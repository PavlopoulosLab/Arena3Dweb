handleNetworkFileUpload <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Uploading network.</p>")
    inFile <- input$input_network_file
    tempNetworkDF <- readFromTableFileToDataFrame(inFile$datapath)
    if (isNetworkFormatValid(tempNetworkDF)) {
      reset_UI_values()
      networkDF <<- parseUploadedNetwork(tempNetworkDF)
      generateStaticNetwork()
    }
  }, error = function(e) {
    print(paste0("Upload network file error: ", e))
    renderError("Bad uploaded network file format.")
  }, finally = {
    removeModal()
  })
}

isNetworkFormatValid <- function(df) {
  isValid <- T
  if (!existMandatoryColumns(df))
    isValid <- F
  else if (existsNonNumericWeight(df))
    isValid <- F
  else if (existsEmptyChannelName(df))
    isValid <- F
  return(isValid)
}

existMandatoryColumns <- function(df) {
  exist <- T
  if (!all(MANDATORY_NETWORK_COLUMNS %in%
           colnames(df))) {
    exist <- F
    renderWarning("Your network file must contain at least these four columns:\n
                  SourceNode, SourceLayer, TargetNode, TargetLayer")
  }
  return(exist)
}

existsNonNumericWeight <- function(df) {
  exist <- F
  if ("Weight" %in% colnames(df)) {
    if (!is.numeric(df$Weight)) {
      exist <- T
      renderWarning("Make sure all input weights all numeric values.")
    }
  }
  return(exist)
}

existsEmptyChannelName <- function(df) {
  exist <- F
  if ("Channel" %in% colnames(df)) {
    if ('' %in% df$Channel) {
      exist <- T
      renderWarning("At least one edge has no channel name.\n
                    Please reupload the network file with all edge channels.")
    }
  }
  return(exist)
}

parseUploadedNetwork <- function(df) {
  df <- subsetLegitColumns(df)
  df <- trimNetworkData(df)
  df <- appendScaledNetworkWeights(df)
  df <- appendNodeLayerCombinations(df)
  df <- reorderNetworkColumns(df)
  return(df)
}

subsetLegitColumns <- function(df) {
  combinedLegitColumns <- c(MANDATORY_NETWORK_COLUMNS, OPTIONAL_NETWORK_COLUMNS)
  existingLegitColumns <- combinedLegitColumns[which(combinedLegitColumns %in%
                                                       colnames(df))]
  return(df[, existingLegitColumns])
}

trimNetworkData <- function(df) {
  invisible(lapply(colnames(df), function(colName) {
    df[[colName]] <<- trimws(df[[colName]])
  }))
  return(df)
}

appendScaledNetworkWeights <- function(df) {
  if ("Weight" %in% colnames(df)) {
    df$Weight <- as.numeric(df$Weight)
  } else {
    df$Weight <- rep(1, nrow(df))
  }
  df$ScaledWeight <- mapper(df$Weight, 0.1, 1)
  return(df)
}

appendNodeLayerCombinations <- function(df) {
  df$SourceNode_Layer <- paste(df$SourceNode, df$SourceLayer, sep = "_")
  df$TargetNode_Layer <- paste(df$TargetNode, df$TargetLayer, sep = "_")
  return(df)
}

reorderNetworkColumns <- function(df) {
  channelColumn <- NULL
  if ("Channel" %in% colnames(df))
    channelColumn <- "Channel"
  df <- df[, c(MANDATORY_NETWORK_COLUMNS, channelColumn, "Weight",
               "SourceNode_Layer", "TargetNode_Layer", "ScaledWeight")]
  return(df)
}

generateStaticNetwork <- function(fromUpload = T) {
  callJSHandler("handler_uploadNetwork", networkDF)
  create_node_layerDF_table()
  renderNetworkDF(networkDF)
  
  updateSelectInput(session, "navBar", selected = "Main View")
  if (!fromUpload)
    reset("input_network_file")
  reset("load_network_file")
  reset("node_attributes_file")
  reset("edge_attributes_file")
}

create_node_layerDF_table <- function() {
  node_layerDF <<-
    as.data.frame(c(networkDF$SourceNode_Layer, networkDF$TargetNode_Layer))
  colnames(node_layerDF)[1] <<- "NodeLayer"
  node_layerDF$Node <<- c(networkDF$SourceNode, networkDF$TargetNode)
  node_layerDF$Layer <<- c(networkDF$SourceLayer, networkDF$TargetLayer)
  node_layerDF <<- unique(node_layerDF)
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
    nodeAttributes$Node <- paste(trimws(nodeAttributes$Node), trimws(nodeAttributes$Layer), sep="_") #concatenation node & group name
    if (!identical(nodeAttributes$Color, NULL)) nodeAttributes$Color <- trimws(nodeAttributes$Color)
    if (!identical(nodeAttributes$Size, NULL)) nodeAttributes$Size <- trimws(nodeAttributes$Size)
    if (!identical(nodeAttributes$Url, NULL)) nodeAttributes$Url <- trimws(nodeAttributes$Url)
    if (!identical(nodeAttributes$Description, NULL)) nodeAttributes$Description <- trimws(nodeAttributes$Description)
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
    edgeAttributes$SourceNode <- paste(trimws(edgeAttributes$SourceNode), trimws(edgeAttributes$SourceLayer), sep="_") # concatenation node1_Group1---node2_Group2
    edgeAttributes$TargetNode <- paste(trimws(edgeAttributes$TargetNode), trimws(edgeAttributes$TargetLayer), sep="_")
    temp <- edgeAttributes$SourceNode
    edgeAttributes$SourceNode <- paste(edgeAttributes$SourceNode, edgeAttributes$TargetNode, sep="---")
    edgeAttributes$TargetNode <- paste(edgeAttributes$TargetNode, temp, sep="---") # both ways, undirected
    edgeAttributes$Color <- trimws(edgeAttributes$Color)
    if ("Channel" %in% colnames(edgeAttributes)) {
      edgeAttributes$Channel <- trimws(edgeAttributes$Channel)
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

handleLoadExample <- function() {
  tryCatch({
    if (existsNetwork(silent = T)) {
      showModal(modalDialog(
        title = "Load Example Network",
        paste0("The current network will be discarded. Are you sure?"),
        footer = tagList(
          actionButton("loadExample_ok", "Yes"),
          modalButton("Cancel")
        )
      ))
    } else
      loadExampleNetwork()
  }, error = function(e) {
    print(paste0("Example network upload error: ", e))
    renderError("Unexpected error.")
  })
}

loadExampleNetwork <- function() {
  reset_UI_values()
  networkDF <<- fst::read.fst("./www/data/networkDF.fst")
  generateStaticNetwork(fromUpload = F)
}

handleLoadExampleAccept <- function() {
  tryCatch({
    loadExampleNetwork()
  }, error = function(e) {
    print(paste0("Example network upload error: ", e))
    renderError("Unexpected error.")
  }, finally = {
    removeModal()
  })
}
