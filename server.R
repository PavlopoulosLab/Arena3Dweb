server <- function(input, output, session) {
  source("config/global_variables.R", local = T)
  source("config/static_variables.R", local = T)
  
  source("functions/input/api.R", local = T)
  source("functions/input/files.R", local = T)
  source("functions/js_handling.R", local = T)
  source("functions/init.R", local = T)
  source("functions/render.R", local = T)
  source("functions/general.R", local = T)
  source("functions/parse.R", local = T)
  source("functions/igraph/graph.R", local = T)
  source("functions/igraph/layout.R", local = T)
  source("functions/igraph/cluster.R", local = T)
  source("functions/igraph/topology.R", local = T)
  source("functions/vr.R", local = T)
  
  # API ####
  # GET file request 
  observeEvent(session$clientData$url_search, {
    resolveAPI()
  })
  
  # START ####
  initializeServerApp()
  
  # ~Welcome ####
  observeEvent(input$link_to_examples, {
    updateNavbarPage(session, "navBar", selected = "Help")
  }, ignoreInit = T)
  
  # JS variables ####
  observeEvent(input$js_checkbox_flag, {
    updateCheckboxInputFromJS()
  }, ignoreInit = T)

  observeEvent(input$js_channel_curvature_flag, {
    toggleCurvatureInputsFromJS()
  }, ignoreInit = T)
  
  # FILE I/O ####
  observeEvent(input$input_network_file, {
    handleInputNetworkFileUpload()
  }, ignoreInit = T)
  
  observeEvent(input$load_network_file, {
    handleImportNetworkFileUpload()
  }, ignoreInit = T)
  
  observeEvent(input$node_attributes_file, {
    handleInputNodeAttributeFileUpload()
  }, ignoreInit = T)
  
  observeEvent(input$edge_attributes_file, {
    handleInputEdgeAttributeFileUpload()
  }, ignoreInit = T)
  
  # LAYOUT ####
  observeEvent(input$runClusterLayout, {
    handleClusterLayout()
  }, ignoreInit = T)
  
  observeEvent(input$selectCluster, {
    handleClusterAlgorithmSelection()
  }, ignoreInit = T)
  
  observeEvent(input$topologyScale,{
    handleTopologyScaling()
  }, ignoreInit = T)
  
  
  # $$$$$$$$$$$$$$$$$$$ ############
  
  # ~~~VR ####
  observeEvent(input$vr_button,{
    tryCatch({
      producePLY(session$token)
      produceHTML(session$token)
      session$sendCustomMessage("handler_browseUrl", paste0(API_URL, session$token))
    }, error = function(e) {
      print(paste0("Error in VR parser: ", e))
      renderError("Error while parsing network for VR mode.")
    })
  }, ignoreInit = T)
  
  
  # Hide buttons ####
  observeEvent(list(input$hideButton1, input$hideButton2, input$hideButton3,
                    input$hideButton4, input$hideButton5, input$hideButton6,
                    input$hideButton7), {
    updateSelectInput(session, "navBar", selected = "Main View")
  }, ignoreInit = T)
  
  # JS handler events ####
  # Scene
  observeEvent(input$showSceneCoords,{ session$sendCustomMessage("handler_showSceneCoords", input$showSceneCoords)},ignoreInit = T)
  observeEvent(input$autoRotateScene,{ session$sendCustomMessage("handler_autoRotateScene", input$autoRotateScene)},ignoreInit = T)

  observeEvent(input$predefined_layout,{session$sendCustomMessage("handler_predefined_layer_layout", input$predefined_layout)}, ignoreInit = T)

  # Layers
  observeEvent(input$selectAll,{  session$sendCustomMessage("handler_selectAllLayers", input$selectAll) })
  observeEvent(input$showSelectedLayerLabels,{ session$sendCustomMessage("handler_showSelectedLayerLabels", input$showSelectedLayerLabels) }, ignoreInit = T)
  observeEvent(input$showLayerLabels,{ session$sendCustomMessage("handler_showLayerLabels", input$showLayerLabels) }, ignoreInit = T)
  observeEvent(input$resizeLayerLabels,{ session$sendCustomMessage("handler_resizeLayerLabels", input$resizeLayerLabels) }, ignoreInit = T)
  observeEvent(input$showLayerCoords,{ session$sendCustomMessage("handler_showLayerCoords", input$showLayerCoords) }, ignoreInit = T)
  observeEvent(input$showWireFrames,{ session$sendCustomMessage("handler_showWireFrames", input$showWireFrames) }, ignoreInit = T)
    observeEvent(input$layerColorFilePriority,{ session$sendCustomMessage("handler_layerColorFilePriority", input$layerColorFilePriority) }, ignoreInit = T)
  observeEvent(input$floorOpacity,{ session$sendCustomMessage("handler_floorOpacity", input$floorOpacity) }, ignoreInit = T)
  # Nodes
  observeEvent(input$showLabels,{ session$sendCustomMessage("handler_showLabels", input$showLabels) }, ignoreInit = T)
  observeEvent(input$showSelectedLabels,{ session$sendCustomMessage("handler_showSelectedLabels", input$showSelectedLabels) }, ignoreInit = T)
  observeEvent(input$resizeLabels,{ session$sendCustomMessage("handler_resizeLabels", input$resizeLabels) }, ignoreInit = T)
  observeEvent(input$nodeSelector,{ session$sendCustomMessage("handler_nodeSelector", input$nodeSelector) }, ignoreInit = T)
  observeEvent(input$nodeSelectedColorPriority,{ session$sendCustomMessage("handler_nodeSelectedColorPriority", input$nodeSelectedColorPriority) }, ignoreInit = T)
  # Edges
  observeEvent(input$edgeSelectedColorPriority,{ session$sendCustomMessage("handler_edgeSelectedColorPriority", input$edgeSelectedColorPriority) }, ignoreInit = T)
  observeEvent(input$edgeFileColorPriority,{ session$sendCustomMessage("handler_edgeFileColorPriority", input$edgeFileColorPriority) }, ignoreInit = T)
  observeEvent(input$edgeWidthByWeight,{
    tryCatch({
      if (input$edgeWidthByWeight){ # triggers second event when resetting
        shinyjs::hide("layerEdgeOpacity")
        shinyjs::hide("interLayerEdgeOpacity")
      } else {
        shinyjs::show("layerEdgeOpacity")
        shinyjs::show("interLayerEdgeOpacity")
      }}, error = function(e) {
      print(paste0("Error in Edge Opacity: ", e))
      renderError("Error on Edge Opacity interface.")
    })
     session$sendCustomMessage("handler_edgeWidthByWeight", input$edgeWidthByWeight)
      }, ignoreInit = T)
  observeEvent(input$directionToggle,{
    tryCatch({
      if (input$directionToggle){ # triggers second event when resetting
        shinyjs::show("intraDirectionArrowSize")
        shinyjs::show("directionArrowSize")
      } else {
        shinyjs::hide("intraDirectionArrowSize")
        shinyjs::hide("directionArrowSize")
      }
      session$sendCustomMessage("handler_toggleDirection", input$directionToggle) 
    }, error = function(e) {
      print(paste0("Error in Direction Size Arrow: ", e))
      renderError("Error on Direction interface.")
    })
  }, ignoreInit = T)
  observeEvent(input$directionArrowSize,{ session$sendCustomMessage("handler_directionArrowSize", input$directionArrowSize) }, ignoreInit = T)
  observeEvent(input$intraDirectionArrowSize,{ session$sendCustomMessage("handler_intraDirectionArrowSize", input$intraDirectionArrowSize) }, ignoreInit = T)
  observeEvent(input$layerEdgeOpacity,{ session$sendCustomMessage("handler_layerEdgeOpacity", input$layerEdgeOpacity) }, ignoreInit = T)
  observeEvent(input$interLayerEdgeOpacity,{ session$sendCustomMessage("handler_interLayerEdgeOpacity", input$interLayerEdgeOpacity) }, ignoreInit = T)
  observeEvent(input$channelCurvature,{ session$sendCustomMessage("handler_channelCurvature", input$channelCurvature) }, ignoreInit = T)
  observeEvent(input$interChannelCurvature,{ session$sendCustomMessage("handler_interChannelCurvature", input$interChannelCurvature) }, ignoreInit = T)
  # Extra
  observeEvent(input$fps,{ session$sendCustomMessage("handler_fps", input$fps) }, ignoreInit = T)
  
  # Download handler JSON ####
  output$save_network_object <- downloadHandler(
    filename = function() {
      paste('network-', Sys.Date(), '.json', sep='')
    },
    content = function(con) {
      if (length(inData) > 1){ # == network loaded
        js_scene_pan <- fromJSON(input$js_scene_pan) # from JS
        js_scene_sphere <- fromJSON(input$js_scene_sphere)
        js_layers <- as.data.frame(fromJSON(input$js_layers))
        js_nodes <- as.data.frame(fromJSON(input$js_nodes))
        js_edge_pairs <- as.data.frame(fromJSON(input$js_edge_pairs))
        js_label_color <- input$js_label_color
        js_direction_flag <- input$directionToggle
        exportData <- format_export_data(js_scene_pan, js_scene_sphere, js_layers, js_nodes, js_edge_pairs, js_label_color, js_direction_flag)
        json_output <- toJSON(exportData)
      }
      write(json_output, con)
    }
  )
  
}
