initializeServerApp <- function() {
  initializeJSVariables()
}

initializeJSVariables <- function() { # TODO one call with one JSON object
  session$sendCustomMessage("handler_maxAllowedEdges", MAX_EDGES) 
  session$sendCustomMessage("handler_maxAllowedChannels", MAX_CHANNELS)
  session$sendCustomMessage("handler_maxAllowedLayers", MAX_LAYERS)
  session$sendCustomMessage("handler_colorBrewerPallete_dark", CHANNEL_COLORS_DARK)
  session$sendCustomMessage("handler_colorBrewerPallete", CHANNEL_COLORS_LIGHT)
}
