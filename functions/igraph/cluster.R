handleClusterAlgorithmSelection <- function() {
  tryCatch({
    if (input$selectCluster != "-") { # triggers second event when resetting
      shinyjs::show("selectLocalLayout")
    } else {
      shinyjs::hide("selectLocalLayout")
    }
  }, error = function(e) {
    print(paste0("Error in clustering algorithm selection: ", e))
    renderError("Unexpected error on cluster interface.")
  })
}

# @param clusters (communities list): output from igraph clustering algorithms such as louvain
# we are using $membership and $names form this clusters object
# @return annotations (2-col character dataframe): col1 clustering groups, col2 comma separated members per group
parseClusterData <- function(clusters){
  clusters$membership <- as.character(clusters$membership)
  groups <- unique(clusters$membership)
  annotations <- matrix(, nrow=0, ncol=2)
  for (i in 1:length(groups)){
    annotations <- rbind(annotations, c(groups[i], paste(clusters$names[which(clusters$membership %in% groups[i])], collapse=',')))
  }
  return(as.data.frame(annotations))
}

# @param cluster_name (string): string name from UI
# @return cluster_function_name (string): cluster name needed for stategy3_superNodes 
getFormatedClusterString <- function(cluster_name) {
  if (cluster_name == "Louvain"){
    return('cluster_louvain')
  } else if (cluster_name == "Walktrap"){
    return('cluster_walktrap')
  } else if (cluster_name == "Edge Betweenness"){
    return('cluster_edge_betweenness')
  } else if (cluster_name == "Fast Greedy"){
    return('cluster_fast_greedy')
  } else if (cluster_name == "Label Propagation"){
    return('cluster_label_prop')
  } 
}

# @param inDataEdgelist (dataframe): Dataframe with edges 
# @param layout (character): Layout needed for stategy3_superNodes functions 
# @param local_layout (character): Local Layout needed for stategy3_superNodes functions 
# @param cluster (character): Cluster needed for stategy3_superNodes functions 
# @return void
applyCluster <- function(inDataEdgelist, layout, local_layout, cluster){
  callJSHandler("handler_startLoader", T)
  formatted_layout <- getFormatedLayoutString(layout)
  formatted_local_layout <- getFormatedLayoutString(local_layout)
  formatted_cluster <- getFormatedClusterString(cluster)
  sub_graph <- createGraph(inDataEdgelist) # V(graph)
  sub_nodes <- V(sub_graph)$name # unsorted
  sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
  # if(cluster == 'Leiden') {
  #   clustered_graph <- cluster_leiden(sub_graph,resolution_parameter=0.06)
  # } else {
  clustered_graph <- eval(parse(text = paste0(formatted_cluster, "(sub_graph)")))
  # }
  annotations <- parseClusterData(clustered_graph)
  colnames(annotations) <- c('Annotations', 'Nodes')
  layout_coords <- strategy3_superNodes(sub_graph, annotations, formatted_layout, formatted_local_layout,3)
  nodes_layout <- cbind(layout_coords$network_nodes, layout_coords$lay)
  nodes_layout <-  as.matrix(merge(nodes_layout, layout_coords$groups_expanded, by.x = 1, by.y = "Nodes"))
  callJSHandler("handler_layout", nodes_layout)
  callJSHandler("handler_finishLoader", T)
  # reset("selectCluster")
  # reset("selectLayout")
  # reset("selectLocalLayout")
}

# Function for Layouts with superNodes per Annotation Group
# @param g(igraph obj): the selected network
# @param groups(dataframe): the selected annotation file -> names and respective nodes
# @param layout(string): the user-selected layout choice
# @param local_layout(string): the user-selected layout choice for in-group layouts
# @param repeling_force(int): the user-selected repeling force
# @return lay (2d double matrix): the layout coordinates
# @return network_nodes (character vector): the proper order of nodes(names) to correctly attach to canvas
strategy3_superNodes <- function(g, groups, layout, local_layout, repeling_force){
  lay <- NULL
  network_nodes <- NULL
  if (!(is.null(g) || is.null(groups))){
    set.seed(123)
    # network
    E(g)$Weight <- 1
    my_network <- as.data.frame(get.edgelist(g))
    my_network <- cbind(my_network, as.double(E(g)$Weight))
    colnames(my_network) <- c('Source', 'Target', 'Weight')
    network_nodes <- unique(c(my_network$Source, my_network$Target))
    # annotations
    groups_expanded <- groups %>% separate_rows(Nodes, sep=",")
    groups_expanded <- groups_expanded[which(groups_expanded$Nodes %in% network_nodes), ] # removing non-existing nodes
    noGroupNodes <- network_nodes[!(network_nodes %in% groups_expanded$Nodes)]
    # 1. create dataframe of one supernode per group plus no-group nodes
    # Source Target -> swap all nodes with their respective Group Name(s)
    # if multiple groups per node, add the extra edges
    # e.g. Group1+2Node - noGroupNode -> Group1 - noGroupNode, Group2 - noGroupNode
    # merge my_network with groups_expanded two times ( Source - Nodes, Target - Nodes)
    # where annotations not NA, swap Source or Target with respective Group Name
    superFrame <- merge(my_network, groups_expanded, by.x = 'Source', by.y = 'Nodes', all.x = T)
    superFrame <- merge(superFrame, groups_expanded, by.x = 'Target', by.y = 'Nodes', all.x = T)
    graphFrame <- superFrame # keeping this for later on
    graphFrame$Source[!is.na(graphFrame$Annotations.x)] <- graphFrame$Annotations.x[!is.na(graphFrame$Annotations.x)]
    graphFrame$Target[!is.na(graphFrame$Annotations.y)] <- graphFrame$Annotations.y[!is.na(graphFrame$Annotations.y)]
    graphFrame <- graphFrame[, c('Source', 'Target', 'Weight')]
    # 2. create graph and apply layout on this compound supernode network
    temp_g <- graph_from_data_frame(graphFrame, directed = F)
    E(temp_g)$weight <- as.numeric(graphFrame$Weight)
    temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "max")
    lay_super <- eval(parse(text = paste0(layout, "(temp_g)")))
    # lay_super <- layout_with_fr(temp_g)
    # plot(temp_g, layout = lay_super)
    
    if (identical(typeof(lay_super), "double")){ # most layout algorithms
      lay_super <- cbind(lay_super, names(V(temp_g)))
    } else{ # Sugiyama, list instead of double
      lay_super <- cbind(lay_super$layout, names(V(temp_g)))
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
    # extra edges dataframe for all groups
    extra_edges <- merge(groups_expanded, groups_expanded, by.x = "Annotations", by.y = "Annotations")
    lay <- matrix(, nrow = 0, ncol = 3)

    for (group in unique(groups_expanded$Annotations)){
      tempFrame <- superFrame
      tempFrame <- tempFrame[(tempFrame$Annotations.x == group & tempFrame$Annotations.y == group), ]
      tempFrame <- tempFrame[!is.na(tempFrame$Source) & !is.na(tempFrame$Target), ]
      tempFrame <- tempFrame[, c('Source', 'Target', 'Weight')]
      
      # create any missing in-group edges with minimum weight
      # (all against all in same groups that do not already exist in tempFrame)
      temp_extra_edges <- extra_edges[extra_edges$Annotations == group, ]
      temp_g <- graph_from_data_frame(temp_extra_edges[, c(2,3)], directed = F)
      min_weight <- ifelse(identical(min(tempFrame$Weight), Inf), 1, min(tempFrame$Weight))
      # Kamada kawai 
      if ('layout_with_kk' == layout) E(temp_g)$weight <- min_weight * repeling_force
      else  E(temp_g)$weight <- min_weight / repeling_force # * 1.0001 # invisible weight = max network value *2
      temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "first")
      temp_extra_edges <- as.data.frame(cbind( get.edgelist(temp_g) , E(temp_g)$weight ))
      colnames(temp_extra_edges) <- c('Source', 'Target', 'Weight')
      
      tempFrame <- rbind(tempFrame, temp_extra_edges)
      
      if (nrow(tempFrame) > 0){
        temp_g <- graph_from_data_frame(tempFrame, directed = F)
        E(temp_g)$weight <- as.numeric(tempFrame$Weight)
        temp_g <- igraph::simplify(temp_g, remove.multiple = T, remove.loops = F, edge.attr.comb = "max")
        # temp_lay <- layout_with_fr(temp_g)
        temp_lay <- eval(parse(text = paste0( local_layout, "(temp_g)")))
        
        # plot(temp_g, layout = temp_lay)
        if (identical(typeof(temp_lay), "double")){ # most layout algorithms
          temp_lay <- cbind(temp_lay, names(V(temp_g)))
        } else{ # Sugiyama, list instead of double
          temp_lay <- cbind(temp_lay$layout, names(V(temp_g)))
        }
        
        groupX <- lay_super[lay_super[,3] == group, 1]
        groupY <- lay_super[lay_super[,3] == group, 2]
        temp_lay[, 1] <- as.numeric(temp_lay[, 1]) + groupX
        temp_lay[, 2] <- as.numeric(temp_lay[, 2]) + groupY
        lay <- rbind(lay, temp_lay)
      } else{
        lay <- rbind(lay, c(lay_super[lay_super[,3] == group, 1],
                            lay_super[lay_super[,3] == group, 2],
                            groups$Nodes[groups$Annotations == group]))
      }
    } # end for

    # 5. calculate coordinates for duplicate nodes
    dflay <- as.data.frame(lay)
    dflay$V1 <- as.numeric(dflay$V1)
    dflay$V2 <- as.numeric(dflay$V2)
    meanX <- aggregate(dflay$V1, by=list(dflay$V3), FUN=mean)
    colnames(meanX) <- c("Node", "X")
    meanY <- aggregate(dflay$V2, by=list(dflay$V3), FUN=mean)
    colnames(meanY) <- c("Node", "Y")
    dflay <- merge(meanX, meanY)
    dflay <- as.matrix(dflay[, c("X", "Y", "Node")])
    # 6. append non-group nodes from lay_super
    lay_noGroupNodes <- lay_super[lay_super[,3] %in% noGroupNodes, ]
    lay <- rbind(dflay, lay_noGroupNodes)
    network_nodes <- lay[, 3]
    
    lay <- cbind(as.numeric(lay[, 1]), as.numeric(lay[, 2]))
  }
  return(list(lay = lay, network_nodes = network_nodes, groups_expanded = groups_expanded))
}
