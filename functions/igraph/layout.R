handleClusterLayout <- function() {
  tryCatch({
    renderModal("<h2>Please wait.</h2><br /><p>Generating layout.</p>")
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
                  } else
                    renderWarning("Can't execute Cluster without selected Local Layout.")
                } else {
                  tempMatNodes <- rbind(tempMatNodes, as.matrix(tempMat[, "TargetNode"]))
                  formatAndApplyLayout(tempMatNodes, FALSE)
                }
              }  else
                renderWarning(paste0("Layer ", group_name, " could not form a graph."))
            } else {
              inDataEdgelist <- inData[inData[, "SourceLayer"] == group_name,, drop=F]
              inDataEdgelist <- inDataEdgelist[inDataEdgelist[, "TargetLayer"] == group_name,, drop=F]
              if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                inDataEdgelist <- checkAndFilterSelectedChannels(inDataEdgelist, selected_channels)
                if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                  if (input$selectCluster != "-"){
                    if (input$selectLocalLayout != "-"){
                      applyCluster(inDataEdgelist, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                    } else
                      renderWarning("Can't execute Cluster without selected Local Layout.")
                  } else {
                    sub_graph <- createGraph(inDataEdgelist) # V(graph)
                    sub_nodes <- V(sub_graph)$name # unsorted
                    sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                    applyLayout(sub_graph, sub_nodes, sub_weights)
                  }
                } else
                  renderWarning(paste0("Layer ", group_name, " could not form a graph."))
              } else 
                renderWarning(paste0("Layer ", group_name, " could not form a graph."))
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
                } else
                  renderWarning("Can't execute Cluster without selected Local Layout.")
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
                  } else
                    renderWarning("Can't execute Cluster without selected Local Layout.")
                } else {
                  sub_graph <- createGraph(inDataEdgelist) # V(graph)
                  sub_nodes <- V(sub_graph)$name # unsorted
                  sub_weights <- E(sub_graph)$weight # != inDataEdgelist[, 3]
                  applyLayout(sub_graph, sub_nodes, sub_weights) # execute once, for combined subgraph
                }
              } else
                renderWarning("Subgraph of selected Layers could not form a graph.")
            }
          } else
            renderWarning("Subgraph of selected Layers could not form a graph.")
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
              }  else
                renderWarning(paste0("Layer ", group_name, " could not form a graph."))
              
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
                    } else
                      renderWarning("Can't execute Cluster without selected Local Layout.")
                  } else {
                    formatAndApplyLayout(tempMatNodes, TRUE)
                  }
                } else
                  renderWarning(paste0("Layer ", group_name, " could not form a graph."))
              } else {
                # for the rest of the layouts, use selected edges and nodes
                if (nrow(inDataEdgelist) >= 2){ # igraph cant create graph with only one row (edge)
                  if (input$selectCluster != "-"){
                    if (input$selectLocalLayout != "-"){
                      applyCluster(inDataEdgelist, input$selectLayout, input$selectLocalLayout, input$selectCluster)
                    } else
                      renderWarning("Can't execute Cluster without selected Local Layout.")
                  } else {
                    formatAndApplyLayout(inDataEdgelist, TRUE)
                  }
                } else
                  renderWarning(paste0("Layer ", group_name, " could not form a graph."))
              }
            }
          } else
            renderWarning("Can't execute Local Layouts without selected Nodes.")
        }
      }
    } else
      renderWarning("Can't execute Layouts and cluster  without selected Layout Algorithm.")
  }, error = function(e) {
    print(paste0("Error on layout or clustering: ", e))
    renderError("Error on layout or clustering algorithm.")
  }, finally = {
    removeModal()
  })
}

# @param tempMatNodes():
# @param localBoundflag(boolean): flag that send the setLocalFlag used only @ local layouts 
formatAndApplyLayout <- function(tempMatNodes, localBoundflag) {
  tempMatNodes <- unique(tempMatNodes)
  sub_graph <- make_ring(length(tempMatNodes))
  V(sub_graph)$name <- tempMatNodes
  sub_nodes <- V(sub_graph)$name
  sub_weights <- E(sub_graph)$weight
  if (localBoundflag == TRUE) {
    session$sendCustomMessage("handler_setLocalFlag", T) # this tells js to map coordinates on local bounds in assignXYZ
  }
  applyLayout(sub_graph, sub_nodes, sub_weights)
}

# @param layout_name (string): string name from UI
# @return layout_function_name (string): layout name needed for stategy3_superNodes 
getFormatedLayoutString <- function(layout_name) {
  if (layout_name == "Reingold-Tilford"){
    return('layout_as_tree')
  } else if (layout_name == "Circle"){
    return('layout_in_circle')
  } else if (layout_name == "Grid"){
    return('layout_on_grid')
  } else if (layout_name == "Random"){
    return('layout_randomly')
  } else if (layout_name == "Davidson-Harel"){
    return('layout_with_dh')
  } else if (layout_name == "DrL"){
    return('layout_with_drl')
  } else if (layout_name == "Fruchterman-Reingold"){
    return('layout_with_fr')
  } else if (layout_name == "GEM"){
    return('layout_with_gem')
  } else if (layout_name == "Graphopt"){
    return('layout_with_graphopt')
  } else if (layout_name == "Kamada-Kawai"){
    return('layout_with_kk')
  } else if (layout_name == "Large Graph Layout"){
    return('layout_with_lgl')
  } else if (layout_name == "Multidimensional Scaling"){
    return('layout_with_mds')
  } else if (layout_name == "Sugiyama"){
    return('layout_with_sugiyama')
  }
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
  # reset("selectLayout")
  return(TRUE)
}
