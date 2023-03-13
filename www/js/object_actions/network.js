const executePreNetworkSetup = () => {
    colorVector = COLOR_VECTOR_DARK.concat(COLOR_VECTOR_271);
    clearCanvas();
    if (!canvasControlsAttached)
        attachCanvasControls();
};

const uploadNetwork = (network) => { 
  console.log(network);
  executePreNetworkSetup();
  

  let temp_name1 = temp_name2 = temp_layer1 = temp_layer2 = "",
    layers_counter = 0;
  let temp_channel;
  for (let i=0; i < network.SourceLayer.length; i++){
    temp_layer1 = String(network.SourceLayer[i]);
    temp_layer2 = String(network.TargetLayer[i]);
    temp_name1 = network.SourceNode_Layer[i];
    temp_name2 = network.TargetNode_Layer[i];
    if (network.Channel) {
      temp_channel = String(network.Channel[i]);
    }
    //push new nodes, layers, layer_groups and node-layergroup maps
    if (!node_whole_names.includes(temp_name1)){
      node_names.push(String(network.SourceNode[i]));
      node_whole_names.push(temp_name1);
      node_groups[temp_name1] = temp_layer1;
      if (!layer_names.includes(temp_layer1)){
        layer_names.push(temp_layer1);
        layers.push(new Layer({id: layers_counter, name: temp_layer1}));
        layer_groups[temp_layer1] = layers_counter;
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
        layer_groups[temp_layer2] = layers_counter;
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
  node_label_flags = Array.apply(0, Array(node_names.length)).map(function() { return false; });
  layer_node_labels_flags = Array.apply(0, Array(layer_names.length)).map(function () { return false; });
  if (layer_names.length > MAX_LAYERS) {
     alert("Network must contain no more than ".concat(MAX_LAYERS).concat(" layers.")); //layer limit
      return false
  }
  updateLayerNamesRShiny(); //correct order of layer names to avoid bugs with positions
  updateNodeNamesRShiny(); //for Local Layout algorithms
  updateSelectedNodesRShiny();
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

const importNetwork = (jsonNetwork) => {
  executePreNetworkSetup();

  setLabelColorVariable(jsonNetwork.universalLabelColor);  
  
  let layers_counter = 0,
      color = "",
      whole_name = "",
    import_width = "",
    channel_values = [];
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
    };
  let scrambleNodes_flag = false;
  let adjustLayerSize_flag = false;
  let layerSphereGeometry = new THREE.SphereGeometry( 0 );
  let layerSphereMaterial = new THREE.MeshBasicMaterial( {
    color:"white", transparent: true, opacity: 0.5
    
  });
  
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
    import_width = jsonNetwork.layers.geometry_parameters_width[i];
    //create layer geometries
    let planeGeom = new THREE.PlaneGeometry(import_width, import_width, PLANE_WIDTHSEGMENTS, PLANE_HEIGHTSEGMENTS);
    planeGeom.rotateY(THREE.Math.degToRad(90));
    floorCurrentColor = new THREE.Color(jsonNetwork.layers.floor_current_color[i]);
    floorDefaultColors.push(floorCurrentColor)
    let planeMat = new THREE.MeshBasicMaterial({
      color: floorCurrentColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: layerOpacity,
      side: THREE.DoubleSide
    });
    let plane = new THREE.Mesh(planeGeom, planeMat);
    let sphere = new THREE.Mesh(layerSphereGeometry, layerSphereMaterial);
    plane.add(sphere);
    sphere.translateY(-import_width / 2);
    sphere.translateZ(import_width / 2);
    sphere.position.y = sphere.position.y * Number(jsonNetwork.layers.last_layer_scale[i]); //stretch factor for label
    sphere.position.z = sphere.position.z * Number(jsonNetwork.layers.last_layer_scale[i]); //stretch factor for label
    layer_planes.push(plane);
    layer_spheres.push(sphere);
    scene.addLayer(plane);
    if (jsonNetwork.layers.generate_coordinates) { 
      plane.position.x = Number(jsonNetwork.layers.position_x[i]);
      plane.position.y = Number(jsonNetwork.layers.position_y[i]);
      plane.position.z = Number(jsonNetwork.layers.position_z[i]);
    } else {
      plane.position.x = 0;
      plane.position.y = 0;
      plane.position.z = 0;
      plane.move = true
    }
    plane.geometry.scale(1,
      Number(jsonNetwork.layers.last_layer_scale[i]),
      Number(jsonNetwork.layers.last_layer_scale[i])
    );
    last_layer_scale.push(Number(jsonNetwork.layers.last_layer_scale[i]));
    plane.rotation.x = Number(jsonNetwork.layers.rotation_x[i]);
    plane.rotation.y = Number(jsonNetwork.layers.rotation_y[i]);
    plane.rotation.z = Number(jsonNetwork.layers.rotation_z[i]);
  }
  
  // NODE
  for (let i = 0; i < jsonNetwork.nodes.name.length; i++) {
    node_names.push(jsonNetwork.nodes.name[i]);
    currentLayer = jsonNetwork.nodes.layer[i];
    whole_name = jsonNetwork.nodes.name[i].concat("_").concat(currentLayer);
    node_whole_names.push(whole_name); //name + group
    node_attributes.Node.push(whole_name);
    node_groups[whole_name] = jsonNetwork.nodes.layer[i];
    if (!layer_groups.hasOwnProperty(currentLayer)) {
      layer_groups[currentLayer] = layers_counter;
      layers_counter++;
      layer_names.push(currentLayer);
    }
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
    layer_planes[layer_groups[node_groups[whole_name]]].add(sphere);
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
  if (jsonNetwork.scramble_nodes)
    scrambleNodes_flag = true;
    
  isDirectionEnabled = jsonNetwork.direction;
  updateDirectionCheckboxRShiny('edgeDirectionToggle', isDirectionEnabled);
  edgeWidthByWeight = jsonNetwork.edgeOpacityByWeight;
  updateEdgeByWeightCheckboxRShiny('edgeWidthByWeight', edgeWidthByWeight);

  if (jsonNetwork.adjust_layer_size)
    adjustLayerSize_flag = true;
  
  //=========================
  
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
  layer_node_labels_flags = Array.apply(0, Array(layer_names.length)).map(function() { return false; }); //for specific-layer node label rendering
  updateLayerNamesRShiny();
  updateNodeNamesRShiny();
  updateSelectedNodesRShiny();
  attachLayerCheckboxes();
  drawEdges();
  drawLayerEdges(); // important, to create inter-layer edges beforehand, to avoid updateEdgesRShiny() bug
  createLabels();

  positionLayers(true);
  if (scrambleNodes_flag) scrambleNodes(import_width / 2, -import_width / 2, -import_width / 2.5, import_width / 2.5);
  if (adjustLayerSize_flag) adjustLayerSize();
  toggleDirection(isDirectionEnabled)
  
  
  executePostNetworkSetup();
}

const clearCanvas = () => {
  scene.reset();
  layers = [];


  nodes = [], //canvas objects
  node_labels = [];
  document.getElementById("labelDiv").innerHTML = "";
  if (document.getElementById("channelColorLayoutDiv")) document.getElementById("channelColorLayoutDiv").innerHTML = "";
  if (document.getElementById("channelColorPicker")) document.getElementById("channelColorPicker").innerHTML = "";
  node_names = [],
  node_whole_names = [],
  node_label_flags = [],
  hovered_nodes = [],
  last_hovered_node_index = "",
  last_hovered_layer_index = "",
  edges = [], //canvas objects
  layerEdges = [], //canvas objects
  edge_pairs = [],
  layer_edges_pairs = [], //canvas objects
  layer_edges_pairs_channels = [], //canvas objects
  edge_values = [],
  edge_channels = [],
  channels = [],
  layerCoords = [],
  node_groups = new Map(),
  layer_groups = new Map(),
  layer_labels = [], //divs
  layer_names = [],
  layer_node_labels_flags = [],
  floorDefaultColors = [], 
  layer_planes = [],
  layer_spheres = [],
  js_selected_layers = [],
  selectedNodePositions = [],
  selected_edges = [],
  shiftX = "",
  shiftY = "",
  lasso = "",
  optionsList = "",
  node_cluster_colors = [],
  node_attributes = "",
  edge_attributes = "",
  last_layer_scale = [];
  channel_values = [];
  isDirectionEnabled = false;
  toggleChannelCurvatureRange(false);
  return true;
}

const loadGraph = () => {
  //create layer planes
  let layerSphereGeometry = new THREE.SphereGeometry( 0 );
  let layerSphereMaterial = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0.5} );
  for(let i = 0; i < Object.getOwnPropertyNames(layer_groups).length; i++){
    let planeGeom = new THREE.PlaneGeometry(2*yBoundMax, 2*yBoundMax, PLANE_WIDTHSEGMENTS, PLANE_HEIGHTSEGMENTS);
    planeGeom.rotateY(THREE.Math.degToRad(90));
    let planeMat = new THREE.MeshBasicMaterial({
      color: floorCurrentColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: layerOpacity,
      side: THREE.DoubleSide,
    });
    let plane = new THREE.Mesh(planeGeom, planeMat);
    let sphere = new THREE.Mesh( layerSphereGeometry, layerSphereMaterial );
    plane.add(sphere);
    sphere.translateY(-yBoundMax);
	  sphere.translateZ(zBoundMax);
    layer_planes.push(plane);
    layer_spheres.push(sphere);
    scene.addLayer(plane); // TODO swap with scene.addLayer(newLayer.plane) where newLayer = new Layer(params)
    last_layer_scale.push(1);
  }
  //create node geometries
  for (i = 0; i < node_whole_names.length; i++){
    geometry = new THREE.SphereGeometry( SPHERE_RADIUS, SPHERE_WIDTHSEGMENTS, SPHERE_HEIGHTSEGMENTS );
    material = new THREE.MeshStandardMaterial( {color: colorVector[(layer_groups[node_groups[node_whole_names[i]]])%colorVector.length], transparent: true} ); //standard material allows light reaction
    sphere = new THREE.Mesh( geometry, material );
    nodes.push(sphere);
    layer_planes[layer_groups[node_groups[node_whole_names[i]]]].add(sphere); //attaching to corresponding layer centroid
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
    drag_controls = new DragControls(layer_planes, camera, renderer.domElement);

    updateScenePanRShiny();
    updateSceneSphereRShiny();
    updateLayersRShiny();
    updateNodesRShiny();
    updateEdgesRShiny();
    updateLabelColorRShiny();

    if (!animationRunning) { // ensure animation runs only once
        animate();
        animationRunning = true;
    }
}
