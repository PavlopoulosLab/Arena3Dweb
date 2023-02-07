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
      networkDF[(networkDF$SourceLayer == layerName) &
                  (networkDF$TargetLayer == layerName), , drop = F]
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
  topologyMetricChoice <- input$topologyScaleMetricChoice
  
  scale <- switch(
    topologyMetricChoice,
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
  prepareMetricTable(topologyMetricChoice, nodeScale)
  nodeScale$scale <- mapper(nodeScale$scale,
                            TARGET_NODE_SCALE_MIN, TARGET_NODE_SCALE_MAX,
                            defaultValue = 1)
  callJSHandler("handler_topologyScale", nodeScale)
}

prepareMetricTable <- function(topologyMetricChoice, nodeScale) {
  colnames(nodeScale) <- c("Node", topologyMetricChoice)
  nodeScale <-
    nodeScale[order(-nodeScale[[topologyMetricChoice]]), ]
  nodeScale[[topologyMetricChoice]] <-
    format(round(nodeScale[[topologyMetricChoice]], 2))
  metric <- switch(
    topologyMetricChoice,
    "Degree" = "degree",
    "Clustering Coefficient" = "transitivity",
    "Betweenness Centrality" = "betweenness"
  )
  renderMetricTable(topologyMetricChoice, nodeScale, metric)
}

calculateNodeScaleDF <- function(scale) {
  nodeScale <- as.data.frame(scale)
  nodeScale$nodeName <- rownames(nodeScale)
  rownames(nodeScale) <- NULL
  nodeScale <- nodeScale[, c("nodeName", "scale")]
  return(nodeScale)
}

runAllLayersScaling <- function(selectedLayerNames, subgraphChoice) {
  filteredNetworkDF <-
    networkDF[(networkDF$SourceLayer %in% selectedLayerNames) &
                (networkDF$TargetLayer %in% selectedLayerNames), , drop = F]
  parseAndScaleEdgelist(filteredNetworkDF, subgraphChoice, layerName)
}

runLocalScaling <- function(selectedLayerNames, subgraphChoice) {
  selectedNodePositions <- input$js_selectedNodePositions + 1 # JS to R iterator
  if (existSelectedNodes(selectedNodePositions)) {
    nodeNamesWithLayer <- input$js_node_names
    selectedNodeNamesWithLayer <- nodeNamesWithLayer[selectedNodePositions]
    for (layerName in selectedLayerNames) {
      filteredNetworkDF <-
        networkDF[(networkDF$SourceLayer == layerName) &
                    (networkDF$TargetLayer == layerName) &
                    (networkDF$SourceNode %in% selectedNodeNamesWithLayer) &
                    (networkDF$TargetNode %in% selectedNodeNamesWithLayer), , drop = F]
      parseAndScaleEdgelist(filteredNetworkDF, subgraphChoice, layerName)
    }
  }
}

existSelectedNodes <- function(selectedNodePositions) {
  exist <- T
  if (length(selectedNodePositions) == 0) {
    exist <- F
    renderWarning("Cannot execute local layouts without selected nodes.")
  }
  return(exist)
}
