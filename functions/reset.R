reset_UI_values <- function() {
  hideDataMetricTabs()
  # scene
  reset("toggleSceneCoords")
  reset("autoRotateScene")
  # layers
  reset("showLayerLabelsRadio")
  reset("showLayerCoords")
  reset("showWireFrames")
  reset("resizeLayerLabels")
  reset("layerColorPriorityRadio")
  reset("layerOpacity")
  # nodes
  reset("showNodeLabelsRadio")
  reset("showSelectedNodeLabels")
  reset("resizeNodeLabels")
  reset("nodeSelectedColorPriority")
  reset("nodeSelector")
  # edges
  reset("edgeSelectedColorPriority")
  reset("edgeFileColorPriority")
  reset("edgeDirectionToggle")
  reset("layerEdgeOpacity")
  shinyjs::hide("layerEdgeOpacity")
  reset("interLayerEdgeOpacity")
  shinyjs::hide("interLayerEdgeOpacity")
  reset("edgeWidthByWeight")
  reset("directionArrowSize")
  shinyjs::hide("directionArrowSize")
  shinyjs::hide("intraDirectionArrowSize")
  reset("channelCurvature")
  shinyjs::hide("channelCurvature")
  reset("interChannelCurvature")
  shinyjs::hide("interChannelCurvature") 
  # layouts
  reset("selectAll")
  reset("topologyScaleMetricChoice")
  reset("layoutAlgorithmChoice")
  reset("clusteringAlgorithmChoice")
  reset("localLayoutAlgorithmChoice")
  shinyjs::hide("localLayoutAlgorithmChoice")
  # other
  reset("fps")
}
