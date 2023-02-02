existsNetwork <- function() {
  exist <- T
  if (nrow(networkDF) == 0) {
    exist <- F
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
  graph <- graph_from_edgelist(
    as.matrix(edgelist[, c('SourceNode', 'TargetNode')]), directed = F
  )
  E(graph)$weight <- as.double(edgelist[, 'Weight'])
  # if it does not have channels remove multiple edges else not 
  removeMultiple <- is.na(input$channels_layout) 
  # remove loops and multiple edges, simplify sum aggregates same edges
  graph <- simplify(graph, remove.multiple = removeMultiple,
                    remove.loops = F, edge.attr.comb = list(weight = "sum"))
  return(graph)
}