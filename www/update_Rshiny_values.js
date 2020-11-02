function updateScenePanRShiny(){
  var js_scene_pan = [scene_pan.position.x, scene_pan.position.y, scene_pan.scale.x, "#".concat(renderer.getClearColor().getHexString())];
  Shiny.setInputValue("js_scene_pan", js_scene_pan); //R monitors node attributes to can readily export network
  return true;
}

function updateSceneSphereRShiny(){
  var js_scene_sphere = [scene_sphere.rotation.x, scene_sphere.rotation.y, scene_sphere.rotation.z];
  Shiny.setInputValue("js_scene_sphere", js_scene_sphere);
  return true;
}

function updateLayersRShiny(){
  var js_layers = [],
      temp_js_layers = [];
  for (var i = 0; i < layer_planes.length; i++){
    temp_js_layers = [layer_planes[i].position.x, layer_planes[i].position.y, layer_planes[i].position.z, last_layer_scale[i],
                      layer_planes[i].rotation.x, layer_planes[i].rotation.y, layer_planes[i].rotation.z, floorCurrentColor, layer_planes[i].geometry.parameters.width];
    js_layers.push(temp_js_layers);
  }
  Shiny.setInputValue("js_layers", js_layers);
  return true;
}

function updateLayerNamesRShiny(){
  Shiny.setInputValue("js_layer_names", layer_names);
  return true;
}

function updateNodesRShiny(){
  var js_nodes = [],
      temp_js_nodes = [],
      color = "";
  for (var i = 0; i < nodes.length; i++){
    let url = descr = " ";
    if (node_attributes !== ""){
      pos = node_attributes.Node.indexOf(node_whole_names[i]);
      if (pos > -1){
        if (node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " " && node_attributes.Color[pos] !== null) //if node exists in node attributes file
          color = node_attributes.Color[pos];
        else color = colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length];
        if (node_attributes.Url !== undefined && node_attributes.Url[pos] !== "" && node_attributes.Url[pos] != " " && node_attributes.Url[pos] !== null)
          url = node_attributes.Url[pos];
        if (node_attributes.Description !== undefined && node_attributes.Description[pos] !== "" && node_attributes.Description[pos] != " " && node_attributes.Description[pos] !== null)
          descr = node_attributes.Description[pos];
      } else color = colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length];
    } else color = colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length];
    temp_js_nodes = [node_names[i], node_groups[node_whole_names[i]], nodes[i].position.x, nodes[i].position.y, nodes[i].position.z,
                    nodes[i].scale.x, color, url, descr];
    js_nodes.push(temp_js_nodes);
  }
  Shiny.setInputValue("js_nodes", js_nodes);
  return true;
}

function updateNodeNamesRShiny(){
  Shiny.setInputValue("js_node_names", node_whole_names);
  return true;
}

function updateSelectedNodesRShiny(){
  Shiny.setInputValue("js_selected_nodes", selected_nodes);
  return true;
}

function updateEdgesRShiny(){
  var js_edge_pairs = [],
      temp_js_edge_pairs = [],
      pos1 = pos2 = pos3 = -1;
  for (var i = 0; i < edge_values.length; i++){
    if (edge_attributes !== ""){
      pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
      pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);
      if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " " && edge_attributes.Color[pos1] !== null) color = edge_attributes.Color[pos1];
      else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " " && edge_attributes.Color[pos2] !== null) color = edge_attributes.Color[pos2];
      else color = edgeDefaultColor;
    } else color = edgeDefaultColor;
    temp_js_edge_pairs = [edge_pairs[i], edge_values[i], color];
    js_edge_pairs.push(temp_js_edge_pairs);
  }
  Shiny.setInputValue("js_edge_pairs", js_edge_pairs);
  return true;
}
