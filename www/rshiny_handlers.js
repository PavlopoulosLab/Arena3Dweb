function maxAllowedEdges(limit){
  max_allowed_edges = limit;
  return true;
}

function showLabels(message) {
  labelSwitch = message; //message = true or false
  decideNodeLabelFlags();
  return true;
}

function showSelectedLabels(message) {
  selectedLabelSwitch = message; //message = true or false
  decideNodeLabelFlags();
  return true;
}

function showSelectedLayerLabels(message) {
  selectedLayerLabelSwitch = message; //message = true or false
  if (!selectedLayerLabelSwitch){
    for (var i = 0; i < selected_layers.length; i++){
      layer_labels[selected_layers[i]].style.display = "none";
    }
  }
  return true;
}

function showLayerLabels(message) {
  layerLabelSwitch = message; //message = true or false
  if (!layerLabelSwitch){
    for (var i = 0; i < layer_planes.length; i++){
      layer_labels[i].style.display = "none";
    }
  }
  return true;
}

function resizeLabels(message) {
  var size = message; //message = [1, 20]
  for (var i = 0; i < nodes.length; i++){
    node_labels[i].style.fontSize = size.toString().concat("px");
  }
  return true;
}

function resizeLayerLabels(message) {
  var size = message; //message = [1, 20]
  for (i = 0; i < layer_planes.length; i++){
    layer_labels[i].style.fontSize = size.toString().concat("px");
  }
  return true;
}

function nodeColorAttributePriority(message){
  nodeAttributesPriority = message;
  for (var i = 0; i < nodes.length; i++){
    if (nodeAttributesPriority){
      if (node_attributes !== ""){ //check if color is overidden by user
      pos = node_attributes.Node.indexOf(node_whole_names[i]);
      if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
        nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
      else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
      } else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
    } else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
  }
  updateNodesRShiny();
  return true;
}

function nodeSelectedColorPriority(message){
  selectedNodeColorFlag = message;
  for (var i=0; i<selected_nodes.length; i++){
    if (selectedNodeColorFlag) nodes[selected_nodes[i]].material.color = new THREE.Color( selectedDefaultColor );
    else if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
      pos = node_attributes.Node.indexOf(node_whole_names[selected_nodes[i]]);
      if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " " && node_attributes.Color[pos] != null) //if node exists in node attributes file
        nodes[selected_nodes[i]].material.color = new THREE.Color( node_attributes.Color[pos] );
      else nodes[selected_nodes[i]].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[selected_nodes[i]]]])%colors.length]);
    } else nodes[selected_nodes[i]].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[selected_nodes[i]]]])%colors.length]);
  }
  return true;
}

function edgeColorAttributePriority(message){
  edgeAttributesPriority = message;
  var pos1 = pos2 = pos3 = -1;
  for (var i = 0; i < edges.length; i++){
    if (!exists(selected_edges, i)){
      if (edgeAttributesPriority){
        pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
        pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);
        if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " "){//if node not currently selected and exists in node attributes file and color is assigned
          if (typeof(edges[i]) == "number"){ //edge is inter-layer
            pos3 = layer_edges_pairs.indexOf(i);
            layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos1] );
          }
          else edges[i].material.color = new THREE.Color( edge_attributes.Color[pos1] ); //edge is intra layer
        }
        else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " "){ 
          if (typeof(edges[i]) == "number"){ //edge is inter-layer
            pos3 = layer_edges_pairs.indexOf(i);
            layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos2] );
          } else edges[i].material.color = new THREE.Color( edge_attributes.Color[pos2] );
        }
      } else{
        if (typeof(edges[i]) == "number") {
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edgeDefaultColor );
        }
        else edges[i].material.color = new THREE.Color( edgeDefaultColor );
      }
    }
  }
  updateEdgesRShiny();
  return true;
}

function edgeSelectedColorPriority(message){
  selectedEdgeColorFlag = message;
  var pos1 = pos2 = pos3 = "";
  for (var i=0; i<selected_edges.length; i++){
    if (selectedEdgeColorFlag){
      if (typeof(edges[selected_edges[i]]) == "number") {
        pos3 = layer_edges_pairs.indexOf(selected_edges[i]);
        layerEdges[pos3].material.color = new THREE.Color( selectedDefaultColor );
      } else edges[selected_edges[i]].material.color = new THREE.Color( selectedDefaultColor );
    }else if (edge_attributes !== "" && edgeAttributesPriority){ //check if color is overidden by user
      pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[selected_edges[i]]);
      pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[selected_edges[i]]);
      if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " "){//if node not currently selected and exists in node attributes file and color is assigned
        if (typeof(edges[selected_edges[i]]) == "number"){ //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos1] );
        }
        else edges[selected_edges[i]].material.color = new THREE.Color( edge_attributes.Color[pos1] ); //edge is intra layer
      }
      else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " "){ 
        if (typeof(edges[selected_edges[i]]) == "number"){ //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos2] );
        } else edges[selected_edges[i]].material.color = new THREE.Color( edge_attributes.Color[pos2] );
      }
      else{
        if (typeof(edges[selected_edges[i]]) == "number") {
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edgeDefaultColor );
        } else edges[selected_edges[i]].material.color = new THREE.Color( edgeDefaultColor );
      }
    } else{
      if (typeof(edges[selected_edges[i]]) == "number") {
        pos3 = layer_edges_pairs.indexOf(i);
        layerEdges[pos3].material.color = new THREE.Color( edgeDefaultColor );
      } else edges[selected_edges[i]].material.color = new THREE.Color( edgeDefaultColor );
    } 
  }
  return true;
}

function showLayerCoords(message) {
  var labelCoordsSwitch = message; //message = true or false
  if (labelCoordsSwitch){
    for (var i = 0; i < layer_planes.length; i++){
      coordsSystem(layer_planes[i]);
    }
  } else{
    for (var i = 0; i < layer_planes.length; i++){
      layer_planes[i].remove(layerCoords[3*i]);
      layer_planes[i].remove(layerCoords[3*i+1]);
      layer_planes[i].remove(layerCoords[3*i+2]);
    }
    layerCoords = [];
  }
  return true;
}

function showSceneCoords(message) {
  var sceneCoordsSwitch = message; //message = true or false
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

function setLayerEdgeOpacity(message){
  layerEdgeOpacity = message;
  redrawEdges(); //because not on animate
  return true;
}

function setInterLayerEdgeOpacity(message){
  interLayerEdgeOpacity = message;
  return true;
}

function setFloorOpacity(message){
  for (var i = 0; i < layer_planes.length; i++){
    layer_planes[i].material.opacity = message;
  }
  return true;
}

function assignXYZ(message) {
  let y_arr = [], //x always 0, assign on floor every time
      z_arr = [],
      node_name = "",
      y = z = 0,
      layerIndex = "";
  for (var i = 0; i < message.length; i++){
    y_arr.push(Number(message[i][1]));
    z_arr.push(Number(message[i][2]));
  }
  var y_min = Math.min.apply(Math, y_arr),
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
    for (i = 1; i < message.length; i++){
      node_name = message[i][0].trim();
      y = nodes[node_whole_names.indexOf(node_name)].position.y/last_layer_scale[layerIndex];
      z = nodes[node_whole_names.indexOf(node_name)].position.z/last_layer_scale[layerIndex];
      if (y < target_y_min) target_y_min = y;
      if (y > target_y_max) target_y_max = y;
      if (z < target_z_min) target_z_min = z;
      if (z > target_z_max) target_z_max = z;
    }
    if (target_y_min == target_y_max){ //form a square
      target_y_min = target_y_min - Math.abs(target_z_min-target_z_max)/2;
      target_y_max = target_y_max + Math.abs(target_z_min-target_z_max)/2;
    }else if (target_z_min == target_z_max){
      target_z_min = target_z_min - Math.abs(target_y_min-target_y_max)/2;
      target_z_max = target_z_max + Math.abs(target_y_min-target_y_max)/2;
    }
    localLayoutFlag = false;
  }
  for (i = 0; i < message.length; i++){
    node_name = message[i][0].trim();
    //nodes[node_whole_names.indexOf(node_name)].position.x = -15; // to float over layer
    if (y_max - y_min != 0) nodes[node_whole_names.indexOf(node_name)].position.y = ((y_arr[i] - y_min) * (target_y_max - target_y_min) / (y_max - y_min) + target_y_min) * last_layer_scale[layer_groups[node_groups[node_name]]]; //mapping * layer stretch scale
    else nodes[node_whole_names.indexOf(node_name)].position.y = 0;
    if (z_max - z_min != 0) nodes[node_whole_names.indexOf(node_name)].position.z = ((z_arr[i] - z_min) * (target_z_max - target_z_min) / (z_max - z_min) + target_z_min) * last_layer_scale[layer_groups[node_groups[node_name]]]; //mapping
    else nodes[node_whole_names.indexOf(node_name)].position.z = 0;
  }
  updateNodesRShiny();
  redrawEdges();
  return true;
}

function setLocalFlag(message){ //T
  localLayoutFlag = message;
  return true;
}

function nodeSelector(message){
  //message -> T | F
  if (message){
    selected_nodes = []; //reseting, else multiple entries -> double transformations
    for (var i=0; i < nodes.length; i++){
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
        if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
          nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
        else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
      } else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
    }
  }
  decideNodeLabelFlags();
  return true;
}

function edgeWidthByWeight(message){
  edgeWidthByWeight = message; //message = true or false
  redrawEdges();
  return true;
}

function topologyScale(message){
  var scale_values = []; //column of scale values from topology
  for(var i=0; i < message.length; i++){
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

function badObject_alert(message){
  alert(message);
  return true;
}

function uploadNetwork(message){
  clearCanvas();
  if (!attachedCanvasControls) attachCanvasControls();
  var temp_name1 = temp_name2 = temp_layer1 = temp_layer2 = "",
  layers_counter = 0;
  for (var i=0; i < message.SourceLayer.length; i++){
    temp_layer1 = String(message.SourceLayer[i]);
    temp_layer2 = String(message.TargetLayer[i]);
    temp_name1 = String(message.SourceNode[i]).concat("_").concat(temp_layer1);
    temp_name2 = String(message.TargetNode[i]).concat("_").concat(temp_layer2);
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
    edge_pairs.push(temp_name1.concat("---").concat(temp_name2));
    edge_values.push(Number(String(message.Weight[i])));
  }
  node_label_flags = Array.apply(0, Array(node_names.length)).map(function() { return false; });
  layer_node_labels_flags = Array.apply(0, Array(layer_names.length)).map(function() { return false; });
  updateLayerNamesRShiny(); //correct order of layer names to avoid bugs with positions
  updateNodeNamesRShiny(); //for Local Layout algorithms
  updateSelectedNodesRShiny();
  //edge_values = mapper(edge_values, 0.1, 1) //min and max opacities //this is done in R now
  if (edge_values.length > max_allowed_edges) alert("Network must contain no more than ".concat(max_allowed_edges).concat(" edges.")); //edge limit
  else {
    attachLayerCheckboxes();
    loadGraph();
  }
  return true;
}

function importNetwork(message){
  clearCanvas();
  if (!attachedCanvasControls) attachCanvasControls();
  setLights();
  addScenePanAndSphere();
  var layers_counter = 0,
      color = "",
      whole_name = "",
      import_width = "";
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
  var layerSphereGeometry = new THREE.SphereGeometry( 0 );
  var layerSphereMaterial = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0.5} );
  for (var i = 0; i < message.length; i++){
    if (message[i][0] == "scene_pan"){
      scene_pan.position.x = Number(message[i][1]);
      scene_pan.position.y = Number(message[i][2]);
      scene_pan.scale.x = scene_pan.scale.y = scene_pan.scale.z = Number(message[i][3]);
      renderer.setClearColor(message[i][4]);
    } else if (message[i][0] == "scene_sphere"){
      scene_sphere.rotation.x = Number(message[i][1]);
      scene_sphere.rotation.y = Number(message[i][2]);
      scene_sphere.rotation.z = Number(message[i][3]);
    } else if (message[i][0] == "layer"){
      import_width = message[i][9];
      //create layer geometries
      var planeGeom = new THREE.PlaneGeometry(import_width, import_width, 8, 8);
      planeGeom.rotateY(THREE.Math.degToRad(90));
      floorCurrentColor = message[i][8];
      var planeMat = new THREE.MeshBasicMaterial({
        color: floorCurrentColor,
        alphaTest: 0.05,
        wireframe: false,
        transparent: true,
        opacity: floorOpacity,
        side: THREE.DoubleSide
      });
      var plane = new THREE.Mesh(planeGeom, planeMat);
      var sphere = new THREE.Mesh( layerSphereGeometry, layerSphereMaterial );
      plane.add(sphere);
      sphere.translateY(-import_width/2);
  	  sphere.translateZ(import_width/2);
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
    } else if (message[i][0] == "node"){
      node_names.push(message[i][1]); //name
      whole_name = message[i][1].concat("_").concat(message[i][2]);
      node_whole_names.push(whole_name); //name + group
      node_attributes.Node.push(whole_name);
      node_groups[whole_name] = message[i][2]; //layer
      if (!layer_groups.hasOwnProperty((message[i][2].trim()))){
        layer_groups[message[i][2].trim()] = layers_counter;
        layers_counter++;
        layer_names.push(message[i][2].trim());
      }
      //create node geometries
      var geometry = new THREE.SphereGeometry( sphereRadius, 4, 3 );
      var material = new THREE.MeshStandardMaterial( {color: message[i][7], transparent: true} );
      node_attributes.Color.push(message[i][7]);
      node_attributes.Url.push(message[i][8]);
      node_attributes.Description.push(message[i][9]);
      var sphere = new THREE.Mesh( geometry, material );
      nodes.push(sphere);
      layer_planes[layer_groups[node_groups[whole_name]]].add(sphere);
      sphere.position.x = Number(message[i][3]); //x
      sphere.position.y = Number(message[i][4]); //y
      sphere.position.z = Number(message[i][5]); //z
      sphere.scale.x = sphere.scale.y = sphere.scale.z = Number(message[i][6]);
      node_attributes.Size.push(Number(message[i][6]));
    } else if (message[i][0] == "edge"){
      edge_pairs.push(message[i][1]);
      edge_values.push(Number(message[i][2]));
      edge_attributes.SourceNode.push(message[i][1]);
      edge_attributes.TargetNode.push("");
      edge_attributes.Color.push(message[i][3]);
    }
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
  return true;
}

function nodeAttributes(message){
  node_attributes = message;
  var pos;
  for (var i = 0; i < nodes.length; i++){
    pos = node_attributes.Node.indexOf(node_whole_names[i]);
    if (pos > -1){ //if node exists in attributes file
      if (nodeAttributesPriority){
        if (!exists(selected_nodes, i) && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node not currently selected and color is assigned
          nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
      }
      if (node_attributes.Size !== undefined && node_attributes.Size[pos] !== "" && node_attributes.Size[pos] != " " && node_attributes.Size[pos] !== null)
        nodes[i].scale.x = nodes[i].scale.y = nodes[i].scale.z = Number(node_attributes.Size[pos]);
    }
  }
  updateNodesRShiny();
  return true;
}

function edgeAttributes(message){
  edge_attributes = message;
  var pos1 = -1,
      pos2 = -1,
      pos3 = -1;
  for (var i = 0; i < edges.length; i++){
    if (edgeAttributesPriority){
      pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
      pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);
      if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " "){//if node not currently selected and exists in node attributes file and color is assigned
        if (typeof(edges[i]) == "number"){ //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos1] );
        }
        else edges[i].material.color = new THREE.Color( edge_attributes.Color[pos1] ); //edge is intra layer
      }
      else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " "){ 
        if (typeof(edges[i]) == "number"){ //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos2] );
        } else edges[i].material.color = new THREE.Color( edge_attributes.Color[pos2] );
      }
    }
  }
  updateEdgesRShiny();
  return true;
}

function changeFPS(message){
  fps = Number(message);
  return true;
}

function startLoader(m){
  var canvas_div = document.getElementById("3d-graph"),
      loader = document.getElementById("loader");
  canvas_div.style.opacity = 0.5;
  loader.style.display = "inline-block";
  return true;
}

function finishLoader(m){
  var canvas_div = document.getElementById("3d-graph"),
      loader = document.getElementById("loader");
  canvas_div.style.opacity = 1;
  loader.style.display = "none";
  return true;
}

function showWireFrames(message) {
  wireframeFlag = message; //message = true or false
  for(var i = 0; i < layer_planes.length; i++){
    layer_planes[i].material.wireframe = wireframeFlag;
  }
  return true;
}

function selectAllLayers(message) {
  selected_layers = [];
  var c = document.getElementById("checkboxdiv").children;
  for (var i = 0; i < c.length; i++){
    if (i%7 === 0){ //(c[i].type == "checkbox"){
      if (message){
        c[i].checked = true;
        selected_layers.push(i/7);
        layer_planes[i/7].material.color = new THREE.Color( "#f7f43e" );
      } else {
        c[i].checked = false;
        layer_planes[i/7].material.color = new THREE.Color( floorCurrentColor );
        layer_labels[i/7].style.display = "none";
      }
    }
  }
  Shiny.setInputValue("selected_layers", selected_layers);
  return true;
}

//RSHINY HANDLERS----------------------------
Shiny.addCustomMessageHandler("handler_maxAllowedEdges", maxAllowedEdges);
Shiny.addCustomMessageHandler("handler_showLabels", showLabels);
Shiny.addCustomMessageHandler("handler_showSelectedLabels", showSelectedLabels);
Shiny.addCustomMessageHandler("handler_showSelectedLayerLabels", showSelectedLayerLabels);
Shiny.addCustomMessageHandler("handler_showLayerLabels", showLayerLabels);
Shiny.addCustomMessageHandler("handler_resizeLabels", resizeLabels);
Shiny.addCustomMessageHandler("handler_resizeLayerLabels", resizeLayerLabels);
Shiny.addCustomMessageHandler("handler_showLayerCoords", showLayerCoords);
Shiny.addCustomMessageHandler("handler_showSceneCoords", showSceneCoords);
Shiny.addCustomMessageHandler("handler_layerEdgeOpacity", setLayerEdgeOpacity);
Shiny.addCustomMessageHandler("handler_interLayerEdgeOpacity", setInterLayerEdgeOpacity);
Shiny.addCustomMessageHandler("handler_floorOpacity", setFloorOpacity);
Shiny.addCustomMessageHandler("handler_layout", assignXYZ);
Shiny.addCustomMessageHandler("handler_setLocalFlag", setLocalFlag);
Shiny.addCustomMessageHandler("handler_nodeSelector", nodeSelector);
Shiny.addCustomMessageHandler("handler_edgeWidthByWeight", edgeWidthByWeight);
Shiny.addCustomMessageHandler("handler_topologyScale", topologyScale);
Shiny.addCustomMessageHandler("handler_badObject_alert", badObject_alert);
Shiny.addCustomMessageHandler("handler_uploadNetwork", uploadNetwork);
Shiny.addCustomMessageHandler("handler_importNetwork", importNetwork);
Shiny.addCustomMessageHandler("handler_nodeAttributes", nodeAttributes);
Shiny.addCustomMessageHandler("handler_edgeAttributes", edgeAttributes);
Shiny.addCustomMessageHandler("handler_fps", changeFPS);
Shiny.addCustomMessageHandler("handler_startLoader", startLoader);
Shiny.addCustomMessageHandler("handler_finishLoader", finishLoader);
Shiny.addCustomMessageHandler("handler_showWireFrames", showWireFrames);
Shiny.addCustomMessageHandler("handler_nodeColorAttributePriority", nodeColorAttributePriority);
Shiny.addCustomMessageHandler("handler_nodeSelectedColorPriority", nodeSelectedColorPriority);
Shiny.addCustomMessageHandler("handler_edgeColorAttributePriority", edgeColorAttributePriority);
Shiny.addCustomMessageHandler("handler_edgeSelectedColorPriority", edgeSelectedColorPriority);
Shiny.addCustomMessageHandler("handler_selectAllLayers", selectAllLayers);
