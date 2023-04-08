source("config/global_variables.R", local = T)
source("config/ui_variables.R", local = T)
source("views/home.R", local = T)
source("views/file.R", local = T)
source("views/layouts.R", local = T)
source("views/scene.R", local = T)
source("views/layer.R", local = T)
source("views/node.R", local = T)
source("views/edge.R", local = T)
source("views/fps.R", local = T)
source("views/data.R", local = T)
source("views/help.R", local = T)
source("views/footer.R", local = T)

ui <- fluidPage(
  useShinyjs(),
  tags$head(tags$link(rel = "stylesheet", type = "text/css", href = "arena3dweb.css")),
  tags$head(tags$script(src = "js/three/three.js")),
  tags$head(tags$script(src = "js/three/matrix4.js")), # for dragcontrols
  tags$head(tags$script(src = "js/three/drag_controls.js")),
  tags$head(tags$script(src = "js/config/global_variables.js")),
  tags$head(tags$script(src = "js/config/static_variables.js")),
  tags$head(tags$script(src = "js/classes/Scene.js")),
  tags$head(tags$script(src = "js/classes/Layer.js")),
  tags$head(tags$script(src = "js/classes/Node.js")),
  tags$head(tags$script(src = "js/classes/Edge.js")),
  tags$head(tags$script(src = "js/object_actions/screen.js")),
  tags$head(tags$script(src = "js/object_actions/network.js")),
  tags$head(tags$script(src = "js/object_actions/themes.js")),
  tags$head(tags$script(src = "js/object_actions/layout.js")),
  tags$head(tags$script(src = "js/object_actions/labels.js")),
  tags$head(tags$script(src = "js/object_actions/layer.js")),
  tags$head(tags$script(src = "js/object_actions/node.js")),
  tags$head(tags$script(src = "js/object_actions/edge.js")),
  tags$head(tags$script(src = "js/object_actions/canvas_controls.js")),
  tags$head(tags$script(src = "js/object_actions/right_click_menu.js")),
  tags$head(tags$script(src = "js/rshiny_handlers.js")),
  tags$head(tags$script(src = "js/rshiny_update.js")),
  tags$head(tags$script(src = "js/general.js")),
  tags$head(tags$script(src = "js/event_listeners.js")),
  tags$head(tags$script(src = "js/on_page_load.js")),
  theme = shinytheme("darkly"),
  navbarPage(
    title = "", id = "navBar", selected = "Home", windowTitle = "Arena3Dweb",
    tabPanel(title = "Home", generateHomeDiv()),
    tabPanel(title = "Main View"),
    tabPanel(title = "File", generateFileDiv()),
    tabPanel(title = "Layer Selection & Layouts", generateLayoutsDiv()),
    tabPanel(title = "Scene Actions", generateSceneDiv()),
    tabPanel(title = "Layer Actions", generateLayerDiv()),
    tabPanel(title = "Node Actions", generateNodeDiv()),
    tabPanel(title = "Edge Actions", generateEdgeDiv()),
    tabPanel(title = "View Data", generateDataDiv()),
    tabPanel(title = "FPS", generateFPSDiv()),
    tabPanel(title = "Help", generateHelpDiv()),
  ),
  tags$div(id = "navControlButtonsDiv"),
  tags$div(id = "info", "Waiting for Network to be uploaded."),
  tags$div(id = "logo"),
  tags$div(id = "themeDiv"),
  tags$div(id = "loader"),
  tags$div(id = "labelDiv"),
  tags$div(id = "descrDiv"),
  tags$div(id = "3d-graph")
)
