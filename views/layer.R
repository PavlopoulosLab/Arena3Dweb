generateLayerDiv <- function() {
  tags$div(
    radioButtons("showLayerLabelsRadio", "Show Labels:",
      inline = T,
      choiceNames = list("All", "Selected", "None"),
      choiceValues = list("all", "selected", "none")
    ),
    checkboxInput("showLayerCoords", "Show Layer Coord Systems", F),
    checkboxInput("showWireFrames", "Show Floors in Wireframes", F),
    sliderInput("resizeLayerLabels", "Resize Labels:",
                min = 12, max = 30, value = 20, step = 1),
    sliderInput("layerOpacity", "Floor Opacity:",
                min = 0, max = 1, value = 0.6, step = 0.05),
    radioButtons("layerColorPriorityRadio", "Color Priority:",
      inline = T,
      choiceNames = list("Default / Imported", "Theme / Colorpicker"),
      choiceValues = list("default", "picker")
    ),        
    tags$div(id = "floorColorPicker", class = "colorPicker"),
    actionButton("hideButton4", icon("angle-up"), class = "hideButton")
  )
}
