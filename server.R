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
  
  observeEvent(input$showSelectedLayerLabels, {
    callJSHandler("handler_showSelectedLayerLabels", input$showSelectedLayerLabels)
  }, ignoreInit = T)
  
  observeEvent(input$showAllLayerLabels, {
    callJSHandler("handler_showAllLayerLabels", input$showAllLayerLabels)
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
  
  observeEvent(input$layerColorFilePriority, {
    callJSHandler("handler_layerColorFilePriority", input$layerColorFilePriority)
  }, ignoreInit = T)
  
  observeEvent(input$floorOpacity, {
    callJSHandler("handler_floorOpacity", input$floorOpacity)
  }, ignoreInit = T)
  
  # NODES ####
  observeEvent(input$showAllNodeLabels, {
    callJSHandler("handler_showNodeLabels", input$showAllNodeLabels)
  }, ignoreInit = T)
  
  observeEvent(input$showSelectedNodeLabels, {
    callJSHandler("handler_showSelectedNodeLabels", input$showSelectedNodeLabels)
  }, ignoreInit = T)
  
  observeEvent(input$resizeLabels, {
    callJSHandler("handler_resizeLabels", input$resizeLabels)
  }, ignoreInit = T)
  
  observeEvent(input$nodeSelector, {
    callJSHandler("handler_nodeSelector", input$nodeSelector)
  }, ignoreInit = T)
  
  observeEvent(input$nodeSelectedColorPriority, {
    callJSHandler("handler_nodeSelectedColorPriority", input$nodeSelectedColorPriority)
  }, ignoreInit = T)
  
  # EDGES ####
  observeEvent(input$edgeSelectedColorPriority, {
    callJSHandler("handler_edgeSelectedColorPriority", input$edgeSelectedColorPriority)
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
  
  observeEvent(input$directionArrowSize, {
    callJSHandler("handler_directionArrowSize", input$directionArrowSize)
  }, ignoreInit = T)
  
  observeEvent(input$intraDirectionArrowSize, {
    callJSHandler("handler_intraDirectionArrowSize", input$intraDirectionArrowSize)
  }, ignoreInit = T)
  
  observeEvent(input$layerEdgeOpacity, {
    callJSHandler("handler_layerEdgeOpacity", input$layerEdgeOpacity)
  }, ignoreInit = T)
  
  observeEvent(input$interLayerEdgeOpacity, {
    callJSHandler("handler_interLayerEdgeOpacity", input$interLayerEdgeOpacity)
  }, ignoreInit = T)
  
  observeEvent(input$channelCurvature, {
    callJSHandler("handler_channelCurvature", input$channelCurvature)
  }, ignoreInit = T)
  
  observeEvent(input$interChannelCurvature, {
    callJSHandler("handler_interChannelCurvature", input$interChannelCurvature)
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
