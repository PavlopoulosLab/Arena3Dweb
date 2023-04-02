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

  renderLayerLabelsFlag = true;
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
  let js_nodes = [];

  renderNodeLabelsFlag = true;
  for (let i = 0; i < nodeObjects.length; i++) {    
    js_nodes.push([
      nodeObjects[i].getName(), nodeObjects[i].getLayer(),
      nodeObjects[i].getPosition("x"),
      nodeObjects[i].getPosition("y"),
      nodeObjects[i].getPosition("z"),
      nodeObjects[i].getScale(), nodeObjects[i].getColor(),
      nodeObjects[i].url, nodeObjects[i].descr
    ]);
  }

  js_nodes = js_nodes.map(node => {
    return {
      name: node[0],
      layer: node[1],
      position_x: node[2],
      position_y: node[3],
      position_z: node[4],
      scale: node[5],
      color: node[6],
      url: node[7],
      descr: node[8],
    }
  });
  Shiny.setInputValue("js_nodes", JSON.stringify(js_nodes));
};

const updateVRNodesRShiny = () => {
  let js_nodes_world = [];
  
  renderNodeLabelsFlag = true;
  for (let i = 0; i < nodeObjects.length; i++) {
    js_nodes_world.push([
      nodeObjects[i].getName(), nodeObjects[i].getLayer(),
      nodeObjects[i].getWorldPosition("x"),
      nodeObjects[i].getWorldPosition("y"),
      nodeObjects[i].getWorldPosition("z"),
      nodeObjects[i].getColor()
    ]);
  }

  js_nodes_world = js_nodes_world.map(node => {
    return {
      name: node[0],
      layer: node[1],
      worldPosition_x: node[2],
      worldPosition_y: node[3],
      worldPosition_z: node[4],
      color: node[5]
    }
  });
  Shiny.setInputValue("js_nodes_world", JSON.stringify(js_nodes_world));
};

// from JS, because need to get positions from js_selectedNodePositions
const updateNodeNamesRShiny = () => {
  Shiny.setInputValue("js_node_names", nodeLayerNames);
};

const updateSelectedNodesRShiny = () => {
  Shiny.setInputValue("js_selectedNodePositions", getSelectedNodes());
};

// Edges
const updateEdgesRShiny = () => {
  let js_edge_pairs = [],
    temp_js_edge_pairs = [],
    pos1 = (pos2 = pos3 = -1);
    temp_channel = '';
  j = 0;
  for (let i = 0; i < edgePairs.length; i++) {
    // color
    if (edge_attributes !== "") {
      pos1 = edge_attributes.SourceNode.indexOf(edgePairs[i]);
      pos2 = edge_attributes.TargetNode.indexOf(edgePairs[i]);
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
      else color = EDGE_DEFAULT_COLOR;
    } else color = EDGE_DEFAULT_COLOR;
    // color end
    
    if (edgeChannels && edgeChannels[i] && edgeChannels[i].length > 0) {
      edgeChannels[i].forEach((channel) => {
        temp_js_edge_pairs = [edgePairs_source[i], edgePairs_target[i], edgeValues[j], channelColors[channel], channel];
        js_edge_pairs.push(temp_js_edge_pairs);
        j++;
      });

    } else {
      temp_js_edge_pairs = [edgePairs_source[i], edgePairs_target[i], edgeValues[j], color, ""];
      js_edge_pairs.push(temp_js_edge_pairs);
      j++;
    }
  }
  
  js_edge_pairs = js_edge_pairs.map(edge => {
    return {
      src: edge[0],
      trg: edge[1],
      opacity: edge[2],
      color: edge[3],
      channel: edge[4]
    }
  });
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

const updateToggleCurvatureComponentsRShiny = (message) => {
  Shiny.setInputValue("js_channel_curvature_flag", message);
};

const updateSelectedChannelsRShiny = (element) => {
  const index = selectedChannels.indexOf(element.name);
  if (index > -1)
    selectedChannels.splice(index, 1);
  else
    selectedChannels.push(element.name);

  Shiny.setInputValue("js_selectedChannels", selectedChannels); // R monitors selected Channels
};

// Labels
const updateLabelColorRShiny = () => {
  Shiny.setInputValue("js_label_color", globalLabelColor);
}

const updateVRLayerLabelsRShiny = () => {
  let js_vr_layer_labels = [],
  target = new THREE.Vector3(),
  layer_planes = layers.map(({ plane }) => plane);

  renderLayerLabelsFlag = true;
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
