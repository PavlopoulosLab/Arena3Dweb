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
  subNetwork <- convertGraphToDF(networkGraph) # TODO check for Circle layouts etc
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
  subNetwork <- as.data.frame(igraph::get.edgelist(networkGraph))
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

calculateNodeCoordsPerCluster <- function(expandedGroups, subNetworkWithGroups,
                                          superNodeCoords, globalLayoutFunc,
                                          localLayoutFunc, repelling_force) {
  # Foreach group, add low-weight within group edges and
  # apply local layout on the respective (x,y) superNode coords system

  extra_edges <- merge(expandedGroups, expandedGroups,
                       by.x = "Annotations", by.y = "Annotations")

  nodeCoords <- do.call(rbind, lapply(unique(expandedGroups$Annotations), function(group) {
    tempNetwork <- subNetworkWithGroups
    tempNetwork <- tempNetwork[(tempNetwork$SourceGroup == group & 
                                  tempNetwork$TargetGroup == group), ]
    tempNetwork <- tempNetwork[, c('Source', 'Target', 'weight')]
    
    # TODO continue from here
    # create any missing in-group edges with minimum weight
    # (all against all in same assignedClusters that do not already exist in tempNetwork)
    temp_extra_edges <- extra_edges[extra_edges$Annotations == group, ]
    temp_g <- igraph::graph_from_data_frame(temp_extra_edges[, c(2,3)], directed = F)
    min_weight <- ifelse(identical(min(tempNetwork$weight), Inf), 1, min(tempNetwork$weight))
    # Kamada kawai 
    if ('layout_with_kk' == globalLayoutFunc)
      igraph::E(temp_g)$weight <- min_weight * repelling_force
    else
      igraph::E(temp_g)$weight <- min_weight / repelling_force # * 1.0001 # invisible weight = max network value *2
    
    temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "first")
    temp_extra_edges <- as.data.frame(cbind(igraph::get.edgelist(temp_g) , igraph::E(temp_g)$weight ))
    colnames(temp_extra_edges) <- c('Source', 'Target', 'weight')
    
    
    tempNetwork <- rbind(tempNetwork, temp_extra_edges)
    
    
    temp_g <- igraph::graph_from_data_frame(tempNetwork, directed = F)
    igraph::E(temp_g)$weight <- as.numeric(tempNetwork$weight)
    temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "max")
    
    tempCoords <- eval(parse(text = paste0("igraph::", localLayoutFunc, "(temp_g)")))
    tempCoords <- bindNamesToLayout(localLayoutFunc, tempCoords, temp_g)
    colnames(tempCoords) <- c("x", "y", "Nodes")
    
    groupX <- superNodeCoords[superNodeCoords$superNode == group, ]$x
    groupY <- superNodeCoords[superNodeCoords$superNode == group, ]$y
    tempCoords$x <- as.numeric(tempCoords$x) + groupX
    tempCoords$y <- as.numeric(tempCoords$y) + groupY
    tempCoords # gets rbind
  }))
  
  nodeCoords <- merge(nodeCoords, expandedGroups)
  colnames(nodeCoords) <- c("name", "y", "z", "group")
  return(nodeCoords)
}
