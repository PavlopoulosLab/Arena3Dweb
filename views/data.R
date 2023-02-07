generateDataDiv <- function() {
  tags$div(
    class = "networkDataTab",
    tabsetPanel(
      id = "dataViewPanel",
      tabPanel(
        "Network Data",
        DT::dataTableOutput(outputId = "network_dataView")
      ),
      tabPanel(
        "Degree",
        DT::dataTableOutput(outputId = "degree_dataView")
      ),
      tabPanel(
        "Clustering Coefficient",
        DT::dataTableOutput(outputId = "transitivity_dataView")
      ),
      tabPanel(
        "Betweenness Centrality",
        DT::dataTableOutput(outputId = "betweenness_dataView")
      )
    ),
    actionButton("hideButton7", icon("angle-up"), class = "hideButton")
  )
}
