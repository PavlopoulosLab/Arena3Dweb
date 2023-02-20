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
