callJSHandler <- function(handlerName, handlerFunctionParameter) {
  session$sendCustomMessage(handlerName, handlerFunctionParameter)
}

# used to trim user input data
trim <- function (x) {
  x <- gsub("^\\s+|\\s+$", "", x)
  x <- gsub(",", "", x)
  return(x)
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

reset_UI_values <- function(){
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
  reset("selectLayout")
  reset("selectCluster")
  reset("selectLocalLayout")
  shinyjs::hide("selectLocalLayout")
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
