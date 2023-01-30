server <- function(input, output, session) {
  source("config/global_variables.R", local = T)
  source("config/static_variables.R", local = T)
  source("functions/general.R", local = T)
  source("functions/graph.R", local = T)
  source("functions/layout.R", local = T)
  source("functions/topology.R", local = T)
  source("functions/cluster.R", local = T)
  source("functions/parse.R", local = T)
  source("functions/vr.R", local = T)
  
  # GET request ####
  output$url_checker <- renderText({ # this component needs to be in landing page in order to be observed on page load
    tryCatch({
      query <- parseQueryString(session$clientData$url_search)
      if (length(query$f) > 0){ # GET request, f filename
        parse_import_data(paste0(POST_REQUEST_PATH, query$f))
        updateSelectInput(session, "navBar", selected = "Main View")
        paste("") # empty string to not print anything on landing page
      }
    }, error = function(e) {
      print(paste("Error :  ", e))
      session$sendCustomMessage("handler_badObject_alert", paste("Problem with url query handling: ", e, sep=""))
    })
  })
  
  # Communicate variables to js ####
  session$sendCustomMessage("handler_maxAllowedEdges", MAX_EDGES) 
  session$sendCustomMessage("handler_maxAllowedChannels", MAX_CHANNELS)
  session$sendCustomMessage("handler_maxAllowedLayers", MAX_LAYERS)
  session$sendCustomMessage("handler_colorBrewerPallete_dark", CHANNEL_COLORS_DARK)
  session$sendCustomMessage("handler_colorBrewerPallete", CHANNEL_COLORS_LIGHT)

  observeEvent(input$js_checkbox_flag,{ 
     updateCheckboxInput(session, input$js_checkbox_flag[1],value = (input$js_checkbox_flag[2] == 'TRUE'))
  }, ignoreInit = T)


  observeEvent(input$channel_curvature_flag, {
    if(input$channel_curvature_flag) {
      shinyjs::show("channelCurvature")
      shinyjs::show("interChannelCurvature")
    } else {
      shinyjs::hide("channelCurvature")
      shinyjs::hide("interChannelCurvature")
    }
   
  }, ignoreInit = T)
  
  
  # Observe Events ####
  # ~~~I/O ####
  observeEvent(input$input_network_file,{ # creating igraph graph from input file
    tryCatch({
      inFile <- input$input_network_file
      if (!is.null(inFile)){ #input$input_network_file -> NULL initially
        reset_UI_values()
        inData <<- read.delim(inFile$datapath, header = TRUE) # datapath -> temporary location of uploaded file
        
        inData$SourceNode <<- trim(inData$SourceNode)
        inData$SourceLayer <<- trim(inData$SourceLayer)
        inData$TargetNode <<- trim(inData$TargetNode)
        inData$TargetLayer <<- trim(inData$TargetLayer)
        if ("Channel" %in% colnames(inData)) {
          inData$Channel <<- trim(inData$Channel)
        }
        if('' %in% inData$Channel){
          print(paste("A channel name is empty. Channels: ",inData$Channel))
          session$sendCustomMessage("handler_badObject_alert", "A channel name is empty. Please reupload the file with all the channel names.")
        } else {
          if (identical(inData$Weight, NULL)) inData$Weight <<- as.matrix(rep(1,length(inData$SourceNode)))
          else inData$Weight <<- mapper(as.numeric(trim(inData$Weight)), 0.1, 1)
          session$sendCustomMessage("handler_uploadNetwork", inData)
          inData [, "SourceNode"] <<- as.matrix(paste(inData[, "SourceNode"], inData[, "SourceLayer"], sep="_"))
          inData [, "TargetNode"] <<- as.matrix(paste(inData[, "TargetNode"], inData[, "TargetLayer"], sep="_"))
          inData <<- as.data.frame(inData)
        }
        updateSelectInput(session, "navBar", selected = "Main View")
      }
      reset("load_network_file")
      reset("node_attributes_file")
      reset("edge_attributes_file")
    }, error = function(e) {
      print(paste("Error in Uploaded Network file:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Bad Uploaded Network File Format.")
    })
  }, ignoreInit = T)
  
  observeEvent(input$load_network_file,{
    tryCatch({
      inFile <- input$load_network_file
      if (!is.null(inFile)){
        reset_UI_values()
        shinyjs::show("layerColorFilePriority")
          updateCheckboxInput(session,'layerColorFilePriority',value = TRUE);
        parse_import_data(inFile$datapath)
        updateSelectInput(session, "navBar", selected = "Main View")
      }
      reset("input_network_file")
      reset("node_attributes_file")
      reset("edge_attributes_file")
    }, error = function(e) {
      print(paste("Error in Imported Network file:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Bad Imported Network File Format.")
    })
  }, ignoreInit = T)
  
  observeEvent(input$node_attributes_file,{
    tryCatch({
      nodeFile <- input$node_attributes_file$datapath
      nodeAttributes <- read.delim(nodeFile)
      nodeAttributes$Node <- paste(trim(nodeAttributes$Node), trim(nodeAttributes$Layer), sep="_") #concatenation node & group name
      if (!identical(nodeAttributes$Color, NULL)) nodeAttributes$Color <- trim(nodeAttributes$Color)
      if (!identical(nodeAttributes$Size, NULL)) nodeAttributes$Size <- trim(nodeAttributes$Size)
      if (!identical(nodeAttributes$Url, NULL)) nodeAttributes$Url <- trim(nodeAttributes$Url)
      if (!identical(nodeAttributes$Description, NULL)) nodeAttributes$Description <- trim(nodeAttributes$Description)
      if (!is.null(nodeFile)){
        session$sendCustomMessage("handler_nodeAttributes", nodeAttributes)
        updateSelectInput(session, "navBar", selected = "Main View")
      }
    }, error = function(e) {
      print(paste("Error in input Node Attributes file:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Bad Node Attributes File Format.")
    })
  }, ignoreInit = T)
  
  observeEvent(input$edge_attributes_file,{
    tryCatch({
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
        session$sendCustomMessage("handler_edgeAttributes", edgeAttributes)
        updateSelectInput(session, "navBar", selected = "Main View")
      }
    }, error = function(e) {
      print(paste("Error in input Edge Attributes file:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Bad Edge Attributes File Format.")
    })
  }, ignoreInit = T)
  
  # ~~~VR ####
  observeEvent(input$vr_button,{
    tryCatch({
      producePLY(session$token)
      produceHTML(session$token)
      session$sendCustomMessage("handler_browseUrl", paste0(API_URL, session$token))
    }, error = function(e) {
      print(paste("Error in VR parser:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Error while parsing network for VR mode.")
    })
  }, ignoreInit = T)
  
  # Layout ####
  observeEvent(input$runClusterLayout,{
    tryCatch({
      selected_channels <- input$channels_layout;
      if (input$selectLayout != "-"){ # triggers second event when resetting
        selected_layers <- as.numeric(input$selected_layers) # from JS
        if (!identical(selected_layers, numeric(0))){ # at least one selected Layer needed
          layer_group_names <- as.matrix(input$js_layer_names)
          if (input$sub_graphChoice == "perLayer"){ # PER LAYER
            # make separate sub_graphs for each Layer and then run Layout iteratively
            for (i in 1:length(selected_layers)){
              group_name <- layer_group_names[selected_layers[i]+1]
              if (input$selectLayout == "Circle" || input$selectLayout == "Grid" || input$selectLayout == "Random"){
                tempMat <- inData[inData[, "SourceLayer"] == group_name,, drop = F]
                tempMatNodes <- as.matrix(tempMat[, "SourceNode"])
                tempMat <- inData[inData[, "TargetLayer"] == group_name,, drop = F]
                if (nrow(tempMat) >= 2){ # igraph cant create graph with only one row (edge)
                  if (input$selectCluster != "-"){
                    if (input$selectLocalLayout != "-"){
                      applyCluster(tempMat, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                    } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Cluster without selected Local Layout.")
                  } else {
                    tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "TargetNode"]))
                    formatAndApplyLayout(tempMatNodes, FALSE)
                  }
                }  else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
              } else {
                inDataEdgelist <- inData[inData[, "SourceLayer"] == group_name,, drop=F]
                inDataEdgelist <- inDataEdgelist[inDataEdgelist[, "TargetLayer"] == group_name,, drop=F]
                if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                  inDataEdgelist <- checkAndFilterSelectedChannels(inDataEdgelist, selected_channels)
                  if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                    if (input$selectCluster != "-"){
                      if (input$selectLocalLayout != "-"){
                        applyCluster(inDataEdgelist, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                      } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Cluster without selected Local Layout.")
                    } else {
                      sub_graph <- createGraph(inDataEdgelist) # V(graph)
                      sub_nodes <- V(sub_graph)$name # unsorted
                      sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                      applyLayout(sub_graph, sub_nodes, sub_weights)
                    }
                  } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
              }
            }
          } else if (input$sub_graphChoice == "allLayers"){ # ALL LAYERS
            # make a combined sub_graph for each Layer and then run Layout iteratively
            inDataEdgelist <- matrix("", ncol = ncol(inData), nrow = 0)
            groups <- layer_group_names[selected_layers + 1, ]
            for (i in 1:nrow(inData)){
              if ((!is.na(match(inData[i, "SourceLayer"], groups))) && (!is.na(match(inData[i, "TargetLayer"], groups))))
                inDataEdgelist <- rbind(inDataEdgelist, inData[i,])
            }
            if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
              if (input$selectLayout == "Circle" || input$selectLayout == "Grid" || input$selectLayout == "Random"){
                if (input$selectCluster != "-"){
                  if (input$selectLocalLayout != "-"){
                    applyCluster(inDataEdgelist, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                  } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Cluster without selected Local Layout.")
                } else {
                  tempMatNodes <- rbind(inDataEdgelist[,"SourceNode"], inDataEdgelist[,"TargetNode"])
                  formatAndApplyLayout(tempMatNodes, FALSE)
                }
              } else {
                inDataEdgelist <- checkAndFilterSelectedChannels(inDataEdgelist, selected_channels)
                if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                  if (input$selectCluster != "-"){
                    if (input$selectLocalLayout != "-"){
                      applyCluster(inDataEdgelist, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                    } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Cluster without selected Local Layout.")
                  } else {
                    sub_graph <- createGraph(inDataEdgelist) # V(graph)
                    sub_nodes <- V(sub_graph)$name # unsorted
                    sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                    applyLayout(sub_graph, sub_nodes, sub_weights) # execute once, for combined subgraph
                  }
                } else session$sendCustomMessage("handler_badObject_alert", paste("Subgraph of selected Layers could not form a graph.", sep=""))
              }
            } else session$sendCustomMessage("handler_badObject_alert", paste("Subgraph of selected Layers could not form a graph.", sep=""))
          } 
          else { # LOCAL LAYOUTS
            selected_nodes <- input$js_selected_nodes
            if (length(selected_nodes) > 0){ # can't run local layouts without selected nodes
              whole_node_names <- input$js_node_names
              for (i in 1:length(selected_layers)){
                group_name <- layer_group_names[selected_layers[i]+1]
                #Find  edges and nodes in case we need clustering 
                tempMat <- inData[inData[, "SourceLayer"] == group_name,, drop = F]
                tempMat <- tempMat[tempMat[, "TargetLayer"] == group_name,, drop = F] 
                #First filter selected Channels if exist  
                if("Channel" %in% colnames(inData)) {
                  inDataEdgelist <- matrix("", nrow = 0, ncol = 4)
                  colnames(inDataEdgelist) <- c("SourceNode", "TargetNode", "Weight", "Channel")
                  inDataEdgelist <- inDataEdgelist[inDataEdgelist[, "Channel"] == selected_channels,, drop = F]
                } else {
                  inDataEdgelist <- matrix("", nrow = 0, ncol = 3)
                  colnames(inDataEdgelist) <- c("SourceNode", "TargetNode", "Weight")
                }  
                #If we have more than one selected node filter the nodes that we want 
                if (nrow(tempMat) > 1){
                  for (j in 1:nrow(tempMat)){
                    if("Channel" %in% colnames(inData)) {
                      if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selected_nodes+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selected_nodes+1])))){
                        inDataEdgelist <- rbind(inDataEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"],  tempMat[j, "Channel"]))
                      }
                    } else {
                      if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selected_nodes+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selected_nodes+1])))){
                        inDataEdgelist <- rbind(inDataEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"]))
                      }
                    }
                  }
                }  else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                
                if (input$selectLayout == "Circle" || input$selectLayout == "Grid" || input$selectLayout == "Random"){
                  tempMatNodes <- matrix("", nrow = 0, ncol = 1)
                  # for these 3 simple layouts, just find selected node names in selected layers
                  tempMat1 <- inData[inData[, "SourceLayer"] == group_name,, drop = F]
                  tempMat2 <- inData[inData[, "TargetLayer"] == group_name,, drop = F]
                  
                  
                  for (j in 1:length(selected_nodes)){
                    tempMat <- tempMat1[tempMat1[, "SourceNode"] == whole_node_names[selected_nodes[j]+1],, drop = F]
                    tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "SourceNode"]))
                    tempMat <- tempMat2[tempMat2[, "TargetNode"] == whole_node_names[selected_nodes[j]+1],, drop = F]
                    tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "TargetNode"]))
                  }
                  tempMatNodes <- unique(tempMatNodes)
                  if ((nrow(tempMatNodes) >= 2 )){
                    if (input$selectCluster != "-"){
                      if (input$selectLocalLayout != "-"){
                        applyCluster(inDataEdgelist, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                      } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Cluster without selected Local Layout.")
                    } else {
                      formatAndApplyLayout(tempMatNodes, TRUE)
                    }
                  } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                } else {
                  # for the rest of the layouts, use selected edges and nodes
                  if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                    if (input$selectCluster != "-"){
                      if (input$selectLocalLayout != "-"){
                        applyCluster(inDataEdgelist, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                      } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Cluster without selected Local Layout.")
                    } else {
                      formatAndApplyLayout(inDataEdgelist, TRUE)
                    }
                  } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                }
              }
            } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Local Layouts without selected Nodes.")
          }
        }
      } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Layouts and cluster  without selected Layout Algorithm.")
    }, error = function(e) {
      print(paste("Error in Clustering:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Error on Layout or Clustering layout.")
    })
  }, ignoreInit = T)
  
  # Clustering ####
  observeEvent(input$selectCluster,{
    tryCatch({
      if (input$selectCluster != "-"){ # triggers second event when resetting
        shinyjs::show("selectLocalLayout")
      } else {
        shinyjs::hide("selectLocalLayout")
      }
    }, error = function(e) {
      print(paste("Error in Clustering:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Error on Cluster interface.")
    })
  }, ignoreInit = T)
  
  # TopologyScale ####
  observeEvent(input$topologyScale,{
    tryCatch({
      if (input$topologyScale != "-"){ # triggers second event when resetting
        selected_layers <- as.numeric(input$selected_layers)
        if (!identical(selected_layers, numeric(0))){ # at least one selected Layer needed
          layer_group_names <- as.matrix(input$js_layer_names)
          if (input$sub_graphChoice == "perLayer"){
            # make separate sub_graphs for each Layer and then run Layout iteratively
            for (i in 1:length(selected_layers)){
              group_name <- layer_group_names[selected_layers[i]+1] # +1, since layers start from 0 in js
              inDataEdgelist <- inData[inData[, "SourceLayer"] == group_name,,drop=F ]
              inDataEdgelist <- inDataEdgelist[inDataEdgelist[, "TargetLayer"] == group_name,,drop=F ]
              if ( nrow(inDataEdgelist) >= 2 ){ # igraph cant create graph with only one row (edge)
                inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
                sub_graph <- createGraph(inDataEdgelist) # V(graph)
                sub_nodes <- V(sub_graph)$name # unsorted
                sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                scaleTopology(sub_graph, sub_nodes, sub_weights)
              } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
            }
          } else if(input$sub_graphChoice == "allLayers") {
            # make a combined sub_graph for each Layer and then run Layout iteratively
            inDataEdgelist <- matrix("", ncol = length(colnames(inData)), nrow = 0)
            groups <- layer_group_names[selected_layers + 1, ]
            for (i in 1:nrow(inData)){
              if ((!is.na(match(inData[i, "SourceLayer"], groups))) && (!is.na(match(inData[i, "TargetLayer"], groups))))
                inDataEdgelist <- rbind(inDataEdgelist, inData[i,])
            }
            if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
              inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
              sub_graph <- createGraph(inDataEdgelist) # V(graph)
              sub_nodes <- V(sub_graph)$name # unsorted
              sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
              scaleTopology(sub_graph, sub_nodes, sub_weights)
            } else session$sendCustomMessage("handler_badObject_alert", paste("Subgraph of selected Layerss could not form a graph.", sep=""))
          } else{ # local layouts
            selected_nodes <- input$js_selected_nodes
            if(length(selected_nodes) > 0){
              whole_node_names <- input$js_node_names
              for (i in 1:length(selected_layers)){
                group_name <- layer_group_names[selected_layers[i]+1]
                tempMat <- inData[inData[, "SourceLayer"] == group_name,, drop = F]
                tempMat <- tempMat[tempMat[, "TargetLayer"] == group_name,, drop = F]
                inDataEdgelist <- matrix("", nrow = 0, ncol = 3)
                colnames(inDataEdgelist) <- c("SourceNode", "TargetNode", "Weight")
                if (nrow(tempMat) > 1){
                  for (j in 1:nrow(tempMat)){
                    if ((!is.na(match(tempMat[j, "SourceNode"], whole_node_names[selected_nodes+1]))) && (!is.na(match(tempMat[j, "TargetNode"], whole_node_names[selected_nodes+1])))){
                      inDataEdgelist <- rbind(inDataEdgelist, c(tempMat[j, "SourceNode"], tempMat[j, "TargetNode"], tempMat[j, "Weight"]))
                    }
                  }
                  if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                    sub_graph <- createGraph(inDataEdgelist) # V(graph)
                    sub_nodes <- V(sub_graph)$name # unsorted
                    sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                    scaleTopology(sub_graph, sub_nodes, sub_weights)
                  } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
              }
            } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Local Layouts without selected Nodes.")
          }
        }
      }
    }, error = function(e) {
      print(paste("Error in Clustering:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Bad Cluster Edge Attributes File Format.")
    })
    return(TRUE)
  }, ignoreInit = T)
  
  # Hide buttons ####
  observeEvent(list(input$hideButton1, input$hideButton2, input$hideButton3, input$hideButton4, input$hideButton5, input$hideButton6, input$hideButton7),{
    updateSelectInput(session, "navBar", selected = "Main View")
  }, ignoreInit = T)
  
  # JS handler events ####
  # Scene
  observeEvent(input$showSceneCoords,{ session$sendCustomMessage("handler_showSceneCoords", input$showSceneCoords)},ignoreInit = T)
  observeEvent(input$autoRotateScene,{ session$sendCustomMessage("handler_autoRotateScene", input$autoRotateScene)},ignoreInit = T)

  observeEvent(input$predefined_layout,{session$sendCustomMessage("handler_predefined_layer_layout", input$predefined_layout)}, ignoreInit = T)

  # Layers
  observeEvent(input$selectAll,{  session$sendCustomMessage("handler_selectAllLayers", input$selectAll) })
  observeEvent(input$showSelectedLayerLabels,{ session$sendCustomMessage("handler_showSelectedLayerLabels", input$showSelectedLayerLabels) }, ignoreInit = T)
  observeEvent(input$showLayerLabels,{ session$sendCustomMessage("handler_showLayerLabels", input$showLayerLabels) }, ignoreInit = T)
  observeEvent(input$resizeLayerLabels,{ session$sendCustomMessage("handler_resizeLayerLabels", input$resizeLayerLabels) }, ignoreInit = T)
  observeEvent(input$showLayerCoords,{ session$sendCustomMessage("handler_showLayerCoords", input$showLayerCoords) }, ignoreInit = T)
  observeEvent(input$showWireFrames,{ session$sendCustomMessage("handler_showWireFrames", input$showWireFrames) }, ignoreInit = T)
    observeEvent(input$layerColorFilePriority,{ session$sendCustomMessage("handler_layerColorFilePriority", input$layerColorFilePriority) }, ignoreInit = T)
  observeEvent(input$floorOpacity,{ session$sendCustomMessage("handler_floorOpacity", input$floorOpacity) }, ignoreInit = T)
  # Nodes
  observeEvent(input$showLabels,{ session$sendCustomMessage("handler_showLabels", input$showLabels) }, ignoreInit = T)
  observeEvent(input$showSelectedLabels,{ session$sendCustomMessage("handler_showSelectedLabels", input$showSelectedLabels) }, ignoreInit = T)
  observeEvent(input$resizeLabels,{ session$sendCustomMessage("handler_resizeLabels", input$resizeLabels) }, ignoreInit = T)
  observeEvent(input$nodeSelector,{ session$sendCustomMessage("handler_nodeSelector", input$nodeSelector) }, ignoreInit = T)
  observeEvent(input$nodeSelectedColorPriority,{ session$sendCustomMessage("handler_nodeSelectedColorPriority", input$nodeSelectedColorPriority) }, ignoreInit = T)
  # Edges
  observeEvent(input$edgeSelectedColorPriority,{ session$sendCustomMessage("handler_edgeSelectedColorPriority", input$edgeSelectedColorPriority) }, ignoreInit = T)
  observeEvent(input$edgeFileColorPriority,{ session$sendCustomMessage("handler_edgeFileColorPriority", input$edgeFileColorPriority) }, ignoreInit = T)
  observeEvent(input$edgeWidthByWeight,{
    tryCatch({
      if (input$edgeWidthByWeight){ # triggers second event when resetting
        shinyjs::hide("layerEdgeOpacity")
        shinyjs::hide("interLayerEdgeOpacity")
      } else {
        shinyjs::show("layerEdgeOpacity")
        shinyjs::show("interLayerEdgeOpacity")
      }}, error = function(e) {
      print(paste("Error in Edge Opacity:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Error on Edge Opacity interface.")
    })
     session$sendCustomMessage("handler_edgeWidthByWeight", input$edgeWidthByWeight)
      }, ignoreInit = T)
  observeEvent(input$directionToggle,{
    tryCatch({
      if (input$directionToggle){ # triggers second event when resetting
        shinyjs::show("intraDirectionArrowSize")
        shinyjs::show("directionArrowSize")
      } else {
        shinyjs::hide("intraDirectionArrowSize")
        shinyjs::hide("directionArrowSize")
      }
      session$sendCustomMessage("handler_toggleDirection", input$directionToggle) 
    }, error = function(e) {
      print(paste("Error in Direction Size Arrow:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Error on Direction interface.")
    })
  }, ignoreInit = T)
  observeEvent(input$directionArrowSize,{ session$sendCustomMessage("handler_directionArrowSize", input$directionArrowSize) }, ignoreInit = T)
  observeEvent(input$intraDirectionArrowSize,{ session$sendCustomMessage("handler_intraDirectionArrowSize", input$intraDirectionArrowSize) }, ignoreInit = T)
  observeEvent(input$layerEdgeOpacity,{ session$sendCustomMessage("handler_layerEdgeOpacity", input$layerEdgeOpacity) }, ignoreInit = T)
  observeEvent(input$interLayerEdgeOpacity,{ session$sendCustomMessage("handler_interLayerEdgeOpacity", input$interLayerEdgeOpacity) }, ignoreInit = T)
  observeEvent(input$channelCurvature,{ session$sendCustomMessage("handler_channelCurvature", input$channelCurvature) }, ignoreInit = T)
  observeEvent(input$interChannelCurvature,{ session$sendCustomMessage("handler_interChannelCurvature", input$interChannelCurvature) }, ignoreInit = T)
  # Extra
  observeEvent(input$fps,{ session$sendCustomMessage("handler_fps", input$fps) }, ignoreInit = T)
  
  # Download handler JSON ####
  output$save_network_object <- downloadHandler(
    filename = function() {
      paste('network-', Sys.Date(), '.json', sep='')
    },
    content = function(con) {
      if (length(inData) > 1){ # == network loaded
        js_scene_pan <- fromJSON(input$js_scene_pan) # from JS
        js_scene_sphere <- fromJSON(input$js_scene_sphere)
        js_layers <- as.data.frame(fromJSON(input$js_layers))
        js_nodes <- as.data.frame(fromJSON(input$js_nodes))
        js_edge_pairs <- as.data.frame(fromJSON(input$js_edge_pairs))
        js_label_color <- input$js_label_color
        js_direction_flag <- input$directionToggle
        exportData <- format_export_data(js_scene_pan, js_scene_sphere, js_layers, js_nodes, js_edge_pairs, js_label_color, js_direction_flag)
        json_output <- toJSON(exportData)
      }
      write(json_output, con)
    }
  )
  
}
