handleEdgeWidthByWeightCheckbox <- function() {
  tryCatch({
    if (input$edgeWidthByWeight){
      shinyjs::hide("intraLayerEdgeOpacity")
      shinyjs::hide("interLayerEdgeOpacity")
    } else {
      shinyjs::show("intraLayerEdgeOpacity")
      shinyjs::show("interLayerEdgeOpacity")
    }
    callJSHandler("handler_setEdgeWidthByWeight", input$edgeWidthByWeight)
  }, error = function(e) {
    print(paste0("Error in Edge Opacity: ", e))
    renderError("Error on Edge Opacity interface.")
  })
}

handleEdgeDirectionCheckbox <- function() {
  tryCatch({
    if (input$edgeDirectionToggle){
      shinyjs::show("intraDirectionArrowSize")
      shinyjs::show("interDirectionArrowSize")
    } else {
      shinyjs::hide("intraDirectionArrowSize")
      shinyjs::hide("interDirectionArrowSize")
    }
    callJSHandler("handler_toggleDirection", input$edgeDirectionToggle) 
  }, error = function(e) {
    print(paste0("Error in Direction Size Arrow: ", e))
    renderError("Error on Direction interface.")
  })
}
