generateLayoutsDiv <- function() {
  tags$div(
    radioButtons("subgraphChoice", "Select Subgraph to Apply Calculations:",
                 c("Per Layer" = "perLayer", "All Selected Layers" = "allLayers",
                   "Local Layout for Selected Nodes Per Layer" = "nodesPerLayers")),
    checkboxInput("selectAll", "Select/Deselect All Layers", value = F),
    tags$div(id = "checkboxdiv", class = "checkboxdiv"),
    tags$div(id = "channelColorLayoutDiv", class = "channelColorLayoutDiv"),
    selectInput("selectLayout", "Apply Layout Algorithm on Selected Layers:",
                c("-", "Fruchterman-Reingold", "Reingold-Tilford", "Circle",
                  "Grid", "Random", "DrL", "Graphopt", "Kamada-Kawai",
                  "Large Graph Layout",  "Multidimensional Scaling", "Sugiyama"), # "Davidson-Harel", "GEM" 
                width = "500px"),
    selectInput("selectCluster", "Apply Clustering on Selected Layers (Optional):",
                c("-", "Louvain", "Walktrap", "Fast Greedy", "Label Propagation"), # "Edge Betweenness"
                width = "500px"),
    selectInput("selectLocalLayout", "Apply Local Layout Algorithm:",
                c("-", "Fruchterman-Reingold", "Reingold-Tilford", "Circle",
                  "Grid", "Random", "DrL", "Graphopt", "Kamada-Kawai",
                  "Large Graph Layout",  "Multidimensional Scaling", "Sugiyama"), # "Davidson-Harel", "GEM"
                width = "500px"),            
    actionButton("runClusterLayout", "Run", class = "runButton"),
    selectInput("topologyScaleMetricChoice", "Scale Nodes of Selected Layers by Topology Metric:",
                c("-", "Degree", "Clustering Coefficient", "Betweenness Centrality"),
                width = "500px"),
    actionButton("runTopologyScale", "Run", class = "runButton"),
    actionButton("hideButton2", icon("angle-up"), class = "hideButton")
  )
}
