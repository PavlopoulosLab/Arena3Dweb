existsNetwork <- function(silent = F) {
  exist <- T
  if (nrow(networkDF) == 0) {
    exist <- F
    if (!silent)
      renderWarning("Upload/import a network first through the File tab.")
  }
  return(exist)
}

existsSelectedLayer <- function() {
  exist <- T
  if (is.null(input$js_selected_layers)) {
    exist <- F
    renderWarning("Select at least one layer.")
  }
  return(exist)
}

filterSelectedChannels <- function(netData) {
  if ("Channel" %in% colnames(netData)) {
    netData <- netData[(netData$Channel %in% input$channels_layout), , drop = F]
    if (is.null(input$channels_layout))
      renderWarning("Select at least one channel.")
  }
  return(netData)
}

filterPerLayer <- function(netData, layerName) {
  filteredNetworkDF <- netData[(netData$SourceLayer == layerName) &
                                 (netData$TargetLayer == layerName), , drop = F]
  return(filteredNetworkDF)
}

filterAllSelectedLayers <- function(netData, selectedLayerNames) {
  filteredNetworkDF <- 
    netData[(netData$SourceLayer %in% selectedLayerNames) &
              (netData$TargetLayer %in% selectedLayerNames), , drop = F]
  return(filteredNetworkDF)
}

filterPerSelectedNodes <- function(netData, selectedNodeNamesWithLayer) {
  filteredNetworkDF <- 
    netData[(netData$SourceNode_Layer %in% selectedNodeNamesWithLayer) &
              (netData$TargetNode_Layer %in% selectedNodeNamesWithLayer), ,
            drop = F]
  return(filteredNetworkDF)
}

parseEdgelistIntoGraph <- function(filteredNetworkDF, subgraphChoice, layerName) {
  networkGraph <- ""
  if (isIGraphObjectValid(filteredNetworkDF, subgraphChoice, layerName)) {
    networkEdgelist <- filteredNetworkDF[, c("SourceNode_Layer",
                                             "TargetNode_Layer", "ScaledWeight")]
    # distinct, in case multiple rows remained in multi-channel nets
    networkEdgelist <- dplyr::distinct(networkEdgelist, SourceNode_Layer,
                                       TargetNode_Layer, .keep_all = T)
    networkGraph <- createGraph(networkEdgelist)
  }
  return(networkGraph)
}

isIGraphObjectValid <- function(filteredNetworkDF, subgraphChoice, layerName) {
  isValid <- T
  if (nrow(filteredNetworkDF) < 2) {
    isValid <- F
    if (subgraphChoice == "allLayers")
      renderWarning(paste0("Subgraph of selected layers cannot form a graph."))
    else
      renderWarning(paste0("Layer ", layerName, " cannot form a graph."))
  }
  return(isValid)
}

createGraph <- function(edgelist) {
  graph <- igraph::graph_from_data_frame(edgelist, directed = F)
  igraph::E(graph)$weight <- as.double(edgelist[, 'ScaledWeight'])
  # if it does not have channels remove multiple edges else not 
  removeMultiple <- is.na(input$channels_layout) 
  # remove loops and multiple edges, simplify sum aggregates same edges
  graph <- igraph::simplify(graph, remove.multiple = removeMultiple,
                            remove.loops = F, edge.attr.comb = "sum")
  return(graph)
}

existSelectedNodes <- function(selectedNodePositions) {
  exist <- T
  if (length(selectedNodePositions) == 0) {
    exist <- F
    renderWarning("Cannot execute local layouts without selected nodes.")
  }
  return(exist)
}
