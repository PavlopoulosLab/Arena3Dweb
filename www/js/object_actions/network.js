const uploadNetwork = (network) => { 
  executePreNetworkSetup();

  initializeLayers(network);
  initializeNodes(network);
  initializeEdges(network);

  let layer_names = layers.map(({ name }) => name);
  if (layer_names.length > MAX_LAYERS) {
    alert("Network must contain no more than ".concat(MAX_LAYERS).concat(" layers.")); //layer limit
  } else {
    node_label_flags = Array.apply(0, Array(node_names.length)).map(function() { return false; });

    if (network.Channel) {
      let channel_values = network.Channel.filter((x, i, a) => a.indexOf(x) == i)
      if (channel_values.length > MAX_CHANNELS) {
        alert("Network must contain no more than ".concat(MAX_CHANNELS).concat(" channels.")); //channel limit
        return false
      } else {
        channels = channel_values;
        channels.forEach(c => {
          channelVisibility[c] = true;
        });
      }
    }
  
    if (edge_values.length > MAX_EDGES)
      alert("Network must contain no more than ".concat(MAX_EDGES).concat(" edges.")); //edge limit
    else {
      attachLayerCheckboxes();
      loadGraph();
      if (network.Channel) {
        attachChannelEditList();
        toggleChannelCurvatureRange(true);
        attachChannelLayoutList();
      } else {
        toggleChannelCurvatureRange(false);
      }
    }
    
    executePostNetworkSetup();
  }
}

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
  node_label_flags = [];

  // layers
  layers = [];
  layerGroups = new Map();
  lastHoveredLayerIndex = "";

  // nodes
  nodes = []; //canvas objects
  node_names = [];
  node_whole_names = [];
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
  toggleChannelCurvatureRange(false);
  
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
    layers.push(new Layer({id: i, name: layer_names[i]}));
    layerGroups[layer_names[i]] = i;
  }
};

const initializeNodes = (network) => {
  node_names = network.SourceNode.concat(network.TargetNode);
  node_names = getUniqueValues(node_names);
  node_whole_names = network.SourceNode_Layer.concat(network.TargetNode_Layer);
  node_whole_names = getUniqueValues(node_whole_names);

  // TODO change arrays with node objects
  // for (let i = 0; i < node_names.length; i++) {}
};

const initializeEdges = (network) => {
  let sourceNodeLayerName, targetNodeLayerName, edgePair;

  for (let i = 0; i < network.SourceNode.length; i++) {
    sourceNodeLayerName = network.SourceNode_Layer[i];
    targetNodeLayerName = network.TargetNode_Layer[i];
    // push node-layer group maps, TODO probably move into initializeNodes when Node class ready
    nodeGroups[sourceNodeLayerName] = network.SourceLayer[i]; // faster if here, in one for loop
    nodeGroups[targetNodeLayerName] = network.TargetLayer[i];
    
    //push edges and values
    edgePair = sourceNodeLayerName.concat("---").concat(targetNodeLayerName);
    if (network.Channel)
      updateChannelArrays(network.Channel[i], edgePair);
    else
      edge_pairs.push(edgePair);

    edge_values.push(network.Weight[i]);
  }
};

const updateChannelArrays = (channelName, edgePair) => {
  let position;
  if (edge_pairs.includes(edgePair) ) {
    position = edge_pairs.indexOf(edgePair);
    edge_channels[position].push(channelName);
  } else {
    edge_pairs.push(edgePair);
    edge_channels.push([channelName]);
  }
};

const loadGraph = () => {
  //create layer planes
  let layerSphereGeometry = new THREE.SphereGeometry( 0 );
  let layerSphereMaterial = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0.5} );
  for(let i = 0; i < Object.getOwnPropertyNames(layerGroups).length; i++) {
    scene.addLayer(layers[i].plane); 
  }
  //create node geometries
  for (i = 0; i < node_whole_names.length; i++){
    geometry = new THREE.SphereGeometry( SPHERE_RADIUS, SPHERE_WIDTHSEGMENTS, SPHERE_HEIGHTSEGMENTS );
    material = new THREE.MeshStandardMaterial( {color: nodeColorVector[(layerGroups[nodeGroups[node_whole_names[i]]])%nodeColorVector.length], transparent: true} ); //standard material allows light reaction
    sphere = new THREE.Mesh( geometry, material );
    nodes.push(sphere);
    layers[layerGroups[nodeGroups[node_whole_names[i]]]].plane.add(sphere); //attaching to corresponding layer centroid
  }
  
  channel_colors = CHANNEL_COLORS_LIGHT;
  createChannelColorMap();
  scrambleNodes();
  initialSpreadLayers(1);
  drawEdges();
  createLabels();

  //init selected channels for layout with all the channels
  channels_layout = channels;
  Shiny.setInputValue("channels_layout", channels_layout); //R monitors selected Channels
  
  scene.tiltDefault();
  scene.setScale(0.9); //starting a little zoomed out
}

const executePostNetworkSetup = () => {
  let layer_planes = layers.map(({ plane }) => plane);
  drag_controls = new DragControls(layer_planes, camera, renderer.domElement);

  updateScenePanRShiny();
  updateSceneSphereRShiny();
  updateLayersRShiny();
  updateVRLayerLabelsRShiny();
  updateLayerNamesRShiny();

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

  
  setLabelColorVariable(jsonNetwork.universalLabelColor);  
  
  let whole_name = "",
    min_import_width = "",
    channel_values = [],
    node_attributes = {
      "Node": [],
      "Size": [],
      "Color": [],
      "Url": [],
      "Description": [],
    },
    edge_attributes = {
      "SourceNode": [],
      "TargetNode": [],
      "Color": []
    },
    scrambleNodes_flag = false;
  
  // SCENE
  scene.setPosition("x", Number(jsonNetwork.scene.position_x));
  scene.setPosition("y", Number(jsonNetwork.scene.position_y));
  scene.setScale(Number(jsonNetwork.scene.scale));
  renderer.setClearColor(jsonNetwork.scene.color);
  scene.setRotation("x", Number(jsonNetwork.scene.rotation_x));
  scene.setRotation("y", Number(jsonNetwork.scene.rotation_y));
  scene.setRotation("z", Number(jsonNetwork.scene.rotation_z));
  
  // LAYER
  for (let i = 0; i < jsonNetwork.layers.name.length; i++) {
    layerGroups[jsonNetwork.layers.name[i]] = i;
    layers.push(new Layer({id: i, name: jsonNetwork.layers.name[i],
      position_x: Number(jsonNetwork.layers.position_x[i]),
      position_y: Number(jsonNetwork.layers.position_y[i]),
      position_z: Number(jsonNetwork.layers.position_z[i]),
      last_layer_scale: Number(jsonNetwork.layers.last_layer_scale[i]),
      rotation_x: Number(jsonNetwork.layers.rotation_x[i]),
      rotation_y: Number(jsonNetwork.layers.rotation_y[i]),
      rotation_z: Number(jsonNetwork.layers.rotation_z[i]),
      floor_current_color: jsonNetwork.layers.floor_current_color[i],
      geometry_parameters_width: Number(jsonNetwork.layers.geometry_parameters_width[i])}));
    scene.addLayer(layers[i].plane);
  }

  // NODE
  for (let i = 0; i < jsonNetwork.nodes.name.length; i++) {
    node_names.push(jsonNetwork.nodes.name[i]);
    currentLayer = jsonNetwork.nodes.layer[i];
    whole_name = jsonNetwork.nodes.name[i].concat("_").concat(currentLayer);
    node_whole_names.push(whole_name); //name + group
    node_attributes.Node.push(whole_name);
    nodeGroups[whole_name] = jsonNetwork.nodes.layer[i];
    //create node geometries
    let geometry = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_WIDTHSEGMENTS, SPHERE_HEIGHTSEGMENTS);
    let material = new THREE.MeshStandardMaterial({
      color: jsonNetwork.nodes.color[i],
      transparent: true
    });
    node_attributes.Color.push(jsonNetwork.nodes.color[i]);
    node_attributes.Url.push(jsonNetwork.nodes.url[i]);
    node_attributes.Description.push(jsonNetwork.nodes.descr[i]);
    let sphere = new THREE.Mesh(geometry, material);
    nodes.push(sphere);
    layers[layerGroups[nodeGroups[whole_name]]].plane.add(sphere);
    sphere.position.x = Number(jsonNetwork.nodes.position_x[i]);
    sphere.position.y = Number(jsonNetwork.nodes.position_y[i]);
    sphere.position.z = Number(jsonNetwork.nodes.position_z[i]);
    sphere.scale.x = sphere.scale.y = sphere.scale.z = 
      Number(jsonNetwork.nodes.scale[i]);
    node_attributes.Size.push(Number(jsonNetwork.nodes.scale[i]));
  }
  
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
  isDirectionEnabled = jsonNetwork.direction;
  updateDirectionCheckboxRShiny('edgeDirectionToggle', isDirectionEnabled);
  edgeWidthByWeight = jsonNetwork.edgeOpacityByWeight;
  updateEdgeByWeightCheckboxRShiny('edgeWidthByWeight', edgeWidthByWeight);

  if (channel_values.length > 0) {
    if (channel_values.length > MAX_CHANNELS) {
      alert("Network must contain no more than ".concat(MAX_CHANNELS).concat(" channels.")); //channel limit
      return false
    } else {
        channel_colors = CHANNEL_COLORS_LIGHT;
        channels = channel_values;
        channels.forEach(c => {
          channelVisibility[c] = true;
        });
        createChannelColorMap()
    }
    attachChannelEditList();
    toggleChannelCurvatureRange(true);
    attachChannelLayoutList();
    channels_layout = channels;
    Shiny.setInputValue("channels_layout", channels_layout); //R monitors selected Channels
    } else {
    edge_channels = []
    toggleChannelCurvatureRange(false);
  }
  node_label_flags = Array.apply(0, Array(node_names.length)).map(function() { return false; }); //for node label rendering

  attachLayerCheckboxes();
  drawEdges();
  drawLayerEdges(); // important, to create inter-layer edges beforehand, to avoid updateEdgesRShiny() bug
  createLabels();

  // initialSpreadLayers(1);
  if (jsonNetwork.scramble_nodes)
    scrambleNodes_flag = true;
  if (scrambleNodes_flag) {
    min_import_width = jsonNetwork.layers.geometry_parameters_width.map(function(str) {
      return Number(str);
    });
    min_import_width = Math.min(...min_import_width);
    scrambleNodes(min_import_width / 2, -min_import_width / 2, -min_import_width / 2, min_import_width / 2);
  }
  
  toggleDirection(isDirectionEnabled)
  
  
  executePostNetworkSetup();
}
