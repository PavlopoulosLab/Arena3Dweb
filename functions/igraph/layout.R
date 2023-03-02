handleLayout <- function() {
  tryCatch({
    if (areValidLayoutInputs()) {
      renderModal("<h2>Please wait.</h2><br /><p>Generating layout.</p>")
      callJSHandler("handler_startLoader", T)
      
      selectedLayerPositions <- input$js_selected_layers + 1 # from JS to R counters
      selectedLayerNames <- input$js_layer_names[selectedLayerPositions]
      subgraphChoice <- input$subgraphChoice
      
      runLayoutAlgorithm(selectedLayerNames, subgraphChoice)
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
    if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS)
      tempFilteredNetworkDF <- filterPseudoNetwork(filteredNetworkDF, layerName)
    else
      tempFilteredNetworkDF <- filterPerLayer(filteredNetworkDF, layerName)
    networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF, subgraphChoice,
                                           layerName)
    applyLayoutWithOptionalClustering(networkGraph)
  }
}

filterPseudoNetwork <- function(filteredNetworkDF, layerNames,
                                selectedNodeNamesWithLayer = NULL) {
  tinyWeight <- min(filteredNetworkDF$ScaledWeight) / 100
  
  tempNetwork <- extractSelectedNetworkEdgelist(filteredNetworkDF, layerNames,
                                                selectedNodeNamesWithLayer)
  tempNetworkNodesLinked <- 
    extractSelectedNetworkEdgelistAllLinks(filteredNetworkDF, layerNames,
                                           selectedNodeNamesWithLayer, tinyWeight)
  tempNetwork <- rbind(tempNetwork, tempNetworkNodesLinked)
  colnames(tempNetwork)[3] <- "weight"
  tempGraph <- removeExistingEdges(tempNetwork)
  filteredNetworkDF <- parseGraphIntoPseudoFrame(tempGraph)
  return(filteredNetworkDF)
}

extractSelectedNetworkEdgelist <- function(filteredNetworkDF, layerNames,
                                           selectedNodeNamesWithLayer) {
  if (is.null(selectedNodeNamesWithLayer))
    tempNetwork <- 
      filteredNetworkDF[(filteredNetworkDF$SourceLayer %in% layerNames) &
                          (filteredNetworkDF$TargetLayer %in% layerNames), , drop = F]
  else
    tempNetwork <- 
      filteredNetworkDF[(filteredNetworkDF$SourceLayer %in% layerNames) &
                          (filteredNetworkDF$TargetLayer %in% layerNames) &
                          (filteredNetworkDF$SourceNode %in% selectedNodeNamesWithLayer) &
                          (filteredNetworkDF$TargetNode %in% selectedNodeNamesWithLayer),
                        , drop = F]
  tempNetwork <- tempNetwork[, c("SourceNode_Layer", "TargetNode_Layer",
                                 "ScaledWeight")]
  return(tempNetwork)
}

extractSelectedNetworkEdgelistAllLinks <- function(filteredNetworkDF, layerNames,
                                                   selectedNodeNamesWithLayer,
                                                   tinyWeight) {
  tempNetworkDF1 <-
    extractSelectedLayerNodes(filteredNetworkDF, "Source", layerNames,
                              selectedNodeNamesWithLayer)
  tempNetworkDF2 <-
    extractSelectedLayerNodes(filteredNetworkDF, "Target", layerNames,
                              selectedNodeNamesWithLayer)
  colnames(tempNetworkDF2) <- "SourceNode_Layer"
  tempNetworkNodesLinked <- interlinkNodeColumns(tempNetworkDF1, tempNetworkDF2,
                                                 tinyWeight)
  return(tempNetworkNodesLinked)
}

extractSelectedLayerNodes <- function(filteredNetworkDF, column, layerNames,
                                      selectedNodeNamesWithLayer) {
  if (is.null(selectedNodeNamesWithLayer))
    tempDF <- 
      filteredNetworkDF[(
        filteredNetworkDF[[paste0(column, "Layer")]] %in% layerNames), , drop = F]
  else
    tempDF <- 
      filteredNetworkDF[
        (filteredNetworkDF[[paste0(column, "Layer")]] %in% layerNames) &
          (filteredNetworkDF[[paste0(
            column, "Node_Layer")]] %in% selectedNodeNamesWithLayer), , drop = F]
  tempDF <- tempDF[, c(paste0(column, "Node_Layer")), drop = F]
  return(tempDF)
}

interlinkNodeColumns <- function(df1, df2, tinyWeight) {
  df <- rbind(df1, df2)
  if (nrow(df) > 0) {
    df <- unique(df)
    df$TargetNode_Layer <- 
      shiftValuesByOne(df$SourceNode_Layer)
    df$ScaledWeight <- tinyWeight
  }
  return(df)
}

shiftValuesByOne <- function(vec) {
  vec <- c("", vec)
  vec[1] <- tail(vec, n = 1)
  vec <- head(vec, -1)
  return(vec)
}

removeExistingEdges <- function(networkObject) {
  graphObject <- igraph::graph_from_data_frame(networkObject, directed = F)
  graphObject <- igraph::simplify(graphObject, remove.multiple = T,
                                  remove.loops = F, edge.attr.comb = "max")
  return(graphObject)
}

parseGraphIntoPseudoFrame <- function(tempGraph) {
  filteredNetworkDF <- as.data.frame(igraph::as_edgelist(tempGraph))
  if (nrow(filteredNetworkDF > 0)) {
    filteredNetworkDF$weight <- igraph::E(tempGraph)$weight
    colnames(filteredNetworkDF) <- c('SourceNode_Layer', 'TargetNode_Layer',
                                     'weight')
    colnames(filteredNetworkDF)[3] <- "ScaledWeight"
  }
  return(filteredNetworkDF)
}

applyLayoutWithOptionalClustering <- function(networkGraph) {
  if (class(networkGraph) == "igraph") {
    if (isClusteringEnabled())
      nodeCoords <- calculateClusteredLayout(networkGraph)
    else
      nodeCoords <- calculateLayout(networkGraph, input$layoutAlgorithmChoice)
    callJSHandler("handler_layout", nodeCoords)
  }
}

calculateLayout <- function(networkGraph, layoutAlgorithm) {
  layoutFunc <- getLayoutFunction(layoutAlgorithm)
  nodeCoords <-
    eval(parse(text = paste0("igraph::", layoutFunc, "(networkGraph)")))
  nodeCoords <- as.data.frame(nodeCoords)
  colnames(nodeCoords) <- c("y", "z")
  nodeCoords$name <- igraph::V(networkGraph)$name
  return(nodeCoords)
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
    "Sugiyama" = "layout_with_sugiyama"
  )
  return(layoutFunction)
}

runAllLayersLayout <- function(filteredNetworkDF, selectedLayerNames,
                               subgraphChoice) {
  if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS)
    filteredNetworkDF <- filterPseudoNetwork(filteredNetworkDF, selectedLayerNames)
  else
    filteredNetworkDF <- filterAllSelectedLayers(filteredNetworkDF,
                                                 selectedLayerNames)
  
  networkGraph <- parseEdgelistIntoGraph(filteredNetworkDF, subgraphChoice,
                                         layerName)
  applyLayoutWithOptionalClustering(networkGraph)
}

runLocalLayout <- function(filteredNetworkDF, selectedLayerNames,
                           subgraphChoice) {
  selectedNodePositions <- input$js_selectedNodePositions + 1 # JS to R iterator
  if (existSelectedNodes(selectedNodePositions)) {
    nodeNamesWithLayer <- input$js_node_names
    selectedNodeNamesWithLayer <- nodeNamesWithLayer[selectedNodePositions]
    
    if (!input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS)
      filteredNetworkDF <- filterPerSelectedNodes(filteredNetworkDF,
                                                  selectedNodeNamesWithLayer)
    for (layerName in selectedLayerNames) {
      if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS)
        tempFilteredNetworkDF <-
          filterPseudoNetwork(filteredNetworkDF, layerName,
                              selectedNodeNamesWithLayer)
      else
        tempFilteredNetworkDF <- filterPerLayer(filteredNetworkDF, layerName)
      
      networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF,
                                             subgraphChoice, layerName)
      # map coordinates on local bounds in assignXYZ
      callJSHandler("handler_setLocalFlag", T)
      applyLayoutWithOptionalClustering(networkGraph)
    }
  }
}
