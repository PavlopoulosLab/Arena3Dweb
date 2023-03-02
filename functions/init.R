initializeServerApp <- function() {
  initializeJSVariables()
  attachDownloadHandler()
  hideDataMetricTabs()
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
        exportData <- convertSessionToJSON()
        write(exportData, con)
      }
    }
  )
}

hideDataMetricTabs <- function() {
  lapply(c("Network Data", "Clustering Data", TOPOLOGY_METRICS),
         function(metricName) {
           hideTab(inputId = "dataViewPanel", target = metricName)
         }
  )
}
