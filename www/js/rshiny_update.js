// Scene
const updateScenePanRShiny = () => {
  renderInterLayerEdgesFlag = true;
  let js_scene_pan = {
    "position_x": scene.getPosition("x"),
    "position_y": scene.getPosition("y"),
    "scale": scene.getScale(),
    "color": "#".concat(renderer.getClearColor().getHexString()) 
  }
  Shiny.setInputValue("js_scene_pan", JSON.stringify(js_scene_pan));
};

const updateSceneSphereRShiny = () => {
  renderInterLayerEdgesFlag = true;
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

  renderInterLayerEdgesFlag = true;
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

  renderInterLayerEdgesFlag = true;
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
const updateEdgesRShiny = () => { // only called during network init once
  updateEdgeColorsRShiny();
  let js_edge_pairs = [];

  for (let i = 0; i < edgeObjects.length; i++) {
    if (edgeObjects[i].channels.length > 0) {
      for (let j = 0; j < edgeObjects[i].channels.length; j++)
        js_edge_pairs.push([edgeObjects[i].source, edgeObjects[i].target,
          edgeObjects[i].weights[j], edgeObjects[i].channels[j]]);
    } else
      js_edge_pairs.push([edgeObjects[i].source, edgeObjects[i].target,
        edgeObjects[i].weights[0], ""]);
  }
  
  js_edge_pairs = js_edge_pairs.map(edge => {
    return {
      src: edge[0],
      trg: edge[1],
      opacity: edge[2],
      channel: edge[3]
    }
  });
  Shiny.setInputValue("js_edge_pairs", JSON.stringify(js_edge_pairs));
};

const updateEdgeColorsRShiny = () => {
  let js_edge_colors = [];

  for (let i = 0; i < edgeObjects.length; i++) {
    if (edgeObjects[i].channels.length > 0) {
      for (let j = 0; j < edgeObjects[i].channels.length; j++) // TODO decide which color to export
        js_edge_colors.push([edgeObjects[i].importedColors[j]]);
    } else
      js_edge_colors.push([edgeObjects[i].importedColors[0]]);
  }
  
  js_edge_colors = js_edge_colors.map(edge => {
    return { color: edge[0] }
  });
  Shiny.setInputValue("js_edge_colors", JSON.stringify(js_edge_colors));
};

const updateSelectedChannelsRShiny = (element) => {
  let index = selectedChannels.indexOf(element.name);

  if (index > -1)
    selectedChannels.splice(index, 1);
  else
    selectedChannels.push(element.name);

  Shiny.setInputValue("js_selectedChannels", selectedChannels);
};

const updateDirectionCheckboxRShiny = (name, value) => {
  Shiny.setInputValue('js_direction_checkbox_flag', [name, !value]) // trigger
  Shiny.setInputValue('js_direction_checkbox_flag', [name, value])
};

const updateEdgeByWeightCheckboxRShiny = (name, value) => {
  Shiny.setInputValue('js_edgeByWeight_checkbox_flag', [name, !value]) // trigger
  Shiny.setInputValue('js_edgeByWeight_checkbox_flag', [name, value])
};

const updateToggleCurvatureComponentsRShiny = (message) => {
  Shiny.setInputValue("js_channel_curvature_flag", message);
};

// Labels
const updateLabelColorRShiny = () => {
  Shiny.setInputValue("js_label_color", globalLabelColor);
};

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
