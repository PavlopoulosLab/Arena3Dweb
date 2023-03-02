callJSHandler <- function(handlerName, handlerFunctionParameter) {
  session$sendCustomMessage(handlerName, handlerFunctionParameter)
}

readFromTableFileToDataFrame <- function(path) {
  df <- switch(
    READ_LIBRARY,
    "fread" = data.table::fread(path),
    "base" = read.delim(path, header = T)
  )
  return(df)
}

mapper <- function(inArr, min, max, defaultValue = DEFAULT_MAP_VALUE){
  outArr <- inArr
  inArr_min <- min(inArr)
  inArr_max <- max(inArr)
  if (inArr_max - inArr_min != 0) {
    for (i in 0:length(inArr)){
      outArr[i] <- (inArr[i] - inArr_min) * (max - min) / (inArr_max - inArr_min) + min;
    }
  } else outArr[] <- defaultValue;
  return(outArr);
}

extractColumnFrom_node_layerDF <- function(nodeLayerNames, column) { # column = Node or Layer
  nodeLayerNames <- as.data.frame(nodeLayerNames)
  colnames(nodeLayerNames)[1] <- "NodeLayer"
  nodeLayerNames <- plyr::join(nodeLayerNames, node_layerDF, type = "left",
                               by = "NodeLayer")
  return(nodeLayerNames[[column]])
}
