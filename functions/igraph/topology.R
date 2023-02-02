handleTopologyScaling <- function() {
  tryCatch({
    if (areValidTopologyScalingInputs()) {
      renderModal("<h2>Please wait.</h2><br /><p>Rescaling nodes.</p>")
      callJSHandler("handler_startLoader", T)
      
      selectedLayerPositions <- input$js_selected_layers + 1 # from JS to R counters
      selectedLayerNames <- input$js_layer_names[selectedLayerPositions]
      subgraphChoice <- input$subgraphChoice
      
      runTopologyScaling(selectedLayerNames, subgraphChoice)
    }
  }, error = function(e) {
    print(paste0("Error in topological scaling: ", e))
    renderError("Unexpected topological scaling error.")
  }, finally = {
    removeModal()
    callJSHandler("handler_finishLoader", T)
  })
}

areValidTopologyScalingInputs <- function() {
  areValid <- F
  if (existsNetwork())
    if (isTopologyMetricSelected())
      if (existsSelectedLayer())
        areValid <- T
  return(areValid)
}

isTopologyMetricSelected <- function() {
  isSelected <- T
  if (input$topologyScaleMetricChoice == "-") {
    isSelected <- F
    renderWarning("Please, select a topology metric.")
  }
  return(isSelected)
}

runTopologyScaling <- function(selectedLayerNames, subgraphChoice) {
  switch(
    subgraphChoice,
    "perLayer" = runPerLayerScaling(selectedLayerNames, subgraphChoice),
    "allLayers" = runAllLayersScaling(selectedLayerNames, subgraphChoice),
    "nodesPerLayers" = runLocalScaling(selectedLayerNames, subgraphChoice)
  )
}

runPerLayerScaling <- function(selectedLayerNames, subgraphChoice) {
  for (layerName in selectedLayerNames) {
    filteredNetworkDF <-
      networkDF[(networkDF[, "SourceLayer"] == layerName) &
                  (networkDF[, "TargetLayer"] == layerName), , drop = F]
    parseAndScaleEdgelist(filteredNetworkDF, subgraphChoice, layerName)
  }
}

parseAndScaleEdgelist <- function(filteredNetworkDF, subgraphChoice, layerName) {
  if (isIGraphObjectValid(filteredNetworkDF, subgraphChoice, layerName)) {
    networkEdgelist <- filteredNetworkDF[, c("SourceNode", "TargetNode", "Weight")]
    networkGraph <- createGraph(networkEdgelist)
    scaleTopology(networkGraph)
  }
}

scaleTopology <- function(networkGraph) {
  scale <- switch(
    input$topologyScaleMetricChoice,
    "Degree" =
      degree(networkGraph, v = V(networkGraph), mode = "all", loops = T,
             normalized = F),
    "Clustering Coefficient" = {
      scale <- transitivity(networkGraph, type = "weighted", vids = NULL,
                            weights = NULL, isolates = "zero") # NULL == E(networkGraph)$weight
      names(scale) <- V(networkGraph)$name
      scale
    },
    "Betweenness Centrality" = 
      betweenness(networkGraph, v = V(networkGraph),
                  directed = input$edgeDirectionToggle, weights = NULL, # NULL == E(networkGraph)$weight
                  normalized = F) 
  )
  nodeScale <- calculateNodeScaleDF(scale)
  nodeScale$scale <- mapper(nodeScale$scale,
                            TARGET_NODE_SCALE_MIN, TARGET_NODE_SCALE_MAX)
  callJSHandler("handler_topologyScale", nodeScale)
}

calculateNodeScaleDF <- function(scale) {
  nodeScale <- as.data.frame(scale)
  nodeScale$nodeName <- rownames(nodeScale)
  rownames(nodeScale) <- NULL
  nodeScale <- nodeScale[, c("nodeName", "scale")]
  return(nodeScale)
}

runAllLayersScaling <- function(selectedLayerNames, subgraphChoice) {
  networkEdgelist <- matrix("", ncol = length(colnames(networkDF)), nrow = 0)
  for (i in 1:nrow(networkDF)){
    if ((!is.na(match(networkDF[i, "SourceLayer"], selectedLayerNames))) &&
        (!is.na(match(networkDF[i, "TargetLayer"], selectedLayerNames))))
      networkEdgelist <- rbind(networkEdgelist, networkDF[i,])
  }
  parseAndScaleEdgelist(networkEdgelist, subgraphChoice, layerName)
}

runLocalScaling <- function(selectedLayerNames, subgraphChoice) {
  selected_nodes <- input$js_selected_nodes # TODO per layer check
  if(length(selected_nodes) > 0){
    whole_node_names <- input$js_node_names
    for (layerName in selectedLayerNames){
      tempMat <- networkDF[networkDF[, "SourceLayer"] == layerName, , drop = F]
      tempMat <- tempMat[tempMat[, "TargetLayer"] == layerName, , drop = F]
      networkEdgelist <- matrix("", nrow = 0, ncol = 3)
      colnames(networkEdgelist) <- c("SourceNode", "TargetNode", "Weight")
      if (nrow(tempMat) > 1){
        for (j in 1:nrow(tempMat)){
          if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selected_nodes+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selected_nodes+1])))){
            networkEdgelist <- rbind(networkEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"]))
          }
        }
        parseAndScaleEdgelist(networkEdgelist, subgraphChoice, layerName)
      } else
        renderWarning(paste("Layer ", layerName, " could not form a graph."))
    }
  } else
    renderWarning("Can't execute Local Layouts without selected Nodes.")
}
