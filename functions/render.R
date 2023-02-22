renderError <- function(prompt) {
  if (exists("session"))
    shinyalert::shinyalert("Error!", prompt, type = "error")
}

renderWarning <- function(prompt) {
  if (exists("session"))
    shinyalert::shinyalert("Warning!", prompt, type = "warning")
}

renderModal <- function(prompt) {
  showModal(modalDialog(HTML(prompt), footer = NULL))
}

renderNetworkDF <- function(formattedNetwork) {
  showTab(inputId = "dataViewPanel", target = "Network Data")
  updateTabsetPanel(session, "dataViewPanel", selected = "Network Data")
  
  hiddenColumns <- c(6, 7, 8)
  if (is.null(formattedNetwork$Channel))
    hiddenColumns <- hiddenColumns - 1
  renderShinyDataTable("network_dataView", formattedNetwork, fileName = "networkData",
                       hiddenColumns = hiddenColumns, filter = "top")
}

renderMetricTable <- function(topologyMetricChoice, nodeScale, metric) {
  showTab(inputId = "dataViewPanel", target = topologyMetricChoice)
  updateTabsetPanel(session, "dataViewPanel", selected = topologyMetricChoice)
  renderShinyDataTable(paste0(metric, "_dataView"),
                       nodeScale,
                       fileName = paste0(metric, "Data"),
                       filter = "top")
}

renderShinyDataTable <- function(shinyOutputId, outputData,
                                 caption = NULL, fileName = "",
                                 scrollY = NULL, hiddenColumns = c(),
                                 filter = "none") {
  output[[shinyOutputId]] <- DT::renderDataTable(
    outputData,
    server = F, 
    extensions = 'Buttons',
    caption = caption,
    options = list(
      scrollY = scrollY, 
      scroller = T,
      "dom" = 'Blfiprt',
      buttons = list(
        list(extend = 'excel', filename = fileName),
        list(extend = 'csv', filename = fileName),
        list(extend = 'copy', filename = fileName),
        list(extend = 'pdf', filename = fileName),
        list(extend = 'print', filename = fileName)
      ),
      columnDefs = list(
        list(visible = F, targets = hiddenColumns)
      )
    ),
    filter = filter,
    rownames = F,
    escape = F
  )
}
