# Upload Network ####
handleUploadNetwork <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Uploading network.</p>")
    inFile <- input$input_network_file
    tempNetworkDF <- readFromTableFileToDataFrame(inFile$datapath)
    if (isNetworkFormatValid(tempNetworkDF)) {
      reset_UI_values()
      networkDF <<- parseUploadedNetwork(tempNetworkDF)
      generateNetworkFromDF()
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
                  SourceNode, SourceLayer, TargetNode, TargetLayer\n
                  See our Help page -> Input & Output Files")
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
  df <- removeDuplicateNetworkRows(df)
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

removeDuplicateNetworkRows <- function(df) {
  if ("Channel" %in% colnames(df)) {
    df <- dplyr::distinct(df, SourceNode, SourceLayer, TargetNode, TargetLayer,
                          Channel, .keep_all = T)
  } else {
    df <- dplyr::distinct(df, SourceNode, SourceLayer, TargetNode, TargetLayer,
                          .keep_all = T)
  }
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

generateNetworkFromDF <- function(fromUpload = T) {
  callJSHandler("handler_uploadNetwork", networkDF)
  create_node_layerDF()
  renderNetworkDF(networkDF)
  
  updateSelectInput(session, "navBar", selected = "Main View")
  if (!fromUpload)
    reset("input_network_file")
  reset("load_network_file")
  reset("node_attributes_file")
  reset("edge_attributes_file")
}

create_node_layerDF <- function() {
  node_layerDF <<-
    as.data.frame(c(networkDF$SourceNode_Layer, networkDF$TargetNode_Layer))
  colnames(node_layerDF)[1] <<- "NodeLayer"
  node_layerDF$Node <<- c(networkDF$SourceNode, networkDF$TargetNode)
  node_layerDF$Layer <<- c(networkDF$SourceLayer, networkDF$TargetLayer)
  node_layerDF <<- unique(node_layerDF)
}

# Load Session ####
handleLoadSession <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Importing network from JSON file.</p>")
    inFile <- input$load_network_file
    loadNetworkFromJSONFilepath(inFile$datapath)
  }, error = function(e) {
    print(paste0("Import network file error: ", e))
    renderError("Bad imported network file format.")
  }, finally = {
    removeModal()
  })
}

loadNetworkFromJSONFilepath <- function(filePath) {
  jsonNetwork <- jsonlite::fromJSON(filePath)
  if (isJSONValid(jsonNetwork)) {
    reset_UI_values()
    jsonNetwork <- parseUploadedJSON(jsonNetwork)
    networkDF <<- extractNetworkDFFromJSONNetwork(jsonNetwork)
    generateNetworkFromDF_JSONVersion(jsonNetwork)
  }
}

isJSONValid <- function(jsonNetwork) {
  isValid <- T
  if (!existMandatoryObjects(jsonNetwork))
    isValid <- F
  if (!areLayersValid(jsonNetwork$layers))
    isValid <- F
  if (!existMandatoryNodeColumns(jsonNetwork$nodes))
    isValid <- F
  if (!existMandatoryEdgeColumns(jsonNetwork$edges))
    isValid <- F
  return(isValid)
}

existMandatoryObjects <- function(jsonNetwork) {
  exist <- T
  if (!all(MANDATORY_JSON_OBJECTS %in%
           names(jsonNetwork))) {
    exist <- F
    renderWarning("Your JSON file must contain at least these four objects:\n
                  scene, layers, nodes, edges\n
                  See our Help page -> API")
  }
  return(exist)
}

areLayersValid <- function(layers) {
  areValid <- T
  if (!("name" %in% colnames(layers))) {
    areLayersValid <- F
    renderWarning("Your JSON layers must contain at least a name property.\n
                  See our Help page -> API")
  } else if (containsEmptyValue(layers$name)) {
    areLayersValid <- F
    renderWarning("Your JSON layers contain at least one empty name value.\n
                  Layer names cannot be empty.")
  } else {
    uniqueLayers <- unique(layers$name)
    if (length(uniqueLayers) > MAX_LAYERS) {
      areLayersValid <- F
      renderWarning(paste0("The network must contain no more than ",
                           MAX_LAYERS, " layers."))
    }
  }
  return(areValid)
}

existMandatoryNodeColumns <- function(nodes) {
  exist <- T
  if (!all(MANDATORY_JSON_NODE_COLUMNS  %in%
           colnames(nodes))) {
    exist <- F
    renderWarning("Your JSON nodes must contain at least a name and a layer.\n
                  See our Help page -> API")
  } else if (containsEmptyValue(nodes$name)) {
    exist <- F
    renderWarning("Your JSON nodes contain at least one empty name value.\n
                  Node names cannot be empty.")
  } else if (containsEmptyValue(nodes$layer)) {
    exist <- F
    renderWarning("Your JSON nodes contain at least one empty layer value.\n
                  Node layers cannot be empty.")
  }
  return(exist)
}

containsEmptyValue <- function(vec) {
  containsEmpty <- F
  if (anyNA(vec) || "" %in% vec)
    containsEmpty <- T
  return(containsEmpty)
}

existMandatoryEdgeColumns <- function(edges) {
  exist <- T
  if (!all(MANDATORY_JSON_EDGE_COLUMNS  %in%
           colnames(edges))) {
    exist <- F
    renderWarning("Your JSON edges must contain at least a src and a trg node.\n
                  See our Help page -> API")
  } else if (containsEmptyValue(edges$src)) {
    exist <- F
    renderWarning("Your JSON edges contain at least one empty src value.\n
                  Source Nodes along with their layers cannot be empty.")
  } else if (containsEmptyValue(edges$trg)) {
    exist <- F
    renderWarning("Your JSON edges contain at least one empty trg value.\n
                  Target Nodes along with their layers cannot be empty.")
  }
  return(exist)
}

parseUploadedJSON <- function(jsonNetwork) {
  jsonNetwork <- subsetLegitObjects(jsonNetwork)
  jsonNetwork <- trimJSONData(jsonNetwork)
  jsonNetwork <- handleJSONChannels(jsonNetwork)
  jsonNetwork$edges <- removeDuplicateJSONEdges(jsonNetwork$edges)
  jsonNetwork <- chooseSceneOrDefaults(jsonNetwork)
  jsonNetwork <- chooseLayersOrDefaults(jsonNetwork)
  jsonNetwork <- chooseToScrambleNodes(jsonNetwork)
  jsonNetwork <- chooseNodesOrDefaults(jsonNetwork)
  jsonNetwork <- chooseEdgesOrDefaults(jsonNetwork)
  jsonNetwork <- addExtraJSONCommands(jsonNetwork)
  return(jsonNetwork)
}

subsetLegitObjects <- function(jsonNetwork) {
  combinedLegitObjects <- c(MANDATORY_JSON_OBJECTS, OPTIONAL_JSON_OBJECTS)
  existingLegitObjects <- combinedLegitObjects[which(combinedLegitObjects %in%
                                                       names(jsonNetwork))]
  return(jsonNetwork[existingLegitObjects])
}

trimJSONData <- function(jsonNetwork) {
  invisible(lapply(names(jsonNetwork), function(objName) {
    if (typeof(jsonNetwork[[objName]]) == "list") {
      invisible(lapply(names(jsonNetwork[[objName]]), function(insideObjName) {
        jsonNetwork[[objName]][[insideObjName]] <<-
          trimws(jsonNetwork[[objName]][[insideObjName]])
      }))
    } else
      jsonNetwork[[objName]] <<- trimws(jsonNetwork[[objName]])
  }))
  return(jsonNetwork)
}

handleJSONChannels <- function(jsonNetwork) {
  if (!is.null(jsonNetwork$edges$channel)) {
    if (all(jsonNetwork$edges$channel == "")) {
      jsonNetwork$edges$channel <- NULL
    } else if ((any(jsonNetwork$edges$channel == "")) ||
                (any(is.na(jsonNetwork$edges$channel)))) {
      jsonNetwork$edges$channel <- NULL
      renderWarning("At least one edge has no channel name.\n
                    Removing channels completely.")
    }
  }
  return(jsonNetwork)
}

removeDuplicateJSONEdges <- function(edges) {
  if (is.null(edges$channel))
    edges <- dplyr::distinct(edges, src, trg, .keep_all = T)
  else
    edges <- dplyr::distinct(edges, src, trg, channel, .keep_all = T)
  return(edges)
}

chooseSceneOrDefaults <- function(jsonNetwork) {
  if (!"scene" %in% names(jsonNetwork))
    jsonNetwork$scene <- list()
  jsonNetwork$scene$position_x <-
    keepValuesOrDefault(jsonNetwork$scene$position_x)
  jsonNetwork$scene$position_y <-
    keepValuesOrDefault(jsonNetwork$scene$position_y)
  jsonNetwork$scene$scale <-
    keepValuesOrDefault(jsonNetwork$scene$scale, "0.9")
  jsonNetwork$scene$color <-
    keepValuesOrDefault(jsonNetwork$scene$color, "#000000")
  jsonNetwork$scene$rotation_x <-
    keepValuesOrDefault(jsonNetwork$scene$rotation_x, "0.261799388")
  jsonNetwork$scene$rotation_y <-
    keepValuesOrDefault(jsonNetwork$scene$rotation_y, "0.261799388")
  jsonNetwork$scene$rotation_z <-
    keepValuesOrDefault(jsonNetwork$scene$rotation_z, "0.261799388")
  return(jsonNetwork)
}

keepValuesOrDefault <- function(jsonNetworkVec, default = "0") {
  if (is.null(jsonNetworkVec)) {
    jsonNetworkVec <- default
  } else if (identical(jsonNetworkVec, "TRUE")) {
    jsonNetworkVec <- T
  } else if (identical(jsonNetworkVec, "FALSE")) {
    jsonNetworkVec <- F
  } else {
    jsonNetworkVec[is.na(jsonNetworkVec)] <- default
    jsonNetworkVec[jsonNetworkVec == ""] <- default
  }
  return(jsonNetworkVec)
}

chooseLayersOrDefaults <- function(jsonNetwork) {
  # flag to move layer with JS if a coord was not given
  jsonNetwork$layers$generate_coordinates <-
    decideGenerateCoordinatesFlag(jsonNetwork$layers)
  jsonNetwork$layers$position_x <-
    keepValuesOrDefault(jsonNetwork$layers$position_x)
  jsonNetwork$layers$position_y <-
    keepValuesOrDefault(jsonNetwork$layers$position_y)
  jsonNetwork$layers$position_z <-
    keepValuesOrDefault(jsonNetwork$layers$position_z)
  jsonNetwork$layers$last_layer_scale <-
    keepValuesOrDefault(jsonNetwork$layers$last_layer_scale, "1")
  jsonNetwork$layers$rotation_x <-
    keepValuesOrDefault(jsonNetwork$layers$rotation_x)
  jsonNetwork$layers$rotation_y <-
    keepValuesOrDefault(jsonNetwork$layers$rotation_y)
  jsonNetwork$layers$rotation_z <-
    keepValuesOrDefault(jsonNetwork$layers$rotation_z)
  jsonNetwork$layers$floor_current_color <-
    keepValuesOrDefault(jsonNetwork$layers$floor_current_color,
                        FLOOR_DEFAULT_COLOR)
  jsonNetwork$layers$geometry_parameters_width <-
    keepValuesOrDefault(jsonNetwork$layers$geometry_parameters_width,
                        FLOOR_DEFAULT_WIDTH)
  return(jsonNetwork)
}

decideGenerateCoordinatesFlag <- function(layers) {
  layers$generate_coordinates <- F
  if (is.null(layers$position_x) || is.null(layers$position_y) ||
      is.null(layers$position_z)) {
    layers$generate_coordinates <- T
  } else {
    invisible(lapply(c("x", "y", "z"), function(dimension) {
      layers$generate_coordinates[
        which(is.na(layers[[paste0("position_", dimension)]]))] <<- T
      layers$generate_coordinates[
        which(layers[[paste0("position_", dimension)]] == "")] <<- T
    }))
  }
  return(layers$generate_coordinates)
}

chooseToScrambleNodes <- function(jsonNetwork) {
  if (is.null(jsonNetwork$nodes$position_x) &&
     is.null(jsonNetwork$nodes$position_y) &&
     is.null(jsonNetwork$nodes$position_z))
    jsonNetwork$scramble_nodes <- T
  else 
    jsonNetwork$scramble_nodes <- F
  return(jsonNetwork)
}

chooseNodesOrDefaults <- function(jsonNetwork) {
  jsonNetwork$nodes$position_x <-
    keepValuesOrDefault(jsonNetwork$nodes$position_x)
  jsonNetwork$nodes$position_y <-
    keepValuesOrDefault(jsonNetwork$nodes$position_y)
  jsonNetwork$nodes$position_z <-
    keepValuesOrDefault(jsonNetwork$nodes$position_z)
  jsonNetwork$nodes$scale <-
    keepValuesOrDefault(jsonNetwork$nodes$scale)
  jsonNetwork$nodes$scale <-
    keepValuesOrDefault(jsonNetwork$nodes$scale, 1)
  jsonNetwork$nodes$color <-
    keepValuesOrDefault(jsonNetwork$nodes$color,
                        NODE_COLORS[match(jsonNetwork$nodes$layer,
                                          jsonNetwork$layer$name)])
  jsonNetwork$nodes$url <-
    keepValuesOrDefault(jsonNetwork$nodes$url, "")
  jsonNetwork$nodes$descr <-
    keepValuesOrDefault(jsonNetwork$nodes$descr, "")
  return(jsonNetwork)
}

chooseEdgesOrDefaults <- function(jsonNetwork) {
  jsonNetwork$edges$opacity <-
    keepValuesOrDefault(jsonNetwork$edges$opacity, 1)
  jsonNetwork$edges$color <-
    keepValuesOrDefault(jsonNetwork$edges$color, EDGE_DEFAULT_COLOR)
  return(jsonNetwork)
}

addExtraJSONCommands <- function(jsonNetwork) {
  jsonNetwork$universalLabelColor <-
    keepValuesOrDefault(jsonNetwork$universalLabelColor, "#FFFFFF")
  jsonNetwork$direction <-
    keepValuesOrDefault(jsonNetwork$direction, F)
  jsonNetwork$edgeOpacityByWeight <-
    keepValuesOrDefault(jsonNetwork$edgeOpacityByWeight, T)
  return(jsonNetwork)
}

extractNetworkDFFromJSONNetwork <- function(jsonNetwork) {
  create_node_layerDF_fromJSON(jsonNetwork$nodes)
  df <- parseJSONEdgesIntoNetwork(jsonNetwork$edges)
  return(df)
}

create_node_layerDF_fromJSON <- function(jsonNodes) {
  node_layerDF <<- jsonNodes[, c("name", "layer")]
  node_layerDF$NodeLayer <<- paste(node_layerDF$name,
                                   node_layerDF$layer, sep = "_")
  node_layerDF <<- node_layerDF[, c("NodeLayer", "name", "layer")]
  colnames(node_layerDF)[2] <<- "Node"
  colnames(node_layerDF)[3] <<- "Layer"
  node_layerDF <<- unique(node_layerDF)
}

parseJSONEdgesIntoNetwork <- function(edges) {
  channelColumn <- NULL
  if ("channel" %in% colnames(edges))
    channelColumn <- "channel"
  opacityColumn <- NULL
  if ("opacity" %in% colnames(edges))
    opacityColumn <- "opacity"
  
  df <- edges[, c(MANDATORY_JSON_EDGE_COLUMNS, channelColumn, opacityColumn)]
  colnames(df)[colnames(df) == "src"] <- "SourceNode_Layer"
  colnames(df)[colnames(df) == "trg"] <- "TargetNode_Layer"
  colnames(df)[colnames(df) == "channel"] <- "Channel"
  colnames(df)[colnames(df) == "opacity"] <- "Weight"
  
  df$SourceNode <- extractColumnFrom_node_layerDF(df$SourceNode_Layer, "Node")
  df$SourceLayer <- extractColumnFrom_node_layerDF(df$SourceNode_Layer, "Layer")
  df$TargetNode <- extractColumnFrom_node_layerDF(df$TargetNode_Layer, "Node")
  df$TargetLayer <- extractColumnFrom_node_layerDF(df$TargetNode_Layer, "Layer")
  df <- appendScaledNetworkWeights(df)
  
  channelColumn <- NULL
  if ("Channel" %in% colnames(df))
    channelColumn <- "Channel"
  df <- df[, c(MANDATORY_NETWORK_COLUMNS, channelColumn, "Weight",
               "SourceNode_Layer", "TargetNode_Layer", "ScaledWeight")]
  return(df)
}

generateNetworkFromDF_JSONVersion <- function(jsonNetwork) {  
  callJSHandler("handler_importNetwork", jsonNetwork)
  renderNetworkDF(networkDF)
  
  updateSelectInput(session, "navBar", selected = "Main View")
  reset("input_network_file")
  reset("node_attributes_file")
  reset("edge_attributes_file")
}

# API ####
resolveAPI <- function() {
  tryCatch({
    query <- parseQueryString(session$clientData$url_search)
    if (length(query$f) > 0) {
      renderModal("<h2>Please wait.</h2><br /><p>Importing network from API.</p>")
      loadNetworkFromJSONFilepath(paste0(POST_REQUEST_PATH, query$f))
      updateNavbarPage(session, "navBar", selected = "Main View")
    }
  }, error = function(e) {
    print(paste0("API error: ", e))
    renderError("Error with external API call.")
  }, finally = {
    removeModal()
  })
}

# Upload NODE attributes ####
handleInputNodeAttributeFileUpload <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Uploading node attributes.</p>")
    nodeFile <- input$node_attributes_file$datapath
    if (!is.null(nodeFile)) {
      nodeAttributes <- read.delim(nodeFile)
      if (existMandatoryNodeAttributeColumns(nodeAttributes)) {
        nodeAttributes$NodeLayer <- paste(trimws(nodeAttributes$Node),
                                          trimws(nodeAttributes$Layer), sep = "_")
        if (!is.null(nodeAttributes$Color))
          nodeAttributes$Color <- trimws(nodeAttributes$Color)
        if (!is.null(nodeAttributes$Size))
          nodeAttributes$Size <- trimws(nodeAttributes$Size)
        if (!is.null(nodeAttributes$Url))
          nodeAttributes$Url <- trimws(nodeAttributes$Url)
        if (!is.null(nodeAttributes$Description))
          nodeAttributes$Description <- trimws(nodeAttributes$Description)
        
        callJSHandler("handler_setNodeAttributes", jsonlite::toJSON(nodeAttributes))
        callJSHandler("handler_clickNodeColorPriority", "default")
        updateSelectInput(session, "navBar", selected = "Main View")
      }
    }
  }, error = function(e) {
    print(paste0("Error during input node attributes file upload:  ", e))
    renderError("Bad node attributes file format.")
  }, finally = {
    removeModal()
  })
}

existMandatoryNodeAttributeColumns <- function(nodeAttributes) {
  exist <- T
  if (is.null(nodeAttributes$Node) || is.null(nodeAttributes$Layer)) {
    exist <- F
    renderWarning("Your node attribute file must contain at least two columns:\n
                  Node and Layer")
  }
  return(exist)
}

# Upload EDGE attributes ####
handleInputEdgeAttributeFileUpload <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Uploading edge attributes.</p>")
    edgeFile <- input$edge_attributes_file$datapath
    if (!is.null(edgeFile)) {
      edgeAttributes <- read.delim(edgeFile)
      if (existMandatoryEdgeAttributeColumns(edgeAttributes)) {
        edgeAttributes$EdgePair <- paste(
          paste(trimws(edgeAttributes$SourceNode), trimws(edgeAttributes$SourceLayer), sep = "_"),
          paste(trimws(edgeAttributes$TargetNode), trimws(edgeAttributes$TargetLayer), sep = "_"),
          sep = "---"
        )
        edgeAttributes$Color <- trimws(edgeAttributes$Color)
        if ("Channel" %in% colnames(edgeAttributes)) {
          edgeAttributes$Channel <- trimws(edgeAttributes$Channel)
          edgeAttributes <- edgeAttributes[, c("EdgePair", "Color", "Channel")]
        } else
          edgeAttributes <- edgeAttributes[, c("EdgePair", "Color")]
        callJSHandler("handler_setEdgeAttributes", jsonlite::toJSON(edgeAttributes))
        updateSelectInput(session, "navBar", selected = "Main View")
      }
    }
  }, error = function(e) {
    print(paste0("Error during input edge attributes file upload:  ", e))
    renderError("Bad edge attributes file format.")
  }, finally = {
    removeModal()
  })
}

existMandatoryEdgeAttributeColumns <- function(edgeAttributes) {
  exist <- T
  if (is.null(edgeAttributes$SourceNode) || is.null(edgeAttributes$SourceLayer) ||
      is.null(edgeAttributes$TargetNode) || is.null(edgeAttributes$TargetLayer) ||
      is.null(edgeAttributes$Color)) {
    exist <- F
    renderWarning("Your edge attribute file must contain at least these five columns:\n
                  SourceNode, SourceLayer, TargetNode and TargetLayer,
                  and optionally a Channel name.")
  }
  return(exist)
}

# Save Session ####
convertSessionToJSON <- function() {
  js_scene_pan <- jsonlite::fromJSON(input$js_scene_pan)
  js_scene_sphere <- jsonlite::fromJSON(input$js_scene_sphere)
  js_layers <- jsonlite::fromJSON(input$js_layers)
  js_nodes <- jsonlite::fromJSON(input$js_nodes)
  js_edge_pairs <- jsonlite::fromJSON(input$js_edge_pairs)
  js_edge_colors <- jsonlite::fromJSON(input$js_edge_colors)
  js_label_color <- input$js_label_color
  direction_flag <- input$edgeDirectionToggle
  edgeByWeight_flag <- input$edgeWidthByWeight
  
  scene <- c(js_scene_pan, js_scene_sphere)
  edges <- as.data.frame(c(js_edge_pairs, js_edge_colors))
  
  exportData <- list(
    scene = scene, layers = js_layers, nodes = js_nodes,
    edges = edges, universalLabelColor = js_label_color,
    direction = direction_flag, edgeOpacityByWeight = edgeByWeight_flag
  )
  exportData <- jsonlite::toJSON(exportData, auto_unbox = T)
  return(exportData)
}

# Load Example ####
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
  generateNetworkFromDF(fromUpload = F)
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
