source("config/ui_variables.R", local = T)
source("views/home.R", local = T)
source("views/file.R", local = T)
source("views/layouts.R", local = T)
source("views/scene.R", local = T)
source("views/layer.R", local = T)
source("views/node.R", local = T)
source("views/edge.R", local = T)
source("views/fps.R", local = T)
source("views/help.R", local = T)
source("views/footer.R", local = T)

ui <- fluidPage(
  tags$head(tags$link(rel = "stylesheet", type = "text/css", href = "arena3dweb.css")),
  tags$head(tags$script(src = "js/three/three.js")),
  tags$head(tags$script(src = "js/three/matrix4.js")), # three.js matrix4 for dragcontrols
  tags$head(tags$script(src = "js/three/drag_controls.js")), # three.js dragcontrols
  tags$head(tags$script(src = "js/global.js")),
  tags$head(tags$script(src = "js/update_Rshiny_values.js")),
  tags$head(tags$script(src = "js/rshiny_handlers.js")),
  tags$head(tags$script(src = "js/general.js")),
  tags$head(tags$script(src = "js/canvas_controls.js")), # 3d interaction/navigation panel
  tags$head(tags$script(src = "js/right_click_menu_actions.js")), # right click on node
  tags$head(tags$script(src = "js/arena3dweb.js")), # 3D object functions and animate
  tags$head(tags$script(src = "js/themes.js")), # theme buttons (light, dark, gray)
  tags$head(tags$script(src = "js/event_listeners.js")), # window event listeners
  tags$head(tags$script(src = "js/main.js")), # on window load event init
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
    tabPanel(title = "FPS", generateFPSDiv()),
    tabPanel(title = "Help", generateHelpDiv()),
  ),
  tags$div(id = "navDiv"),
  tags$div(id = "info", "Waiting for Network to be uploaded."),
  tags$div(id = "logo"),
  tags$div(id = "themeDiv"),
  tags$div(id = "loader"),
  tags$div(id = "labelDiv"),
  tags$div(id = "descrDiv"),
  tags$div(id = "3d-graph")
)
