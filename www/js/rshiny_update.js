// Scene
const updateScenePanRShiny = () => {
  let js_scene_pan = {
    "position_x": scene.getPosition("x"),
    "position_y": scene.getPosition("y"),
    "scale": scene.getScale(),
    "color": "#".concat(renderer.getClearColor().getHexString()) 
  }
  Shiny.setInputValue("js_scene_pan", JSON.stringify(js_scene_pan));
};

const updateSceneSphereRShiny = () => {
  let js_scene_sphere = {
    "rotation_x": scene.getRotation("x"),
    "rotation_y": scene.getRotation("y"),
    "rotation_z": scene.getRotation("z")
  }
  Shiny.setInputValue("js_scene_sphere", JSON.stringify(js_scene_sphere));
};

// Layers
const updateLayersRShiny = () => {
  let js_layers = [];

  for (let i = 0; i < layers.length; i++) {
    js_layers.push(
      [layers[i].getName(), layers[i].getPosition("x"), layers[i].getPosition("y"), layers[i].getPosition("z"),
      layers[i].getScale(), layers[i].getRotation("x"), layers[i].getRotation("y"), layers[i].getRotation("z"),
      layers[i].getColor(), layers[i].getWidth()]
    );
  }
  
  js_layers = js_layers.map(layer => {
    return {
      name: layer[0],
      position_x: layer[1],
      position_y: layer[2],
      position_z: layer[3],
      last_layer_scale: layer[4],
      rotation_x: layer[5],
      rotation_y: layer[6],
      rotation_z: layer[7],
      floor_current_color: layer[8],
      geometry_parameters_width: layer[9],
    }
  });
  Shiny.setInputValue("js_layers", JSON.stringify(js_layers));
};

const updateLayerNamesRShiny = () => {
  let layer_names = layers.map(({ name }) => name);
  Shiny.setInputValue("js_layer_names", layer_names);
};

const updateSelectedLayersRShiny = () => {
  let js_selected_layers = getSelectedLayers();
  Shiny.setInputValue("js_selected_layers", js_selected_layers);
};

// Nodes
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
        else color = nodeColorVector[(layerGroups[nodeGroups[node_whole_names[i]]])%nodeColorVector.length];
        if (node_attributes.Url !== undefined && node_attributes.Url[pos] !== "" && node_attributes.Url[pos] != " " && node_attributes.Url[pos] !== null)
          url = node_attributes.Url[pos];
        if (node_attributes.Description !== undefined && node_attributes.Description[pos] !== "" && node_attributes.Description[pos] != " " && node_attributes.Description[pos] !== null)
          descr = node_attributes.Description[pos];
      } else color = nodeColorVector[(layerGroups[nodeGroups[node_whole_names[i]]])%nodeColorVector.length];
    }  else if (nodes[i].userData.cluster) nodes[i].material.color = new THREE.Color(nodeColorVector[nodes[i].userData.cluster]);
    else color = nodeColorVector[(layerGroups[nodeGroups[node_whole_names[i]]]) % nodeColorVector.length];

    if (node_cluster_colors.length !== 0) color = node_cluster_colors[i];
    
    temp_js_nodes = [node_names[i], nodeGroups[node_whole_names[i]], nodes[i].position.x, nodes[i].position.y, nodes[i].position.z,
      nodes[i].scale.x, color, url, descr];
    js_nodes.push(temp_js_nodes);
    
    // VR
    temp_js_nodes = [node_names[i], nodeGroups[node_whole_names[i]],
      nodes[i].getWorldPosition(target).x, nodes[i].getWorldPosition(target).y, nodes[i].getWorldPosition(target).z,
      nodes[i].scale.x, color];
    js_nodes_world.push(temp_js_nodes);
  }
  Shiny.setInputValue("js_nodes", JSON.stringify(js_nodes));
  Shiny.setInputValue("js_nodes_world", JSON.stringify(js_nodes_world)); // VR
}

const updateNodeNamesRShiny = () => {
  Shiny.setInputValue("js_node_names", node_whole_names);
}

const updateSelectedNodesRShiny = () => {
  Shiny.setInputValue("js_selectedNodePositions", selectedNodePositions);
}

// Edges
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
}

const updateDirectionCheckboxRShiny = (name, value) => {
  Shiny.setInputValue('js_direction_checkbox_flag', [name, !value])
  Shiny.setInputValue('js_direction_checkbox_flag', [name, value])
}

const updateEdgeByWeightCheckboxRShiny = (name, value) => {
  Shiny.setInputValue('js_edgeByWeight_checkbox_flag', [name, !value])
  Shiny.setInputValue('js_edgeByWeight_checkbox_flag', [name, value])
}

// Labels
const updateLabelColorRShiny = () => {
  Shiny.setInputValue("js_label_color", globalLabelColor);
}

const updateVRLayerLabelsRShiny = () => {
  let js_vr_layer_labels = [],
  target = new THREE.Vector3(),
  layer_planes = layers.map(({ plane }) => plane);

for (let i = 0; i < layers.length; i++) {
  js_vr_layer_labels.push(
    [layers[i].getName(), layer_planes[i].getWorldPosition(target).x,
    layer_planes[i].getWorldPosition(target).y, layer_planes[i].getWorldPosition(target).z]
  );
}

js_vr_layer_labels = js_vr_layer_labels.map(layer => {
  return {
    name: layer[0],
    worldPosition_x: layer[1],
    worldPosition_y: layer[2],
    worldPosition_z: layer[3]
  }
});
Shiny.setInputValue("js_vr_layer_labels", JSON.stringify(js_vr_layer_labels));
};
