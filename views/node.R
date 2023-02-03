generateNodeDiv <- function() {
  tags$div(
    checkboxInput("nodeSelector", "Select/Deselect all Nodes",
                  value = F, width = NULL),
    checkboxInput("showLabels", "Show Labels (Warning: Heavy Processing)", F),
    checkboxInput("showSelectedLabels", "Show Labels of Selected Nodes", T),
    checkboxInput("nodeSelectedColorPriority", "Highlight Selected Nodes in Color", T),
    sliderInput("resizeLabels", "Resize Labels:",
                min = 5, max = 15, value = 12, step = 1),
    textAreaInput("searchBar", "Search Nodes:", value = "",
                  width = "100%", height = "100%", cols = 100, rows = 4,
                  placeholder = "Insert comma separated Node names and then hit the Enter button",
                  resize = "vertical"),
    actionButton("hideButton5", icon("angle-up"), class = "hideButton")
  )
}
