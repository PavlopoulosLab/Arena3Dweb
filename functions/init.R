initializeServerApp <- function() {
  initializeJSVariables()
  attachDownloadHandler()
}

initializeJSVariables <- function() { # TODO one call with one JSON object
  callJSHandler("handler_maxAllowedEdges", MAX_EDGES) 
  callJSHandler("handler_maxAllowedChannels", MAX_CHANNELS)
  callJSHandler("handler_maxAllowedLayers", MAX_LAYERS)
  callJSHandler("handler_colorBrewerPallete_dark", CHANNEL_COLORS_DARK)
  callJSHandler("handler_colorBrewerPallete", CHANNEL_COLORS_LIGHT)
}

attachDownloadHandler <- function() {
  output$save_network_object <- downloadHandler(
    filename = function() {
      paste0("network-", Sys.Date(), ".json")
    }, content = function(con) {
      if (existsNetwork()) {
        js_scene_pan <- fromJSON(input$js_scene_pan) # from JS
        js_scene_sphere <- fromJSON(input$js_scene_sphere)
        js_layers <- as.data.frame(fromJSON(input$js_layers))
        js_nodes <- as.data.frame(fromJSON(input$js_nodes))
        js_edge_pairs <- as.data.frame(fromJSON(input$js_edge_pairs))
        js_label_color <- input$js_label_color
        js_direction_flag <- input$edgeDirectionToggle
        exportData <- format_export_data(js_scene_pan, js_scene_sphere, js_layers, js_nodes, js_edge_pairs, js_label_color, js_direction_flag)
        json_output <- toJSON(exportData)
        write(json_output, con)
      }
    }
  )
}
