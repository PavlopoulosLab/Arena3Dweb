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

renderNetworkDF <- function() {
  renderShinyDataTable("networkDataView", networkDF,
                       caption = "Network Data", fileName = "networkData",
                       scrollY = "200px", filter = "top")
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
