resolveAPI <- function() {
  tryCatch({
    query <- parseQueryString(session$clientData$url_search)
    if (length(query$f) > 0) {
      renderModal("<h2>Please wait.</h2><br /><p>Importing network from API.</p>")
      parseInputJSONFile(paste0(POST_REQUEST_PATH, query$f))
      updateNavbarPage(session, "navBar", selected = "Main View")
    }
  }, error = function(e) {
    print(paste0("API error: ", e))
    renderError("Error with external API call.")
  }, finally = {
    removeModal()
  })
}
