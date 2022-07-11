// General ====================
const badObject_alert = (message) => {
  alert(message);
  return true;
}


const clean_array = (message) => {
  temp = [];
  for (i = 0; i < message.length; i++) {
    temp = [];
    for (j = 0; j < message[i].length; j++) {
      if( Array.isArray(message[i][j])) temp.push(message[i][j][0]);
      else temp.push(message[i][j]);
    }
    message[i] = temp;
  }
  return message;
}

const startLoader = (m) => {
  let canvas_div = document.getElementById("3d-graph"),
      loader = document.getElementById("loader");
  canvas_div.style.opacity = 0.5;
  loader.style.display = "inline-block";
  return true;
}

const finishLoader = (m) => {
  let canvas_div = document.getElementById("3d-graph"),
      loader = document.getElementById("loader");
  canvas_div.style.opacity = 1;
  loader.style.display = "none";
  return true;
}

const changeFPS = (message) => {
  fps = Number(message);
  return true;
}

// Files ====================
const uploadNetwork = (message) => {
  session_flag = false;
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
    temp_name1 = String(message.SourceNode[i]).concat("_").concat(temp_layer1);
    temp_name2 = String(message.TargetNode[i]).concat("_").concat(temp_layer2);
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
  layer_node_labels_flags = Array.apply(0, Array(layer_names.length)).map(function() { return false; });
  updateLayerNamesRShiny(); //correct order of layer names to avoid bugs with positions
  updateNodeNamesRShiny(); //for Local Layout algorithms
  updateSelectedNodesRShiny();
  //edge_values = mapper(edge_values, 0.1, 1) //min and max opacities //this is done in R now
  if (message.Channel) {
    let channel_values = message.Channel.filter((x, i, a) => a.indexOf(x) == i)
    if (channel_values.length > max_allowed_channels) {
      alert("Network must contain no more than ".concat(max_allowed_channels).concat(" channels.")); //channel limit
      return false
    } else {
      channels = channel_values;
      channels.forEach(c => {
        channelVisibility[c] = true;
      });
    }
  }

  if (edge_values.length > max_allowed_edges) alert("Network must contain no more than ".concat(max_allowed_edges).concat(" edges.")); //edge limit
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

const importNetwork = (message) => {
  session_flag = true;
  clean_array(message)
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
  let layerSphereGeometry = new THREE.SphereGeometry( 0 );
  let layerSphereMaterial = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0.5});
  for (let i = 0; i < message.length; i++){
    if (message[i][0] == "scene") {
      scene_pan.position.x = Number(message[i][1]);
      scene_pan.position.y = Number(message[i][2]);
      scene_pan.scale.x = scene_pan.scale.y = scene_pan.scale.z = Number(message[i][3]);
      renderer.setClearColor(message[i][4]);
      scene_sphere.rotation.x = Number(message[i][5]);
      scene_sphere.rotation.y = Number(message[i][6]);
      scene_sphere.rotation.z = Number(message[i][7]);
    } else if (message[i][0] == "layer") {
      import_width = message[i][9];
      //create layer geometries
      let planeGeom = new THREE.PlaneGeometry(import_width, import_width, 8, 8);
      planeGeom.rotateY(THREE.Math.degToRad(90));
      floorCurrentColor = new THREE.Color(message[i][8]);
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
      sphere.position.y = sphere.position.y * Number(message[i][4]); //stretch factor for label
      sphere.position.z = sphere.position.z * Number(message[i][4]); //stretch factor for label
      layer_planes.push(plane);
      layer_spheres.push(sphere);
      scene_sphere.add(plane);
      plane.position.x = Number(message[i][1]); //x
      plane.position.y = Number(message[i][2]); //y
      plane.position.z = Number(message[i][3]); //z
      plane.geometry.scale(1, Number(message[i][4]), Number(message[i][4]));
      last_layer_scale.push(Number(message[i][4]));
      plane.rotation.x = Number(message[i][5]);
      plane.rotation.y = Number(message[i][6]);
      plane.rotation.z = Number(message[i][7]);
    } else if (message[i][0] == "node") {
      node_names.push(message[i][1]); //name
      whole_name = message[i][1].concat("_").concat(message[i][2]);
      node_whole_names.push(whole_name); //name + group
      node_attributes.Node.push(whole_name);
      node_groups[whole_name] = message[i][2]; //layer
      if (!layer_groups.hasOwnProperty((message[i][2].trim()))) {
        layer_groups[message[i][2].trim()] = layers_counter;
        layers_counter++;
        layer_names.push(message[i][2].trim());
      }
      //create node geometries
      let geometry = new THREE.SphereGeometry(sphereRadius, 4, 3);
      let material = new THREE.MeshStandardMaterial({ color: message[i][7], transparent: true });
      node_attributes.Color.push(message[i][7]);
      node_attributes.Url.push(message[i][8]);
      node_attributes.Description.push(message[i][9]);
      let sphere = new THREE.Mesh(geometry, material);
      nodes.push(sphere);
      layer_planes[layer_groups[node_groups[whole_name]]].add(sphere);
      sphere.position.x = Number(message[i][3]); //x
      sphere.position.y = Number(message[i][4]); //y
      sphere.position.z = Number(message[i][5]); //z
      sphere.scale.x = sphere.scale.y = sphere.scale.z = Number(message[i][6]);
      node_attributes.Size.push(Number(message[i][6]));
    } else if (message[i][0] == "edge") {
      if (!edge_pairs.includes(message[i][1])) {
        edge_pairs.push(message[i][1]);
        edge_channels.push([])
      }
      if (message[i][4]) {
        //create edge_attributes.Channel
        if (!edge_attributes.Channel) {
          edge_attributes.Channel = []
        }
        pos = edge_pairs.indexOf(message[i][1]);
        edge_channels[pos].push(message[i][4]);
        if (!channel_values.includes(message[i][4])) {
          channel_values.push(message[i][4])
        }
        edge_attributes.Channel.push(message[i][4]);
      }
      edge_values.push(Number(message[i][2]));
      edge_attributes.SourceNode.push(message[i][1]);
      edge_attributes.TargetNode.push("");
      edge_attributes.Color.push(message[i][3]);
    } else if (message[i][0] == "scramble_nodes") {
      scrambleNodes_flag = message[i][1]
      scrambleNodes_flag = (message[i][1] === 'TRUE');
    } else if (message[i][0] == "direction") {
      isDirectionEnabled = (message[i][1] === 'TRUE')
      updateCheckboxInput('directionToggle', message[i][1] === 'TRUE')
    }
  }
  floorCurrentColor = floorDefaultColor;
  drag_controls = new DragControls(layer_planes, camera, renderer.domElement);
  
  if (channel_values.length > 0) {
    if (channel_values.length > max_allowed_channels) {
      alert("Network must contain no more than ".concat(max_allowed_channels).concat(" channels.")); //channel limit
      return false
    } else {
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
  if (scrambleNodes_flag) {
    scrambleNodes(import_width/2, -import_width/2, -import_width/2.5, import_width/2.5);
  }
  toggleDirection(isDirectionEnabled)
  return true;
}

const nodeAttributes = (message) => {
  node_attributes = message;
  let pos;
  for (let i = 0; i < nodes.length; i++){
    pos = node_attributes.Node.indexOf(node_whole_names[i]);
    if (pos > -1){ //if node exists in attributes file
      if (nodeAttributesPriority){
        if (!exists(selected_nodes, i) && checkIfAttributeColorExist(node_attributes, pos)) //if node not currently selected and color is assigned
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
  selected_layers = [];
  let c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < c.length; i++){
    if (i%7 === 0){ //(c[i].type == "checkbox"){
      if (message){
        c[i].checked = true;
        selected_layers.push(i/7);
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
  Shiny.setInputValue("selected_layers", selected_layers);
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
    selected_nodes = []; //reseting, else multiple entries -> double transformations
    for (let i=0; i < nodes.length; i++){
      selected_nodes.push(i);
      if (selectedNodeColorFlag) nodes[i].material.color = new THREE.Color( selectedDefaultColor );
    }
    updateSelectedNodesRShiny();
  }
  else{
    selected_nodes = [];
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
  for (let i=0; i<selected_nodes.length; i++){
    if (selectedNodeColorFlag) nodes[selected_nodes[i]].material.color = new THREE.Color( selectedDefaultColor );
    else if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
      pos = node_attributes.Node.indexOf(node_whole_names[selected_nodes[i]]);
      if(checkIfAttributeColorExist(node_attributes, pos))//if node exists in node attributes file
        nodes[selected_nodes[i]].material.color = new THREE.Color( node_attributes.Color[pos] );
      else nodes[selected_nodes[i]].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[selected_nodes[i]]]])%colors.length]);
    } else nodes[selected_nodes[i]].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[selected_nodes[i]]]])%colors.length]);
  }
  return true;
}

// Edges ====================
const maxAllowedEdges = (limit) => {
  max_allowed_edges = limit;
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
  max_allowed_channels = limit;
  return true;
}

const getChannelColors = (brewerColors) => {
  channel_colors_light = brewerColors;
  return true;
}

const getDarkChannelColors = (brewerColors) => {
  channel_colors_dark = brewerColors;
  return true;
}

const getLabelColor = (label_color) => {
  globalLabelColor = label_color;
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
    for (let i = 0; i < selected_layers.length; i++){
      layer_labels[selected_layers[i]].style.display = "none";
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

const topologyScale = (message) => {
  let scale_values = []; //column of scale values from topology
  for(let i=0; i < message.length; i++){
    scale_values.push(message[i][1]);
  }
  let scale_min = Math.min.apply(Math, scale_values),
      scale_max = Math.max.apply(Math, scale_values),
      target_scale_min = 0.5,
      target_scale_max = 2.5;
  for (i = 0; i < message.length; i++){
    node_name = message[i][0];
    if (scale_max - scale_min !== 0){
      node_scale = (message[i][1] - scale_min) * (target_scale_max - target_scale_min) / (scale_max - scale_min) + target_scale_min; //mapping
      nodes[node_whole_names.indexOf(node_name)].scale.x = node_scale;
      nodes[node_whole_names.indexOf(node_name)].scale.y = node_scale;
      nodes[node_whole_names.indexOf(node_name)].scale.z = node_scale;
    }
  }
  updateNodesRShiny();
  return true;
}


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
          groups = Math.floor(numLayers / cube_size) + 1;
          if (numLayers == 6) groups = 1;
          width = groups*(layer_size+400);
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
                  else if (j < Math.floor(groups / 2))  x = -width/groups
                  else  x =  width/groups
                } else {
                  if (j < Math.floor(groups / 2))  x = -width/groups
                  else x =  width/groups
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
Shiny.addCustomMessageHandler("handler_badObject_alert", badObject_alert);
Shiny.addCustomMessageHandler("handler_startLoader", startLoader);
Shiny.addCustomMessageHandler("handler_finishLoader", finishLoader);
Shiny.addCustomMessageHandler("handler_fps", changeFPS);
// Files ====================
Shiny.addCustomMessageHandler("handler_uploadNetwork", uploadNetwork);
Shiny.addCustomMessageHandler("handler_importNetwork", importNetwork);
Shiny.addCustomMessageHandler("handler_nodeAttributes", nodeAttributes);
Shiny.addCustomMessageHandler("handler_edgeAttributes", edgeAttributes);
// Scene ====================
Shiny.addCustomMessageHandler("handler_showSceneCoords", showSceneCoords);
// Layers ====================
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
Shiny.addCustomMessageHandler("handler_globalLabelColor", getLabelColor);
// Layouts and Topology ====================
Shiny.addCustomMessageHandler("handler_setLocalFlag", setLocalFlag);
Shiny.addCustomMessageHandler("handler_topologyScale", topologyScale);
Shiny.addCustomMessageHandler("handler_predefined_layer_layout", applyPredefinedLayout);