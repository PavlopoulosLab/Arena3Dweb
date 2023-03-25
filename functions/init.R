initializeServerApp <- function() {
  initializeJSVariables()
  attachDownloadHandler()
  hideDataMetricTabs()
}

initializeJSVariables <- function() {
  callJSHandler("handler_initializeGlobals",
                list(MAX_EDGES = MAX_EDGES, MAX_CHANNELS = MAX_CHANNELS,
                     MAX_LAYERS = MAX_LAYERS, CHANNEL_COLORS_DARK = CHANNEL_COLORS_DARK,
                     CHANNEL_COLORS_LIGHT = CHANNEL_COLORS_LIGHT))
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
