# Upload Network ####
handleUploadNetwork <- function() {
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
  jsonNetwork <- fromJSON(filePath)
  if (isJSONFormatValid(jsonNetwork)) {
    reset_UI_values()
    
    # new, from Upload
    networkDF <<- parseUploadedJSON(jsonNetwork)
    # generateStaticNetwork()
    
    # old, from Import
    # shinyjs::show("layerColorFilePriority")
    # updateCheckboxInput(session,'layerColorFilePriority', value = T);
    # parseInputJSONFile(inFile$datapath)
    # updateSelectInput(session, "navBar", selected = "Main View")
    # 
    # reset("input_network_file")
    # reset("node_attributes_file")
    # reset("edge_attributes_file")
  }
}

isJSONFormatValid <- function(jsonNetwork) {
  isValid <- T
  if (!existMandatoryObjects(jsonNetwork))
    isValid <- F
  if (!existMandatoryEdgeColumns(jsonNetwork$edges))
    isValid <- F
  
  # TODO add more checks
  
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

existMandatoryEdgeColumns <- function(edges) {
  
  # TODO continue from here, empty rows in edges src/trg
  
  exist <- T
  if (!all(MANDATORY_JSON_EDGE_COLUMNS  %in%
           colnames(edges))) {
    exist <- F
    renderWarning("Your JSON edges must contain at least a src and a trg node\n
                  See our Help page -> API")
  }
  return(exist)
}

parseUploadedJSON <- function(jsonNetwork) {
  jsonNetwork <- subsetLegitObjects(jsonNetwork)
  df <- parseJSONEdgesIntoNetwork(jsonNetwork$edges)
  
  # old
  # df <- trimNetworkData(df)
  # df <- appendScaledNetworkWeights(df)
  # df <- appendNodeLayerCombinations(df)
  # df <- reorderNetworkColumns(df)
  return(df)
}

parseJSONEdgesIntoNetwork <- function(edges) {
  
  return(networkDF)
}

subsetLegitObjects <- function(jsonNetwork) {
  combinedLegitObjects <- c(MANDATORY_JSON_OBJECTS, OPTIONAL_JSON_OBJECTS)
  existingLegitObjects <- combinedLegitObjects[which(combinedLegitObjects %in%
                                                       names(jsonNetwork))]
  return(jsonNetwork[existingLegitColumns])
}

# Upload NODE attributes ####
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

# Upload EDGE attributes ####
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

# Save Session ####

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

parseInputJSONFile <- function(inFile){
  networkDF <<-  matrix("", nrow = 0, ncol = 6)
  colnames(networkDF) <<- c("SourceNode", "SourceLayer", "TargetNode", "TargetLayer", "Weight", "Channel")
  uniqueNodes <- matrix("", nrow = 0, ncol = 1)
  nodeGroups <- matrix("", nrow = 0, ncol = 1) # map node rows from above to groups
  uniqueChannels <- matrix("", nrow = 0, ncol = 5)
  raw_json <- fromJSON(inFile)
  node_layerDF_table_fromJSON(raw_json$nodes)
  
  max_cols <- 11 # layers with generate coordinates boolean 
  if(length(raw_json) > 2){
    network_matrix = matrix("", nrow = 0, ncol = max_cols)
    
    # scene + defaults
    scene <- raw_json$scene
    if (identical(raw_json$scene, NULL)){ # all defaults
      network_matrix <- rbind(network_matrix, c("scene", 0, 0, 0.9, "#000000",
                                                0.261799388, 0.261799388, 0.261799388, "", "",""))
    } else{
      network_matrix <- rbind(network_matrix, c("scene", 
                                                ifelse(identical(scene$position_x, NULL), 0, scene$position_x), 
                                                ifelse(identical(scene$position_y, NULL), 0, scene$position_y), 
                                                ifelse(identical(scene$scale, NULL), 0.9, scene$scale), 
                                                ifelse(identical(scene$color, NULL), "#000000", scene$color),
                                                ifelse(identical(scene$rotation_x, NULL), "0.261799388", scene$rotation_x),
                                                ifelse(identical(scene$rotation_y, NULL), "0.261799388", scene$rotation_y),
                                                ifelse(identical(scene$rotation_z, NULL), "0.261799388", scene$rotation_z),
                                                "", "", ""))
    }
    
    # layers
    if (nrow(raw_json$layers) > 0){
      layers <- raw_json$layers
      uniqueLayers <- unique(layers)
      if (nrow(uniqueLayers) > MAX_LAYERS) {
        renderWarning(paste0("Network must contain no more than ", MAX_LAYERS, " layers."))
        return(FALSE)
      }      
      for(i in 1:nrow(layers)) {
        #reset the value
        generate_coordinates <- FALSE
        # Check if it has only name
        if( !"position_x"  %in% colnames(layers) || layers$position_x[i] == "") {
          position_x <-  0
          generate_coordinates <- TRUE
        } else {
          position_x <- layers$position_x[i]
        }
        if(!"position_y" %in% colnames(layers) || layers$position_y[i] == "") {
          position_y <- 0
          generate_coordinates <- TRUE
        } else {
          position_y <- layers$position_y[i]
        }
        if(!"position_z" %in% colnames(layers) || layers$position_z[i] == "") {
          position_z <- 0
          generate_coordinates <- TRUE
        } else {
          position_z <- layers$position_z[i]
        }
        if(!"last_layer_scale" %in% colnames(layers) || layers$last_layer_scale[i] == "") {
          last_layer_scale <- 1
        } else {
          last_layer_scale <- layers$last_layer_scale[i]
        }
        if(!"rotation_x" %in% colnames(layers) || layers$rotation_x[i] == "") {
          rotation_x <- 0
        } else {
          rotation_x <- layers$rotation_x[i]
        }
        if(!"rotation_y" %in% colnames(layers) || layers$rotation_y[i] == "") {
          rotation_y <- 0
        } else {
          rotation_y <- layers$rotation_y[i]
        }
        if(!"rotation_z" %in% colnames(layers) || layers$rotation_z[i] == "") {
          rotation_z <- 0
        } else {
          rotation_z <- layers$rotation_z[i]
        }
        if(!"floor_current_color" %in% colnames(layers) || layers$floor_current_color[i] == "") {
          floor_current_color <-  "#777777"
        } else {
          floor_current_color <- layers$floor_current_color[i]
        }
        if(!"geometry_parameters_width" %in% colnames(layers) || layers$geometry_parameters_width[i] == "") {
          geometry_parameters_width <-  1001.90476190476
          network_matrix <- rbind(network_matrix, c("adjust_layer_size", TRUE,"","",
                                                    "", "", "", "", "", "", ""))
        } else {
          geometry_parameters_width <- layers$geometry_parameters_width[i]
        }
        network_matrix <- rbind(network_matrix, c("layer", as.character(position_x), as.character(position_y), as.character(position_z), as.character(last_layer_scale),
                                                  as.character(rotation_x), as.character(rotation_y), as.character(rotation_z), as.character(floor_current_color), as.character(geometry_parameters_width), as.character(generate_coordinates)))
      }
      if (nrow(raw_json$nodes) > 0){
        nodes <- raw_json$nodes
        # if all the positions are missing we need to scramble the nodes manually (JS function)
        if(!"position_x"  %in% colnames(nodes) && !"position_y"  %in% colnames(nodes) && !"position_z"  %in% colnames(nodes)) {
          scramble_nodes <- TRUE
          network_matrix <- rbind(network_matrix, c("scramble_nodes", TRUE,"","",
                                                    "", "", "", "", "", "", ""))
        }
        for(i in 1:nrow(nodes)) {
          # Check if it has only name
          if( !"position_x"  %in% colnames(nodes) || nodes$position_x[i] == "") {
            position_x <- 0
          } else {
            position_x <- nodes$position_x[i]
          }
          if( !"position_y"  %in% colnames(nodes) || nodes$position_y[i] == "") {
            position_y <- 0
          } else {
            position_y <- nodes$position_y[i]
          }
          if( !"position_z"  %in% colnames(nodes) || nodes$position_z[i] == "") {
            position_z <- 0
          } else {
            position_z <- nodes$position_z[i]
          }
          if( !"scale"  %in% colnames(nodes) || nodes$scale[i] == "") {
            scale <- 1
          } else {
            scale <- nodes$scale[i]
          }
          if( !"color"  %in% colnames(nodes) || nodes$color[i] == "") {
            color <- channel_colors[(match(nodes$layer[i],layers$name))%%length(layers$name) + 1] 
          } else {
            color <- nodes$color[i]
          }
          if( !"url"  %in% colnames(nodes)) {
            url <- ""
          } else {
            url <- nodes$url[i]
          }
          if( !"descr"  %in% colnames(nodes)) {
            descr <- ""
          } else {
            descr <- nodes$descr[i]
          }
          network_matrix <- rbind(network_matrix, c("node", trimws(as.character(nodes[[1]][i])), as.character(nodes[[2]][i]), as.character(position_x), as.character(position_y),
                                                    as.character(position_z), as.character(scale), as.character(color), as.character(url), as.character(descr), ""))
          uniqueNodes <- rbind(uniqueNodes, paste(trimws(as.character(nodes[[1]][i])), as.character(nodes[[2]][i]), sep = "_"))
          
          nodeGroups <- rbind(nodeGroups, as.character(nodes[[2]][i]))
        }
      } else
        renderWarning("Node Problem. Not a valid Arena3D object.")
      
      if (nrow(raw_json$edges) > 0){
        edges <- raw_json$edges
        for(i in 1:nrow(edges)) { #channels
          if (as.character(edges[[5]][i]) == " " | as.character(edges[[5]][i]) == "") {
            edges[[5]][i] = NA
          }
          nodes_pair <- paste(c(trimws(as.character(edges[[1]][i])),trimws(as.character(edges[[2]][i]))), collapse="---")
          network_matrix <- rbind(network_matrix,c("edge",nodes_pair, as.character(edges[[3]][i]),
                                                   as.character(edges[[4]][i]),as.character(edges[[5]][i]), "", "", "", "", "", ""))
          node1 <- trimws(as.character(edges[[1]][i]))
          node2 <- trimws(as.character(edges[[2]][i]))
          group1 <- nodeGroups[match(node1, uniqueNodes), 1]
          group2 <- nodeGroups[match(node2, uniqueNodes), 1]
          networkDF <<- rbind(networkDF, c(node1, group1, node2, group2, as.character(edges[[3]][i]),as.character(edges[[5]][i])))
        }
        #Check if there isn't any channel if yes then drop the column
        if (all(is.na(networkDF[,6]))) networkDF <<- networkDF[, colnames(networkDF) != "Channel", drop=F]
        else if (any(is.na(networkDF[,6]))) { # Check if not all edges have a channel name
          renderWarning("Channel Problem. Not a valid Arena3D object.")
        }
        networkDF <<- as.data.frame(networkDF)
        printNetworkDF_old()
      } else
        renderWarning("Edge Problem. Not a valid Arena3D object.")
      if (nrow(networkDF) > MAX_EDGES)
        renderWarning(paste0("Network must contain no more than ", MAX_EDGES, " edges."))
      else {
        if (length(raw_json$universalLabelColor) == 1){
          callJSHandler("handler_globalLabelColor", raw_json$universalLabelColor)
        } else callJSHandler("handler_globalLabelColor", "#ffffff","","",
                             "", "", "", "", "", "", "")
        if (length(raw_json$direction) == 1){
          network_matrix <- rbind(network_matrix, c("direction", raw_json$direction,"","",
                                                    "", "", "", "", "", "", ""))
        }
        if (length(raw_json$edgeOpacityByWeight) == 1){
          network_matrix <- rbind(network_matrix, c("edgeopacitybyweight", raw_json$edgeOpacityByWeight,"","",
                                                    "", "", "", "", "", "", ""))
        }
        callJSHandler("handler_importNetwork", network_matrix)
      }
    } else
      renderWarning("Layer Problem. Not a valid Arena3D object.")
  } else
    renderWarning("Empty File. Not a valid Arena3D object. Please try again.")
  return(TRUE)
}

node_layerDF_table_fromJSON <- function(jsonNodes) {
  node_layerDF <<- jsonNodes[, c("name", "layer")]
  node_layerDF$NodeLayer <<- paste(node_layerDF$name,
                                   node_layerDF$layer, sep = "_")
  node_layerDF <<- node_layerDF[, c("NodeLayer", "name", "layer")]
  colnames(node_layerDF)[2] <<- "Node"
  colnames(node_layerDF)[3] <<- "Layer"
  node_layerDF <<- unique(node_layerDF)
}

printNetworkDF_old <- function() { # TODO remove after import has been updated
  formattedNetwork <- networkDF
  formattedNetwork$SourceNode <-
    extractColumnFrom_node_layerDF(formattedNetwork$SourceNode, "Node")
  formattedNetwork$TargetNode <- 
    extractColumnFrom_node_layerDF(formattedNetwork$TargetNode, "Node")
  channelColumn <- "Channel"
  if (is.null(formattedNetwork$Channel))
    channelColumn <- NULL
  weightColumn <- "Weight"
  if (is.null(formattedNetwork$Weight))
    weightColumn <- NULL
  formattedNetwork <- formattedNetwork[, c("SourceNode", "SourceLayer",
                                           "TargetNode", "TargetLayer",
                                           channelColumn, weightColumn)]
  renderNetworkDF(formattedNetwork)
}

format_export_data <- function(js_scene_pan, js_scene_sphere, js_layers, js_nodes, js_edge_pairs, label_color, direction){
  scene_df <- list(position_x=unbox(js_scene_pan[1]), position_y=unbox(js_scene_pan[2]), scale=unbox(js_scene_pan[3]), color=unbox(js_scene_pan[4]),
                   rotation_x=unbox(toString(js_scene_sphere[1])), rotation_y=unbox(toString(js_scene_sphere[2])), rotation_z=unbox(toString(js_scene_sphere[3])))
  
  layer_df <- data.frame()
  for (i in 1:nrow(js_layers)){
    layer_df <- rbind(layer_df, c(js_layers[i, 1], js_layers[i, 2], js_layers[i, 3], js_layers[i, 4], js_layers[i, 5],
                                  js_layers[i, 6], js_layers[i, 7],js_layers[i, 8], js_layers[i, 9], js_layers[i, 10]))                        
  }
  colnames(layer_df) <- c("name", "position_x", "position_y", "position_z", "last_layer_scale", "rotation_x", "rotation_y", "rotation_z", "floor_current_color", "geometry_parameters_width")
  
  nodes_df <- data.frame()
  for (i in 1:nrow(js_nodes)){
    nodes_df <- rbind(nodes_df, c(js_nodes[i, 1], js_nodes[i, 2], js_nodes[i, 3], js_nodes[i, 4],
                                  js_nodes[i, 5], js_nodes[i, 6], js_nodes[i, 7],
                                  trimws(js_nodes[i, 8]), trimws(js_nodes[i, 9])))
  }
  colnames(nodes_df) <- c("name", "layer", "position_x", "position_y", "position_z", "scale", "color", "url", "descr")
  
  edges_df <- data.frame()
  for (i in 1:nrow(js_edge_pairs)){
    line_split <- strsplit(as.character(js_edge_pairs[i, 1]), "---")
    node1 <- trimws(line_split[[1]][1])
    node2 <- trimws(line_split[[1]][2])
    edges_df <- rbind(edges_df, c(node1,node2, js_edge_pairs[i, 2], js_edge_pairs[i, 3], js_edge_pairs[i, 4] ))
  }
  colnames(edges_df) <- c("src", "trg", "opacity", "color", "channel")
  
  matrix <- list(scene = scene_df, layers = layer_df, nodes = nodes_df, edges = edges_df, universalLabelColor = unbox(label_color), direction = unbox(direction))
  
  return(matrix)
}
