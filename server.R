server <- function(input, output, session) {
  source("config/global_variables.R", local = T)
  source("config/server_variables.R", local = T)
  source("config/static_variables.R", local = T)
  
  source("functions/input.R", local = T)
  source("functions/js_handling.R", local = T)
  source("functions/init.R", local = T)
  source("functions/reset.R", local = T)
  source("functions/render.R", local = T)
  source("functions/general.R", local = T)
  source("functions/igraph/general.R", local = T)
  source("functions/igraph/layout.R", local = T)
  source("functions/igraph/cluster.R", local = T)
  source("functions/igraph/topology.R", local = T)
  source("functions/vr.R", local = T)
  source("functions/edges.R", local = T)
  
  # API GET file request  ####
  observeEvent(session$clientData$url_search, {
    resolveAPI()
  })
  
  # START ####
  initializeServerApp()
  
  # ~Welcome ####
  observeEvent(input$link_to_examples, {
    updateNavbarPage(session, "navBar", selected = "Help")
  }, ignoreInit = T)
  
  observeEvent(input$link_to_fileInput, {
    updateNavbarPage(session, "navBar", selected = "File")
  }, ignoreInit = T)
  
  # JS variables ####
  observeEvent(input$js_direction_checkbox_flag, {
    updateCheckboxInputFromJS(input$js_direction_checkbox_flag[1],
                              input$js_direction_checkbox_flag[2])
  }, ignoreInit = T)

  observeEvent(input$js_edgeByWeight_checkbox_flag, {
    updateCheckboxInputFromJS(input$js_edgeByWeight_checkbox_flag[1],
                              input$js_edgeByWeight_checkbox_flag[2])
  }, ignoreInit = T)

  observeEvent(input$js_channel_curvature_flag, {
    toggleCurvatureInputsFromJS()
  }, ignoreInit = T)

  # FILE I/O ####
  observeEvent(input$input_network_file, {
    handleUploadNetwork()
  }, ignoreInit = T)
  
  observeEvent(input$load_network_file, {
    handleLoadSession()
  }, ignoreInit = T)
  
  observeEvent(input$node_attributes_file, {
    handleInputNodeAttributeFileUpload()
  }, ignoreInit = T)
  
  observeEvent(input$edge_attributes_file, {
    handleInputEdgeAttributeFileUpload()
  }, ignoreInit = T)
  
  observeEvent(input$exampleButton, {
    handleLoadExample()
  }, ignoreInit = T)
  
  observeEvent(input$loadExample_ok, {
    handleLoadExampleAccept()
  }, ignoreInit = T)
  
  # LAYOUT ####
  observeEvent(input$runLayout, {
    handleLayout()
  }, ignoreInit = T)
  
  observeEvent(input$clusteringAlgorithmChoice, {
    handleClusterAlgorithmSelection()
  }, ignoreInit = T)
  
  observeEvent(input$runTopologyScale, {
    handleTopologyScaling()
  }, ignoreInit = T)
  
  # SCENE ####
  observeEvent(input$toggleSceneCoords, {
    callJSHandler("handler_toggleSceneCoords", input$toggleSceneCoords)
  }, ignoreInit = T)
  
  observeEvent(input$autoRotateScene, {
    callJSHandler("handler_autoRotateScene", input$autoRotateScene)
  }, ignoreInit = T)
  
  observeEvent(input$predefined_layout, {
    callJSHandler("handler_predefined_layer_layout", input$predefined_layout)
  }, ignoreInit = T)
  
  # ~VR ####
  observeEvent(input$vr_button, {
    handleVRCall()
  }, ignoreInit = T)
  
  # LAYERS ####
  observeEvent(input$selectAll, {
    callJSHandler("handler_selectAllLayers", input$selectAll)
  }, ignoreInit = T)
  
  observeEvent(input$showLayerLabelsRadio, {
    callJSHandler("handler_showLayerLabels", input$showLayerLabelsRadio)
  }, ignoreInit = T)
  
  observeEvent(input$resizeLayerLabels, {
    callJSHandler("handler_resizeLayerLabels", input$resizeLayerLabels)
  }, ignoreInit = T)
  
  observeEvent(input$showLayerCoords, {
    callJSHandler("handler_showLayerCoords", input$showLayerCoords)
  }, ignoreInit = T)
  
  observeEvent(input$showWireFrames, {
    callJSHandler("handler_showWireFrames", input$showWireFrames)
  }, ignoreInit = T)
  
  observeEvent(input$layerColorPriorityRadio, {
    callJSHandler("handler_setLayerColorPriority", input$layerColorPriorityRadio)
  }, ignoreInit = T)
  
  observeEvent(input$layerOpacity, {
    callJSHandler("handler_floorOpacity", input$layerOpacity)
  }, ignoreInit = T)
  
  # NODES ####
  observeEvent(input$showNodeLabelsRadio, {
    callJSHandler("handler_showNodeLabels", input$showNodeLabelsRadio)
  }, ignoreInit = T)
  
  observeEvent(input$resizeNodeLabels, {
    callJSHandler("handler_resizeNodeLabels", input$resizeNodeLabels)
  }, ignoreInit = T)
  
  observeEvent(input$selectAllNodes, {
    callJSHandler("handler_selectAllNodes", input$selectAllNodes)
  }, ignoreInit = T)

  observeEvent(input$nodeColorPriorityRadio, {
    callJSHandler("handler_setNodeColorPriority", input$nodeColorPriorityRadio)
  }, ignoreInit = T)
  
  observeEvent(input$nodeSelectedColorPriority, {
    callJSHandler("handler_setNodeSelectedColorPriority", input$nodeSelectedColorPriority)
  }, ignoreInit = T)
  
  # EDGES ####
  observeEvent(input$edgeSelectedColorPriority, {
    callJSHandler("handler_setEdgeSelectedColorPriority", input$edgeSelectedColorPriority)
  }, ignoreInit = T)
  
  observeEvent(input$edgeFileColorPriority, {
    callJSHandler("handler_edgeFileColorPriority", input$edgeFileColorPriority)
  }, ignoreInit = T)
  
  observeEvent(input$edgeWidthByWeight, {
    handleEdgeWidthByWeightCheckbox()
  }, ignoreInit = T)
  
  observeEvent(input$edgeDirectionToggle, {
    handleEdgeDirectionCheckbox()
  }, ignoreInit = T)
  
  observeEvent(input$interDirectionArrowSize, {
    callJSHandler("handler_setInterDirectionArrowSize", input$interDirectionArrowSize)
  }, ignoreInit = T)
  
  observeEvent(input$intraDirectionArrowSize, {
    callJSHandler("handler_setIntraDirectionArrowSize", input$intraDirectionArrowSize)
  }, ignoreInit = T)
  
  observeEvent(input$intraLayerEdgeOpacity, {
    callJSHandler("handler_setIntraLayerEdgeOpacity", input$intraLayerEdgeOpacity)
  }, ignoreInit = T)
  
  observeEvent(input$interLayerEdgeOpacity, {
    callJSHandler("handler_setInterLayerEdgeOpacity", input$interLayerEdgeOpacity)
  }, ignoreInit = T)
  
  observeEvent(input$intraChannelCurvature, {
    callJSHandler("handler_toggleIntraChannelCurvature", input$intraChannelCurvature)
  }, ignoreInit = T)
  
  observeEvent(input$interChannelCurvature, {
    callJSHandler("handler_toggleInterChannelCurvature", input$interChannelCurvature)
  }, ignoreInit = T)
  
  # FPS ####
  observeEvent(input$fps, {
    callJSHandler("handler_fps", input$fps)
  }, ignoreInit = T)
  
  # ~Hide buttons ####
  lapply(HIDE_BUTTONS, function(buttonId) {
    observeEvent(input[[buttonId]], {
      updateNavbarPage(session, "navBar", selected = "Main View")
    }, ignoreInit = T)
  })
}
