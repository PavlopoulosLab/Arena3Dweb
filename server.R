server <- function(input, output, session) {
  
  source("global.R")
  
  session$sendCustomMessage("handler_maxAllowedEdges", max_allowed_edges) #communicate variable to js
  
  trim <- function (x) gsub("^\\s+|\\s+$", "", x)
  
  createGraph <- function(edgelist) {
    graph <- graph_from_edgelist(edgelist[, 1:2], directed = FALSE)
    E(graph)$weight <- as.double(edgelist[, 3])
    # remove loops and multiple edges, simplify sum aggregates same edges
    graph <- simplify(graph, remove.multiple = TRUE, remove.loops = TRUE, edge.attr.comb = list(weight = "sum"))
    return(graph)
  }
  
  reset_UI_values <- function(){
    reset("showLabels") #shinyjs resetting checkboxes
    reset("showSelectedLabels")
    reset("showSelectedLayerLabels")
    reset("showLayerLabels")
    reset("resizeLabels")
    reset("showLayerCoords")
    reset("nodeColorAttributePriority")
    reset("nodeSelectedColorPriority")
    reset("edgeColorAttributePriority")
    reset("edgeSelectedColorPriority")
    reset("showWireFrames")
    reset("showSceneCoords")
    reset("layerEdgeOpacity")
    reset("interLayerEdgeOpacity")
    reset("floorOpacity")
    reset("selectAll")
    reset("topologyScale")
    reset("selectLayout")
    reset("nodeSelector")
    reset("edgeWidthByWeight")
    reset("fps")
  }
  
  mapper <- function(inArr, min, max){
    outArr <- inArr
    inArr_min <- min(inArr)
    inArr_max <- max(inArr)
    if (inArr_max - inArr_min != 0){
      for (i in 0:length(inArr)){
        outArr[i] <- (inArr[i] - inArr_min) * (max - min) / (inArr_max - inArr_min) + min;
      }
    } else outArr[] <- 0.3;
    return(outArr);
  }
  
  parse_import_data <- function(inFile){
    inData <<-  matrix("", nrow = 0, ncol = 5)
    colnames(inData) <<- c("SourceNode", "TargetNode", "Weight", "SourceLayer", "TargetLayer")
    uniqueNodes <- matrix("", nrow = 0, ncol = 1)
    nodeGroups <- matrix("", nrow = 0, ncol = 1) # map node rows from above to groups
    con <- file(inFile$datapath, "r")
    line <- readLines(con, 1)
    max_cols <- 10 # nodes with url, descr etc (9) + tag for javascript
    if (!identical(line, character(0))){
      line_split <- strsplit(line, "\t")
      if (as.character(line_split[[1]][1]) == "SCENE_PAN"){
        network_matrix = matrix("", nrow = 0, ncol = max_cols)
        line <- readLines(con, 1)
        line_split <- strsplit(line, "\t")
        if (as.character(line_split[[1]][1]) == "SCENE_SPHERE"){ # in case of empty network
          session$sendCustomMessage("handler_badObject_alert", "Empty Network.")
          break
        } else{
          network_matrix <- rbind(network_matrix, c("scene_pan", as.character(line_split[[1]][1]), as.character(line_split[[1]][2]), as.character(line_split[[1]][3]),
                                                    as.character(line_split[[1]][4]), "", "", "", "", ""))
        }
        line <- readLines(con, 1)
        line_split <- strsplit(line, "\t")
        if (as.character(line_split[[1]][1]) == "SCENE_SPHERE"){
          line <- readLines(con, 1)
          line_split <- strsplit(line, "\t")
          network_matrix <- rbind(network_matrix, c("scene_sphere", as.character(line_split[[1]][1]), as.character(line_split[[1]][2]), as.character(line_split[[1]][3]),
                                                    "", "", "", "", "", ""))
          line <- readLines(con, 1)
          line_split <- strsplit(line, "\t")
          if (as.character(line_split[[1]][1]) == "LAYERS"){
            while (T){
              line <- readLines(con, 1)
              line_split <- strsplit(line, "\t")
              if (as.character(line_split[[1]][1]) == "NODES") break
              else {
                if (length(line_split[[1]]) != ncol(network_matrix)-1){
                  session$sendCustomMessage("handler_badObject_alert", "Layer Problem. Not a valid Arena3D object. Please try again.")
                  break
                }
                network_matrix <- rbind(network_matrix, c("layer", as.character(line_split[[1]][1]), as.character(line_split[[1]][2]), as.character(line_split[[1]][3]), as.character(line_split[[1]][4]),
                                                          as.character(line_split[[1]][5]), as.character(line_split[[1]][6]), as.character(line_split[[1]][7]), as.character(line_split[[1]][8]), as.character(line_split[[1]][9])))
              }
            }
            if (as.character(line_split[[1]][1]) == "NODES"){
              while (T){
                line <- readLines(con, 1)
                line_split <- strsplit(line, "\t")
                if (as.character(line_split[[1]][1]) == "EDGES") break
                else {
                  if (length(line_split[[1]]) != ncol(network_matrix)-1){
                    session$sendCustomMessage("handler_badObject_alert", "Node Problem. Not a valid Arena3D object. Please try again.")
                    break
                  }
                  network_matrix <- rbind(network_matrix, c("node", as.character(line_split[[1]][1]), as.character(line_split[[1]][2]), as.character(line_split[[1]][3]), as.character(line_split[[1]][4]),
                                                            as.character(line_split[[1]][5]), as.character(line_split[[1]][6]), as.character(line_split[[1]][7]), as.character(line_split[[1]][8]), as.character(line_split[[1]][9])))
                  uniqueNodes <- rbind(uniqueNodes, paste(as.character(line_split[[1]][1]), as.character(line_split[[1]][2]), sep = "_"))
                  nodeGroups <- rbind(nodeGroups, as.character(line_split[[1]][2]))
                }
              }
              if (as.character(line_split[[1]][1]) == "EDGES"){
                while (T){
                  line <- readLines(con, 1)
                  line_split <- strsplit(line, "\t")
                  if (as.character(line_split[[1]][1]) == "END") break
                  else {
                    network_matrix <- rbind(network_matrix, c("edge", as.character(line_split[[1]][1]), as.character(line_split[[1]][2]), as.character(line_split[[1]][3]), "", "", "", "", "", ""))
                    line_split2 <- strsplit(as.character(line_split[[1]][1]), "---")
                    node1 <- line_split2[[1]][1]
                    node2 <- line_split2[[1]][2]
                    group1 <- nodeGroups[match(node1, uniqueNodes), 1]
                    group2 <- nodeGroups[match(node2, uniqueNodes), 1]
                    inData <<- rbind(inData, c(node1, node2, as.character(line_split[[1]][2]), group1, group2))
                  }
                }
              }
            }
            # print(network_matrix)
            if (nrow(inData) > max_allowed_edges) session$sendCustomMessage("handler_badObject_alert", paste("Network must contain no more than ", max_allowed_edges, " edges.", sep=""))
            else session$sendCustomMessage("handler_importNetwork", network_matrix)
          } else session$sendCustomMessage("handler_badObject_alert", "Scene  Problem. Not a valid Arena3D object. Please try again.")
        } else session$sendCustomMessage("handler_badObject_alert", "Scene Sphere Problem. Not a valid Arena3D object. Please try again.")
      } else session$sendCustomMessage("handler_badObject_alert", "Scene Pan Problem. Not a valid Arena3D object. Please try again.")
    } else session$sendCustomMessage("handler_badObject_alert", "Empty File. Not a valid Arena3D object. Please try again.")
    close(con)
    return(TRUE)
  }
  
  format_export_data <- function(js_scene_pan, js_scene_sphere, js_layers, js_nodes, js_edge_pairs){
    exportMatrix <- matrix("", nrow = 0, ncol = 9) # 9 max columns for node attributes
    exportMatrix <- rbind(exportMatrix, c("SCENE_PAN", " ", " ", " ", " ", " ", " ", " ", " " ))
    exportMatrix <- rbind(exportMatrix, c(js_scene_pan[1], js_scene_pan[2], js_scene_pan[3], js_scene_pan[4], " ", " ", " ", " ", " " ))
    exportMatrix <- rbind(exportMatrix, c("SCENE_SPHERE", " ", " ", " ", " ", " ", " ", " ", " " ))
    exportMatrix <- rbind(exportMatrix, c(js_scene_sphere[1], js_scene_sphere[2], js_scene_sphere[3], " ", " ", " ", " ", " ", " " ))
    exportMatrix <- rbind(exportMatrix, c("LAYERS", " ", " ", " ", " ", " ", " ", " ", " "))
    for (i in seq(from = 1, to = length(js_layers), by = 9)){
      exportMatrix <- rbind(exportMatrix, c(js_layers[i], js_layers[i+1], js_layers[i+2], js_layers[i+3],
                                            js_layers[i+4], js_layers[i+5], js_layers[i+6], js_layers[i+7], js_layers[i+8]))
    }
    exportMatrix <- rbind(exportMatrix, c("NODES", " ", " ", " ", " ", " ", " ", " ", " " ))
    for (i in seq(from = 1, to = length(js_nodes), by = 9)){
      exportMatrix <- rbind(exportMatrix, c(js_nodes[i], js_nodes[i+1], js_nodes[i+2], js_nodes[i+3],
                                            js_nodes[i+4], js_nodes[i+5], js_nodes[i+6], js_nodes[i+7], js_nodes[i+8]))
    }
    exportMatrix <- rbind(exportMatrix, c("EDGES", " ", " ", " ", " ", " ", " ", " ", " " ))
    for (i in seq(from = 1, to = length(js_edge_pairs), by = 3)){
      exportMatrix <- rbind(exportMatrix, c(js_edge_pairs[i], as.numeric(js_edge_pairs[i+1]), js_edge_pairs[i+2], " ", " ", " ", " ", " ", " " ))
    }
    exportMatrix <- rbind(exportMatrix, c("END", " ", " ", " ", " ", " ", " ", " ", " " ))
    return(exportMatrix)
  }
  
  # layout algorithms
  apply_layout_as_tree <- function(sub_graph, sub_nodes){
    layout <- layout_as_tree(sub_graph, root = numeric(), circular = FALSE,
                             rootlevel = numeric(), mode = "all", flip.y = TRUE)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_in_circle <- function(sub_graph, sub_nodes){
    layout <- layout_in_circle(sub_graph, order = V(sub_graph))
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_on_grid <- function(sub_graph, sub_nodes){
    layout <- layout_on_grid(sub_graph, width = 0, height = 0, dim = 2)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_randomly <- function(sub_graph, sub_nodes){
    layout <- layout_randomly(sub_graph, dim = 2)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_dh <- function(sub_graph, sub_nodes){
    layout <- layout_with_dh(sub_graph, coords = NULL, maxiter = 10, fineiter = max(10, log2(vcount(sub_graph))), cool.fact = 0.75, weight.node.dist = 1,
                             weight.border = 0, weight.edge.lengths = edge_density(sub_graph)/10,
                             weight.edge.crossings = 1 - sqrt(edge_density(sub_graph)),
                             weight.node.edge.dist = 0.2 * (1 - edge_density(sub_graph)))
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_drl <- function(sub_graph, sub_nodes){
    layout <- layout_with_drl(sub_graph, use.seed = FALSE,
                              seed = matrix(runif(vcount(sub_graph) * 2), ncol = 2),
                              options = drl_defaults$default, weights = E(sub_graph)$weight,
                              fixed = NULL, dim = 2)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_fr <- function(sub_graph, sub_nodes){ # this looks bad with weights
    layout <- layout_with_fr(sub_graph, coords = NULL, dim = 2, niter = 500,
                             start.temp = sqrt(vcount(sub_graph)), grid = c("auto", "grid", "nogrid"),
                             weights = NULL, minx = NULL, maxx = NULL, miny = NULL,
                             maxy = NULL, minz = NULL, maxz = NULL)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_gem <- function(sub_graph, sub_nodes){
    layout <- layout_with_gem(sub_graph, coords = NULL, maxiter = 40 * vcount(sub_graph)^2,
                              temp.max = vcount(sub_graph), temp.min = 1/10,
                              temp.init = sqrt(vcount(sub_graph)))
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_graphopt <- function(sub_graph, sub_nodes){
    layout <- layout_with_graphopt(sub_graph, start = NULL, niter = 500,
                                   charge = 0.001, mass = 30, spring.length = 0,
                                   spring.constant = 1, max.sa.movement = 5)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_kk <- function(sub_graph, sub_nodes, sub_weights){
    layout <- layout_with_kk(sub_graph, dim = 2, weights = sub_weights)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_lgl <- function(sub_graph, sub_nodes){
    layout <- layout_with_lgl(sub_graph, maxiter = 150, maxdelta = vcount(sub_graph),
                              coolexp = 1.5, root = NULL)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_mds <- function(sub_graph, sub_nodes){
    layout <- layout_with_mds(sub_graph, dist = NULL, dim = 2, options = arpack_defaults)
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  apply_layout_with_sugiyama <- function(sub_graph, sub_nodes){ # bad with weights
    layout <- layout_with_sugiyama(sub_graph, layers = NULL, hgap = 1, vgap = 1,
                                   maxiter = 100, weights = NULL, attributes = c("default", "all", "none"))$layout
    nodes_layout <- cbind(as.matrix(sub_nodes),layout)
    session$sendCustomMessage("handler_layout", nodes_layout) # send to JS to refresh Layout
    return(TRUE)
  }
  
  applyLayout <- function(sub_graph, sub_nodes, sub_weights){
    session$sendCustomMessage("handler_startLoader", T)
    set.seed(123)
    if (input$selectLayout == "Reingold-Tilford"){
      done <- apply_layout_as_tree(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Circle"){
      done <- apply_layout_in_circle(sub_graph, sub_nodes)
      # } else if (input$selectLayout == "Nicely"){
      #   done <- apply_layout_nicely(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Grid"){
      done <- apply_layout_on_grid(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Random"){
      done <- apply_layout_randomly(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Davidson-Harel"){
      done <- apply_layout_with_dh(sub_graph, sub_nodes)
    } else if (input$selectLayout == "DrL"){
      done <- apply_layout_with_drl(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Fruchterman-Reingold"){
      done <- apply_layout_with_fr(sub_graph, sub_nodes)
    } else if (input$selectLayout == "GEM"){
      done <- apply_layout_with_gem(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Graphopt"){
      done <- apply_layout_with_graphopt(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Kamada-Kawai"){
      done <- apply_layout_with_kk(sub_graph, sub_nodes, sub_weights)
    } else if (input$selectLayout == "Large Graph Layout"){
      done <- apply_layout_with_lgl(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Multidimensional Scaling"){
      done <- apply_layout_with_mds(sub_graph, sub_nodes)
    } else if (input$selectLayout == "Sugiyama"){
      done <- apply_layout_with_sugiyama(sub_graph, sub_nodes)
    }
    session$sendCustomMessage("handler_finishLoader", T)
    reset("selectLayout")
    return(TRUE)
  }
  
  scaleByDegree <- function(sub_graph, sub_nodes){
    topology <- degree(sub_graph, v = V(sub_graph), mode = "all",
                       loops = FALSE, normalized = FALSE)
    nodes_scale <- cbind(as.matrix(sub_nodes), topology)
    session$sendCustomMessage("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
  }
  
  scaleByTransitivity <- function(sub_graph, sub_nodes, sub_weights){
    topology <- transitivity(sub_graph, type = "local", vids = NULL,
                             weights = sub_weights, isolates = "zero")
    nodes_scale <- cbind(as.matrix(sub_nodes), topology)
    session$sendCustomMessage("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
  }
  
  scaleByBetweenness <- function(sub_graph, sub_nodes, sub_weights){
    topology <- betweenness(sub_graph, v = V(sub_graph), directed = FALSE, weights = sub_weights,
                            nobigint = TRUE, normalized = FALSE)
    nodes_scale <- cbind(as.matrix(sub_nodes), topology)
    session$sendCustomMessage("handler_topologyScale", nodes_scale) # send to JS to refresh Layout
  }
  
  scaleTopology <- function(sub_graph, sub_nodes, sub_weights){
    session$sendCustomMessage("handler_startLoader", T)
    set.seed(123)
    if (input$topologyScale == "Degree"){
      scaleByDegree(sub_graph, sub_nodes)
    } else if (input$topologyScale == "Clustering Coefficient"){
      scaleByTransitivity(sub_graph, sub_nodes, sub_weights)
    } else if (input$topologyScale == "Betweenness Centrality"){
      scaleByBetweenness(sub_graph, sub_nodes, sub_weights)
    }
    session$sendCustomMessage("handler_finishLoader", T)
    reset("topologyScale")
    return(TRUE)
  }
  
  observeEvent(input$input_network_file,{ # creating igraph graph from input file
    inFile <- input$input_network_file
    if (!is.null(inFile)){ #input$input_network_file -> NULL initially
      reset_UI_values()
      inData <<- read.delim(inFile$datapath, header = TRUE) # datapath -> temporary location of uploaded file
      tryCatch({
        inData$SourceNode <<- trim(inData$SourceNode)
        inData$SourceLayer <<- trim(inData$SourceLayer)
        inData$TargetNode <<- trim(inData$TargetNode)
        inData$TargetLayer <<- trim(inData$TargetLayer)
        if (identical(inData$Weight, NULL)) inData$Weight <<- as.matrix(rep(1,length(inData$SourceNode)))
        else inData$Weight <<- mapper(as.numeric(trim(inData$Weight)), 0.1, 1)
        session$sendCustomMessage("handler_uploadNetwork", inData)
        inData [, "SourceNode"] <<- as.matrix(paste(inData[, "SourceNode"], inData[, "SourceLayer"], sep="_"))
        inData [, "TargetNode"] <<- as.matrix(paste(inData[, "TargetNode"], inData[, "TargetLayer"], sep="_"))
        inData <<- as.matrix(inData)
      }, warning = function(w) {
        print(paste("Warning:  ", w))
      }, error = function(e) {
        print(paste("Error in Uploaded Network file:  ", e))
        session$sendCustomMessage("handler_badObject_alert", "Bad Uploaded Network File Format.")
      }, finally = {})
      updateSelectInput(session, "navBar", selected = "Main View")
    }
    reset("load_network_file")
    reset("node_attributes_file")
    reset("edge_attributes_file")
    return(TRUE)
  })
  
  observeEvent(input$load_network_file,{
    inFile <- input$load_network_file
    if (!is.null(inFile)){
      reset_UI_values()
      parse_import_data(inFile)
      updateSelectInput(session, "navBar", selected = "Main View")
    }
    reset("input_network_file")
    reset("node_attributes_file")
    reset("edge_attributes_file")
    return(TRUE)
  })
  
  observeEvent(input$node_attributes_file,{
    nodeFile <- input$node_attributes_file$datapath
    nodeAttributes <- read.delim(nodeFile)
    tryCatch({
      nodeAttributes$Node <- paste(trim(nodeAttributes$Node), trim(nodeAttributes$Layer), sep="_") #concatenation node & group name
      if (!identical(nodeAttributes$Color, NULL)) nodeAttributes$Color <- trim(nodeAttributes$Color)
      if (!identical(nodeAttributes$Size, NULL)) nodeAttributes$Size <- trim(nodeAttributes$Size)
      if (!identical(nodeAttributes$Url, NULL)) nodeAttributes$Url <- trim(nodeAttributes$Url)
      if (!identical(nodeAttributes$Description, NULL)) nodeAttributes$Description <- trim(nodeAttributes$Description)
      if (!is.null(nodeFile)){
        session$sendCustomMessage("handler_nodeAttributes", nodeAttributes)
        updateSelectInput(session, "navBar", selected = "Main View")
      }
    }, warning = function(w) {
      print(paste("Warning:  ", w))
    }, error = function(e) {
      print(paste("Error in input Node Attributes file:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Bad Node Attributes File Format.")
    }, finally = {})
    return(TRUE)
  })
  
  observeEvent(input$edge_attributes_file,{
    edgeFile <- input$edge_attributes_file$datapath
    edgeAttributes <- read.delim(edgeFile)
    tryCatch({
      edgeAttributes$SourceNode <- paste(trim(edgeAttributes$SourceNode), trim(edgeAttributes$SourceLayer), sep="_") # concatenation node1_Group1---node2_Group2
      edgeAttributes$TargetNode <- paste(trim(edgeAttributes$TargetNode), trim(edgeAttributes$TargetLayer), sep="_")
      temp <- edgeAttributes$SourceNode
      edgeAttributes$SourceNode <- paste(edgeAttributes$SourceNode, edgeAttributes$TargetNode, sep="---")
      edgeAttributes$TargetNode <- paste(edgeAttributes$TargetNode, temp, sep="---") # both ways, undirected
      edgeAttributes$Color <- trim(edgeAttributes$Color)
      if (!is.null(edgeFile)){
        session$sendCustomMessage("handler_edgeAttributes", edgeAttributes)
        updateSelectInput(session, "navBar", selected = "Main View")
      }
    }, warning = function(w) {
      print(paste("Warning:  ", w))
    }, error = function(e) {
      print(paste("Error in input Edge Attributes file:  ", e))
      session$sendCustomMessage("handler_badObject_alert", "Bad Edge Attributes File Format.")
    }, finally = {})
    return(TRUE)
  })
  
  # handlers for JS
  observeEvent(input$showLabels,{
    session$sendCustomMessage("handler_showLabels", input$showLabels)
    return(TRUE)
  })
  
  observeEvent(input$showSelectedLabels,{
    session$sendCustomMessage("handler_showSelectedLabels", input$showSelectedLabels)
    return(TRUE)
  })
  
  observeEvent(input$showSelectedLayerLabels,{
    session$sendCustomMessage("handler_showSelectedLayerLabels", input$showSelectedLayerLabels)
    return(TRUE)
  })
  
  observeEvent(input$showLayerLabels,{
    session$sendCustomMessage("handler_showLayerLabels", input$showLayerLabels)
    return(TRUE)
  })
  
  observeEvent(input$resizeLabels,{
    session$sendCustomMessage("handler_resizeLabels", input$resizeLabels)
    return(TRUE)
  })
  
  observeEvent(input$resizeLayerLabels,{
    session$sendCustomMessage("handler_resizeLayerLabels", input$resizeLayerLabels)
    return(TRUE)
  })
  
  observeEvent(input$nodeColorAttributePriority,{
    session$sendCustomMessage("handler_nodeColorAttributePriority", input$nodeColorAttributePriority)
    return(TRUE)
  })
  
  observeEvent(input$nodeSelectedColorPriority,{
    session$sendCustomMessage("handler_nodeSelectedColorPriority", input$nodeSelectedColorPriority)
    return(TRUE)
  })
  
  observeEvent(input$edgeColorAttributePriority,{
    session$sendCustomMessage("handler_edgeColorAttributePriority", input$edgeColorAttributePriority)
    return(TRUE)
  })
  
  observeEvent(input$edgeSelectedColorPriority,{
    session$sendCustomMessage("handler_edgeSelectedColorPriority", input$edgeSelectedColorPriority)
    return(TRUE)
  })
  
  observeEvent(input$showLayerCoords,{
    session$sendCustomMessage("handler_showLayerCoords", input$showLayerCoords)
    return(TRUE)
  })
  
  observeEvent(input$showWireFrames,{
    session$sendCustomMessage("handler_showWireFrames", input$showWireFrames)
    return(TRUE)
  })
  
  observeEvent(input$showSceneCoords,{
    session$sendCustomMessage("handler_showSceneCoords", input$showSceneCoords)
    return(TRUE)
  })
  
  observeEvent(input$layerEdgeOpacity,{
    session$sendCustomMessage("handler_layerEdgeOpacity", input$layerEdgeOpacity)
    return(TRUE)
  })
  
  observeEvent(input$interLayerEdgeOpacity,{
    session$sendCustomMessage("handler_interLayerEdgeOpacity", input$interLayerEdgeOpacity)
    return(TRUE)
  })
  
  observeEvent(input$floorOpacity,{
    session$sendCustomMessage("handler_floorOpacity", input$floorOpacity)
    return(TRUE)
  })
  
  observeEvent(input$fps,{
    session$sendCustomMessage("handler_fps", input$fps)
    return(TRUE)
  })
  
  observeEvent(input$selectLayout,{
    if (input$selectLayout != "-"){ # triggers second event when resetting
      if (!is.null(input$input_network_file) || !is.null(input$load_network_file)){ #if file not empty 
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
                tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "TargetNode"]))
                tempMatNodes <- unique(tempMatNodes)
                sub_graph <- make_ring(length(tempMatNodes))
                V(sub_graph)$name <- tempMatNodes
                sub_nodes <- V(sub_graph)$name
                sub_weights <- E(sub_graph)$weight
                applyLayout(sub_graph, sub_nodes, sub_weights)
              } else{
                inDataEdgelist <- inData[inData[, "SourceLayer"] == group_name,, drop=F]
                inDataEdgelist <- inDataEdgelist[inDataEdgelist[, "TargetLayer"] == group_name,, drop=F]
                if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                  inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
                  sub_graph <- createGraph(inDataEdgelist) # V(graph)
                  sub_nodes <- V(sub_graph)$name # unsorted
                  sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                  applyLayout(sub_graph, sub_nodes, sub_weights)
                } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
              }
            }
          } else if (input$sub_graphChoice == "allLayers"){ # ALL LAYERS
            # make a combined sub_graph for each Layer and then run Layout iteratively
            # print(selected_layers)
            inDataEdgelist <- matrix("", ncol = 5, nrow = 0)
            groups <- layer_group_names[selected_layers + 1, ]
            for (i in 1:nrow(inData)){
              if ((!is.na(match(inData[i, "SourceLayer"], groups))) && (!is.na(match(inData[i, "TargetLayer"], groups))))
                inDataEdgelist <- rbind(inDataEdgelist, inData[i,])
            }
            if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
              if (input$selectLayout == "Circle" || input$selectLayout == "Grid" || input$selectLayout == "Random"){
                tempMatNodes <- rbind(inDataEdgelist[,"SourceNode"], inDataEdgelist[,"TargetNode"])
                tempMatNodes <- unique(tempMatNodes)
                sub_graph <- make_ring(length(tempMatNodes))
                V(sub_graph)$name <- tempMatNodes
                sub_nodes <- V(sub_graph)$name
                sub_weights <- E(sub_graph)$weight
                applyLayout(sub_graph, sub_nodes, sub_weights)
              } else{
                inDataEdgelist <- as.matrix(inDataEdgelist[, c("SourceNode", "TargetNode", "Weight")])
                sub_graph <- createGraph(inDataEdgelist) # V(graph)
                sub_nodes <- V(sub_graph)$name # unsorted
                sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                applyLayout(sub_graph, sub_nodes, sub_weights) # execute once, for combined subgraph
              } 
            } else session$sendCustomMessage("handler_badObject_alert", paste("Subgraph of selected Layers could not form a graph.", sep=""))
          } else{ # LOcAL LAYOUTS
            selected_nodes <- input$js_selected_nodes
            if (length(selected_nodes) > 0){ # can't run local layouts without selected nodes
              whole_node_names <- input$js_node_names
              # print(whole_node_names[selected_nodes+1]) # +1 because js starts from 0 while R from 1
              for (i in 1:length(selected_layers)){
                group_name <- layer_group_names[selected_layers[i]+1]
                # print(group_name)
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
                  if (nrow(tempMatNodes) > 1){
                    sub_graph <- make_ring(length(tempMatNodes))
                    V(sub_graph)$name <- tempMatNodes
                    sub_nodes <- V(sub_graph)$name
                    sub_weights <- E(sub_graph)$weight
                    session$sendCustomMessage("handler_setLocalFlag", T) # this tells js to map coordinates on local bounds in assignXYZ
                    applyLayout(sub_graph, sub_nodes, sub_weights)
                  } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                } else{
                  # for the rest of the layouts, find connected selected nodes of selected layouts
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
                      session$sendCustomMessage("handler_setLocalFlag", T)
                      applyLayout(sub_graph, sub_nodes, sub_weights)
                    } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                  } else session$sendCustomMessage("handler_badObject_alert", paste("Layer ", group_name, " could not form a graph.", sep=""))
                }
              }
            } else session$sendCustomMessage("handler_badObject_alert", "Can't execute Local Layouts without selected Nodes.")
          }
        }
      }
    }
  })
  
  observeEvent(input$topologyScale,{
    if (input$topologyScale != "-"){ # triggers second event when resetting
      if (!is.null(input$input_network_file) || !is.null(input$load_network_file)){ # if file not empty
        selected_layers <- as.numeric(input$selected_layers)
        if (!identical(selected_layers, numeric(0))){ # at least one selected Layer needed
          layer_group_names <- as.matrix(input$js_layer_names)
          if (input$sub_graphChoice == "perLayer"){
            # make separate sub_graphs for each Layer and then run Layout iteratively
            for (i in 1:length(selected_layers)){
              # print(selected_layers[i])
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
            inDataEdgelist <- matrix("", ncol = 5, nrow = 0)
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
          } else{ # local
            selected_nodes <- input$js_selected_nodes
            if(length(selected_nodes) > 0){
              whole_node_names <- input$js_node_names
              # print(whole_node_names[selected_nodes+1]) # +1 because js starts from 0 while R from 1
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
    }
  })
  
  observeEvent(list(input$hideButton1, input$hideButton2, input$hideButton3, input$hideButton4, input$hideButton5, input$hideButton6, input$hideButton7),{
    updateSelectInput(session, "navBar", selected = "Main View")
    if (fresh){ # this function executes on page load, so the first time the page is loaded we need to land on the Home tab instead
      updateSelectInput(session, "navBar", selected = "Home")
      fresh <<- F
    }
    return(TRUE)
  })
  
  observeEvent(input$selectAll,{
    session$sendCustomMessage("handler_selectAllLayers", input$selectAll)
    return(TRUE)
  })
  
  observeEvent(input$nodeSelector,{
    session$sendCustomMessage("handler_nodeSelector", input$nodeSelector)
    return(TRUE)
  })
  
  observeEvent(input$edgeWidthByWeight,{
    session$sendCustomMessage("handler_edgeWidthByWeight", input$edgeWidthByWeight)
    return(TRUE)
  })
  
  output$save_network_object <- downloadHandler(
    filename = function() {
      paste('network-', Sys.Date(), '.txt', sep='')
    },
    content = function(con) {
      if (length(inData) > 1){ # == network loaded
        js_scene_pan <- input$js_scene_pan # from JS
        js_scene_sphere <- input$js_scene_sphere
        js_layers <- input$js_layers
        js_nodes <- input$js_nodes
        js_edge_pairs <- input$js_edge_pairs
        exportData <- format_export_data(js_scene_pan, js_scene_sphere, js_layers, js_nodes, js_edge_pairs)
      }
      write.table(exportData, con, row.names = F, col.names = F, quote = F, sep="\t")
    }
  )
  
}
