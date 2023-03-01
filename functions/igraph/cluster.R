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
    execute_strategy3_superNodes(networkGraph, assignedClusters,
                                 globalLayoutFunc, localLayoutFunc)
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
    assignedClusters <- rbind(assignedClusters, cbind(i, paste(clusteringResults[[i]], collapse = ",")))
  }
  colnames(assignedClusters) <- c("Annotations", "Nodes")
  
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

execute_strategy3_superNodes <- function(networkGraph, assignedClusters,
                                         globalLayoutFunc, localLayoutFunc,
                                         repeling_force = 3) {
  # TODO check for Circle layouts etc
  
  lay <- NULL
  network_nodes <- NULL
  if (!(is.null(networkGraph) || is.null(assignedClusters))){
    # network
    igraph::E(networkGraph)$weight <- 1
    my_network <- as.data.frame(igraph::get.edgelist(networkGraph))
    my_network <- cbind(my_network, as.double(igraph::E(networkGraph)$weight))
    colnames(my_network) <- c('Source', 'Target', 'Weight')
    network_nodes <- unique(c(my_network$Source, my_network$Target))
    # annotations
    groups_expanded <- assignedClusters %>% separate_rows(Nodes, sep=",")
    groups_expanded <- groups_expanded[which(groups_expanded$Nodes %in% network_nodes), ] # removing non-existing nodes
    noGroupNodes <- network_nodes[!(network_nodes %in% groups_expanded$Nodes)]
    # 1. create dataframe of one supernode per group plus no-group nodes
    # Source Target -> swap all nodes with their respective Group Name(s)
    # if multiple assignedClusters per node, add the extra edges
    # e.g. Group1+2Node - noGroupNode -> Group1 - noGroupNode, Group2 - noGroupNode
    # merge my_network with groups_expanded two times ( Source - Nodes, Target - Nodes)
    # where annotations not NA, swap Source or Target with respective Group Name
    superFrame <- merge(my_network, groups_expanded, by.x = 'Source', by.y = 'Nodes', all.x = T)
    superFrame <- merge(superFrame, groups_expanded, by.x = 'Target', by.y = 'Nodes', all.x = T)
    graphFrame <- superFrame # keeping this for later on
    graphFrame$Source[!is.na(graphFrame$Annotations.x)] <- graphFrame$Annotations.x[!is.na(graphFrame$Annotations.x)]
    graphFrame$Target[!is.na(graphFrame$Annotations.y)] <- graphFrame$Annotations.y[!is.na(graphFrame$Annotations.y)]
    graphFrame <- graphFrame[, c('Source', 'Target', 'Weight')]
    # 2. create graph and apply globalLayoutFunc on this compound supernode network
    temp_g <- igraph::graph_from_data_frame(graphFrame, directed = F)
    igraph::E(temp_g)$weight <- as.numeric(graphFrame$Weight)
    temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "max")
    lay_super <- eval(parse(text = paste0("igraph::", globalLayoutFunc, "(temp_g)")))
    
    if (identical(typeof(lay_super), "double")) { # most layout algorithms
      lay_super <- cbind(lay_super, names(igraph::V(temp_g)))
    } else{ # Sugiyama, list instead of double
      lay_super <- cbind(lay_super$layout, names(igraph::V(temp_g)))
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
    extra_edges <- merge(groups_expanded, groups_expanded, by.x = "Annotations", by.y = "Annotations")
    lay <- matrix(, nrow = 0, ncol = 3)
    
    for (group in unique(groups_expanded$Annotations)){
      tempFrame <- superFrame
      tempFrame <- tempFrame[(tempFrame$Annotations.x == group & tempFrame$Annotations.y == group), ]
      tempFrame <- tempFrame[!is.na(tempFrame$Source) & !is.na(tempFrame$Target), ]
      tempFrame <- tempFrame[, c('Source', 'Target', 'Weight')]
      
      # create any missing in-group edges with minimum weight
      # (all against all in same assignedClusters that do not already exist in tempFrame)
      temp_extra_edges <- extra_edges[extra_edges$Annotations == group, ]
      temp_g <- igraph::graph_from_data_frame(temp_extra_edges[, c(2,3)], directed = F)
      min_weight <- ifelse(identical(min(tempFrame$Weight), Inf), 1, min(tempFrame$Weight))
      # Kamada kawai 
      if ('layout_with_kk' == globalLayoutFunc) igraph::E(temp_g)$weight <- min_weight * repeling_force
      else igraph::E(temp_g)$weight <- min_weight / repeling_force # * 1.0001 # invisible weight = max network value *2
      temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "first")
      temp_extra_edges <- as.data.frame(cbind(igraph::get.edgelist(temp_g) , igraph::E(temp_g)$weight ))
      colnames(temp_extra_edges) <- c('Source', 'Target', 'Weight')
      
      tempFrame <- rbind(tempFrame, temp_extra_edges)
      
      if (nrow(tempFrame) > 0){
        temp_g <- igraph::graph_from_data_frame(tempFrame, directed = F)
        igraph::E(temp_g)$weight <- as.numeric(tempFrame$Weight)
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
    # 6. append non-group nodes from lay_super
    lay_noGroupNodes <- lay_super[lay_super[,3] %in% noGroupNodes, ]
    lay <- rbind(dflay, lay_noGroupNodes)
    network_nodes <- lay[, 3]
    
    lay <- cbind(as.numeric(lay[, 1]), as.numeric(lay[, 2]))
  }
  
  # wrap up
  nodes_layout <- cbind(network_nodes, lay)
  nodes_layout <- as.matrix(merge(nodes_layout, groups_expanded,
                                  by.x = 1, by.y = "Nodes"))
  colnames(nodes_layout) <- c("name", "y", "z", "group")
  nodes_layout <- as.data.frame(nodes_layout)
  return(nodes_layout)
}
