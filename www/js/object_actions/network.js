const uploadNetwork = (network) => { 
  executePreNetworkSetup();
  
  initializeScene();
  initializeLayers(network);
  if (areObjectsWithinLimit(layers, MAX_LAYERS, "layers")) {
    initializeNodeAndEdgeArrays(network);
    if (areObjectsWithinLimit(edgeValues, MAX_EDGES, "edges") && 
      areObjectsWithinLimit(channels, MAX_CHANNELS, "channels")) {
        initializeNodes();
        
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
  renderLayerLabelsFlag = false;
  node_labels = [];
  renderNodeLabelsFlag = false;

  // layers
  layers = [];
  layerGroups = new Map();
  lastHoveredLayerIndex = "";

  // nodes
  nodeObjects = [];
  nodeNames = [];
  nodeLayerNames = [];
  nodeGroups = new Map();
  last_hovered_node_index = "";

  // edges
  interLayerEdgeOpacity = 0.4,
  intraLayerEdgeOpacity = 1,
  interDirectionArrowSize = 0.03,
  intraDirectionArrowSize = 0.08,
  interChannelCurvature = 0.05,
  intraChannelCurvature = 0.05,
  edgeObjects = [];
  edgeAttributesPriority = true;
  layerEdges = []; //canvas objects
  edgePairs = [];
  edgePairs_source = [];
  edgePairs_target = [];
  layer_edges_pairs = []; //canvas objects
  edgeValues = [];
  selected_edges = [];
  edge_attributes = "";
  isDirectionEnabled = false;
  updateToggleCurvatureComponentsRShiny(false);
  // channels
  if (document.getElementById("channelColorLayoutDiv"))
    document.getElementById("channelColorLayoutDiv").innerHTML = "";
  if (document.getElementById("channelColorPicker"))
    document.getElementById("channelColorPicker").innerHTML = "";
  channels = [];
  selectedChannels = [];
  channelColors = {};
  channelVisibility = {};
  edgeChannels = [];
  layer_edges_pairs_channels = [];

  // others
  shiftX = "";
  shiftY = "";
  lasso = "";
  optionsList = "";
};

const initializeScene = () => {
  scene.tiltDefault();
  scene.setScale(0.9);
  applyTheme('#000000', '#777777', '#ffffff',
     CHANNEL_COLORS_LIGHT, '#ffffff', fromInit = true);
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
  let sourceNodeLayerName, targetNodeLayerName;

  for (let i = 0; i < network.SourceNode.length; i++) {
    sourceNodeLayerName = network.SourceNode_Layer[i];
    targetNodeLayerName = network.TargetNode_Layer[i];
    
    updateNodeArrays(sourceNodeLayerName, network.SourceNode[i], network.SourceLayer[i]);
    updateNodeArrays(targetNodeLayerName, network.TargetNode[i], network.TargetLayer[i]);

    createEdgePairs(network.Channel, i, sourceNodeLayerName, targetNodeLayerName, network.Weight[i]);
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

const createEdgePairs = (networkChannel, i, sourceNodeLayerName, targetNodeLayerName,
  networkWeight) => {
    let edgePair = sourceNodeLayerName.concat("---").concat(targetNodeLayerName);
    if (networkChannel)
      updateEdgeChannelArrays(networkChannel[i], edgePair,
        sourceNodeLayerName, targetNodeLayerName, networkWeight);
    else {
      edgePairs.push(edgePair);
      edgePairs_source.push(sourceNodeLayerName);
      edgePairs_target.push(targetNodeLayerName);
      edgeValues.push([networkWeight]);
    }
};

const updateEdgeChannelArrays = (channelName, edgePair,
  sourceNodeLayerName, targetNodeLayerName, networkWeight) => {
    let position;
    if (edgePairs.includes(edgePair) ) {
      position = edgePairs.indexOf(edgePair);
      edgeChannels[position].push(channelName);
      edgeValues[position].push(networkWeight);
    } else {
      edgePairs.push(edgePair);
      edgePairs_source.push(sourceNodeLayerName);
      edgePairs_target.push(targetNodeLayerName);
      edgeChannels.push([channelName]);
      edgeValues.push([networkWeight]);
    }
};

const updateChannelArrays = (channelArray) => {
  if (channelArray) {
    channels = getUniqueValues(channelArray);
    
    for (let i = 0; i < channels.length; i++)
      channelVisibility[channels[i]] = true;

    getChannelColorsFromPalette(CHANNEL_COLORS_LIGHT);

    selectedChannels = channels.slice(); // copy by value, and not by reference
    Shiny.setInputValue("js_selectedChannels", selectedChannels); // R monitors selected Channels
  }
};

const initializeNodes = () => {
  createNodeObjects();
  scrambleNodes();
};

const executePostNetworkSetup = () => {
  let layer_planes = layers.map(({ plane }) => plane);
  drag_controls = new DragControls(layer_planes, camera, renderer.domElement);

  createEdgeObjects();
  createLabels();

  attachLayerCheckboxes();
  toggleChannelUIComponents();

  if (!animationRunning) { // ensure animation runs only once
    animate();
    animationRunning = true;
  }

  updateScenePanRShiny();
  updateSceneSphereRShiny();
  updateLayersRShiny();
  updateVRLayerLabelsRShiny();
  updateLayerNamesRShiny();
  updateNodesRShiny();
  updateVRNodesRShiny();
  updateNodeNamesRShiny();
  updateSelectedNodesRShiny();
  updateEdgesRShiny();
  updateLabelColorRShiny();
}

const toggleChannelUIComponents = () => {
  if (channels.length > 0) {    
    attachChannelEditList();
    attachChannelLayoutList();
    updateToggleCurvatureComponentsRShiny(true);
  } else
    updateToggleCurvatureComponentsRShiny(false);
};

const importNetwork = (jsonNetwork) => {
  executePreNetworkSetup();
  
  initializeSceneFromJSON(jsonNetwork.scene);
  initializeLayersFromJSON(jsonNetwork.layers);
  if (areObjectsWithinLimit(layers, MAX_LAYERS, "layers")) {
    initializeEdgesFromJSON(jsonNetwork.edges);
    if (areObjectsWithinLimit(edgeValues, MAX_EDGES, "edges") && 
      areObjectsWithinLimit(channels, MAX_CHANNELS, "channels")) {
        initializeNodesFromJSON(jsonNetwork.nodes, jsonNetwork.scramble_nodes); // TODO check if needed before edges after Classes done
        
        executePostNetworkSetup();

        setJSONExtras(jsonNetwork);
      }
  }
};

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

const initializeEdgesFromJSON = (jsonEdges) => {
  edge_attributes = {
    "SourceNode": [],
    "TargetNode": [],
    "EdgePair": [],
    "Color": []
  };
  if (jsonEdges.channel)
    edge_attributes.Channel = [];

  for (let i = 0; i < jsonEdges.src.length; i++) {
    createEdgePairs(jsonEdges.channel, i, jsonEdges.src[i], jsonEdges.trg[i],
      Number(jsonEdges.opacity[i]));

    edge_attributes.SourceNode.push(jsonEdges.src[i]);
    edge_attributes.TargetNode.push(jsonEdges.trg[i]);
    edge_attributes.EdgePair.push(jsonEdges.src[i].concat("---").concat(jsonEdges.trg[i]));
    edge_attributes.Color.push(jsonEdges.color[i]);
    if (jsonEdges.channel)
      edge_attributes.Channel.push(jsonEdges.channel[i]);
  }
  updateChannelArrays(jsonEdges.channel);
};

const initializeNodesFromJSON = (jsonNodes, jsonScrambleFlag) => {
  let nodeLayerName = "",
    nodeColor;
  nodeNames = undefined; // releasing ram

  for (let i = 0; i < jsonNodes.name.length; i++) {
    currentLayer = jsonNodes.layer[i];
    nodeLayerName = jsonNodes.name[i].concat("_").concat(currentLayer);
    nodeLayerNames.push(nodeLayerName); //name + group
    nodeGroups[nodeLayerName] = jsonNodes.layer[i];
    
    nodeColor = jsonNodes.color[i];
    nodeObjects.push(new Node({id: i, name: jsonNodes.name[i],
      layer: nodeGroups[nodeLayerNames[i]], nodeLayerName: nodeLayerNames[i],
      position_x: Number(jsonNodes.position_x[i]),
      position_y: Number(jsonNodes.position_y[i]),
      position_z: Number(jsonNodes.position_z[i]),
      scale: Number(jsonNodes.scale[i]), color: nodeColor,
      url: jsonNodes.url[i], descr: jsonNodes.descr[i]}));
    layers[layerGroups[nodeGroups[nodeLayerName]]].addNode(nodeObjects[i].sphere);
  }

  if (jsonScrambleFlag) {
    let minWidth,
      layerWidths = layers.map(({ geometry_parameters_width }) => geometry_parameters_width);
    minWidth = Math.min(...layerWidths);
    scrambleNodes(-minWidth / 2, minWidth / 2, -minWidth / 2, minWidth / 2);
  }
};

const setJSONExtras = (jsonNetwork) => {
  setLabelColorVariable(jsonNetwork.universalLabelColor);  

  isDirectionEnabled = jsonNetwork.direction;
  toggleDirection(isDirectionEnabled);
  updateDirectionCheckboxRShiny('edgeDirectionToggle', isDirectionEnabled);

  edgeWidthByWeight = jsonNetwork.edgeOpacityByWeight;
  updateEdgeByWeightCheckboxRShiny('edgeWidthByWeight', edgeWidthByWeight);
};
