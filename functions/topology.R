scaleByDegree <- function(sub_graph, sub_nodes){
  topology <- degree(sub_graph, v = V(sub_graph), mode = "all",
                     loops = FALSE, normalized = FALSE)
  nodes_scale <- cbind(as.matrix(sub_nodes), topology)
  session$sendCustomMessage("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
}

scaleByTransitivity <- function(sub_graph, sub_nodes, sub_weights){
  topology <- transitivity(sub_graph, type = "local", vids = NULL,
                           weights = sub_weights, isolates = "zero")
  nodes_scale <- cbind(as.matrix(sub_nodes), topology)
  session$sendCustomMessage("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
}

scaleByBetweenness <- function(sub_graph, sub_nodes, sub_weights){
  topology <- betweenness(sub_graph, v = V(sub_graph), directed = FALSE, weights = sub_weights,
                          nobigint = TRUE, normalized = FALSE)
  nodes_scale <- cbind(as.matrix(sub_nodes), topology)
  session$sendCustomMessage("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
}

scaleTopology <- function(sub_graph, sub_nodes, sub_weights){
  session$sendCustomMessage("handler_startLoader", T)
  set.seed(123)
  if (input$topologyScale == "Degree"){
    scaleByDegree(sub_graph, sub_nodes)
  } else if (input$topologyScale == "Clustering Coefficient"){
    scaleByTransitivity(sub_graph, sub_nodes, sub_weights)
  } else if (input$topologyScale == "Betweenness Centrality"){
    scaleByBetweenness(sub_graph, sub_nodes, sub_weights)
  }
  session$sendCustomMessage("handler_finishLoader", T)
  reset("topologyScale")
  return(TRUE)
}