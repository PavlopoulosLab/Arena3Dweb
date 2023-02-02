handleTopologyScaling <- function() {
  tryCatch({
    if (areValidTopologyScalingInputs()) {
      renderModal("<h2>Please wait.</h2><br /><p>Rescaling nodes.</p>")
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
  if (input$topologyScale == "-") {
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
    inDataEdgelist <- inData[inData[, "SourceLayer"] == layerName, , drop=F ]
    inDataEdgelist <-
      inDataEdgelist[inDataEdgelist[, "TargetLayer"] == layerName, , drop=F ]
    parseAndScaleEdgelist(inDataEdgelist, subgraphChoice, layerName)
  }
}

parseAndScaleEdgelist <- function(inDataEdgelist, subgraphChoice, layerName) {
  if (isIGraphObjectValid(inDataEdgelist, subgraphChoice, layerName)) {
    inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
    sub_graph <- createGraph(inDataEdgelist)
    sub_nodes <- V(sub_graph)$name
    sub_weights <- E(sub_graph)$weight
    scaleTopology(sub_graph, sub_nodes, sub_weights)
  }
}

scaleTopology <- function(sub_graph, sub_nodes, sub_weights){
  callJSHandler("handler_startLoader", T)
  set.seed(123)
  if (input$topologyScale == "Degree"){
    scaleByDegree(sub_graph, sub_nodes)
  } else if (input$topologyScale == "Clustering Coefficient"){
    scaleByTransitivity(sub_graph, sub_nodes, sub_weights)
  } else if (input$topologyScale == "Betweenness Centrality"){
    scaleByBetweenness(sub_graph, sub_nodes, sub_weights)
  }
  callJSHandler("handler_finishLoader", T)
  return(TRUE)
}

scaleByDegree <- function(sub_graph, sub_nodes){
  topology <- degree(sub_graph, v = V(sub_graph), mode = "all",
                     loops = FALSE, normalized = FALSE)
  nodes_scale <- cbind(as.matrix(sub_nodes), topology)
  callJSHandler("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
}

scaleByTransitivity <- function(sub_graph, sub_nodes, sub_weights){
  topology <- transitivity(sub_graph, type = "local", vids = NULL,
                           weights = sub_weights, isolates = "zero")
  nodes_scale <- cbind(as.matrix(sub_nodes), topology)
  callJSHandler("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
}

scaleByBetweenness <- function(sub_graph, sub_nodes, sub_weights){
  topology <- betweenness(sub_graph, v = V(sub_graph), directed = FALSE, weights = sub_weights,
                          nobigint = TRUE, normalized = FALSE)
  nodes_scale <- cbind(as.matrix(sub_nodes), topology)
  callJSHandler("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
}

runAllLayersScaling <- function(selectedLayerNames, subgraphChoice) {
  inDataEdgelist <- matrix("", ncol = length(colnames(inData)), nrow = 0)
  for (i in 1:nrow(inData)){
    if ((!is.na(match(inData[i, "SourceLayer"], selectedLayerNames))) &&
        (!is.na(match(inData[i, "TargetLayer"], selectedLayerNames))))
      inDataEdgelist <- rbind(inDataEdgelist, inData[i,])
  }
  parseAndScaleEdgelist(inDataEdgelist, subgraphChoice, layerName)
}

runLocalScaling <- function(selectedLayerNames, subgraphChoice) {
  selected_nodes <- input$js_selected_nodes # TODO per layer check
  if(length(selected_nodes) > 0){
    whole_node_names <- input$js_node_names
    for (layerName in selectedLayerNames){
      tempMat <- inData[inData[, "SourceLayer"] == layerName, , drop = F]
      tempMat <- tempMat[tempMat[, "TargetLayer"] == layerName, , drop = F]
      inDataEdgelist <- matrix("", nrow = 0, ncol = 3)
      colnames(inDataEdgelist) <- c("SourceNode", "TargetNode", "Weight")
      if (nrow(tempMat) > 1){
        for (j in 1:nrow(tempMat)){
          if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selected_nodes+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selected_nodes+1])))){
            inDataEdgelist <- rbind(inDataEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"]))
          }
        }
        parseAndScaleEdgelist(inDataEdgelist, subgraphChoice, layerName)
      } else
        renderWarning(paste("Layer ", layerName, " could not form a graph."))
    }
  } else
    renderWarning("Can't execute Local Layouts without selected Nodes.")
}
