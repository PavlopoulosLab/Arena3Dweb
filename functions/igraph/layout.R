handleLayout <- function() {
  tryCatch({
    if (areValidLayoutInputs()) {
      renderModal("<h2>Please wait.</h2><br /><p>Generating layout.</p>")
      callJSHandler("handler_startLoader", T)
      
      selectedLayerPositions <- input$js_selected_layers + 1 # from JS to R counters
      selectedLayerNames <- input$js_layer_names[selectedLayerPositions]
      subgraphChoice <- input$subgraphChoice
      
      runLayoutAlgorithm(selectedLayerNames, subgraphChoice)
      
      # OLD ####
      # selected_channels <- input$channels_layout
      # js_selected_layers <- as.numeric(input$js_selected_layers) # from JS
      #   layer_group_names <- as.matrix(input$js_layer_names)
      #   if (input$subgraphChoice == "perLayer"){ # PER LAYER
      #     # make separate sub_graphs for each Layer and then run Layout iteratively
      #     for (i in 1:length(js_selected_layers)){
      #       group_name <- layer_group_names[js_selected_layers[i]+1]
      #       if (input$layoutAlgorithmChoice == "Circle" || input$layoutAlgorithmChoice == "Grid" || input$layoutAlgorithmChoice == "Random"){
      #         tempMat <- networkDF[networkDF[, "SourceLayer"] == group_name,, drop = F]
      #         tempMatNodes <- as.matrix(tempMat[, "SourceNode"])
      #         tempMat <- networkDF[networkDF[, "TargetLayer"] == group_name,, drop = F]
      #         if (nrow(tempMat) >= 2){ # igraph cant create graph with only one row (edge)
      #           if (input$clusteringAlgorithmChoice != "-"){
      #             if (input$localLayoutAlgorithmChoice != "-"){
      #               applyCluster(tempMat, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
      #             } else
      #               renderWarning("Can't execute Cluster without selected Local Layout.")
      #           } else {
      #             tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "TargetNode"]))
      #             formatAndApplyLayout(tempMatNodes, FALSE)
      #           }
      #         }  else
      #           renderWarning(paste0("Layer ", group_name, " could not form a graph."))
      #       } else {
      #         networkEdgelist <- networkDF[networkDF[, "SourceLayer"] == group_name,, drop=F]
      #         networkEdgelist <- networkEdgelist[networkEdgelist[, "TargetLayer"] == group_name,, drop=F]
      #         if (nrow(networkEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
      #           networkEdgelist <- checkAndFilterSelectedChannels(networkEdgelist, selected_channels)
      #           if (nrow(networkEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
      #             if (input$clusteringAlgorithmChoice != "-"){
      #               if (input$localLayoutAlgorithmChoice != "-"){
      #                 applyCluster(networkEdgelist, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
      #               } else
      #                 renderWarning("Can't execute Cluster without selected Local Layout.")
      #             } else {
      #               sub_graph <- createGraph(networkEdgelist) # V(graph)
      #               sub_nodes <- V(sub_graph)$name # unsorted
      #               sub_weights <- E(sub_graph)$weight # != networkEdgelist[, 3]
      #               applyLayout(sub_graph, sub_nodes, sub_weights)
      #             }
      #           } else
      #             renderWarning(paste0("Layer ", group_name, " could not form a graph."))
      #         } else 
      #           renderWarning(paste0("Layer ", group_name, " could not form a graph."))
      #       }
      #     }
      #   } else if (input$subgraphChoice == "allLayers"){ # ALL LAYERS
      #     # make a combined sub_graph for each Layer and then run Layout iteratively
      #     networkEdgelist <- matrix("", ncol = ncol(networkDF), nrow = 0)
      #     groups <- layer_group_names[js_selected_layers + 1, ]
      #     for (i in 1:nrow(networkDF)){
      #       if ((!is.na(match(networkDF[i, "SourceLayer"], groups))) && (!is.na(match(networkDF[i, "TargetLayer"], groups))))
      #         networkEdgelist <- rbind(networkEdgelist, networkDF[i,])
      #     }
      #     if (nrow(networkEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
      #       if (input$layoutAlgorithmChoice == "Circle" || input$layoutAlgorithmChoice == "Grid" || input$layoutAlgorithmChoice == "Random"){
      #         if (input$clusteringAlgorithmChoice != "-"){
      #           if (input$localLayoutAlgorithmChoice != "-"){
      #             applyCluster(networkEdgelist, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
      #           } else
      #             renderWarning("Can't execute Cluster without selected Local Layout.")
      #         } else {
      #           tempMatNodes <- rbind(networkEdgelist[,"SourceNode"], networkEdgelist[,"TargetNode"])
      #           formatAndApplyLayout(tempMatNodes, FALSE)
      #         }
      #       } else {
      #         networkEdgelist <- checkAndFilterSelectedChannels(networkEdgelist, selected_channels)
      #         if (nrow(networkEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
      #           if (input$clusteringAlgorithmChoice != "-"){
      #             if (input$localLayoutAlgorithmChoice != "-"){
      #               applyCluster(networkEdgelist, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
      #             } else
      #               renderWarning("Can't execute Cluster without selected Local Layout.")
      #           } else {
      #             sub_graph <- createGraph(networkEdgelist) # V(graph)
      #             sub_nodes <- V(sub_graph)$name # unsorted
      #             sub_weights <- E(sub_graph)$weight # != networkEdgelist[, 3]
      #             applyLayout(sub_graph, sub_nodes, sub_weights) # execute once, for combined subgraph
      #           }
      #         } else
      #           renderWarning("Subgraph of selected Layers could not form a graph.")
      #       }
      #     } else
      #       renderWarning("Subgraph of selected Layers could not form a graph.")
      #   } 
      #   else { # LOCAL LAYOUTS
      #     selectedNodePositions <- input$js_selectedNodePositions
      #     if (length(selectedNodePositions) > 0){ # can't run local layouts without selected nodes
      #       whole_node_names <- input$js_node_names
      #       for (i in 1:length(js_selected_layers)){
      #         group_name <- layer_group_names[js_selected_layers[i]+1]
      #         #Find  edges and nodes in case we need clustering 
      #         tempMat <- networkDF[networkDF[, "SourceLayer"] == group_name,, drop = F]
      #         tempMat <- tempMat[tempMat[, "TargetLayer"] == group_name,, drop = F] 
      #         #First filter selected Channels if exist  
      #         if("Channel" %in% colnames(networkDF)) {
      #           networkEdgelist <- matrix("", nrow = 0, ncol = 4)
      #           colnames(networkEdgelist) <- c("SourceNode", "TargetNode", "Weight", "Channel")
      #           networkEdgelist <- networkEdgelist[networkEdgelist[, "Channel"] == selected_channels,, drop = F]
      #         } else {
      #           networkEdgelist <- matrix("", nrow = 0, ncol = 3)
      #           colnames(networkEdgelist) <- c("SourceNode", "TargetNode", "Weight")
      #         }  
      #         #If we have more than one selected node filter the nodes that we want 
      #         if (nrow(tempMat) > 1){
      #           for (j in 1:nrow(tempMat)){
      #             if("Channel" %in% colnames(networkDF)) {
      #               if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selectedNodePositions+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selectedNodePositions+1])))){
      #                 networkEdgelist <- rbind(networkEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"],  tempMat[j, "Channel"]))
      #               }
      #             } else {
      #               if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selectedNodePositions+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selectedNodePositions+1])))){
      #                 networkEdgelist <- rbind(networkEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"]))
      #               }
      #             }
      #           }
      #         }  else
      #           renderWarning(paste0("Layer ", group_name, " could not form a graph."))
      #         
      #         if (input$layoutAlgorithmChoice == "Circle" || input$layoutAlgorithmChoice == "Grid" || input$layoutAlgorithmChoice == "Random"){
      #           tempMatNodes <- matrix("", nrow = 0, ncol = 1)
      #           # for these 3 simple layouts, just find selected node names in selected layers
      #           tempMat1 <- networkDF[networkDF[, "SourceLayer"] == group_name,, drop = F]
      #           tempMat2 <- networkDF[networkDF[, "TargetLayer"] == group_name,, drop = F]
      #           
      #           
      #           for (j in 1:length(selectedNodePositions)){
      #             tempMat <- tempMat1[tempMat1[, "SourceNode"] == whole_node_names[selectedNodePositions[j]+1],, drop = F]
      #             tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "SourceNode"]))
      #             tempMat <- tempMat2[tempMat2[, "TargetNode"] == whole_node_names[selectedNodePositions[j]+1],, drop = F]
      #             tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "TargetNode"]))
      #           }
      #           tempMatNodes <- unique(tempMatNodes)
      #           if ((nrow(tempMatNodes) >= 2 )){
      #             if (input$clusteringAlgorithmChoice != "-"){
      #               if (input$localLayoutAlgorithmChoice != "-"){
      #                 applyCluster(networkEdgelist, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
      #               } else
      #                 renderWarning("Can't execute Cluster without selected Local Layout.")
      #             } else {
      #               formatAndApplyLayout(tempMatNodes, TRUE)
      #             }
      #           } else
      #             renderWarning(paste0("Layer ", group_name, " could not form a graph."))
      #         } else {
      #           # for the rest of the layouts, use selected edges and nodes
      #           if (nrow(networkEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
      #             if (input$clusteringAlgorithmChoice != "-"){
      #               if (input$localLayoutAlgorithmChoice != "-"){
      #                 applyCluster(networkEdgelist, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
      #               } else
      #                 renderWarning("Can't execute Cluster without selected Local Layout.")
      #             } else {
      #               formatAndApplyLayout(networkEdgelist, TRUE)
      #             }
      #           } else
      #             renderWarning(paste0("Layer ", group_name, " could not form a graph."))
      #         }
      #       }
      #     } else
      #       renderWarning("Can't execute Local Layouts without selected Nodes.")
      #   }
      
    }
  }, error = function(e) {
    print(paste0("Error on layout or clustering: ", e))
    renderError("Error on layout or clustering algorithm.")
  }, finally = {
    removeModal()
    callJSHandler("handler_finishLoader", T)
  })
}

areValidLayoutInputs <- function() {
  areValid <- F
  if (existsNetwork())
    if (isLayoutAlgorithmSelected())
      if (existsSelectedLayer())
        areValid <- T
  return(areValid)
}

isLayoutAlgorithmSelected <- function() {
  isSelected <- T
  if (input$layoutAlgorithmChoice == "-") {
    isSelected <- F
    renderWarning("Please, select a layout algorithm.")
  }
  return(isSelected)
}

runLayoutAlgorithm <- function(selectedLayerNames, subgraphChoice) {
  filteredNetworkDF <- filterSelectedChannels(networkDF)
  
  if (nrow(filteredNetworkDF) > 0) {
    set.seed(123)
    switch(
      subgraphChoice,
      "perLayer" = runPerLayerLayout(filteredNetworkDF, selectedLayerNames,
                                     subgraphChoice),
      "allLayers" = runAllLayersLayout(filteredNetworkDF, selectedLayerNames,
                                       subgraphChoice),
      "nodesPerLayers" = runLocalLayout(filteredNetworkDF, selectedLayerNames,
                                        subgraphChoice)
    )
  }
}

runPerLayerLayout <- function(filteredNetworkDF, selectedLayerNames,
                              subgraphChoice) {
  for (layerName in selectedLayerNames) {
    if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS) {
      tempFilteredNetworkDF <- filterUserSelectedPseudoNetwork(filteredNetworkDF,
                                                           layerName)
    } else {
      tempFilteredNetworkDF <- filterPerLayer(filteredNetworkDF, layerName)
    }
    networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF, subgraphChoice,
                                           layerName)
    applyLayoutWithOptionalClustering(networkGraph)
  }
}

filterUserSelectedPseudoNetwork <- function(filteredNetworkDF, layerName) {
  tempNetworkDF1 <-
    filteredNetworkDF[(filteredNetworkDF$SourceLayer == layerName), , drop = F]
  tempNetworkDF1 <- tempNetworkDF1[, c("SourceNode_Layer"), drop = F]
  tempNetworkDF2 <-
    filteredNetworkDF[(filteredNetworkDF$TargetLayer == layerName), , drop = F]
  tempNetworkDF2 <- tempNetworkDF2[, c("TargetNode_Layer"), drop = F]
  colnames(tempNetworkDF2) <- "SourceNode_Layer"
  filteredNetworkDF <- rbind(tempNetworkDF1, tempNetworkDF2)
  filteredNetworkDF <- unique(filteredNetworkDF)
  filteredNetworkDF$TargetNode_Layer <- 
    shiftValuesByOne(filteredNetworkDF$SourceNode_Layer)
  filteredNetworkDF$ScaledWeight <- 1
  return(filteredNetworkDF)
}

shiftValuesByOne <- function(vec) {
  vec <- c("", vec)
  vec[1] <- tail(vec, n = 1)
  vec <- head(vec, -1)
  return(vec)
}

applyLayoutWithOptionalClustering <- function(networkGraph) {
  if (class(networkGraph) == "igraph") {
    # if (isClusteringAlgorithmSelected()) # TODO
    #if (input$clusteringAlgorithmChoice != "-"){
    #               if (input$localLayoutAlgorithmChoice != "-"){
    #   applyCluster(networkGraph, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
    # else
    #   formatAndApplyLayout(networkGraph, TRUE)
    calculateLayout(networkGraph) # this is else, TODO remove comment
  }
}

calculateLayout <- function(networkGraph) {
  layoutAlgorithmChoice <- input$layoutAlgorithmChoice
  
  nodePositions <- switch(
    layoutAlgorithmChoice,
    "Circle" = igraph::layout_in_circle(networkGraph),
    "Grid" = igraph::layout_on_grid(networkGraph),
    "Random" = igraph::layout_randomly(networkGraph),
    "Fruchterman-Reingold" = igraph::layout_with_fr(networkGraph),
    "Reingold-Tilford" = igraph::layout_as_tree(networkGraph),
    "DrL" = igraph::layout_with_drl(networkGraph),
    "Graphopt" = igraph::layout_with_graphopt(networkGraph),
    "Kamada-Kawai" = igraph::layout_with_kk(networkGraph),
    "Large Graph Layout" = igraph::layout_with_lgl(networkGraph),
    "Multidimensional Scaling" = igraph::layout_with_mds(networkGraph),
    "Sugiyama" = igraph::layout_with_sugiyama(networkGraph)$layout
  )
  
  nodePositions <- as.data.frame(nodePositions)
  colnames(nodePositions) <- c("y", "z")
  nodePositions$name <- igraph::V(networkGraph)$name
  callJSHandler("handler_layout", nodePositions)
}

runAllLayersLayout <- function(filteredNetworkDF, selectedLayerNames,
                               subgraphChoice) {
  # if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS) {
  #   filteredNetworkDF <- filterUserSelectedPseudoNetwork(layerName) # TODO all layers here
  # } else {
    filteredNetworkDF <- filterAllSelectedLayers(filteredNetworkDF, selectedLayerNames)
  # }
  
  networkGraph <- parseEdgelistIntoGraph(filteredNetworkDF, subgraphChoice,
                                         layerName)
  applyLayoutWithOptionalClustering(networkGraph)
}

runLocalLayout <- function(filteredNetworkDF, selectedLayerNames,
                           subgraphChoice) {
  # if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS) {
  #   filteredNetworkDF <- filterUserSelectedPseudoNetwork(layerName) # TODO all layers here
  # } else {
    selectedNodePositions <- input$js_selectedNodePositions + 1 # JS to R iterator
    if (existSelectedNodes(selectedNodePositions)) {
      nodeNamesWithLayer <- input$js_node_names
      selectedNodeNamesWithLayer <- nodeNamesWithLayer[selectedNodePositions]
      for (layerName in selectedLayerNames) {
        tempFilteredNetworkDF <- filterPerLayer(filteredNetworkDF, layerName)
        tempFilteredNetworkDF <- filterPerSelectedNodes(tempFilteredNetworkDF,
                                                    selectedNodeNamesWithLayer)
        networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF,
                                               subgraphChoice, layerName)
        applyLayoutWithOptionalClustering(networkGraph)
      }
    }
  #}
}

# OLD ####
# @param tempMatNodes():
# @param localBoundflag(boolean): flag that send the setLocalFlag used only @ local layouts 
formatAndApplyLayout <- function(tempMatNodes, localBoundflag) {
  # tempMatNodes <- unique(tempMatNodes)
  # sub_graph <- make_ring(length(tempMatNodes))
  # V(sub_graph)$name <- tempMatNodes
  # sub_nodes <- V(sub_graph)$name
  # sub_weights <- E(sub_graph)$weight
  
  if (localBoundflag == TRUE) {
    callJSHandler("handler_setLocalFlag", T) # this tells js to map coordinates on local bounds in assignXYZ
  } # TODO check if else F is needed here
  
  # applyLayout(sub_graph, sub_nodes, sub_weights)
}
