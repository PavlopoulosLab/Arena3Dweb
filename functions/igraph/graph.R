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

# @param Edge List 
# @return edgeList
checkAndFilterSelectedChannels <- function(inDataEdgelist, selected_channels) {
  if("Channel" %in% colnames(inDataEdgelist) && !is.null(selected_channels) ) {
    inDataEdgelist <- as.data.frame(inDataEdgelist)
    inDataEdgelist <- inDataEdgelist[inDataEdgelist$Channel %in% selected_channels,]
  } 
  inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
  return(inDataEdgelist)
}
