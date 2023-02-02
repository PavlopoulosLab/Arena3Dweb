existsNetwork <- function() {
  exist <- T
  saveRDS(inData, "inData.RDS")
  if (nrow(inData) == 0) {
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

isIGraphObjectValid <- function(inDataEdgelist, subgraphChoice, layerName) {
  isValid <- T
  if (nrow(inDataEdgelist) < 2) {
    isValid <- F
    if (subgraphChoice == "allLayers")
      renderWarning(paste0("Subgraph of selected layers cannot form a graph."))
    else
      renderWarning(paste0("Layer ", layerName, " cannot form a graph."))
  }
  return(isValid)
}
