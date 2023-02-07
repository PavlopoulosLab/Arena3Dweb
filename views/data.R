generateDataDiv <- function() {
  tags$div(
    class = "networkDataTab",
    tabsetPanel(
      tabPanel(
        "Network Data",
        DT::dataTableOutput(outputId = "networkDataView"),
        actionButton("hideButton7", icon("angle-up"), class = "hideButton")
      ),
      tabPanel(
        "Degree"
      ),
      tabPanel(
        "Clustering Coefficient"
      ),
      tabPanel(
        "Betweenness Centrality"
      )
    )
  )
}
