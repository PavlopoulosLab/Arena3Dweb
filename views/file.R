generateFileTabPanel <- function() {
  tags$div(
    fileInput("input_network_file", "Upload Network:", accept = c(".tsv", ".txt")),
    fileInput("load_network_file", "Load Session:", accept = c(".json")),
    fileInput("node_attributes_file", "Upload NODE attributes:", accept = c(".tsv", ".txt")),
    fileInput("edge_attributes_file", "Upload EDGE attributes:", accept = c(".tsv", ".txt")),
    downloadButton("save_network_object", "Save Session"),
    actionButton("hideButton1", icon("angle-up"), class = "hideButton")
  )
}
