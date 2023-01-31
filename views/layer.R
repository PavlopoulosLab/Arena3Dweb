generateLayerDiv <- function() {
  tags$div(
    checkboxInput("showLayerLabels", "Show Labels", T),
    checkboxInput("showSelectedLayerLabels", "Show Labels of Selected Layers", F),
    checkboxInput("showLayerCoords", "Show Layer Coord System", F),
    checkboxInput("showWireFrames", "Show Layer Wireframed Floor", F),
    checkboxInput("layerColorFilePriority", "Priority on Layer Color From File", T),
    sliderInput("resizeLayerLabels", "Resize Labels:",
                min = 5, max = 30, value = 20, step = 1),
    sliderInput("floorOpacity", "Floor Opacity:",
                min = 0, max = 1, value = 0.6, step = 0.05),
    tags$div(id = "floorColorPicker", class = "colorPicker"),
    actionButton("hideButton4", icon("angle-up"), class = "hideButton")
  )
}
