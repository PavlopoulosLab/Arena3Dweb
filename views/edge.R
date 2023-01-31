generateEdgeDiv <- function() {
  tags$div(
    checkboxInput("edgeSelectedColorPriority", "Highlight Selected Edges in Color", T),
    checkboxInput("edgeFileColorPriority", "Priority on Edge Color From File", T),
    checkboxInput("edgeDirectionToggle", "Enable Edge Direction", F),
    sliderInput("intraDirectionArrowSize", "Intra-Layer Direction Arrow Size:",
                min = 0.01, max = 0.1, value = 0.05, step = 0.01),
    sliderInput("directionArrowSize", "Inter-Layer Direction Arrow Size:",
                min = 0.01, max = 0.1, value = 0.03, step = 0.01),
    checkboxInput("edgeWidthByWeight", "Edge Opacity By Weight",
                  value = T, width = NULL),
    sliderInput("layerEdgeOpacity", "Intra-Layer Edge Opacity:",
                min = 0, max = 1, value = 1, step = 0.1),
    sliderInput("interLayerEdgeOpacity", "Inter-Layer Edge Opacity:",
                min = 0, max = 1, value = 0.4, step = 0.1),
    sliderInput("channelCurvature", "Intra-Layer Channel Curvature:",
                min = 0.01, max = 0.1, value = 0.05, step = 0.01),
    sliderInput("interChannelCurvature", "Inter-Layer Channel Curvature:",
                min = 0.01, max = 0.1, value = 0.05, step = 0.01),
    tags$div(id = "channelColorPicker", class = "channelColorPicker"),
    actionButton("hideButton6", icon("angle-up"), class = "hideButton")
  )
}
