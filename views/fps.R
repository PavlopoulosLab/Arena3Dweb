generateFPSDiv <- function() {
  tags$div(
    radioButtons("fps", "FPS:",
                 c("15FPS" = "15", "30FPS" = "30", "60FPS" = "60"),
                 selected = "15"),
    actionButton("hideButton7", icon("angle-up"), class = "hideButton")
  )
}
