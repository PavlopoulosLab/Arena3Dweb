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
  
  nodes_layout <- 
    execute_strategy3_superNodes_strictPartitioning(
      networkGraph, assignedClusters, globalLayoutFunc, localLayoutFunc)
  return(nodes_layout)
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
  superNodeCoords <- extractSuperNodeCoords(groupsGraph, globalLayoutFunc,
                                            repelling_force)
  
  
  # 4. foreach group, add low-weight within group edges and
  # apply layout (2nd input choice) with the respective (x,y) coords system
  # extra edges dataframe for all assignedClusters
  extra_edges <- merge(expandedGroups, expandedGroups, by.x = "Annotations", by.y = "Annotations")
  lay <- matrix(, nrow = 0, ncol = 3)
  
  for (group in unique(expandedGroups$Annotations)){
    tempFrame <- subNetworkWithGroups
    tempFrame <- tempFrame[(tempFrame$SourceGroup == group & tempFrame$TargetGroup == group), ]
    tempFrame <- tempFrame[!is.na(tempFrame$Source) & !is.na(tempFrame$Target), ]
    tempFrame <- tempFrame[, c('Source', 'Target', 'weight')]
    
    # create any missing in-group edges with minimum weight
    # (all against all in same assignedClusters that do not already exist in tempFrame)
    temp_extra_edges <- extra_edges[extra_edges$Annotations == group, ]
    temp_g <- igraph::graph_from_data_frame(temp_extra_edges[, c(2,3)], directed = F)
    min_weight <- ifelse(identical(min(tempFrame$weight), Inf), 1, min(tempFrame$weight))
    # Kamada kawai 
    if ('layout_with_kk' == globalLayoutFunc) igraph::E(temp_g)$weight <- min_weight * repelling_force
    else igraph::E(temp_g)$weight <- min_weight / repelling_force # * 1.0001 # invisible weight = max network value *2
    temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "first")
    temp_extra_edges <- as.data.frame(cbind(igraph::get.edgelist(temp_g) , igraph::E(temp_g)$weight ))
    colnames(temp_extra_edges) <- c('Source', 'Target', 'weight')
    
    tempFrame <- rbind(tempFrame, temp_extra_edges)
    
    if (nrow(tempFrame) > 0){
      temp_g <- igraph::graph_from_data_frame(tempFrame, directed = F)
      igraph::E(temp_g)$weight <- as.numeric(tempFrame$weight)
      temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "max")
      temp_lay <- eval(parse(text = paste0("igraph::", localLayoutFunc, "(temp_g)")))
      
      if (identical(typeof(temp_lay), "double")){ # most layout algorithms
        temp_lay <- cbind(temp_lay, names(igraph::V(temp_g)))
      } else{ # Sugiyama, list instead of double
        temp_lay <- cbind(temp_lay$layout, names(igraph::V(temp_g)))
      }
      
      groupX <- superNodeCoords[superNodeCoords$superNode == group, ]$x
      groupY <- superNodeCoords[superNodeCoords$superNode == group, ]$y
      temp_lay[, 1] <- as.numeric(temp_lay[, 1]) + groupX
      temp_lay[, 2] <- as.numeric(temp_lay[, 2]) + groupY
      lay <- rbind(lay, temp_lay)
    } else {
      lay <- rbind(lay, c(superNodeCoords[superNodeCoords$superNode == group, ]$x,
                          superNodeCoords[superNodeCoords$superNode == group, ]$y,
                          assignedClusters$Nodes[assignedClusters$Annotations == group]))
    }
  } # end for
  
  # 5. calculate coordinates for duplicate nodes
  dflay <- as.data.frame(lay)
  dflay$V1 <- as.numeric(dflay$V1)
  dflay$V2 <- as.numeric(dflay$V2)
  meanX <- aggregate(dflay$V1, by = list(dflay$V3), FUN = mean)
  colnames(meanX) <- c("Node", "X")
  meanY <- aggregate(dflay$V2, by = list(dflay$V3), FUN = mean)
  colnames(meanY) <- c("Node", "Y")
  dflay <- merge(meanX, meanY)
  dflay <- as.matrix(dflay[, c("X", "Y", "Node")])
  network_nodes <- dflay[, 3]
  dflay <- cbind(as.numeric(dflay[, 1]), as.numeric(dflay[, 2]))
  
  
  # wrap up
  nodes_layout <- cbind(network_nodes, dflay)
  nodes_layout <- as.matrix(merge(nodes_layout, expandedGroups,
                                  by.x = 1, by.y = "Nodes"))
  colnames(nodes_layout) <- c("name", "y", "z", "group")
  nodes_layout <- as.data.frame(nodes_layout)
  return(nodes_layout)
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

extractSuperNodeCoords <- function(groupsGraph, globalLayoutFunc, repelling_force) {
  superNodeCoords <- eval(parse(text = paste0("igraph::", globalLayoutFunc, "(groupsGraph)")))
  
  if (globalLayoutFunc == "layout_with_sugiyama")
    superNodeCoords <- cbind(superNodeCoords$layout, names(igraph::V(groupsGraph)))
  else
    superNodeCoords <- cbind(superNodeCoords, names(igraph::V(groupsGraph)))
  superNodeCoords <- as.data.frame(superNodeCoords)
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
