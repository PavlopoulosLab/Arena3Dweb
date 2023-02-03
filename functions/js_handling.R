updateCheckboxInputFromJS <- function() {
  tryCatch({
    checkboxName <- input$js_checkbox_flag[1]
    checkboxValue <- input$js_checkbox_flag[2]
    updateCheckboxInput(session, checkboxName,
                        value = (checkboxValue == 'TRUE'))
  }, error = function(e) {
    print(paste("Checkbox error: ", e))
    renderError("Error with checkbox action.")
  })
}

toggleCurvatureInputsFromJS <- function() {
  tryCatch({
    if (input$js_channel_curvature_flag) {
      shinyjs::show("channelCurvature")
      shinyjs::show("interChannelCurvature")
    } else {
      shinyjs::hide("channelCurvature")
      shinyjs::hide("interChannelCurvature")
    }
  }, error = function(e) {
    print(paste("Curvature input toggling error: ", e))
    renderError("Error with curvature input toggling.")
  })
}
