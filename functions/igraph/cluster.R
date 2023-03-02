handleClusterAlgorithmSelection <- function() {
  tryCatch({
    if (input$clusteringAlgorithmChoice != "-") { # triggers second event when resetting
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
  clusteringResults <- switch(
    input$clusteringAlgorithmChoice,
    "Louvain" = igraph::cluster_louvain(networkGraph),
    "Walktrap" = igraph::cluster_walktrap(networkGraph),
    "Fast Greedy" = igraph::cluster_fast_greedy(networkGraph),
    "Label Propagation" = igraph::cluster_label_prop(networkGraph)
  )
  
  assignedClusters <- data.frame()
  for (i in 1:length(clusteringResults)) {
    assignedClusters <- rbind(assignedClusters, cbind(i, paste(clusteringResults[[i]], collapse = ", ")))
  }
  colnames(assignedClusters) <- c("Annotations", "Nodes")
  renderClusteringDF(assignedClusters)
  return(assignedClusters)
}

getLayoutFunction <- function(layout_name) {
  layoutFunction <- switch(
    layout_name,
    "Reingold-Tilford" = "layout_as_tree",
    "Circle" = "layout_in_circle",
    "Grid" = "layout_on_grid",
    "Random" = "layout_randomly",
    "Davidson-Harel" = "layout_with_dh",
    "DrL" = "layout_with_drl",
    "Fruchterman-Reingold" = "layout_with_fr",
    "GEM" = "layout_with_gem",
    "Graphopt" = "layout_with_graphopt",
    "Kamada-Kawai" = "layout_with_kk",
    "Large Graph Layout" = "layout_with_lgl",
    "Multidimensional Scaling" = "layout_with_mds",
    "Sugiyama" = "layout_with_sugiyama",
  )
  return(layoutFunction)
}

# Strategy 3 ####
execute_strategy3_superNodes_strictPartitioning <- function(
    networkGraph, assignedClusters, globalLayoutFunc, localLayoutFunc,
    repeling_force = 3) {
  subNetwork <- convertGraphToDF(networkGraph) # TODO check for Circle layouts etc
  expandedGroups <- assignedClusters %>% tidyr::separate_rows(Nodes, sep = ", ")
  subNetworkWithGroups <- appendClusters(subNetwork, expandedGroups)
  groupsGraph <- extractGroupsGraph(subNetworkWithGroups)
  
  

  # TODO continue form here
  lay_super <- eval(parse(text = paste0("igraph::", globalLayoutFunc, "(groupsGraph)")))
  
  if (identical(typeof(lay_super), "double")) { # most layout algorithms
    lay_super <- cbind(lay_super, names(igraph::V(groupsGraph)))
  } else{ # Sugiyama, list instead of double
    lay_super <- cbind(lay_super$layout, names(igraph::V(groupsGraph)))
  }
  
  # 3. push all nodes above away from 0,0 // also check minx maxx for layout as alternative
  # foreach node, calculate a = y/x
  # then multiply x by an input number n (e.g.) and solve for y
  # keep the (x, y) coords system in a matrix for all supernodes
  lay_super <- as.data.frame(lay_super)
  lay_super$V1 <- as.numeric(lay_super$V1)
  lay_super$V2 <- as.numeric(lay_super$V2)
  lay_super$a <- ifelse(lay_super$V1 != 0, lay_super$V2 / lay_super$V1, lay_super$V2 / 0.01)
  lay_super$X <- repeling_force * lay_super$V1
  lay_super$Y <- lay_super$a * lay_super$X
  lay_super <- lay_super[, c('X', 'Y', 'V3')]
  colnames(lay_super)[3] <- 'Node'
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
    if ('layout_with_kk' == globalLayoutFunc) igraph::E(temp_g)$weight <- min_weight * repeling_force
    else igraph::E(temp_g)$weight <- min_weight / repeling_force # * 1.0001 # invisible weight = max network value *2
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
      
      groupX <- lay_super[lay_super[, 3] == group, 1]
      groupY <- lay_super[lay_super[, 3] == group, 2]
      temp_lay[, 1] <- as.numeric(temp_lay[, 1]) + groupX
      temp_lay[, 2] <- as.numeric(temp_lay[, 2]) + groupY
      lay <- rbind(lay, temp_lay)
    } else {
      lay <- rbind(lay, c(lay_super[lay_super[, 3] == group, 1],
                          lay_super[lay_super[, 3] == group, 2],
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
