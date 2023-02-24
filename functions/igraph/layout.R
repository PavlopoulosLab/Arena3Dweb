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
  switch(
    subgraphChoice,
    "perLayer" = runPerLayerLayout(selectedLayerNames, subgraphChoice),
    "allLayers" = runAllLayersLayout(selectedLayerNames, subgraphChoice),
    "nodesPerLayers" = runLocalLayout(selectedLayerNames, subgraphChoice)
  )
}

runPerLayerLayout <- function(selectedLayerNames, subgraphChoice) {
  for (layerName in selectedLayerNames) {
    # TODO create filter function for below, ADD channels if exist, call from topology as well
    filteredNetworkDF <-
      networkDF[(networkDF$SourceLayer == layerName) &
                  (networkDF$TargetLayer == layerName), , drop = F]
    networkGraph <- parseEdgelistIntoGraph(filteredNetworkDF, subgraphChoice,
                                           layerName)
    applyLayoutWithOptionalClustering(networkGraph)
    #if (input$clusteringAlgorithmChoice != "-"){
      #               if (input$localLayoutAlgorithmChoice != "-"){
  }
}

parseEdgelistIntoGraph <- function(filteredNetworkDF, subgraphChoice, layerName) {
  networkGraph <- ""
  if (isIGraphObjectValid(filteredNetworkDF, subgraphChoice, layerName)) {
    networkEdgelist <- filteredNetworkDF[, c("SourceNode_Layer",
                                             "TargetNode_Layer", "ScaledWeight")]
    networkGraph <- createGraph(networkEdgelist)
  }
  return(networkGraph)
}

applyLayoutWithOptionalClustering <- function(networkGraph) {
  if (class(networkGraph) == "igraph") {
    # if (isClusteringAlgorithmSelected()) # TODO
    #   applyCluster(networkGraph, input$layoutAlgorithmChoice, input$localLayoutAlgorithmChoice, input$clusteringAlgorithmChoice)
    # else
    #   formatAndApplyLayout(networkGraph, TRUE)
    calculateLayout(networkGraph)
  }
  print("TODO. Finished.")
}

calculateLayout <- function(networkGraph) {
  layoutAlgorithmChoice <- input$layoutAlgorithmChoice
  
  nodePositions <- switch(
    layoutAlgorithmChoice,
    "Fruchterman-Reingold" = {
      layout <- layout_with_fr(networkGraph)
      # cbind(as.matrix(sub_nodes), layout) # TODO bind node names to coords
    }
  )
  
  callJSHandler("handler_topologyScale", nodePositions)
}

runAllLayersLayout <- function(selectedLayerNames, subgraphChoice) {
  print("TODO. Not yet coded.")
}

runLocalLayout <- function(selectedLayerNames, subgraphChoice) {
  print("TODO. Not yet coded.")
}

# OLD ####
# @param tempMatNodes():
# @param localBoundflag(boolean): flag that send the setLocalFlag used only @ local layouts 
formatAndApplyLayout <- function(tempMatNodes, localBoundflag) {
  tempMatNodes <- unique(tempMatNodes)
  sub_graph <- make_ring(length(tempMatNodes))
  V(sub_graph)$name <- tempMatNodes
  sub_nodes <- V(sub_graph)$name
  sub_weights <- E(sub_graph)$weight
  if (localBoundflag == TRUE) {
    callJSHandler("handler_setLocalFlag", T) # this tells js to map coordinates on local bounds in assignXYZ
  }
  applyLayout(sub_graph, sub_nodes, sub_weights)
}

checkAndFilterSelectedChannels <- function(networkEdgelist, selected_channels) {
  if("Channel" %in% colnames(networkEdgelist) && !is.null(selected_channels) ) {
    networkEdgelist <- as.data.frame(networkEdgelist)
    networkEdgelist <- networkEdgelist[networkEdgelist$Channel %in% selected_channels,]
  } 
  networkEdgelist <- as.matrix(networkEdgelist[, c("SourceNode", "TargetNode", "Weight")])
  return(networkEdgelist)
}

# @param layout_name (string): string name from UI
# @return layout_function_name (string): layout name needed for stategy3_superNodes 
getFormatedLayoutString <- function(layout_name) {
  if (layout_name == "Reingold-Tilford"){
    return('layout_as_tree')
  } else if (layout_name == "Circle"){
    return('layout_in_circle')
  } else if (layout_name == "Grid"){
    return('layout_on_grid')
  } else if (layout_name == "Random"){
    return('layout_randomly')
  } else if (layout_name == "Davidson-Harel"){
    return('layout_with_dh')
  } else if (layout_name == "DrL"){
    return('layout_with_drl')
  } else if (layout_name == "Fruchterman-Reingold"){
    return('layout_with_fr')
  } else if (layout_name == "GEM"){
    return('layout_with_gem')
  } else if (layout_name == "Graphopt"){
    return('layout_with_graphopt')
  } else if (layout_name == "Kamada-Kawai"){
    return('layout_with_kk')
  } else if (layout_name == "Large Graph Layout"){
    return('layout_with_lgl')
  } else if (layout_name == "Multidimensional Scaling"){
    return('layout_with_mds')
  } else if (layout_name == "Sugiyama"){
    return('layout_with_sugiyama')
  }
}

# layout algorithms
apply_layout_as_tree <- function(sub_graph, sub_nodes){
  layout <- layout_as_tree(sub_graph, root = numeric(), circular = FALSE,
                           rootlevel = numeric(), mode = "all", flip.y = TRUE)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_in_circle <- function(sub_graph, sub_nodes){
  layout <- layout_in_circle(sub_graph, order = V(sub_graph))
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_on_grid <- function(sub_graph, sub_nodes){
  layout <- layout_on_grid(sub_graph, width = 0, height = 0, dim = 2)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_randomly <- function(sub_graph, sub_nodes){
  layout <- layout_randomly(sub_graph, dim = 2)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_dh <- function(sub_graph, sub_nodes){
  layout <- layout_with_dh(sub_graph, coords = NULL, maxiter = 10, fineiter = max(10, log2(vcount(sub_graph))), cool.fact = 0.75, weight.node.dist = 1,
                           weight.border = 0, weight.edge.lengths = edge_density(sub_graph)/10,
                           weight.edge.crossings = 1 - sqrt(edge_density(sub_graph)),
                           weight.node.edge.dist = 0.2 * (1 - edge_density(sub_graph)))
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_drl <- function(sub_graph, sub_nodes){
  layout <- layout_with_drl(sub_graph, use.seed = FALSE,
                            seed = matrix(runif(vcount(sub_graph) * 2), ncol = 2),
                            options = drl_defaults$default, weights = E(sub_graph)$weight,
                            fixed = NULL, dim = 2)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_fr <- function(sub_graph, sub_nodes){ # this looks bad with weights
  layout <- layout_with_fr(sub_graph, coords = NULL, dim = 2, niter = 500,
                           start.temp = sqrt(vcount(sub_graph)), grid = c("auto", "grid", "nogrid"),
                           weights = NULL, minx = NULL, maxx = NULL, miny = NULL,
                           maxy = NULL, minz = NULL, maxz = NULL)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_gem <- function(sub_graph, sub_nodes){
  layout <- layout_with_gem(sub_graph, coords = NULL, maxiter = 40 * vcount(sub_graph)^2,
                            temp.max = vcount(sub_graph), temp.min = 1/10,
                            temp.init = sqrt(vcount(sub_graph)))
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_graphopt <- function(sub_graph, sub_nodes){
  layout <- layout_with_graphopt(sub_graph, start = NULL, niter = 500,
                                 charge = 0.001, mass = 30, spring.length = 0,
                                 spring.constant = 1, max.sa.movement = 5)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_kk <- function(sub_graph, sub_nodes, sub_weights){
  layout <- layout_with_kk(sub_graph, dim = 2, weights = sub_weights)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_lgl <- function(sub_graph, sub_nodes){
  layout <- layout_with_lgl(sub_graph, maxiter = 150, maxdelta = vcount(sub_graph),
                            coolexp = 1.5, root = NULL)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_mds <- function(sub_graph, sub_nodes){
  layout <- layout_with_mds(sub_graph, dist = NULL, dim = 2, options = arpack_defaults)
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

apply_layout_with_sugiyama <- function(sub_graph, sub_nodes){ # bad with weights
  layout <- layout_with_sugiyama(sub_graph, layers = NULL, hgap = 1, vgap = 1,
                                 maxiter = 100, weights = NULL, attributes = c("default", "all", "none"))$layout
  nodes_layout <- cbind(as.matrix(sub_nodes),layout)
  callJSHandler("handler_layout", nodes_layout) # send to JS to refresh Layout
  return(TRUE)
}

applyLayout <- function(sub_graph, sub_nodes, sub_weights){
  callJSHandler("handler_startLoader", T)
  set.seed(123)
  if (input$layoutAlgorithmChoice == "Reingold-Tilford"){
    done <- apply_layout_as_tree(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Circle"){
    done <- apply_layout_in_circle(sub_graph, sub_nodes)
    # } else if (input$layoutAlgorithmChoice == "Nicely"){
    #   done <- apply_layout_nicely(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Grid"){
    done <- apply_layout_on_grid(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Random"){
    done <- apply_layout_randomly(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Davidson-Harel"){
    done <- apply_layout_with_dh(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "DrL"){
    done <- apply_layout_with_drl(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Fruchterman-Reingold"){
    done <- apply_layout_with_fr(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "GEM"){
    done <- apply_layout_with_gem(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Graphopt"){
    done <- apply_layout_with_graphopt(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Kamada-Kawai"){
    done <- apply_layout_with_kk(sub_graph, sub_nodes, sub_weights)
  } else if (input$layoutAlgorithmChoice == "Large Graph Layout"){
    done <- apply_layout_with_lgl(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Multidimensional Scaling"){
    done <- apply_layout_with_mds(sub_graph, sub_nodes)
  } else if (input$layoutAlgorithmChoice == "Sugiyama"){
    done <- apply_layout_with_sugiyama(sub_graph, sub_nodes)
  }
  callJSHandler("handler_finishLoader", T)
  # reset("layoutAlgorithmChoice")
  return(TRUE)
}
