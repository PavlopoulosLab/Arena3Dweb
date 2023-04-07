generateEdgeDiv <- function() {
  tags$div(
    checkboxInput("edgeDirectionToggle", "Enable Edge Direction", F),
    sliderInput("intraDirectionArrowSize", "Intra-Layer Direction Arrow Size:",
                min = 1, max = 10, value = 5, step = 1),
    sliderInput("interDirectionArrowSize", "Inter-Layer Direction Arrow Size:",
                min = 1, max = 10, value = 5, step = 1),
    checkboxInput("edgeWidthByWeight", "Edge Opacity By Weight",
                  value = T, width = NULL),
    sliderInput("intraLayerEdgeOpacity", "Intra-Layer Edge Opacity:",
                min = 0, max = 1, value = 1, step = 0.1),
    sliderInput("interLayerEdgeOpacity", "Inter-Layer Edge Opacity:",
                min = 0, max = 1, value = 0.4, step = 0.1),
    sliderInput("intraChannelCurvature", "Intra-Layer Channel Curvature:",
                min = 10, max = 20, value = 15, step = 1),
    sliderInput("interChannelCurvature", "Inter-Layer Channel Curvature:",
                min = 1, max = 10, value = 5, step = 1),
    checkboxInput("edgeSelectedColorPriority", "Highlight Selected Edges in Color", T),
    checkboxInput("edgeFileColorPriority", "Priority on Loaded Edge Color", F),
    tags$div(id = "channelColorPicker", class = "channelColorPicker"),
    actionButton("hideButton6", icon("angle-up"), class = "hideButton")
  )
}
