generateNodeDiv <- function() {
  tags$div(
    checkboxInput("selectAllNodes", "Select / Deselect all Nodes",
                  value = F, width = NULL),
    radioButtons("showNodeLabelsRadio", "Show Labels:",
      inline = T,
      choiceNames = list("All", "Selected", "None"),
      choiceValues = list("all", "selected", "none"),
      selected = "selected"
    ),
    sliderInput("resizeNodeLabels", "Resize Labels:",
                min = 5, max = 15, value = 12, step = 1),
    radioButtons("nodeGeometryRadio", "Node Geometry:",
      inline = T,
      choiceNames = list("Sphere", "Box", "Diamond", "Cone"),
      choiceValues = list("sphere", "box", "diamond", "cone"),
      selected = "sphere"
    ),
    radioButtons("nodeColorPriorityRadio", "Color Priority:",
      inline = T,
      choiceNames = list("Default / Imported", "Clustering"),
      choiceValues = list("default", "cluster")
    ),
    checkboxInput("nodeSelectedColorPriority", "Highlight Selected Nodes", T),
    textAreaInput("nodeSearchBar", "Search Nodes:", value = "",
                  width = "100%", height = "100%", cols = 100, rows = 4,
                  placeholder = "Insert comma separated Node names and then hit the Enter button",
                  resize = "vertical"),
    actionButton("hideButton5", icon("angle-up"), class = "hideButton")
  )
}
