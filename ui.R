ui <- fluidPage(
  useShinyjs(),
  tags$head(tags$link(rel = "stylesheet", type = "text/css", href = "arena3dweb.css")),
  tags$head(tags$script(src = "three.js")),
  tags$head(tags$script(src = "arena3dweb.js")),
  tags$head(tags$script(src = "rshiny_handlers.js")),
  tags$head(tags$script(src = "canvas_controls.js")),
  tags$head(tags$script(src = "update_Rshiny_values.js")),
  theme = shinytheme("darkly"),
  # shinythemes::themeSelector(),
  fluidRow( # max columns = 12, per row
    column(12,
           navbarPage("", id = "navBar", selected = "Home",
                      tabPanel("Home", tags$div(id="homeDiv")),
                      tabPanel("Main View", ""),
                      tabPanel("File",
                               fileInput("input_network_file", "Upload Network:", accept = c(".tsv", ".txt")),
                               fileInput("load_network_file", "Import Network from a saved object:", accept = c(".tsv", ".txt")),
                               fileInput("node_attributes_file", "Upload NODE attributes:", accept = c(".tsv", ".txt")),
                               fileInput("edge_attributes_file", "Upload EDGE attributes:", accept = c(".tsv", ".txt")),
                               downloadButton("save_network_object", "Export Current View"),
                               actionButton("hideButton1", icon("angle-up"), class = "hideButton")
                      ),
                      tabPanel("Layer Selection & Layouts",
                               radioButtons("sub_graphChoice", "Select Subgraph to Apply Calculations:", c("Per Layer" = "perLayer", "All Selected Layers" = "allLayers", "Local Layout for Selected Nodes Per Layer" = "nodesPerLayers")),
                               checkboxInput("selectAll", "Select/Deselect All Layers", value = FALSE),
                               div(id='checkboxdiv', class='checkboxdiv'),
                               selectInput("selectLayout", "Apply Layout Algorithm on Selected Layers:", c("-", "Reingold-Tilford", "Circle", "Grid", "Random", "Davidson-Harel", "DrL", 
                                                                                                           "Fruchterman-Reingold", "GEM", "Graphopt", "Kamada-Kawai", "Large Graph Layout",
                                                                                                           "Multidimensional Scaling", "Sugiyama")),
                               selectInput("topologyScale", "Scale Nodes of Selected Layers by Topology Metric:", c("-", "Degree", "Clustering Coefficient",
                                                                                                                    "Betweenness Centrality")),
                               actionButton("hideButton2", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Scene Actions", checkboxInput("showSceneCoords", "Show Scene Coord System", T),
                               div(id='sceneColorPicker', class='colorPicker'),
                               actionButton("hideButton3", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Layer Actions",
                               checkboxInput("showLayerLabels", "Show Labels", T),
                               checkboxInput("showSelectedLayerLabels", "Show Labels of Selected Layers", F),
                               checkboxInput("showLayerCoords", "Show Layer Coord System", F),
                               checkboxInput("showWireFrames", "Show Layer Wireframed Floor", F),
                               sliderInput("resizeLayerLabels", "Resize Labels:", min = 5, max = 30, value = 15, step = 1),
                               sliderInput("floorOpacity", "Floor Opacity:", min = 0, max = 1, value = 0.3, step = 0.05),
                               div(id='floorColorPicker', class='colorPicker'),
                               actionButton("hideButton4", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Node Actions",
                               checkboxInput("nodeSelector", "Select/Deselect all Nodes", value = FALSE, width = NULL),
                               checkboxInput("showLabels", "Show Labels (Warning: Heavy Processing)", FALSE),
                               checkboxInput("showSelectedLabels", "Show Labels of Selected Nodes", T),
                               checkboxInput("nodeColorAttributePriority", "Priority on Uploaded Color Attribute", T),
                               checkboxInput("nodeSelectedColorPriority", "Highlight Selected Nodes in Color", T),
                               sliderInput("resizeLabels", "Resize Labels:", min = 5, max = 15, value = 9, step = 1),
                               textAreaInput("searchBar", "Search Nodes:", value = "", width = "100%", height = "100%", cols = 100, rows = 4, 
                                             placeholder = "Insert comma separated Node names and then hit the Enter button", resize = "vertical"),
                               actionButton("hideButton5", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Edge Actions",
                               checkboxInput("edgeWidthByWeight", "Edge Width By Weight", value = T, width = NULL),
                               checkboxInput("edgeColorAttributePriority", "Priority on Uploaded Color Attribute", T),
                               checkboxInput("edgeSelectedColorPriority", "Highlight Selected Edges in Color", T),
                               sliderInput("layerEdgeOpacity", "Intra-Layer Edge Opacity:", min = 0, max = 1, value = 0.3, step = 0.1),
                               sliderInput("interLayerEdgeOpacity", "Inter-Layer Edge Opacity:", min = 0, max = 1, value = 0.3, step = 0.1),
                               actionButton("hideButton6", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("FPS", radioButtons("fps", "FPS:", c("15FPS" = "15", "30FPS" = "30", "60FPS" = "60"), selected = "15"),
                               actionButton("hideButton7", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Help", tags$div(id="helpDiv"))
           ),
           tags$div(id="navDiv"),
           tags$div(id="info", "Waiting for Network to be uploaded."),
           tags$div(id="logo"),
           tags$div(id="loader"),
           tags$div(id="labelDiv"),
           tags$div(id="descrDiv"),
           tags$div(id="3d-graph") # div of 3D network visualization
    )
  )
)