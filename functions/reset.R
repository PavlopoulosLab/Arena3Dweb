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
  reset("resizeNodeLabels")
  reset("nodeSelectedColorPriority")
  reset("selectAllNodes")
  # edges
  reset("edgeSelectedColorPriority")
  reset("edgeFileColorPriority")
  reset("edgeDirectionToggle")
  reset("intraLayerEdgeOpacity")
  shinyjs::hide("intraLayerEdgeOpacity")
  reset("interLayerEdgeOpacity")
  shinyjs::hide("interLayerEdgeOpacity")
  reset("edgeWidthByWeight")
  reset("interDirectionArrowSize")
  reset("intraDirectionArrowSize")
  shinyjs::hide("interDirectionArrowSize")
  shinyjs::hide("intraDirectionArrowSize")
  reset("intraChannelCurvature")
  shinyjs::hide("intraChannelCurvature")
  reset("interChannelCurvature")
  shinyjs::hide("interChannelCurvature") 
  # layouts
  reset("selectAllLayersCheckbox")
  reset("topologyScaleMetricChoice")
  reset("layoutAlgorithmChoice")
  reset("clusteringAlgorithmChoice")
  reset("localLayoutAlgorithmChoice")
  shinyjs::hide("localLayoutAlgorithmChoice")
  # other
  reset("fps")
}
