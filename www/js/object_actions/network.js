const uploadNetwork = (network) => { 
  executePreNetworkSetup();
  
  scene.tiltDefault();
  scene.setScale(0.9);
  initializeLayers(network);
  if (areObjectsWithinLimit(layers, MAX_LAYERS, "layers")) {
    initializeNodeAndEdgeArrays(network);
    if (areObjectsWithinLimit(edge_values, MAX_EDGES, "edges") && 
      areObjectsWithinLimit(channels, MAX_CHANNELS, "channels")) {
        initializeNodes();
        initializeEdges();

        toggleChannelUIComponents(); // TODO executePostNetworkSetup?
        attachLayerCheckboxes(); // TODO executePostNetworkSetup?

        executePostNetworkSetup();
    }
  }  
};

const executePreNetworkSetup = () => {
  resetValues();
  if (!canvasControlsAttached)
    attachCanvasControls();
};

const resetValues = () => {
  scene.reset();

  // labels
  document.getElementById("labelDiv").innerHTML = "";
  layer_label_divs = []; //divs
  node_labels = [];
  nodeLabelFlags = [];

  // layers
  layers = [];
  layerGroups = new Map();
  lastHoveredLayerIndex = "";

  // nodes
  nodes = []; //canvas objects
  nodeNames = [];
  nodeLayerNames = [];
  nodeGroups = new Map();
  hovered_nodes = [];
  last_hovered_node_index = "";
  selectedNodePositions = [];
  nodeColorVector = COLOR_VECTOR_DARK.concat(COLOR_VECTOR_271);
  node_cluster_colors = [];
  node_attributes = "";

  // edges
  edges = []; //canvas objects
  layerEdges = []; //canvas objects
  edge_pairs = [];
  layer_edges_pairs = []; //canvas objects
  layer_edges_pairs_channels = []; //canvas objects
  edge_values = [];
  selected_edges = [];
  edge_attributes = "";
  // channels
  if (document.getElementById("channelColorLayoutDiv"))
    document.getElementById("channelColorLayoutDiv").innerHTML = "";
  if (document.getElementById("channelColorPicker"))
    document.getElementById("channelColorPicker").innerHTML = "";
  edge_channels = [];
  channels = [];
  channel_values = [];
  isDirectionEnabled = false;
  updateToggleCurvatureComponentsRShiny(false);
  
  // others
  shiftX = "";
  shiftY = "";
  lasso = "";
  optionsList = "";
};

const initializeLayers = (network) => {
  let layer_names = network.SourceLayer.concat(network.TargetLayer);
  layer_names = getUniqueValues(layer_names);
  for (let i = 0; i < layer_names.length; i++) {
    layerGroups[layer_names[i]] = i;
    layers.push(new Layer({id: i, name: layer_names[i]}));
    scene.addLayer(layers[i].plane);
  }
  initialSpreadLayers(1);
};

const areObjectsWithinLimit = (object, limit, objectName) => {
  let areWithinLimit = true;
  if (object.length > limit) {
    areWithinLimit = false;
    alert(`Network must contain no more than ${limit} ${objectName}.`);
  }
  return(areWithinLimit);
}

const initializeNodeAndEdgeArrays = (network) => {
  let sourceNodeLayerName, targetNodeLayerName, edgePair;

  for (let i = 0; i < network.SourceNode.length; i++) {
    sourceNodeLayerName = network.SourceNode_Layer[i];
    targetNodeLayerName = network.TargetNode_Layer[i];
    
    updateNodeArrays(sourceNodeLayerName, network.SourceNode[i], network.SourceLayer[i]);
    updateNodeArrays(targetNodeLayerName, network.TargetNode[i], network.TargetLayer[i]);

    edgePair = sourceNodeLayerName.concat("---").concat(targetNodeLayerName);
    if (network.Channel)
      updateEdgeChannelArrays(network.Channel[i], edgePair);
    else
      edge_pairs.push(edgePair);

    edge_values.push(network.Weight[i]);
  }

  updateChannelArrays(network.Channel);
};

const updateNodeArrays = (nodeLayerName, nodeName, layerName) => {
  if (!nodeLayerNames.includes(nodeLayerName)) {
    nodeLayerNames.push(nodeLayerName);
    nodeNames.push(nodeName);
    nodeGroups[nodeLayerName] = layerName; 
  }
};

const updateEdgeChannelArrays = (channelName, edgePair) => {
  let position;
  if (edge_pairs.includes(edgePair) ) {
    position = edge_pairs.indexOf(edgePair);
    edge_channels[position].push(channelName);
  } else {
    edge_pairs.push(edgePair);
    edge_channels.push([channelName]);
  }
};

const updateChannelArrays = (channelArray) => { // TODO continue from here
  if (channelArray) {
    channels = getUniqueValues(channelArray);
    selectedChannels = channels.slice(); // copy by value, and not by reference
    
    for (let i = 0; i < channels.length; i++)
      channelVisibility[channels[i]] = true;

    getChannelColorsFromPalette(CHANNEL_COLORS_LIGHT);
    
    Shiny.setInputValue("js_selectedChannels", selectedChannels); // R monitors selected Channels
  }
};

const initializeNodes = () => {
  createNodeObjects();
  scrambleNodes();
};

const toggleChannelUIComponents = () => { // TODO probably move in executePostNetworkSetup
  if (channels.length > 0) {    
    attachChannelEditList();
    attachChannelLayoutList();
    updateToggleCurvatureComponentsRShiny(true);
  } else
    updateToggleCurvatureComponentsRShiny(false);
};

const executePostNetworkSetup = () => {
  let layer_planes = layers.map(({ plane }) => plane);
  drag_controls = new DragControls(layer_planes, camera, renderer.domElement);

  updateScenePanRShiny();
  updateSceneSphereRShiny();
  updateLayersRShiny();
  updateVRLayerLabelsRShiny();
  updateLayerNamesRShiny();

  nodeLabelFlags = new Array(nodeLayerNames.length).fill(false);
  createLabels();
  updateNodesRShiny();
  updateNodeNamesRShiny(); //for Local Layout algorithms
  updateSelectedNodesRShiny();

  updateEdgesRShiny();
  updateLabelColorRShiny();

  if (!animationRunning) { // ensure animation runs only once
    animate();
    animationRunning = true;
  }
}

const importNetwork = (jsonNetwork) => {
  executePreNetworkSetup();
  
  initializeSceneFromJSON(jsonNetwork.scene);
  initializeLayersFromJSON(jsonNetwork.layers);
  if (areObjectsWithinLimit(layers, MAX_LAYERS, "layers")) {
    initializeNodesFromJSON(jsonNetwork.nodes, jsonNetwork.scramble_nodes);
    

    
    
    
    let channel_values = [];

    edge_attributes = {
      "SourceNode": [],
      "TargetNode": [],
      "Color": []
    };

    
    // EDGE
    for (let i = 0; i < jsonNetwork.edges.src.length; i++) {
      let edge_pair = jsonNetwork.edges.src[i].concat("---").concat(jsonNetwork.edges.trg[i]);
      if (!edge_pairs.includes(edge_pair)) {
        edge_pairs.push(edge_pair);
        edge_channels.push([]);
      }
      
      if (jsonNetwork.edges.channel != null) {
        //create edge_attributes.Channel
        if (!edge_attributes.Channel) {
          edge_attributes.Channel = []
        }
        pos = edge_pairs.indexOf(edge_pair);
        edge_channels[pos].push(jsonNetwork.edges.channel[i]);
        if (!channel_values.includes(jsonNetwork.edges.channel[i])) {
          channel_values.push(jsonNetwork.edges.channel[i])
        }
        edge_attributes.Channel.push(jsonNetwork.edges.channel[i]);
      }
      
      edge_values.push(Number(jsonNetwork.edges.opacity[i]));
      edge_attributes.SourceNode.push(edge_pair);
      edge_attributes.TargetNode.push("");
      edge_attributes.Color.push(jsonNetwork.edges.color[i]);
    }
    
    // EXTRAS
    setLabelColorVariable(jsonNetwork.universalLabelColor);  

    isDirectionEnabled = jsonNetwork.direction;
    updateDirectionCheckboxRShiny('edgeDirectionToggle', isDirectionEnabled);
    edgeWidthByWeight = jsonNetwork.edgeOpacityByWeight;
    updateEdgeByWeightCheckboxRShiny('edgeWidthByWeight', edgeWidthByWeight);

    if (channel_values.length > 0) {
      if (channel_values.length > MAX_CHANNELS) {
        alert("Network must contain no more than ".concat(MAX_CHANNELS).concat(" channels.")); //channel limit
        return false
      } else {
          channels = channel_values;
          channels.forEach(c => {
            channelVisibility[c] = true;
          });
          getChannelColorsFromPalette(CHANNEL_COLORS_LIGHT);
      }

      attachChannelEditList();
      updateToggleCurvatureComponentsRShiny(true);
      attachChannelLayoutList();
      selectedChannels = channels.slice(); // copy by value, and not by reference
      Shiny.setInputValue("js_selectedChannels", selectedChannels); //R monitors selected Channels
    } else {
      edge_channels = [];
      updateToggleCurvatureComponentsRShiny(false);
    }

    attachLayerCheckboxes();
    initializeEdges();
    drawLayerEdges(); // important, to create inter-layer edges beforehand, to avoid updateEdgesRShiny() bug

    
    
    toggleDirection(isDirectionEnabled)
    
    
    executePostNetworkSetup();
  }
}

const initializeSceneFromJSON = (jsonScene) => {
  scene.setPosition("x", Number(jsonScene.position_x));
  scene.setPosition("y", Number(jsonScene.position_y));
  scene.setScale(Number(jsonScene.scale));
  renderer.setClearColor(jsonScene.color);
  scene.setRotation("x", Number(jsonScene.rotation_x));
  scene.setRotation("y", Number(jsonScene.rotation_y));
  scene.setRotation("z", Number(jsonScene.rotation_z));
};

const initializeLayersFromJSON = (jsonLayers) => {
  for (let i = 0; i < jsonLayers.name.length; i++) {
    layerGroups[jsonLayers.name[i]] = i;
    layers.push(new Layer({
      id: i, name: jsonLayers.name[i],
      position_x: Number(jsonLayers.position_x[i]),
      position_y: Number(jsonLayers.position_y[i]),
      position_z: Number(jsonLayers.position_z[i]),
      last_layer_scale: Number(jsonLayers.last_layer_scale[i]),
      rotation_x: Number(jsonLayers.rotation_x[i]),
      rotation_y: Number(jsonLayers.rotation_y[i]),
      rotation_z: Number(jsonLayers.rotation_z[i]),
      floor_current_color: jsonLayers.floor_current_color[i],
      geometry_parameters_width: Number(jsonLayers.geometry_parameters_width[i])
    }));
    scene.addLayer(layers[i].plane);
  }
};

const initializeNodesFromJSON = (jsonNodes, jsonScrambleFlag) => {
  let nodeLayerName = "",
    nodeColor, sphere;

  node_attributes = {
    "Node": [],
    "Size": [],
    "Color": [],
    "Url": [],
    "Description": [],
  };
  
  for (let i = 0; i < jsonNodes.name.length; i++) {
    nodeNames.push(jsonNodes.name[i]);
    currentLayer = jsonNodes.layer[i];
    nodeLayerName = jsonNodes.name[i].concat("_").concat(currentLayer);
    nodeLayerNames.push(nodeLayerName); //name + group
    nodeGroups[nodeLayerName] = jsonNodes.layer[i];

    node_attributes.Node.push(nodeLayerName);
    node_attributes.Size.push(Number(jsonNodes.scale[i]));
    node_attributes.Color.push(jsonNodes.color[i]);
    node_attributes.Url.push(jsonNodes.url[i]);
    node_attributes.Description.push(jsonNodes.descr[i]);
    
    nodeColor = jsonNodes.color[i];
    sphere = createNodeObject(nodeColor);
    layers[layerGroups[nodeGroups[nodeLayerName]]].plane.add(sphere);

    sphere.position.x = Number(jsonNodes.position_x[i]);
    sphere.position.y = Number(jsonNodes.position_y[i]);
    sphere.position.z = Number(jsonNodes.position_z[i]);
    sphere.scale.x = sphere.scale.y = sphere.scale.z = Number(jsonNodes.scale[i]);
  }

  if (jsonScrambleFlag) {
    let minWidth,
      layerWidths = layers.map(({ geometry_parameters_width }) => geometry_parameters_width);
    minWidth = Math.min(...layerWidths);
    scrambleNodes(-minWidth / 2, minWidth / 2, -minWidth / 2, minWidth / 2);
  }
};
