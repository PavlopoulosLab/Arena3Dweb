generateDataDiv <- function() {
  tags$div(
    DT::dataTableOutput(outputId = "networkDataView"),
    actionButton("hideButton7", icon("angle-up"), class = "hideButton")
  )
}
