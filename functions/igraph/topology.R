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
  filteredNetworkDF <- filterSelectedChannels(networkDF)
  
  if (nrow(filteredNetworkDF) > 0) {
    switch(
      subgraphChoice,
      "perLayer" = runPerLayerScaling(filteredNetworkDF, selectedLayerNames,
                                      subgraphChoice),
      "allLayers" = runAllLayersScaling(filteredNetworkDF, selectedLayerNames,
                                        subgraphChoice),
      "nodesPerLayers" = runLocalScaling(filteredNetworkDF, selectedLayerNames,
                                         subgraphChoice)
    )
  }
}

runPerLayerScaling <- function(filteredNetworkDF, selectedLayerNames,
                               subgraphChoice) {
  for (layerName in selectedLayerNames) {
    tempFilteredNetworkDF <- filterPerLayer(filteredNetworkDF, layerName)
    networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF, subgraphChoice,
                                           layerName)
    scaleTopology(networkGraph)
  }
}

scaleTopology <- function(networkGraph) {
  if (class(networkGraph) == "igraph") {
    topologyMetricChoice <- input$topologyScaleMetricChoice
    
    scale <- switch(
      topologyMetricChoice,
      "Degree" =
        igraph::degree(networkGraph, v = igraph::V(networkGraph), mode = "all", loops = T,
                       normalized = F),
      "Clustering Coefficient" = {
        scale <- igraph::transitivity(networkGraph, type = "weighted", vids = NULL,
                                      weights = NULL, isolates = "zero") # NULL: E(networkGraph)$weight
        names(scale) <- igraph::V(networkGraph)$name
        scale
      },
      "Betweenness Centrality" = 
        igraph::betweenness(networkGraph, v = igraph::V(networkGraph),
                            directed = input$edgeDirectionToggle, weights = NULL, # NULL == E(networkGraph)$weight
                            normalized = F) 
    )
    nodeScale <- calculateNodeScaleDF(scale)
    prepareMetricTable(topologyMetricChoice, nodeScale)
    nodeScale$scale <- mapper(nodeScale$scale,
                              TARGET_NODE_SCALE_MIN, TARGET_NODE_SCALE_MAX,
                              defaultValue = 1)
    callJSHandler("handler_scaleTopology", nodeScale)
  }
}

prepareMetricTable <- function(topologyMetricChoice, nodeScale) {
  colnames(nodeScale) <- c("Node", topologyMetricChoice)
  nodeScale <-
    nodeScale[order(-nodeScale[[topologyMetricChoice]]), ]
  nodeScale[[topologyMetricChoice]] <-
    format(round(nodeScale[[topologyMetricChoice]], 2))
  nodeScale$Layer <- extractColumnFrom_node_layerDF(nodeScale$Node, "Layer")
  nodeScale$Node <- extractColumnFrom_node_layerDF(nodeScale$Node, "Node")
  nodeScale <- nodeScale[, c("Node", "Layer", topologyMetricChoice)]
  
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

runAllLayersScaling <- function(filteredNetworkDF, selectedLayerNames,
                                subgraphChoice) {
  filteredNetworkDF <- filterAllSelectedLayers(filteredNetworkDF, selectedLayerNames)
  networkGraph <- parseEdgelistIntoGraph(filteredNetworkDF, subgraphChoice,
                                         layerName)
  scaleTopology(networkGraph)
}

runLocalScaling <- function(filteredNetworkDF, selectedLayerNames,
                            subgraphChoice) {
  selectedNodePositions <- input$js_selectedNodePositions + 1 # JS to R iterator
  if (existSelectedNodes(selectedNodePositions)) {
    nodeNamesWithLayer <- input$js_node_names
    selectedNodeNamesWithLayer <- nodeNamesWithLayer[selectedNodePositions]
    filterPerSelectedNodes <- filterPerSelectedNodes(filteredNetworkDF,
                                                    selectedNodeNamesWithLayer)
    for (layerName in selectedLayerNames) {
      tempFilteredNetworkDF <- filterPerLayer(filterPerSelectedNodes, layerName)
      networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF,
                                             subgraphChoice, layerName)
      scaleTopology(networkGraph)
    }
  }
}
