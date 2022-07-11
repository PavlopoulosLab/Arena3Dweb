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
