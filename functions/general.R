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

reset_UI_values <- function() {
  reset("showLabels") #shinyjs resetting checkboxes
  reset("showSelectedLabels")
  reset("showSelectedLayerLabels")
  reset("showLayerLabels")
  reset("resizeLabels")
  reset("showLayerCoords")
  reset("nodeSelectedColorPriority")
  reset("edgeSelectedColorPriority")
  reset("edgeFileColorPriority")
  reset("edgeDirectionToggle")
  reset("showWireFrames")
  reset("layerColorFilePriority")
  shinyjs::hide("layerColorFilePriority")
  reset("showSceneCoords")
  reset("autoRotateScene")
  reset("layerEdgeOpacity")
  shinyjs::hide("layerEdgeOpacity")
  reset("interLayerEdgeOpacity")
  shinyjs::hide("interLayerEdgeOpacity")
  reset("floorOpacity")
  reset("selectAll")
  reset("topologyScaleMetricChoice")
  reset("layoutAlgorithmChoice")
  reset("clusteringAlgorithmChoice")
  reset("localLayoutAlgorithmChoice")
  shinyjs::hide("localLayoutAlgorithmChoice")
  reset("nodeSelector")
  reset("edgeWidthByWeight")
  reset("fps")
  reset("predefined_layout")
  reset("directionArrowSize")
  shinyjs::hide("directionArrowSize")
  shinyjs::hide("intraDirectionArrowSize")
  reset("channelCurvature")
  shinyjs::hide("channelCurvature")
  reset("interChannelCurvature")
  shinyjs::hide("interChannelCurvature") 
}

extractColumnFrom_node_layerDF <- function(nodeLayerNames, column) { # column = Node or Layer
  nodeLayerNames <- as.data.frame(nodeLayerNames)
  colnames(nodeLayerNames)[1] <- "NodeLayer"
  nodeLayerNames <- plyr::join(nodeLayerNames, node_layerDF, type = "left",
                               by = "NodeLayer")
  return(nodeLayerNames[[column]])
}
