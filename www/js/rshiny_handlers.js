// General ====================
const startLoader = (m) => {
  let canvas_div = document.getElementById("3d-graph"),
      loader = document.getElementById("loader");
  canvas_div.style.opacity = 0.5;
  loader.style.display = "inline-block";
  return true;
};

const finishLoader = (m) => {
  let canvas_div = document.getElementById("3d-graph"),
      loader = document.getElementById("loader");
  canvas_div.style.opacity = 1;
  loader.style.display = "none";
  return true;
};

const changeFPS = (message) => {
  fps = Number(message);
  return true;
};

const browseUrl = url => {
  window.open(url, "_blank");
};

// Files ====================
const uploadNetwork = (message) => {
  session_flag = false; // TODO figure what this exactly does..
  if (animationPause) pauseAnimate(); //resume rendering
   //init on with darkColors
  colors = darkColors.concat(default_colors);
  clearCanvas();
  if (!attachedCanvasControls) attachCanvasControls();
  let temp_name1 = temp_name2 = temp_layer1 = temp_layer2 = "",
    layers_counter = 0;
  let temp_channel;
  for (let i=0; i < message.SourceLayer.length; i++){
    temp_layer1 = String(message.SourceLayer[i]);
    temp_layer2 = String(message.TargetLayer[i]);
    temp_name1 = message.SourceNode_Layer[i];
    temp_name2 = message.TargetNode_Layer[i];
    if (message.Channel) {
      temp_channel = String(message.Channel[i]);
    }
    //push new nodes, layers, layer_groups and node-layergroup maps
    if (!node_whole_names.includes(temp_name1)){
      node_names.push(String(message.SourceNode[i]));
      node_whole_names.push(temp_name1);
      node_groups[temp_name1] = temp_layer1;
      if (!layer_names.includes(temp_layer1)){
        layer_names.push(temp_layer1);
        layer_groups[temp_layer1] = layers_counter;
        layers_counter++;
      }
    }
    if (!node_whole_names.includes(temp_name2)){
      node_names.push(String(message.TargetNode[i]));
      node_whole_names.push(temp_name2);
      node_groups[temp_name2] = temp_layer2;
      if (!layer_names.includes(temp_layer2)){
        layer_names.push(temp_layer2);
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
    edge_values.push(Number(String(message.Weight[i])));
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
  if (message.Channel) {
    let channel_values = message.Channel.filter((x, i, a) => a.indexOf(x) == i)
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

  if (edge_values.length > MAX_EDGES) alert("Network must contain no more than ".concat(MAX_EDGES).concat(" edges.")); //edge limit
  else {
    attachLayerCheckboxes();
    loadGraph();
    if (message.Channel) {
      attachChannelEditList();
      toggleChannelCurvatureRange(true);
      attachChannelLayoutList();
    } else {
      toggleChannelCurvatureRange(false);
    }
  }
  return true;
}

const importNetwork = (jsonNetwork) => {
  setLabelColorVariable(jsonNetwork.universalLabelColor);
  session_flag = true;
  clearCanvas();
  //init on with darkColors
  colors = darkColors.concat(default_colors);
  if (!attachedCanvasControls) attachCanvasControls();
  setLights();
  addScenePanAndSphere();
  
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
  scene_pan.position.x = Number(jsonNetwork.scene.position_x);
  scene_pan.position.y = Number(jsonNetwork.scene.position_y);
  scene_pan.scale.x = scene_pan.scale.y = scene_pan.scale.z = 
    Number(jsonNetwork.scene.scale);
  renderer.setClearColor(jsonNetwork.scene.color);
  scene_sphere.rotation.x = Number(jsonNetwork.scene.rotation_x);
  scene_sphere.rotation.y = Number(jsonNetwork.scene.rotation_y);
  scene_sphere.rotation.z = Number(jsonNetwork.scene.rotation_z);
  
  // LAYER
  for (let i = 0; i < jsonNetwork.layers.name.length; i++) {
    import_width = jsonNetwork.layers.geometry_parameters_width[i];
    //create layer geometries
    let planeGeom = new THREE.PlaneGeometry(import_width, import_width, 8, 8);
    planeGeom.rotateY(THREE.Math.degToRad(90));
    floorCurrentColor = new THREE.Color(jsonNetwork.layers.floor_current_color[i]);
    floorDefaultColors.push(floorCurrentColor)
    let planeMat = new THREE.MeshBasicMaterial({
      color: floorCurrentColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: floorOpacity,
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
    scene_sphere.add(plane);
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
    let geometry = new THREE.SphereGeometry(sphereRadius, 4, 3);
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
    
    if (jsonNetwork.edges.channel[i] !== null) {
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
    edge_attributes.Color.push(jsonNetwork.edges.color);
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
  
  //========================
  floorCurrentColor = floorDefaultColor;
  drag_controls = new DragControls(layer_planes, camera, renderer.domElement);
  
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
  if (!animationRunning) animate();
  //communicating variables to rshiny, to optionally export the network on demand
  updateScenePanRShiny();
  updateSceneSphereRShiny();
  updateLayersRShiny();
  updateNodesRShiny();
  updateEdgesRShiny();
  updateLabelColorRShiny();
  moveLayers(true);
  if (scrambleNodes_flag) scrambleNodes(import_width / 2, -import_width / 2, -import_width / 2.5, import_width / 2.5);
  if (adjustLayerSize_flag) adjustLayerSize();
  toggleDirection(isDirectionEnabled)
  return true;
}

const setLabelColorVariable = (label_color) => {
  globalLabelColor = label_color;
  return true;
}

const nodeAttributes = (message) => {
  node_attributes = message;
  let pos;
  for (let i = 0; i < nodes.length; i++){
    pos = node_attributes.Node.indexOf(node_whole_names[i]);
    if (pos > -1){ //if node exists in attributes file
      if (nodeAttributesPriority){
        if (!exists(selectedNodePositions, i) && checkIfAttributeColorExist(node_attributes, pos)) //if node not currently selected and color is assigned
          nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
      }
      if (node_attributes.Size !== undefined && node_attributes.Size[pos] !== "" && node_attributes.Size[pos] != " " && node_attributes.Size[pos] !== null)
        nodes[i].scale.x = nodes[i].scale.y = nodes[i].scale.z = Number(node_attributes.Size[pos]);
    }
  }
  updateNodesRShiny();
  return true;
}

const edgeAttributes = (message) => {
  edge_attributes = message;
  let pos1 = -1,
      pos2 = -1,
      pos3 = -1;
  for (let i = 0; i < edges.length; i++){
    if (edgeAttributesPriority){

      pos1arr = findIndices(edge_attributes.SourceNode, edge_pairs[i]);
      pos2arr = findIndices(edge_attributes.TargetNode, edge_pairs[i]);
      pos1arr != -1 && pos1arr.forEach(pos1 => {
        if (checkIfAttributeColorExist(edge_attributes, pos1)) {//if node not currently selected and exists in node attributes file and color is assigned
          if (typeof (edges[i]) == "number") { //edge is inter-layer
            pos3 = layer_edges_pairs.indexOf(i);
            if (edge_attributes && edge_attributes.Channel) {
              assignColor(layer_edges_pairs_channels, pos3, layerEdges[pos3].children, edge_attributes.Channel[pos1], edge_attributes.Color[pos1], layerEdges[pos3]);
            } else {
              assignColor(layer_edges_pairs_channels, pos3, layerEdges[pos3].children, [], edge_attributes.Color[pos1], layerEdges[pos3]);
            }
            }
          else {
            assignColor(edge_channels, i, edges[i].children, edge_attributes.Channel[pos1], edge_attributes.Color[pos1], edges[i]);
          }
        }
      });
      pos2arr != -1 && pos2arr.forEach(pos2 => {
      if (checkIfAttributeColorExist(edge_attributes, pos2)) { 
        if (typeof(edges[i]) == "number"){ //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos2] );
        } else edges[i].material.color = new THREE.Color( edge_attributes.Color[pos2] );
      }
      });
    }
  }
  updateEdgesRShiny();
  return true;
}

// Scene ====================
const showSceneCoords = (message) => {
  let sceneCoordsSwitch = message; //message = true or false
  if (scene_sphere !== ""){
    if (sceneCoordsSwitch) coordsSystemScene(scene_sphere);
    else{
      scene_sphere.remove(sceneCoords[0]);
      scene_sphere.remove(sceneCoords[1]);
      scene_sphere.remove(sceneCoords[2]);
      sceneCoords = ["", "", ""];
    }
  }
  return true;
}

const autoRotateScene = (message) => {
  autoRotateFlag = message;
  if (!autoRotateFlag) {
    dragging = false;
    clearInterval(timeoutFScene); 
  }
  return true;
}

// Layers ====================
const maxAllowedLayers = (limit) => {
  MAX_LAYERS = limit;
  return true;
}

const showLayerCoords = (message) => {
  let labelCoordsSwitch = message; //message = true or false
  if (labelCoordsSwitch){
    for (let i = 0; i < layer_planes.length; i++){
      coordsSystem(layer_planes[i]);
    }
  } else{
    for (let i = 0; i < layer_planes.length; i++){
      layer_planes[i].remove(layerCoords[3*i]);
      layer_planes[i].remove(layerCoords[3*i+1]);
      layer_planes[i].remove(layerCoords[3*i+2]);
    }
    layerCoords = [];
  }
  return true;
}

const setFloorOpacity = (message) => {
  for (let i = 0; i < layer_planes.length; i++){
    layer_planes[i].material.opacity = message;
  }
  return true;
}

const showWireFrames = (message) => {
  wireframeFlag = message; //message = true or false
  for(let i = 0; i < layer_planes.length; i++){
    layer_planes[i].material.wireframe = wireframeFlag;
  }
  return true;
}

const layerColorFilePriority = (message) => {
  layerColorFile = message;
  for (let i = 0; i < layer_planes.length; i++){
    if (!layerColorFile) layer_planes[i].material.color = new THREE.Color(floorCurrentColor)
    else layer_planes[i].material.color = new THREE.Color(floorDefaultColors[i]);
  }
  updateLayersRShiny();
  return true;
}

const selectAllLayers = (message) => {
  js_selected_layers = [];
  let c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < c.length; i++){
    if (i%7 === 0){ //(c[i].type == "checkbox"){
      if (message){
        c[i].checked = true;
        js_selected_layers.push(i/7);
        layer_planes[i/7].material.color = new THREE.Color( "#f7f43e" );
      } else {
        c[i].checked = false;
        if (floorDefaultColors.length > 0 && layerColorFile) {
          layer_planes[i/7].material.color = new THREE.Color(floorDefaultColors[i/7]);
        } else layer_planes[i/7].material.color = new THREE.Color(floorCurrentColor);
        layer_labels[i/7].style.display = "none";
      }
    }
  }
  Shiny.setInputValue("js_selected_layers", js_selected_layers);
  return true;
}

// Nodes ====================
const assignXYZ = (message) => {
  let y_arr = [], //x always 0, assign on floor every time
      z_arr = [],
      node_name = "",
      y = z = 0,
    layerIndex = "";
  for (let i = 0; i < message.length; i++){
    y_arr.push(Number(message[i][1]));
    z_arr.push(Number(message[i][2]));
  }
  let y_min = Math.min.apply(Math, y_arr),
      y_max = Math.max.apply(Math, y_arr),
      z_min = Math.min.apply(Math, z_arr),
      z_max = Math.max.apply(Math, z_arr),
      target_y_min = yBoundMin,
      target_y_max = yBoundMax,
      target_z_min = zBoundMin,
      target_z_max = zBoundMax;
  if (localLayoutFlag){ //if local layout, change target mins and maxes and then unset flag
    layerIndex = layer_groups[node_groups[message[0][0]]];
    target_y_min = target_y_max = nodes[node_whole_names.indexOf(message[0][0].trim())].position.y/last_layer_scale[layerIndex],
    target_z_min = target_z_max = nodes[node_whole_names.indexOf(message[0][0].trim())].position.z/last_layer_scale[layerIndex];
    for (i = 1; i < message.length; i++) {
      node_name = message[i][0].trim();
      if (nodes[node_whole_names.indexOf(node_name)]) {
        y = nodes[node_whole_names.indexOf(node_name)].position.y / last_layer_scale[layerIndex];
        z = nodes[node_whole_names.indexOf(node_name)].position.z / last_layer_scale[layerIndex];
        if (y < target_y_min) target_y_min = y;
        if (y > target_y_max) target_y_max = y;
        if (z < target_z_min) target_z_min = z;
        if (z > target_z_max) target_z_max = z;
      }
      if (target_y_min == target_y_max) { //form a square
        target_y_min = target_y_min - Math.abs(target_z_min - target_z_max) / 2;
        target_y_max = target_y_max + Math.abs(target_z_min - target_z_max) / 2;
      } else if (target_z_min == target_z_max) {
        target_z_min = target_z_min - Math.abs(target_y_min - target_y_max) / 2;
        target_z_max = target_z_max + Math.abs(target_y_min - target_y_max) / 2;
      }
    }
  }
  for (i = 0; i < message.length; i++){
    node_name = message[i][0].trim();
    if (session_flag && !localLayoutFlag) {
      layerIndex = layer_groups[node_groups[message[0][0]]];
      target_y_max = -layer_planes[layerIndex].geometry.parameters.width / 2;
      target_y_min = layer_planes[layerIndex].geometry.parameters.width/2;
      target_z_max = layer_planes[layerIndex].geometry.parameters.width/2.5;
      target_z_min = -layer_planes[layerIndex].geometry.parameters.width/2.5;
    }
    //nodes[node_whole_names.indexOf(node_name)].position.x = -15; // to float over layer
    if (nodes[node_whole_names.indexOf(node_name)]) {
      if (y_max - y_min != 0) nodes[node_whole_names.indexOf(node_name)].position.y = ((y_arr[i] - y_min) * (target_y_max - target_y_min) / (y_max - y_min) + target_y_min) * last_layer_scale[layer_groups[node_groups[node_name]]]; //mapping * layer stretch scale
      else nodes[node_whole_names.indexOf(node_name)].position.y = 0;
      if (z_max - z_min != 0) nodes[node_whole_names.indexOf(node_name)].position.z = ((z_arr[i] - z_min) * (target_z_max - target_z_min) / (z_max - z_min) + target_z_min) * last_layer_scale[layer_groups[node_groups[node_name]]]; //mapping
      else nodes[node_whole_names.indexOf(node_name)].position.z = 0;
    }
  }
  localLayoutFlag = false;

  if (message && message[0] && message[0].length == 4) {
    for (i = 0; i < message.length; i++){
      node_name = message[i][0].trim();
      if (nodes[node_whole_names.indexOf(node_name)]) {
        nodes[node_whole_names.indexOf(node_name)].material.color = new THREE.Color(colors[message[i][3]]);
        node_cluster_colors[node_whole_names.indexOf(node_name)] = colors[message[i][3]];
        nodes[node_whole_names.indexOf(node_name)].userData.cluster = message[i][3];
      }
    }
  }
  updateNodesRShiny();
  redrawEdges();

  return true;
}

const nodeSelector = (message) => {
  //message -> T | F
  if (message){
    selectedNodePositions = []; //reseting, else multiple entries -> double transformations
    for (let i=0; i < nodes.length; i++){
      selectedNodePositions.push(i);
      if (selectedNodeColorFlag) nodes[i].material.color = new THREE.Color( selectedDefaultColor );
    }
    updateSelectedNodesRShiny();
  }
  else{
    selectedNodePositions = [];
    updateSelectedNodesRShiny();
    for (i=0; i < nodes.length; i++){
      if (node_attributes !== ""){
        pos = node_attributes.Node.indexOf(node_whole_names[i]);
        if(checkIfAttributeColorExist(node_attributes, pos)) //if node exists in node attributes file
          nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
        else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
      } else if (nodes[i].userData.cluster)  nodes[i].material.color = new THREE.Color(colors[nodes[i].userData.cluster]);
      else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]]) % colors.length]);
    }
  }
  decideNodeLabelFlags();
  return true;
}

const nodeSelectedColorPriority = (message) => {
  selectedNodeColorFlag = message;
  for (let i=0; i<selectedNodePositions.length; i++){
    if (selectedNodeColorFlag) nodes[selectedNodePositions[i]].material.color = new THREE.Color( selectedDefaultColor );
    else if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
      pos = node_attributes.Node.indexOf(node_whole_names[selectedNodePositions[i]]);
      if(checkIfAttributeColorExist(node_attributes, pos))//if node exists in node attributes file
        nodes[selectedNodePositions[i]].material.color = new THREE.Color( node_attributes.Color[pos] );
      else nodes[selectedNodePositions[i]].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[selectedNodePositions[i]]]])%colors.length]);
    } else nodes[selectedNodePositions[i]].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[selectedNodePositions[i]]]])%colors.length]);
  }
  return true;
}

// Edges ====================
const maxAllowedEdges = (limit) => {
  MAX_EDGES = limit;
  return true;
}

const setLayerEdgeOpacity = (message) => {
  layerEdgeOpacity = message;
  redrawEdges(); //because not on animate
  return true;
}

const setDirectionArrowSize = (message) => {
  directionArrowSize = message;
  redrawEdges(); //because not on animate
  return true;
}

const setIntraDirectionArrowSize = (message) => {
  intraDirectionArrowSize = message;
  redrawEdges(); //because not on animate
  return true;
}

const setInterLayerEdgeOpacity = (message) => {
  interLayerEdgeOpacity = message;
  return true;
}

const redrawEdgeWidthByWeight = (message) => {
  edgeWidthByWeight = message; //message = true or false
  redrawEdges();
  return true;
}

const edgeFileColorPriority = (message) => {
  edgeAttributesPriority = message; //message = true or false
  if (edgeAttributesPriority) document.getElementById('channelColorPicker').style.display = 'none';
  else document.getElementById('channelColorPicker').style.display = 'block';
  redrawEdges();
  return true;
}


const edgeSelectedColorPriority = (message) => {
  selectedEdgeColorFlag = message;
  let pos1 = pos2 = pos3 = "";
  for (let i=0; i<selected_edges.length; i++){
    if (selectedEdgeColorFlag){
      if (typeof (edges[selected_edges[i]]) == "number") {
        pos3 = layer_edges_pairs.indexOf(selected_edges[i]);
        assign2Children(layerEdges[pos3], selectedDefaultColor);
      } else {
        assign2Children(edges[selected_edges[i]], selectedDefaultColor);
      }
    }else if (edge_attributes !== "" && edgeAttributesPriority){ //check if color is overidden by user
      pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[selected_edges[i]]);
      pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[selected_edges[i]]);
      if(checkIfAttributeColorExist(edge_attributes, pos1)){//if node not currently selected and exists in node attributes file and color is assigned
        if (typeof (edges[selected_edges[i]]) == "number") { //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
           assign2Children(layerEdges[pos3], edge_attributes.Color[pos1]);
        }
        else {
          assign2Children(edges[selected_edges[i]], edge_attributes.Color[pos1]);//edge is intra layer
        }
        }
      else if(checkIfAttributeColorExist(edge_attributes, pos2)){
        if (typeof (edges[selected_edges[i]]) == "number") { //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
            assign2Children(layerEdges[pos3], edge_attributes.Color[pos2]);
        } else {
            assign2Children(edges[selected_edges[i]], edge_attributes.Color[pos2]);
        }
      }
      else{
        if (typeof (edges[selected_edges[i]]) == "number") {
          pos3 = layer_edges_pairs.indexOf(i);
          assign2Children(layerEdges[pos3], edgeDefaultColor, true);
        } else {
          assign2Children( edges[selected_edges[i]], edgeDefaultColor,  true);
        }   
      }
    } else{
      if (typeof (edges[selected_edges[i]]) == "number") {
        pos3 = layer_edges_pairs.indexOf(i);
        assign2Children(layerEdges[pos3], edgeDefaultColor, true);
      } else {
        assign2Children( edges[selected_edges[i]], edgeDefaultColor, true);

      }
    } 
  }
  return true;
}

const toggleDirection = (message) => {
  isDirectionEnabled = message;
  redrawEdges();
  return true;
}

// Channels ====================
const maxAllowedChannels = (limit) => {
  MAX_CHANNELS = limit;
  return true;
}

const getChannelColors = (brewerColors) => {
  CHANNEL_COLORS_LIGHT = brewerColors;
  return true;
}

const getDarkChannelColors = (brewerColors) => {
  CHANNEL_COLORS_DARK = brewerColors;
  return true;
}

const toggleChannelCurvature = (message) => {
  channelCurvature = message;
  redrawEdges();
  return true;
}

const interToggleChannelCurvature = (message) => {
  interChannelCurvature = message;
  redrawEdges();
  return true;
}

// Labels ====================
const showLayerLabels = (message) => {
  layerLabelSwitch = message; //message = true or false
  if (!layerLabelSwitch){
    for (let i = 0; i < layer_planes.length; i++){
      layer_labels[i].style.display = "none";
    }
  }
  return true;
}

const showSelectedLayerLabels = (message) => {
  selectedLayerLabelSwitch = message; //message = true or false
  if (!selectedLayerLabelSwitch){
    for (let i = 0; i < js_selected_layers.length; i++){
      layer_labels[js_selected_layers[i]].style.display = "none";
    }
  }
  return true;
}

const resizeLayerLabels = (message) => {
  let size = message; //message = [1, 20]
  for (i = 0; i < layer_planes.length; i++){
    layer_labels[i].style.fontSize = size.toString().concat("px");
  }
  return true;
}

const showLabels = (message) => {
  labelSwitch = message; //message = true or false
  decideNodeLabelFlags();
  return true;
}

const showSelectedLabels = (message) => {
  selectedLabelSwitch = message; //message = true or false
  decideNodeLabelFlags();
  return true;
}

const resizeLabels = (message) => {
  let size = message; //message = [1, 20]
  for (let i = 0; i < nodes.length; i++){
    node_labels[i].style.fontSize = size.toString().concat("px");
  }
  return true;
}

// Layouts and Topology ====================
const setLocalFlag = (message) => { //T
  localLayoutFlag = message;
  return true;
}

const topologyScale = (nodeScale) => {
  for (i = 0; i < nodeScale.nodeName.length; i++) {
    nodeName = nodeScale.nodeName[i];
    nodes[node_whole_names.indexOf(nodeName)].scale.x =
      nodes[node_whole_names.indexOf(nodeName)].scale.y =
      nodes[node_whole_names.indexOf(nodeName)].scale.z = nodeScale.scale[i];
  }
  updateNodesRShiny();
};


const applyPredefinedLayout = (message) => {
  let numLayers = layer_planes.length;
  if (numLayers <= 1)  alert("You need at least 2 layers for the layouts");
  else {
    if (message) {
      // init position in order to position layers more easily
      scene_sphere.rotation.x = THREE.Math.degToRad(5);
      scene_sphere.rotation.y = THREE.Math.degToRad(5);
      scene_sphere.rotation.z = THREE.Math.degToRad(5);
      layer_size = layer_planes[0].geometry.parameters.height;
      for (let i = 0; i < numLayers; i++) {
        layer_planes[i].position.set(0, 0, 0)
        layer_planes[i].quaternion.copy(camera.quaternion);
        if(layer_size < layer_planes[i].geometry.parameters.height) layer_size = layer_planes[i].geometry.parameters.height
      }
      switch (message) {
        case "zigZag":
          for (let i = 1; i < numLayers; i+=2){
            layer_planes[i].translateY(500);
          }
          moveLayers()
          break;
        case "parallel":
         moveLayers()
          break;
        case "cube":
          let cube_size = 6;
          let groups = Math.ceil(numLayers / cube_size);
          if (numLayers == 6) groups = 1;
          let distance = groups * (Number(layer_size) + 400);
          for (let j = 0; j < groups; j++) {
            if (j * cube_size + cube_size > numLayers) length = numLayers;
            else length = j * cube_size + cube_size;
            k = 0;
            for (let i = j * cube_size; i < length; i++) {
              //position each group
              if (groups > 1) {
                let x;
                if ((groups % 2)) {
                  if(j == Math.floor(groups / 2)) x = 0
                  else if (j < Math.floor(groups / 2))  x = -distance/groups
                  else  x =  distance/groups
                } else {
                  if (j < Math.floor(groups / 2))  x = -distance/groups
                  else x = distance/groups
                }
                layer_planes[i].position.set(x , 0, 0);
              }
              if (!(k % 2)) layer_planes[i].rotateZ(THREE.Math.degToRad(90));
              if (k >= 4) layer_planes[i].rotateY(THREE.Math.degToRad(90));
              // move
              if (k == 0 || k == 1 || k == 5) {
                layer_planes[i].translateX(layer_planes[i].geometry.parameters.height/2 + 100);
              } else {
                 layer_planes[i].translateX(-layer_planes[i].geometry.parameters.height/2 - 100);
              }
              k++;
            }
          }
          break;
        case "starLike":
          degree =  360 / numLayers ;
          for (let i = 0; i < numLayers; i++){
            layer_planes[i].rotateZ(THREE.Math.degToRad(degree * i));
            layer_planes[i].translateY(-layer_planes[i].geometry.parameters.height/2 - 100);
          }
          break;
        default:
          break;
      }
    }
    updateLayersRShiny();
  }

  return true;
}



//RSHINY HANDLERS----------------------------

// General ====================
Shiny.addCustomMessageHandler("handler_startLoader", startLoader);
Shiny.addCustomMessageHandler("handler_finishLoader", finishLoader);
Shiny.addCustomMessageHandler("handler_fps", changeFPS);
Shiny.addCustomMessageHandler("handler_browseUrl", browseUrl);
// Files ====================
Shiny.addCustomMessageHandler("handler_uploadNetwork", uploadNetwork);
Shiny.addCustomMessageHandler("handler_importNetwork", importNetwork);
Shiny.addCustomMessageHandler("handler_nodeAttributes", nodeAttributes);
Shiny.addCustomMessageHandler("handler_edgeAttributes", edgeAttributes);
// Scene ====================
Shiny.addCustomMessageHandler("handler_showSceneCoords", showSceneCoords);
// Layers ====================
Shiny.addCustomMessageHandler("handler_maxAllowedLayers", maxAllowedLayers);
Shiny.addCustomMessageHandler("handler_showLayerCoords", showLayerCoords);
Shiny.addCustomMessageHandler("handler_autoRotateScene", autoRotateScene);
Shiny.addCustomMessageHandler("handler_floorOpacity", setFloorOpacity);
Shiny.addCustomMessageHandler("handler_showWireFrames", showWireFrames);
Shiny.addCustomMessageHandler("handler_selectAllLayers", selectAllLayers);
Shiny.addCustomMessageHandler("handler_layerColorFilePriority", layerColorFilePriority);
// Nodes ====================
Shiny.addCustomMessageHandler("handler_layout", assignXYZ);
Shiny.addCustomMessageHandler("handler_nodeSelector", nodeSelector);
Shiny.addCustomMessageHandler("handler_nodeSelectedColorPriority", nodeSelectedColorPriority);
// Edges ====================
Shiny.addCustomMessageHandler("handler_maxAllowedEdges", maxAllowedEdges);
Shiny.addCustomMessageHandler("handler_directionArrowSize", setDirectionArrowSize);
Shiny.addCustomMessageHandler("handler_intraDirectionArrowSize", setIntraDirectionArrowSize);
Shiny.addCustomMessageHandler("handler_layerEdgeOpacity", setLayerEdgeOpacity);
Shiny.addCustomMessageHandler("handler_interLayerEdgeOpacity", setInterLayerEdgeOpacity);
Shiny.addCustomMessageHandler("handler_edgeWidthByWeight", redrawEdgeWidthByWeight);
Shiny.addCustomMessageHandler("handler_edgeSelectedColorPriority", edgeSelectedColorPriority);
Shiny.addCustomMessageHandler("handler_edgeFileColorPriority", edgeFileColorPriority);
Shiny.addCustomMessageHandler("handler_toggleDirection", toggleDirection);
// Channels ====================
Shiny.addCustomMessageHandler("handler_maxAllowedChannels", maxAllowedChannels);
Shiny.addCustomMessageHandler("handler_colorBrewerPallete", getChannelColors);
Shiny.addCustomMessageHandler("handler_colorBrewerPallete_dark", getDarkChannelColors);
Shiny.addCustomMessageHandler("handler_channelCurvature", toggleChannelCurvature);
Shiny.addCustomMessageHandler("handler_interChannelCurvature", interToggleChannelCurvature);
// Labels ====================
Shiny.addCustomMessageHandler("handler_showLayerLabels", showLayerLabels);
Shiny.addCustomMessageHandler("handler_showSelectedLayerLabels", showSelectedLayerLabels);
Shiny.addCustomMessageHandler("handler_resizeLayerLabels", resizeLayerLabels);
Shiny.addCustomMessageHandler("handler_showLabels", showLabels);
Shiny.addCustomMessageHandler("handler_showSelectedLabels", showSelectedLabels);
Shiny.addCustomMessageHandler("handler_resizeLabels", resizeLabels);
// Layouts and Topology ====================
Shiny.addCustomMessageHandler("handler_setLocalFlag", setLocalFlag);
Shiny.addCustomMessageHandler("handler_topologyScale", topologyScale);
Shiny.addCustomMessageHandler("handler_predefined_layer_layout", applyPredefinedLayout);
