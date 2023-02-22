const updateScenePanRShiny = () => {
  let js_scene_pan = {
    "position_x" : String(scene_pan.position.x),
    "position_y" : String(scene_pan.position.y),
    "scale" : String(scene_pan.scale.x),
    "color" : "#".concat(renderer.getClearColor().getHexString()) 
  }
  Shiny.setInputValue("js_scene_pan", JSON.stringify(js_scene_pan));
  return true;
}

const updateSceneSphereRShiny = () => {
  let js_scene_sphere = {
    "rotation_x" : String(scene_sphere.rotation.x),
    "rotation_y" : String(scene_sphere.rotation.y),
    "rotation_z" : String(scene_sphere.rotation.z)
  }
  Shiny.setInputValue("js_scene_sphere", JSON.stringify(js_scene_sphere));
  return true;
}

const updateLayersRShiny = () => {
  let js_layers = [],
    js_layers_world = [], // VR
    target = new THREE.Vector3(), // VR
    targetQ = new THREE.Quaternion(); // VR
  temp_js_layers = [];
  let temp_size;
  if (typeof floorCurrentColor === 'object') {
    tempColor = '#' + floorCurrentColor.getHexString();
  } else {
    tempColor = floorCurrentColor;
  }
  for (let i = 0; i < layer_planes.length; i++){
    if (layerColorFile) {
        if (typeof floorDefaultColors[i] === 'object') {
          layerColor = '#' + floorDefaultColors[i].getHexString();
        } else layerColor = floorDefaultColors[i]
    } else layerColor = tempColor;
     temp_js_layers = [layer_names[i], layer_planes[i].position.x, layer_planes[i].position.y, layer_planes[i].position.z, last_layer_scale[i],
                      layer_planes[i].rotation.x, layer_planes[i].rotation.y, layer_planes[i].rotation.z, layerColor,  layer_planes[i].geometry.parameters.width];
    js_layers.push(temp_js_layers);
    
    // VR
    temp_js_layers = [
      layer_names[i], layer_planes[i].getWorldPosition(target).x,
      layer_planes[i].getWorldPosition(target).y,
      layer_planes[i].getWorldPosition(target).z];
    js_layers_world.push(temp_js_layers);
  }
  Shiny.setInputValue("js_layers", JSON.stringify(js_layers));
  Shiny.setInputValue("js_layers_world", JSON.stringify(js_layers_world));
  return true;
}

const updateLayerNamesRShiny = () => {
  Shiny.setInputValue("js_layer_names", layer_names);
  return true;
}

const updateNodesRShiny = () => {
  let js_nodes = [],
    js_nodes_world = [], // VR
    target = new THREE.Vector3(), // VR
    temp_js_nodes = [],
    color = "";
  for (let i = 0; i < nodes.length; i++){
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
    }  else if (nodes[i].userData.cluster) nodes[i].material.color = new THREE.Color(colors[nodes[i].userData.cluster]);
    else color = colors[(layer_groups[node_groups[node_whole_names[i]]]) % colors.length];

    if (node_cluster_colors.length !== 0) color = node_cluster_colors[i];
    
    temp_js_nodes = [node_names[i], node_groups[node_whole_names[i]], nodes[i].position.x, nodes[i].position.y, nodes[i].position.z,
      nodes[i].scale.x, color, url, descr];
    js_nodes.push(temp_js_nodes);
    
    // VR
    temp_js_nodes = [node_names[i], node_groups[node_whole_names[i]],
      nodes[i].getWorldPosition(target).x, nodes[i].getWorldPosition(target).y, nodes[i].getWorldPosition(target).z,
      nodes[i].scale.x, color];
    js_nodes_world.push(temp_js_nodes);
  }
  Shiny.setInputValue("js_nodes", JSON.stringify(js_nodes));
  Shiny.setInputValue("js_nodes_world", JSON.stringify(js_nodes_world)); // VR
  return true;
}

const updateNodeNamesRShiny = () => {
  Shiny.setInputValue("js_node_names", node_whole_names);
  return true;
}

const updateSelectedNodesRShiny = () => {
  Shiny.setInputValue("js_selectedNodePositions", selectedNodePositions);
  return true;
}

const updateEdgesRShiny = () => {
  let js_edge_pairs = [],
    temp_js_edge_pairs = [],
    pos1 = (pos2 = pos3 = -1);
    temp_channel = '';
  j = 0;
  for (let i = 0; i < edge_pairs.length; i++) {
    if (edge_attributes !== "") {
      pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
      pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);
      if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " " && edge_attributes.Color[pos1] !== null) {
        if (edge_attributes.Channel && edge_attributes.Channel[pos1]) {
          temp_channel = edge_attributes.Channel[pos1];
        }
        color = edge_attributes.Color[pos1];
      }
      else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " " && edge_attributes.Color[pos2] !== null) {
         if (edge_attributes.Channel && edge_attributes.Channel[pos2]) {
          temp_channel = edge_attributes.Channel[pos2];
        }
        color = edge_attributes.Color[pos2];
      }
      else color = edgeDefaultColor;
    } else color = edgeDefaultColor;
    if (edge_channels && edge_channels[i] && edge_channels[i].length > 0) {
      edge_channels[i].forEach((channel) => {
        temp_js_edge_pairs = [edge_pairs[i], edge_values[j], channel_color[channel], channel];
        js_edge_pairs.push(temp_js_edge_pairs);
        j++;
      });

    } else {
      temp_js_edge_pairs = [edge_pairs[i], edge_values[j], color, ""];
      js_edge_pairs.push(temp_js_edge_pairs);
      j++;
    }
  }
  Shiny.setInputValue("js_edge_pairs", JSON.stringify(js_edge_pairs));
  return true;
}

const updateLabelColorRShiny = () => {
  Shiny.setInputValue("js_label_color", globalLabelColor);
  return true;
}

const updateDirectionCheckboxRShiny = (name, value) => {
  // to always trigger
  Shiny.setInputValue('js_direction_checkbox_flag', [name, !value])
  Shiny.setInputValue('js_direction_checkbox_flag', [name, value])
}

const updateEdgeByWeightCheckboxRShiny = (name, value) => {
  // to always trigger
  Shiny.setInputValue('js_edgeByWeight_checkbox_flag', [name, !value])
  Shiny.setInputValue('js_edgeByWeight_checkbox_flag', [name, value])
}
