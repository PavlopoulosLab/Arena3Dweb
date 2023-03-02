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
    if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS) {
      tempFilteredNetworkDF <- filterPseudoNetworkByLayers(filteredNetworkDF,
                                                           layerName)
    } else {
      tempFilteredNetworkDF <- filterPerLayer(filteredNetworkDF, layerName)
    }
    networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF, subgraphChoice,
                                           layerName)
    applyLayoutWithOptionalClustering(networkGraph)
  }
}

filterPseudoNetworkByLayers <- function(filteredNetworkDF, layerNames) {
  tempNetworkDF1 <-
    filteredNetworkDF[(filteredNetworkDF$SourceLayer %in% layerNames), , drop = F]
  tempNetworkDF1 <- tempNetworkDF1[, c("SourceNode_Layer"), drop = F]
  tempNetworkDF2 <-
    filteredNetworkDF[(filteredNetworkDF$TargetLayer %in% layerNames), , drop = F]
  tempNetworkDF2 <- tempNetworkDF2[, c("TargetNode_Layer"), drop = F]
  colnames(tempNetworkDF2) <- "SourceNode_Layer"
  filteredNetworkDF <- interlinkNodeColumns(tempNetworkDF1, tempNetworkDF2)
  return(filteredNetworkDF)
}

interlinkNodeColumns <- function(df1, df2) {
  df <- rbind(df1, df2)
  if (nrow(df) > 0) {
    df <- unique(df)
    df$TargetNode_Layer <- 
      shiftValuesByOne(df$SourceNode_Layer)
    df$ScaledWeight <- 1
  }
  return(df)
}

shiftValuesByOne <- function(vec) {
  vec <- c("", vec)
  vec[1] <- tail(vec, n = 1)
  vec <- head(vec, -1)
  return(vec)
}

applyLayoutWithOptionalClustering <- function(networkGraph) {
  if (class(networkGraph) == "igraph") {
    if (isClusteringEnabled())
      nodePositions <- calculateClusteredLayout(networkGraph)
    else
      nodePositions <- calculateLayout(networkGraph, input$layoutAlgorithmChoice)
    callJSHandler("handler_layout", nodePositions)
  }
}

calculateLayout <- function(networkGraph, layoutAlgorithm) {
  layoutFunc <- getLayoutFunction(layoutAlgorithm)
  nodePositions <-
    eval(parse(text = paste0("igraph::", layoutFunc, "(networkGraph)")))
  nodePositions <- as.data.frame(nodePositions)
  colnames(nodePositions) <- c("y", "z")
  nodePositions$name <- igraph::V(networkGraph)$name
  return(nodePositions)
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
  if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS) {
    filteredNetworkDF <- filterPseudoNetworkByLayers(filteredNetworkDF,
                                                         selectedLayerNames)
  } else {
    filteredNetworkDF <- filterAllSelectedLayers(filteredNetworkDF, selectedLayerNames)
  }
  
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
      if (input$layoutAlgorithmChoice %in% NO_EDGE_LAYOUTS) {
        tempFilteredNetworkDF <-
          filterPseudoNetworkByLayersAndNodes(filteredNetworkDF, layerName,
                                              selectedNodeNamesWithLayer)
      } else {
        tempFilteredNetworkDF <- filterPerLayer(filteredNetworkDF, layerName)
      }
      networkGraph <- parseEdgelistIntoGraph(tempFilteredNetworkDF,
                                             subgraphChoice, layerName)
      # map coordinates on local bounds in assignXYZ
      callJSHandler("handler_setLocalFlag", T)
      applyLayoutWithOptionalClustering(networkGraph)
    }
  }
}

filterPseudoNetworkByLayersAndNodes <- function(filteredNetworkDF, layerName,
                                                selectedNodeNamesWithLayer) {
  tempNetworkDF1 <-
    filteredNetworkDF[(filteredNetworkDF$SourceLayer == layerName) &
                        (filteredNetworkDF$SourceNode_Layer %in%
                           selectedNodeNamesWithLayer), , drop = F]
  tempNetworkDF1 <- tempNetworkDF1[, c("SourceNode_Layer"), drop = F]
  tempNetworkDF2 <-
    filteredNetworkDF[(filteredNetworkDF$TargetLayer == layerName) &
                        (filteredNetworkDF$TargetNode_Layer %in%
                           selectedNodeNamesWithLayer), , drop = F]
  tempNetworkDF2 <- tempNetworkDF2[, c("TargetNode_Layer"), drop = F]
  colnames(tempNetworkDF2) <- "SourceNode_Layer"
  filteredNetworkDF <- interlinkNodeColumns(tempNetworkDF1, tempNetworkDF2)
  return(filteredNetworkDF)
}
