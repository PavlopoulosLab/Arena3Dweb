ui <- fluidPage(
  useShinyjs(),
  extendShinyjs(text = js.opentab, functions = c("BrowseURL")),
  tags$head(tags$link(rel = "stylesheet", type = "text/css", href = "arena3dweb.css")),
  tags$head(tags$script(src = "js/three/three.js")), # 3D graphics engine
  tags$head(tags$script(src = "js/three/matrix4.js")), # three.js matrix4 for dragcontrols
  tags$head(tags$script(src = "js/three/drag_controls.js")), # three.js dragcontrols
  tags$head(tags$script(src = "js/global.js")), # global variables
  tags$head(tags$script(src = "js/update_Rshiny_values.js")), # communicate JS variables to R
  tags$head(tags$script(src = "js/rshiny_handlers.js")), # call JS functions from R
  tags$head(tags$script(src = "js/general.js")), # general purpose functions
  tags$head(tags$script(src = "js/canvas_controls.js")), # 3d interaction/navigation panel
  tags$head(tags$script(src = "js/right_click_menu_actions.js")), # right click on node
  tags$head(tags$script(src = "js/arena3dweb.js")), # 3D object functions and animate
  tags$head(tags$script(src = "js/themes.js")), # theme buttons (light, dark, gray)
  tags$head(tags$script(src = "js/event_listeners.js")), # window event listeners
  tags$head(tags$script(src = "js/main.js")), # on window load event init
  theme = shinytheme("darkly"),
  fluidRow(
    column(12,
           navbarPage("", id = "navBar", selected = "Home",
                      tabPanel("Home",
                               tags$div(id="homeDiv"),
                               textOutput("url_checker")),
                      tabPanel("Main View"),
                      tabPanel("File",
                               fileInput("input_network_file", "Upload Network:", accept = c(".tsv", ".txt")),
                               fileInput("load_network_file", "Load Session:", accept = c(".json")),
                               fileInput("node_attributes_file", "Upload NODE attributes:", accept = c(".tsv", ".txt")),
                               fileInput("edge_attributes_file", "Upload EDGE attributes:", accept = c(".tsv", ".txt")),
                               downloadButton("save_network_object", "Save Session"),
                               actionButton("hideButton1", icon("angle-up"), class = "hideButton")
                      ),
                      tabPanel("Layer Selection & Layouts",
                              radioButtons("sub_graphChoice", "Select Subgraph to Apply Calculations:", c("Per Layer" = "perLayer", "All Selected Layers" = "allLayers", "Local Layout for Selected Nodes Per Layer" = "nodesPerLayers")),
                              checkboxInput("selectAll", "Select/Deselect All Layers", value = FALSE),
                              div(id='checkboxdiv', class='checkboxdiv'),
                              div(id='channelColorLayoutDiv', class='channelColorLayoutDiv'),
                              selectInput("selectLayout", "Apply Layout Algorithm on Selected Layers:", c("-", "Fruchterman-Reingold", "Reingold-Tilford", "Circle", "Grid", "Random", 
                        #       "Davidson-Harel",
                               "DrL",
                                # "GEM", 
                                "Graphopt", "Kamada-Kawai", "Large Graph Layout",  "Multidimensional Scaling", "Sugiyama"),width = '500px'),
                              selectInput("selectCluster", "Apply Clustering on Selected Layers (Optional):", c("-", "Louvain", "Walktrap",
                              # "Edge Betweenness", 
                              "Fast Greedy", "Label Propagation"),width = '500px'),
                              selectInput("selectLocalLayout", "Apply Local Layout Algorithm:", c("-", "Fruchterman-Reingold", "Reingold-Tilford", "Circle", "Grid", "Random", 
                        #       "Davidson-Harel",
                               "DrL", 
                                # "GEM", 
                                "Graphopt", "Kamada-Kawai", "Large Graph Layout",  "Multidimensional Scaling", "Sugiyama"),width = '500px'),
                              actionButton("runClusterLayout", 'Run', class ="runButton"),
                              selectInput("topologyScale", "Scale Nodes of Selected Layers by Topology Metric:", c("-", "Degree", "Clustering Coefficient",
                                                                                                                    "Betweenness Centrality"),width = '500px'),
                              actionButton("hideButton2", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Scene Actions", checkboxInput("showSceneCoords", "Show Scene Coord System", T),
                       checkboxInput("autoRotateScene", "Enable Scene Auto Rotate", F),
                       radioButtons("predefined_layout", "Select Predefined Layout:", c("Parallel Coordinates" = "parallel", "Zig Zag" = "zigZag", "Star" = "starLike", "Cube" = "cube") ),
                               div(id='sceneColorPicker', class='colorPicker'),
                               actionButton("vr_button", "See in VR"),
                               actionButton("hideButton3", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Layer Actions",
                               checkboxInput("showLayerLabels", "Show Labels", T),
                               checkboxInput("showSelectedLayerLabels", "Show Labels of Selected Layers", F),
                               checkboxInput("showLayerCoords", "Show Layer Coord System", F),
                               checkboxInput("showWireFrames", "Show Layer Wireframed Floor", F),
                               checkboxInput("layerColorFilePriority", "Priority on Layer Color From File", F),
                               sliderInput("resizeLayerLabels", "Resize Labels:", min = 5, max = 30, value = 20, step = 1),
                               sliderInput("floorOpacity", "Floor Opacity:", min = 0, max = 1, value = 0.6, step = 0.05),
                               div(id='floorColorPicker', class='colorPicker'),
                               actionButton("hideButton4", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Node Actions",
                                checkboxInput("nodeSelector", "Select/Deselect all Nodes", value = FALSE, width = NULL),
                                checkboxInput("showLabels", "Show Labels (Warning: Heavy Processing)", FALSE),
                                checkboxInput("showSelectedLabels", "Show Labels of Selected Nodes", T),
                                checkboxInput("nodeSelectedColorPriority", "Highlight Selected Nodes in Color", T),
                                sliderInput("resizeLabels", "Resize Labels:", min = 5, max = 15, value = 12, step = 1),
                                textAreaInput("searchBar", "Search Nodes:", value = "", width = "100%", height = "100%", cols = 100, rows = 4,
                                        placeholder = "Insert comma separated Node names and then hit the Enter button", resize = "vertical"),
                                actionButton("hideButton5", icon("angle-up"), class ="hideButton")
                      ),
                      tabPanel("Edge Actions",
                                checkboxInput("edgeSelectedColorPriority", "Highlight Selected Edges in Color", T),
                                checkboxInput("edgeFileColorPriority", "Priority on Edge Color From File", T),
                                checkboxInput("directionToggle", "Enable Edge Direction"),
                                sliderInput("intraDirectionArrowSize", "Intra-Layer Direction Arrow Size:", min = 0.01, max = 0.1, value = 0.05, step = 0.01),
                                sliderInput("directionArrowSize", "Inter-Layer Direction Arrow Size:", min = 0.01, max = 0.1, value = 0.03, step = 0.01),
                                checkboxInput("edgeWidthByWeight", "Edge Opacity By Weight", value = T, width = NULL),
                                sliderInput("layerEdgeOpacity", "Intra-Layer Edge Opacity:", min = 0, max = 1, value = 1, step = 0.1),
                                sliderInput("interLayerEdgeOpacity", "Inter-Layer Edge Opacity:", min = 0, max = 1, value = 0.4, step = 0.1),
                                sliderInput("channelCurvature", "Intra-Layer Channel Curvature:", min = 0.01, max = 0.1, value = 0.05, step = 0.01),
                                sliderInput("interChannelCurvature", "Inter-Layer Channel Curvature:", min = 0.01, max = 0.1, value = 0.05, step = 0.01),
                                div(id='channelColorPicker', class='channelColorPicker'),
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
           tags$div(id="themeDiv"),
           tags$div(id="loader"),
           tags$div(id="labelDiv"),
           tags$div(id="descrDiv"),
           tags$div(id="3d-graph") # div of 3D network visualization
    )
  )
)
