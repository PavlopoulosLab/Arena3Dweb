updateCheckboxInputFromJS <- function(checkboxName, checkboxValue) {
  tryCatch({
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
      shinyjs::show("intraChannelCurvature")
      shinyjs::show("interChannelCurvature")
    } else {
      shinyjs::hide("intraChannelCurvature")
      shinyjs::hide("interChannelCurvature")
    }
  }, error = function(e) {
    print(paste("Curvature input toggling error: ", e))
    renderError("Error with curvature input toggling.")
  })
}
