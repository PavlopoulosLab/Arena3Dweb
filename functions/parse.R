parseInputJSONFile_old <- function(inFile){ # TODO remove
  networkDF <<-  matrix("", nrow = 0, ncol = 6)
  colnames(networkDF) <<- c("SourceNode", "SourceLayer", "TargetNode", "TargetLayer", "Weight", "Channel")
  uniqueNodes <- matrix("", nrow = 0, ncol = 1)
  nodeGroups <- matrix("", nrow = 0, ncol = 1) # map node rows from above to groups
  uniqueChannels <- matrix("", nrow = 0, ncol = 5)
  
  
  jsonNetwork <- fromJSON(inFile)
  node_layerDF_table_fromJSON(jsonNetwork$nodes)

  max_cols <- 11 # layers with generate coordinates boolean 
  if(length(jsonNetwork) > 2){
    network_matrix = matrix("", nrow = 0, ncol = max_cols)
    
    # scene + defaults
    scene <- jsonNetwork$scene
    if (identical(jsonNetwork$scene, NULL)){ # all defaults
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
    if (nrow(jsonNetwork$layers) > 0){
      layers <- jsonNetwork$layers
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
      if (nrow(jsonNetwork$nodes) > 0){
        nodes <- jsonNetwork$nodes
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
      
      if (nrow(jsonNetwork$edges) > 0){
        edges <- jsonNetwork$edges
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
        saveRDS(networkDF, "networkDF.RDS")
      } else
        renderWarning("Edge Problem. Not a valid Arena3D object.")
      if (nrow(networkDF) > MAX_EDGES)
        renderWarning(paste0("Network must contain no more than ", MAX_EDGES, " edges."))
      else {
        if (length(jsonNetwork$universalLabelColor) == 1){
          callJSHandler("handler_globalLabelColor", jsonNetwork$universalLabelColor)
        } else callJSHandler("handler_globalLabelColor", "#ffffff","","",
                                                  "", "", "", "", "", "", "")
        if (length(jsonNetwork$direction) == 1){
          network_matrix <- rbind(network_matrix, c("direction", jsonNetwork$direction,"","",
                                                  "", "", "", "", "", "", ""))
        }
        if (length(jsonNetwork$edgeOpacityByWeight) == 1){
          network_matrix <- rbind(network_matrix, c("edgeopacitybyweight", jsonNetwork$edgeOpacityByWeight,"","",
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
