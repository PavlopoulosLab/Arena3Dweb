handleTopologyScaling <- function() {
  tryCatch({
    if (areValidTopologyScalingInputs()) {
      renderModal("<h2>Please wait.</h2><br /><p>Rescaling nodes.</p>")
      
      
      # ===================
      selected_layers <- as.numeric(input$selected_layers)
      layer_group_names <- as.matrix(input$js_layer_names)
      if (input$sub_graphChoice == "perLayer"){
        # make separate sub_graphs for each Layer and then run Layout iteratively
        for (i in 1:length(selected_layers)){
          group_name <- layer_group_names[selected_layers[i]+1] # +1, since layers start from 0 in js
          inDataEdgelist <- inData[inData[, "SourceLayer"] == group_name,,drop=F ]
          inDataEdgelist <- inDataEdgelist[inDataEdgelist[, "TargetLayer"] == group_name,,drop=F ]
          if ( nrow(inDataEdgelist) >= 2 ){ # igraph cant create graph with only one row (edge)
            inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
            sub_graph <- createGraph(inDataEdgelist) # V(graph)
            sub_nodes <- V(sub_graph)$name # unsorted
            sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
            scaleTopology(sub_graph, sub_nodes, sub_weights)
          } else
            renderWarning(paste0("Layer ", group_name, " could not form a graph."))
        }
      } else if(input$sub_graphChoice == "allLayers") {
        # make a combined sub_graph for each Layer and then run Layout iteratively
        inDataEdgelist <- matrix("", ncol = length(colnames(inData)), nrow = 0)
        groups <- layer_group_names[selected_layers + 1, ]
        for (i in 1:nrow(inData)){
          if ((!is.na(match(inData[i, "SourceLayer"], groups))) && (!is.na(match(inData[i, "TargetLayer"], groups))))
            inDataEdgelist <- rbind(inDataEdgelist, inData[i,])
        }
        if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
          inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
          sub_graph <- createGraph(inDataEdgelist) # V(graph)
          sub_nodes <- V(sub_graph)$name # unsorted
          sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
          scaleTopology(sub_graph, sub_nodes, sub_weights)
        } else
          renderWarning(paste0("Subgraph of selected Layerss could not form a graph."))
      } else{ # local layouts
        selected_nodes <- input$js_selected_nodes
        if(length(selected_nodes) > 0){
          whole_node_names <- input$js_node_names
          for (i in 1:length(selected_layers)){
            group_name <- layer_group_names[selected_layers[i]+1]
            tempMat <- inData[inData[, "SourceLayer"] == group_name,, drop = F]
            tempMat <- tempMat[tempMat[, "TargetLayer"] == group_name,, drop = F]
            inDataEdgelist <- matrix("", nrow = 0, ncol = 3)
            colnames(inDataEdgelist) <- c("SourceNode", "TargetNode", "Weight")
            if (nrow(tempMat) > 1){
              for (j in 1:nrow(tempMat)){
                if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selected_nodes+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selected_nodes+1])))){
                  inDataEdgelist <- rbind(inDataEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"]))
                }
              }
              if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                sub_graph <- createGraph(inDataEdgelist) # V(graph)
                sub_nodes <- V(sub_graph)$name # unsorted
                sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                scaleTopology(sub_graph, sub_nodes, sub_weights)
              } else
                renderWarning(paste("Layer ", group_name, " could not form a graph."))
            } else
              renderWarning(paste("Layer ", group_name, " could not form a graph."))
          }
        } else
          renderWarning("Can't execute Local Layouts without selected Nodes.")
      }
    }

    # ===================
    
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
