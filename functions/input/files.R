handleInputNetworkFileUpload <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Uploading network.</p>")
    inFile <- input$input_network_file
    if (!is.null(inFile)){ #input$input_network_file -> NULL initially
      reset_UI_values()
      networkDF <<- read.delim(inFile$datapath, header = TRUE) # datapath -> temporary location of uploaded file
      
      networkDF$SourceNode <<- trim(networkDF$SourceNode)
      networkDF$SourceLayer <<- trim(networkDF$SourceLayer)
      networkDF$TargetNode <<- trim(networkDF$TargetNode)
      networkDF$TargetLayer <<- trim(networkDF$TargetLayer)
      if ("Channel" %in% colnames(networkDF)) {
        networkDF$Channel <<- trim(networkDF$Channel)
      }
      if('' %in% networkDF$Channel){
        print(paste("A channel name is empty. Channels: ",networkDF$Channel))
        renderWarning("A channel name is empty.
                      Please reupload the file with all the channel names.")
      } else {
        if (identical(networkDF$Weight, NULL)) networkDF$Weight <<- as.matrix(rep(1,length(networkDF$SourceNode)))
        else networkDF$Weight <<- mapper(as.numeric(trim(networkDF$Weight)), 0.1, 1)
        callJSHandler("handler_uploadNetwork", networkDF)
        networkDF [, "SourceNode"] <<- as.matrix(paste(networkDF[, "SourceNode"], networkDF[, "SourceLayer"], sep="_"))
        networkDF [, "TargetNode"] <<- as.matrix(paste(networkDF[, "TargetNode"], networkDF[, "TargetLayer"], sep="_"))
        networkDF <<- as.data.frame(networkDF)
      }
      updateSelectInput(session, "navBar", selected = "Main View")
    }
    reset("load_network_file")
    reset("node_attributes_file")
    reset("edge_attributes_file")
  }, error = function(e) {
    print(paste0("Upload network file error: ", e))
    renderError("Bad uploaded network file format.")
  }, finally = {
    removeModal()
  })
}

handleImportNetworkFileUpload <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Importing network from JSON file.</p>")
    inFile <- input$load_network_file
    if (!is.null(inFile)){
      reset_UI_values()
      shinyjs::show("layerColorFilePriority")
      updateCheckboxInput(session,'layerColorFilePriority',value = TRUE);
      parseInputJSONFile(inFile$datapath)
      updateSelectInput(session, "navBar", selected = "Main View")
    }
    reset("input_network_file")
    reset("node_attributes_file")
    reset("edge_attributes_file")
  }, error = function(e) {
    print(paste0("Import network file error: ", e))
    renderError("Bad imported network file format.")
  }, finally = {
    removeModal()
  })
}

handleInputNodeAttributeFileUpload <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Uploading node attributes.</p>")
    nodeFile <- input$node_attributes_file$datapath
    nodeAttributes <- read.delim(nodeFile)
    nodeAttributes$Node <- paste(trim(nodeAttributes$Node), trim(nodeAttributes$Layer), sep="_") #concatenation node & group name
    if (!identical(nodeAttributes$Color, NULL)) nodeAttributes$Color <- trim(nodeAttributes$Color)
    if (!identical(nodeAttributes$Size, NULL)) nodeAttributes$Size <- trim(nodeAttributes$Size)
    if (!identical(nodeAttributes$Url, NULL)) nodeAttributes$Url <- trim(nodeAttributes$Url)
    if (!identical(nodeAttributes$Description, NULL)) nodeAttributes$Description <- trim(nodeAttributes$Description)
    if (!is.null(nodeFile)){
      callJSHandler("handler_nodeAttributes", nodeAttributes)
      updateSelectInput(session, "navBar", selected = "Main View")
    }
  }, error = function(e) {
    print(paste0("Error during input node attributes file upload:  ", e))
    renderError("Bad node attributes file format.")
  }, finally = {
    removeModal()
  })
}

handleInputEdgeAttributeFileUpload <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Uploading edge attributes.</p>")
    edgeFile <- input$edge_attributes_file$datapath
    edgeAttributes <- read.delim(edgeFile)
    edgeAttributes$SourceNode <- paste(trim(edgeAttributes$SourceNode), trim(edgeAttributes$SourceLayer), sep="_") # concatenation node1_Group1---node2_Group2
    edgeAttributes$TargetNode <- paste(trim(edgeAttributes$TargetNode), trim(edgeAttributes$TargetLayer), sep="_")
    temp <- edgeAttributes$SourceNode
    edgeAttributes$SourceNode <- paste(edgeAttributes$SourceNode, edgeAttributes$TargetNode, sep="---")
    edgeAttributes$TargetNode <- paste(edgeAttributes$TargetNode, temp, sep="---") # both ways, undirected
    edgeAttributes$Color <- trim(edgeAttributes$Color)
    if ("Channel" %in% colnames(edgeAttributes)) {
      edgeAttributes$Channel <- trim(edgeAttributes$Channel)
    }
    if (!is.null(edgeFile)){
      callJSHandler("handler_edgeAttributes", edgeAttributes)
      updateSelectInput(session, "navBar", selected = "Main View")
    }
  }, error = function(e) {
    print(paste0("Error during input edge attributes file upload:  ", e))
    renderError("Bad edge attributes file format.")
  }, finally = {
    removeModal()
  })
}
