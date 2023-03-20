const executePreNetworkSetup = () => {
    colorVector = COLOR_VECTOR_DARK.concat(COLOR_VECTOR_271);
    clearCanvas();
    if (!canvasControlsAttached)
        attachCanvasControls();
};

const clearCanvas = () => {
  scene.reset();
  layers = [];
  nodes = []; //canvas objects
  node_labels = [];
  document.getElementById("labelDiv").innerHTML = "";
  if (document.getElementById("channelColorLayoutDiv")) document.getElementById("channelColorLayoutDiv").innerHTML = "";
  if (document.getElementById("channelColorPicker")) document.getElementById("channelColorPicker").innerHTML = "";
  node_names = [];
  node_whole_names = [];
  node_label_flags = [];
  hovered_nodes = [];
  last_hovered_node_index = "";
  lastHoveredLayerIndex = "";
  edges = []; //canvas objects
  layerEdges = []; //canvas objects
  edge_pairs = [];
  layer_edges_pairs = []; //canvas objects
  layer_edges_pairs_channels = []; //canvas objects
  edge_values = [];
  edge_channels = [];
  channels = [];
  node_groups = new Map();
  layerGroups = new Map();
  layer_label_divs = []; //divs
  selectedNodePositions = [];
  selected_edges = [];
  shiftX = "";
  shiftY = "";
  lasso = "";
  optionsList = "";
  node_cluster_colors = [];
  node_attributes = "";
  edge_attributes = "";
  channel_values = [];
  isDirectionEnabled = false;
  toggleChannelCurvatureRange(false);
}

const uploadNetwork = (network) => { 
  executePreNetworkSetup();

  let temp_name1 = temp_name2 = temp_layer1 = temp_layer2 = "",
    layers_counter = 0, layer_names = [];
  let temp_channel;
  for (let i=0; i < network.SourceLayer.length; i++){
    temp_layer1 = String(network.SourceLayer[i]);
    temp_layer2 = String(network.TargetLayer[i]);
    temp_name1 = network.SourceNode_Layer[i];
    temp_name2 = network.TargetNode_Layer[i];
    if (network.Channel) {
      temp_channel = String(network.Channel[i]);
    }
    //push new nodes, layers, layerGroups and node-layergroup maps
    if (!node_whole_names.includes(temp_name1)){
      node_names.push(String(network.SourceNode[i]));
      node_whole_names.push(temp_name1);
      node_groups[temp_name1] = temp_layer1;
      if (!layer_names.includes(temp_layer1)){
        layer_names.push(temp_layer1);
        layers.push(new Layer({id: layers_counter, name: temp_layer1}));
        layerGroups[temp_layer1] = layers_counter;
        layers_counter++;
      }
    }
    if (!node_whole_names.includes(temp_name2)){
      node_names.push(String(network.TargetNode[i]));
      node_whole_names.push(temp_name2);
      node_groups[temp_name2] = temp_layer2;
      if (!layer_names.includes(temp_layer2)){
        layer_names.push(temp_layer2);
        layers.push(new Layer({id: layers_counter, name: temp_layer2}));
        layerGroups[temp_layer2] = layers_counter;
        layers_counter++;
      }
    }
    //push edges and values
    //check if edges_pair already exists if yes add a channel to edges_channels if not create new
    temp_edge_pair = temp_name1.concat("---").concat(temp_name2);
    if (temp_channel) {
       if (edge_pairs.includes(temp_edge_pair) ) {
        pos = edge_pairs.indexOf(temp_edge_pair);
        edge_channels[pos].push(temp_channel);
      } else {
        edge_pairs.push(temp_edge_pair);
        edge_channels.push([temp_channel]);
      }
    } else {
      edge_pairs.push(temp_edge_pair);
    }
    edge_values.push(Number(String(network.Weight[i])));
  }
  
  if (layer_names.length > MAX_LAYERS) {
    alert("Network must contain no more than ".concat(MAX_LAYERS).concat(" layers.")); //layer limit
  } else {
    node_label_flags = Array.apply(0, Array(node_names.length)).map(function() { return false; });

    //edge_values = mapper(edge_values, 0.1, 1) //min and max opacities //this is done in R now
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
    material = new THREE.MeshStandardMaterial( {color: colorVector[(layerGroups[node_groups[node_whole_names[i]]])%colorVector.length], transparent: true} ); //standard material allows light reaction
    sphere = new THREE.Mesh( geometry, material );
    nodes.push(sphere);
    layers[layerGroups[node_groups[node_whole_names[i]]]].plane.add(sphere); //attaching to corresponding layer centroid
  }
  
  channel_colors = CHANNEL_COLORS_LIGHT;
  createChannelColorMap();
  scrambleNodes();
  positionLayers();
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
    adjustLayerSize_flag = false;
  
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
    node_groups[whole_name] = jsonNetwork.nodes.layer[i];
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
    layers[layerGroups[node_groups[whole_name]]].plane.add(sphere);
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

  //positionLayers(true);
  if (jsonNetwork.scramble_nodes)
    scrambleNodes_flag = true;
  if (scrambleNodes_flag) {
    min_import_width = jsonNetwork.layers.geometry_parameters_width.map(function(str) {
      return Number(str);
    });
    min_import_width = Math.min(...min_import_width);
    scrambleNodes(min_import_width / 2, -min_import_width / 2, -min_import_width / 2, min_import_width / 2);
  }

  if (jsonNetwork.adjust_layer_size)
    adjustLayerSize_flag = true;
  if (adjustLayerSize_flag)
    adjustLayerSize();
  toggleDirection(isDirectionEnabled)
  
  
  executePostNetworkSetup();
}
