generateSceneDiv <- function() {
  tags$div(
    checkboxInput("toggleSceneCoords", "Show Scene Coord System", T),
    checkboxInput("autoRotateScene", "Enable Scene Auto Rotate", F),
    radioButtons("predefined_layout", "Select Predefined Layout:",
                 c("Parallel Coordinates" = "parallel", "Zig Zag" = "zigZag",
                   "Star" = "starLike", "Cube" = "cube") ),
    tags$div(id = "sceneColorPicker", class = "colorPicker"),
    actionButton("vr_button", "See in VR"),
    actionButton("hideButton3", icon("angle-up"), class = "hideButton")
  )
}
