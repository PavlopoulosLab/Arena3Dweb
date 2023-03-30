handleClusterAlgorithmSelection <- function() {
  tryCatch({
    if (input$clusteringAlgorithmChoice != "-") {
      shinyjs::show("localLayoutAlgorithmChoice")
    } else {
      shinyjs::hide("localLayoutAlgorithmChoice")
    }
  }, error = function(e) {
    print(paste0("Error in clustering algorithm selection: ", e))
    renderError("Unexpected error on cluster interface.")
  })
}

isClusteringEnabled <- function() {
  isEnabled <- F
  if (input$clusteringAlgorithmChoice != "-") {
    isEnabled <- T
    if (input$localLayoutAlgorithmChoice == "-") {
      isEnabled <- F
      renderWarning("You need to select a local layout algorithm for the clusters.")
    }
  }
  return(isEnabled)
}

calculateClusteredLayout <- function(networkGraph) {
  assignedClusters <- applyClustering(networkGraph)
  globalLayoutFunc <- getLayoutFunction(input$layoutAlgorithmChoice)
  localLayoutFunc <- getLayoutFunction(input$localLayoutAlgorithmChoice)
  
  nodeCoords <- 
    execute_strategy3_superNodes_strictPartitioning(
      networkGraph, assignedClusters, globalLayoutFunc, localLayoutFunc)
  return(nodeCoords)
}

applyClustering <- function(networkGraph) {
  clusterFunction <- getClusteringFunction(input$clusteringAlgorithmChoice)
  clusteringResults <-
    eval(parse(text = paste0("igraph::", clusterFunction, "(networkGraph)")))
  
  assignedClusters <- data.frame()
  for (i in 1:length(clusteringResults)) {
    assignedClusters <- rbind(assignedClusters, cbind(i, paste(clusteringResults[[i]], collapse = ", ")))
  }
  colnames(assignedClusters) <- c("Annotations", "Nodes")
  renderClusteringDF(assignedClusters)
  callJSHandler("handler_chooseNodeColorPriority", "cluster")
  return(assignedClusters)
}

getClusteringFunction <- function(clustering_name) {
  clusterFunction <- switch(
    clustering_name,
    "Louvain" = "cluster_louvain",
    "Walktrap" = "cluster_walktrap",
    "Fast Greedy" = "cluster_fast_greedy",
    "Label Propagation" = "cluster_label_prop"
  )
  return(clusterFunction)
}

# Strategy 3 ####
execute_strategy3_superNodes_strictPartitioning <- function(
    networkGraph, assignedClusters, globalLayoutFunc, localLayoutFunc,
    repelling_force = 3) {
  subNetwork <- convertGraphToDF(networkGraph)
  expandedGroups <- assignedClusters %>% tidyr::separate_rows(Nodes, sep = ", ")
  subNetworkWithGroups <- appendClusters(subNetwork, expandedGroups)
  groupsGraph <- extractGroupsGraph(subNetworkWithGroups)
  superNodeCoords <- calculateSuperNodeCoords(groupsGraph, globalLayoutFunc,
                                              repelling_force)
  nodeCoords <- calculateNodeCoordsPerCluster(expandedGroups, subNetworkWithGroups,
                                              superNodeCoords, globalLayoutFunc,
                                              localLayoutFunc, repelling_force)
  return(nodeCoords)
}

convertGraphToDF <- function(networkGraph) {
  subNetwork <- as.data.frame(igraph::as_edgelist(networkGraph))
  colnames(subNetwork) <- c('Source', 'Target')
  subNetwork$weight <- igraph::E(networkGraph)$weight
  return(subNetwork)
}

appendClusters <- function(subNetwork, expandedGroups) {
  subNetworkWithGroups <- merge(subNetwork, expandedGroups,
                                by.x = 'Source', by.y = 'Nodes', all.x = T)
  subNetworkWithGroups <- merge(subNetworkWithGroups, expandedGroups,
                                by.x = 'Target', by.y = 'Nodes', all.x = T)
  subNetworkWithGroups <-
    subNetworkWithGroups[, c("Source", "Annotations.x",
                             "Target", "Annotations.y", "weight")]
  colnames(subNetworkWithGroups)[2] <- "SourceGroup"
  colnames(subNetworkWithGroups)[4] <- "TargetGroup"
  return(subNetworkWithGroups)
}

extractGroupsGraph <- function(subNetworkWithGroups) {
  groupsNetwork <- subNetworkWithGroups[, c("SourceGroup", "TargetGroup",
                                            "weight")]
  groupsGraph <- igraph::graph_from_data_frame(groupsNetwork, directed = F)
  groupsGraph <- igraph::simplify(groupsGraph, remove.multiple = T,
                                  remove.loops = F, edge.attr.comb = "mean")
  return(groupsGraph)
}

calculateSuperNodeCoords <- function(groupsGraph, globalLayoutFunc, repelling_force) {
  superNodeCoords <- eval(parse(text = paste0("igraph::", globalLayoutFunc, "(groupsGraph)")))
  superNodeCoords <- bindNamesToLayout(globalLayoutFunc, superNodeCoords,
                                       groupsGraph)
  colnames(superNodeCoords) <- c("x", "y", "superNode")
  
  # The following will repel all super nodes away from 0,0:
  # Foreach node, calculate a = y/x
  # Then multiply x by the repeling force and solve for y
  superNodeCoords$x <- as.double(superNodeCoords$x)
  superNodeCoords$y <- as.double(superNodeCoords$y)
  superNodeCoords$a <- ifelse(superNodeCoords$x != 0, superNodeCoords$y / superNodeCoords$x, superNodeCoords$y / 0.01)
  superNodeCoords$x <- repelling_force * superNodeCoords$x
  superNodeCoords$y <- superNodeCoords$a * superNodeCoords$x
  return(superNodeCoords)
}

bindNamesToLayout <- function(layoutFunc, nodeCoords, graphObject) {
  if (layoutFunc == "layout_with_sugiyama")
    nodeCoords <- cbind(nodeCoords$layout, names(igraph::V(graphObject)))
  else
    nodeCoords <- cbind(nodeCoords, names(igraph::V(graphObject)))
  nodeCoords <- as.data.frame(nodeCoords)
  return(nodeCoords)
}

# Foreach group, add low-weight within group edges and
# apply local layout on the respective (x,y) superNode coords system
calculateNodeCoordsPerCluster <- function(expandedGroups, subNetworkWithGroups,
                                          superNodeCoords, globalLayoutFunc,
                                          localLayoutFunc, repelling_force) {
  interGroupEdges <- merge(expandedGroups, expandedGroups,
                           by.x = "Annotations", by.y = "Annotations")
  tinyWeight <- min(subNetworkWithGroups$weight) / 100
  
  nodeCoords <- do.call(rbind, lapply(
    unique(expandedGroups$Annotations), function(group) {
      groupNetwork <- calculateGroupNetworkWithExistingEdges(subNetworkWithGroups,
                                                             group)
      groupNetworkAllEdges <- 
        calculateGroupNetworkWithAllEdges(interGroupEdges, group, globalLayoutFunc,
                                          tinyWeight, repelling_force)
      groupNetwork <- rbind(groupNetwork, groupNetworkAllEdges)
      groupGraph <- removeExistingEdges(groupNetwork)
      tempCoords <- executeLocalLayout(groupGraph, localLayoutFunc,
                                       superNodeCoords, group)
      # returns tempCoords to rbind
      translateGroupCoords(superNodeCoords, group, tempCoords)
    }))
  
  nodeCoords <- merge(nodeCoords, expandedGroups)
  colnames(nodeCoords) <- c("name", "y", "z", "group")
  return(nodeCoords)
}

calculateGroupNetworkWithExistingEdges <- function(subNetworkWithGroups,
                                                   group) {
  groupNetwork <- subNetworkWithGroups
  groupNetwork <- groupNetwork[(groupNetwork$SourceGroup == group & 
                                groupNetwork$TargetGroup == group), ]
  groupNetwork <- groupNetwork[, c('Source', 'Target', 'weight')]
  return(groupNetwork)
}

calculateGroupNetworkWithAllEdges <- function(interGroupEdges, group,
                                              globalLayoutFunc, tinyWeight,
                                              repelling_force) {
  groupNetworkAllEdges <-
    interGroupEdges[interGroupEdges$Annotations == group, ]
  tempGraph <- igraph::graph_from_data_frame(
    groupNetworkAllEdges[, c("Nodes.x", "Nodes.y")], directed = F)
  
  if (globalLayoutFunc == 'layout_with_kk')
    igraph::E(tempGraph)$weight <- tinyWeight * repelling_force
  else
    igraph::E(tempGraph)$weight <- tinyWeight / repelling_force
  
  tempGraph <- igraph::simplify(tempGraph, remove.multiple = T,
                                remove.loops = T, edge.attr.comb = "first")
  groupNetworkAllEdges <- as.data.frame(igraph::as_edgelist(tempGraph))
  groupNetworkAllEdges$weight <- igraph::E(tempGraph)$weight
  colnames(groupNetworkAllEdges) <- c('Source', 'Target', 'weight')
  return(groupNetworkAllEdges)
}

executeLocalLayout <- function(groupGraph, localLayoutFunc, superNodeCoords,
                               group) {
  tempCoords <- eval(parse(text = paste0("igraph::", localLayoutFunc, "(groupGraph)")))
  tempCoords <- bindNamesToLayout(localLayoutFunc, tempCoords, groupGraph)
  colnames(tempCoords) <- c("x", "y", "Nodes")
  tempCoords$x <- as.double(tempCoords$x)
  tempCoords$y <- as.double(tempCoords$y)
  return(tempCoords) 
}

translateGroupCoords <- function(superNodeCoords, group, tempCoords) {
  groupX <- superNodeCoords[superNodeCoords$superNode == group, ]$x
  groupY <- superNodeCoords[superNodeCoords$superNode == group, ]$y
  tempCoords$x <- tempCoords$x + groupX
  tempCoords$y <- tempCoords$y + groupY
  return(tempCoords) # gets rbind
}
