// general UI init ====================
const clearCanvas = () => {
  scene.reset();
  
  nodes = [], //canvas objects
  node_labels = [];
  if (!attachedCanvasControls) document.getElementById("info").innerHTML = "1. <b>Zoom</b>: Mouse Wheel<br/>2. <b>Pan</b>: Click Drag Scene / Arrow Keys<br/>3. <b>Orbit</b>: Mouse Middle Drag<br/>4. <b>Drag Layer</b>: Click Drag<br/>5. <b>Rotate Layer</b>: <span class='blue'>Z</span> / <span class='red'>X</span> / <span class='green'>C</span> + Click Drag<br/>6. <b>Move Selected Nodes</b>: <span class='blue'>Z</span> / <span class='green'>C</span> + Click Drag<br/>7. <b>Node/Layer Selection</b>: Double Click <br/>8. <b> Lasso Nodes</b>: Shift + Click Drag<br/>9. <b>Unselect All Nodes</b>: Double Click Scene"; //delete all children of info div (node label divs)
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
  sceneCoords = ["", "", ""],
  node_groups = new Map(),
  layer_groups = new Map(),
  layer_labels = [], //divs
  layer_names = [],
  layer_node_labels_flags = [],
  floorDefaultColors = [], 
  x = [],
  y = [],
  z = [],
  scene_pan = "",
  scene_sphere = "",
  layer_planes = [],
  layer_spheres = [],
  js_selected_layers = [],
  selectedNodePositions = [],
  selected_edges = [],
  shiftX = "",
  shiftY = "",
  lasso = "",
  lights = [],
  ambientLight = "",
  optionsList = "",
  node_cluster_colors = [],
  node_attributes = "",
  edge_attributes = "",
  last_layer_scale = [];
  channel_values = [];
  isDirectionEnabled = false;
  autoRotateFlag = false;
  toggleChannelCurvatureRange(false);
  return true;
}

const loadGraph = () => {
  setLights();
	addScenePanAndSphere();
  //create layer planes
  let layerSphereGeometry = new THREE.SphereGeometry( 0 );
  let layerSphereMaterial = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0.5} );
  for(let i = 0; i < Object.getOwnPropertyNames(layer_groups).length; i++){
    let planeGeom = new THREE.PlaneGeometry(2*yBoundMax, 2*yBoundMax, 8, 8);
    planeGeom.rotateY(THREE.Math.degToRad(90));
    floorCurrentColor = floorDefaultColor;
    let planeMat = new THREE.MeshBasicMaterial({
      color: floorDefaultColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: floorOpacity,
      side: THREE.DoubleSide,
    });
    let plane = new THREE.Mesh(planeGeom, planeMat);
    let sphere = new THREE.Mesh( layerSphereGeometry, layerSphereMaterial );
    plane.add(sphere);
    sphere.translateY(-yBoundMax);
	  sphere.translateZ(zBoundMax);
    layer_planes.push(plane);
    layer_spheres.push(sphere);
    scene_sphere.add(plane);
    last_layer_scale.push(1);
  }
  //create node geometries
  for (i = 0; i < node_whole_names.length; i++){
    geometry = new THREE.SphereGeometry( sphereRadius ); //default width and height segments -> 8,6
    material = new THREE.MeshStandardMaterial( {color: colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length], transparent: true} ); //standard material allows light reaction
    sphere = new THREE.Mesh( geometry, material );
    nodes.push(sphere);
    layer_planes[layer_groups[node_groups[node_whole_names[i]]]].add(sphere); //attaching to corresponding layer centroid
  }
  
  drag_controls = new DragControls( layer_planes, camera, renderer.domElement );
  channel_colors = CHANNEL_COLORS_LIGHT;
  createChannelColorMap();
  scrambleNodes();
  moveLayers();
  drawEdges();
  createLabels();

  //init selected channels for layout with all the channels
  channels_layout = channels;
  Shiny.setInputValue("channels_layout", channels_layout); //R monitors selected Channels
  scene_sphere.rotation.x = THREE.Math.degToRad(15); //starting a little tilted so layers are visible
  scene_sphere.rotation.y = THREE.Math.degToRad(15);
  scene_sphere.rotation.z = THREE.Math.degToRad(5);
  scene_pan.scale.set(0.9, 0.9, 0.9); //starting a little zoomed out

  if (!animationRunning) animate(); //ensure animation runs only once
    
  //communicating variables to rshiny, to optionally export the network on demand
  updateScenePanRShiny();
  updateSceneSphereRShiny();
  updateLayersRShiny();
  updateNodesRShiny();
  updateEdgesRShiny();
  updateLabelColorRShiny();
  return true;
}

const setLights = () => {
	let sphereGeom = new THREE.SphereGeometry();
	lights[0] = new THREE.PointLight( 0xffffff, 1, 2*yBoundMax );
  lights[0].add( new THREE.Mesh( sphereGeom, new THREE.MeshBasicMaterial( { color: 0xffffff } ) ) );
  lights[0].position.set( 0, yBoundMax, 0 );
  lights[0].rotateX(THREE.Math.degToRad(90));
  scene.add( lights[0] );
  lights[1] = new THREE.PointLight( 0xffffff, 1, 2*yBoundMax );
  lights[1].add( new THREE.Mesh( sphereGeom, new THREE.MeshBasicMaterial( { color: 0xffffff } ) ) );
  lights[1].position.set( 0, -yBoundMax, 0 );
  lights[1].rotateX(THREE.Math.degToRad(90));
  scene.add( lights[1] );
  ambientLight = new THREE.AmbientLight(0xffffff);
  scene.add(ambientLight);
  return true;
}

// Scene ====================
const addScenePanAndSphere = () => {
  //scene_pan_sphere to apply all translations
	let geometry = new THREE.SphereGeometry();
  let material = new THREE.MeshBasicMaterial( {color:"blue", transparent: true, opacity: 0} );
  let sphere = new THREE.Mesh( geometry, material );
	scene.add(sphere);
	scene_pan = sphere;
  //scene_middle_sphere to apply all rotations
  geometry = new THREE.SphereGeometry();
  material = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0} );
  sphere = new THREE.Mesh( geometry, material );
  scene_pan.add(sphere);
  scene_sphere = sphere;
  coordsSystemScene(scene_sphere);
  return true;
}

const coordsSystem = (obj) => { //adding coord lines to input object
  let points = [];
  
  //x axis red
	points.push( new THREE.Vector3(0, 0, 0), new THREE.Vector3(150, 0, 0), new THREE.Vector3(-150, 0, 0) );
	let geometry = new THREE.BufferGeometry().setFromPoints( points );
	let material = new THREE.LineBasicMaterial( { color: "#FB3D2A" } );
	let line = new THREE.Line( geometry, material );
	obj.add(line);
  layerCoords.push(line);
  
	//y axis green
	points = [];
	points.push( new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 150, 0), new THREE.Vector3(0, -150, 0) );
	geometry = new THREE.BufferGeometry().setFromPoints( points );
	material = new THREE.LineBasicMaterial( { color: "#46FB2A" } );
	line = new THREE.Line( geometry, material );
	obj.add(line);
	layerCoords.push(line);
	
  //z axis blue
  points = [];
  points.push( new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 150), new THREE.Vector3(0, 0, -150 ) );
  geometry = new THREE.BufferGeometry().setFromPoints( points );
	material = new THREE.LineBasicMaterial( { color: "#2AC2FB" } );
  line = new THREE.Line( geometry, material );
  obj.add(line);
  layerCoords.push(line);
  
  return true;
}

const coordsSystemScene = (obj) => { //adding coord lines to input object
  if (sceneCoords[0] != ""){ //when re-uploading network
    scene_sphere.remove(sceneCoords[0]);
    scene_sphere.remove(sceneCoords[1]);
    scene_sphere.remove(sceneCoords[2]);
    sceneCoords = ["", "", ""];
  }
  let points = [];
  //x axis red
	points.push( obj.position, new THREE.Vector3(800, 0, 0) );
	points.push( obj.position, new THREE.Vector3(-800, 0, 0) );
	let geometry = new THREE.BufferGeometry().setFromPoints( points );
	let material = new THREE.LineBasicMaterial( { color: "#FB3D2A" } );
	let line = new THREE.Line( geometry, material );
	obj.add(line);
  sceneCoords[0] = line;
  
	//y axis green
	points = [];
	points.push( obj.position, new THREE.Vector3(0, 800, 0) );
	points.push( obj.position, new THREE.Vector3(0, -800, 0) );
	geometry = new THREE.BufferGeometry().setFromPoints( points );
	material = new THREE.LineBasicMaterial( { color: "#46FB2A" } );
	line = new THREE.Line( geometry, material );
	obj.add(line);
	sceneCoords[1] = line;
	
	//z axis blue
	points = [];
	points.push( obj.position, new THREE.Vector3(0, 0, 800) );
	points.push( obj.position, new THREE.Vector3(0, 0, -800) );
	geometry = new THREE.BufferGeometry().setFromPoints( points );
	material = new THREE.LineBasicMaterial( { color: "#2AC2FB" } );
  line = new THREE.Line( geometry, material );
  obj.add(line);
  sceneCoords[2] = line;
	
  return true;
}

// @param color: hex code of color value for background
const setSceneColor = (color) => {
  //from picker, color = document.getElementById("scene_color").value
  if (scene_sphere != ""){
    renderer.setClearColor(color);
    updateScenePanRShiny();
  }
  return true;
}

// scene drag with mouse
const sceneDragPan = (x, y) => {
  scene_pan.translateX(x - previousX);
  scene_pan.translateY(previousY - y);
  updateScenePanRShiny();
  updateLayersRShiny();
  updateNodesRShiny();
  return true;
}

// middle click drag
const sceneOrbit = (x, y) => {
  if (scene_sphere != ""){
    let deltaMove = {
        x: x-previousX,
        y: y-previousY
    };
	  
	  let deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
	    new THREE.Euler( toRadians(deltaMove.y * 1), toRadians(deltaMove.x * 1), 0, 'XYZ'));
        
    scene_sphere.quaternion.multiplyQuaternions(deltaRotationQuaternion, scene_sphere.quaternion);

		updateSceneSphereRShiny();
		updateLayersRShiny();
    updateNodesRShiny();
  }
  return true;
}

// Layers ====================
const selectCheckedLayers = () => {
  js_selected_layers = [];
  let c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < c.length; i++){
    if (i%7 === 0){ //(c[i].type == "checkbox"){
      if (c[i].checked) js_selected_layers.push(i/7); //7 -> checkbox, label, checkbox2, label2, checkbox3, label3, br
    }
  }
  Shiny.setInputValue("js_selected_layers", js_selected_layers); //R monitors selected Layers to apply Layouts correctly
  return true;
}

const paintSelectedLayers = () => {
  selectCheckedLayers();
  for (i = 0; i < layer_planes.length; i++){
    if (exists(js_selected_layers, i)) layer_planes[i].material.color = new THREE.Color( "#f7f43e" );
    else {
      if (floorDefaultColors.length > 0 && layerColorFile) {
        layer_planes[i].material.color = new THREE.Color(floorDefaultColors[i]);
      } else layer_planes[i].material.color = new THREE.Color(floorCurrentColor);
      if (!layerLabelSwitch && selectedLayerLabelSwitch) layer_labels[i].style.display = "none";
    }
  }
  return true;
}

const hideLayers = () => {
  let c = document.getElementById("checkboxdiv").children;
  //layers
  for (let i = 0; i < c.length; i++){
    if (i >= 2 && i%7 == 2){ //(c[i].type == "checkbox"){
      if (!c[i].checked) layer_planes[Math.floor(i/7)].visible = true;
      else layer_planes[Math.floor(i/7)].visible = false;
    }
  }
  //node labels
  decideNodeLabelFlags();
  return true;
}

const showLayerNodeLabels = () => {
  let c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < c.length; i++){
    if (i >= 2 && i%7 == 4){
      if (!c[i].checked){
        layer_node_labels_flags[Math.floor(i/7)] = false;
      } else layer_node_labels_flags[Math.floor(i/7)] = true;
    }
  }
  decideNodeLabelFlags();
  return true;
}

const attachLayerCheckboxes = () => { //insert #groups Checkboxes
  let checkbox = "",
    label = "",
    br = "",
    temp = "",
    container = document.getElementById('checkboxdiv');
  container.innerHTML = ''; //clear previous checkboxes
  for(let i = 0; i < Object.getOwnPropertyNames(layer_groups).length; i++){
    checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.name = "checkbox".concat(i);
    checkbox.className = "checkbox_check";
    checkbox.value = i;
    checkbox.id = "checkbox".concat(i);
    checkbox.setAttribute('onclick', 'paintSelectedLayers()');
    
    label = document.createElement('label');
    label.className = "checkbox_element layer_label";
    label.htmlFor = i;
    temp = layer_names[i];
    label.title = layer_names[i];
    label.appendChild(document.createTextNode(temp));
    
    checkbox2 = document.createElement('input');
    checkbox2.className = "checkbox_check";
    checkbox2.type = "checkbox";
    checkbox2.name = "checkbox2".concat(i);
    checkbox2.value = "show_hide".concat(i);
    checkbox2.id = "checkbox2".concat(i);
    checkbox2.setAttribute('onclick', 'hideLayers()');
    
    label2 = document.createElement('label');
    label2.className = "checkbox_element";
    label2.htmlFor = "show_hide".concat(i);
    label2.appendChild(document.createTextNode('Hide'));
    
    checkbox3 = document.createElement('input');
    checkbox3.className = "checkbox_check";
    checkbox3.type = "checkbox";
    checkbox3.name = "checkbox3".concat(i);
    checkbox3.value = "show_labels".concat(i);
    checkbox3.id = "checkbox3".concat(i);
    checkbox3.setAttribute('onclick', 'showLayerNodeLabels()');
    
    label3 = document.createElement('label');
    label3.className = "checkbox_element";
    label3.htmlFor = "show_labels".concat(i);
    label3.appendChild(document.createTextNode('Labels'));
    
    br = document.createElement('br');
    
    container.appendChild(checkbox);
    container.appendChild(label);
    container.appendChild(checkbox2);
    container.appendChild(label2);
    container.appendChild(checkbox3);
    container.appendChild(label3);
    container.appendChild(br);
  }
  return true;
}

const moveLayers = (checkMoveFlag) => {
  let window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
    numLayers = layer_planes.length;
  for (let i = 0; i < numLayers; i++){
    if(checkMoveFlag && layer_planes[i].move || !checkMoveFlag) {
      if (numLayers % 2) layer_planes[i].translateX( (-Math.floor(layer_planes.length/2) + i) * window_width); //odd number of Layers
      else layer_planes[i].translateX( (-layer_planes.length/2 + i) * window_width + window_width/2); //even number of Layers
    }
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
  return true;
}

// @param color (string): hex color
const setFloorColor = (color) => {
  // from picker: floorCurrentColor = document.getElementById("floor_color").value;
  floorCurrentColor = color;
  floorDefaultColor = color;
  for (let i = 0; i < layer_planes.length; i++) {
      if (floorDefaultColors.length > 0 && layerColorFile) {
        layer_planes[i].material.color = new THREE.Color(floorDefaultColors[i]);
      } else layer_planes[i].material.color = new THREE.Color(color);
  }
  updateLayersRShiny();
  return true;
}

const checkHoverOverLayer = (event, node_hover_flag) => {
  vector.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1, - 1 ); // z = - 1 important!
  vector.unproject( camera );
  dir.set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );
  raycaster.set( vector, dir );
  
  let intersects = raycaster.intersectObjects(layer_planes);
  
  if (intersects.length > 0 & !node_hover_flag) {
    if (last_hovered_layer_index != ""){
      paintSelectedLayers();
      last_hovered_layer_index = "";
    }
    intersects[0].object.material.color.set( 0xff0000 );
    last_hovered_layer_index = findIndexByUuid(layer_planes, intersects[0].object.uuid);
  } else {
    paintSelectedLayers();
    last_hovered_layer_index = "";
  }
  
  return true;
}

const checkLayerInteraction = (e) => {
  let layer_selection = false;
  if (last_hovered_layer_index !== ""){
    layer_selection = true;
    let c = document.getElementById("checkboxdiv").children;
    c[last_hovered_layer_index*7].checked ? c[last_hovered_layer_index*7].checked = false : c[last_hovered_layer_index*7].checked = true;
    // altering the checkbox is enough, the rest are tirggered elsewhere
    last_hovered_layer_index = "";
    paintSelectedLayers();
  }
  return layer_selection;
}

const rotateLayers = (e) => {
  let rads, i;

  if (e.screenX - e.screenY >= previousX - previousY) rads = 0.05;
  else rads = -0.05;

  if (axisPressed=="z"){
    for (i = 0; i < js_selected_layers.length; i++){
      layer_planes[js_selected_layers[i]].rotateZ(rads);
    }
  } else if (axisPressed=="x"){
    for (i = 0; i < js_selected_layers.length; i++){
      layer_planes[js_selected_layers[i]].rotateX(rads);
    }
  } else if (axisPressed=="c"){
    for (i = 0; i < js_selected_layers.length; i++){
      layer_planes[js_selected_layers[i]].rotateY(rads);
    }
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
}

// Nodes ====================
const scrambleNodes = (yMin, yMax, zMin, zMax) => {
  !yMin && (yMin = yBoundMin)
  !yMax && (yMax = yBoundMax)
  !zMin && (zMin = zBoundMin)
  !zMax && (zMax = zBoundMax)
  for (let i = 0; i < nodes.length; i++){ //random y,z
    x.push(0);
    y.push(getRandomArbitrary(yMin, yMax));
    z.push(getRandomArbitrary(zMin, zMax));
    nodes[i].translateX(x[i]);
    nodes[i].translateY(y[i]);
    nodes[i].translateZ(z[i]);
  }
  return true;
}

const adjustLayerSize = () => {
  let maxY, minY, maxZ, minZ;
  maxY = minY = maxZ = minZ = nodes[0].position;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].position.y > maxY.y) maxY = nodes[i].position;
    if (nodes[i].position.y < minY.y) minY = nodes[i].position;
    if (nodes[i].position.z > maxZ.z) maxZ = nodes[i].position;
    if (nodes[i].position.z < maxZ.z) minZ = nodes[i].position;
  }
  y_distance = maxY.manhattanDistanceTo(new THREE.Vector3( )) + new THREE.Vector3( ).manhattanDistanceTo(minY)
  z_distance = maxZ.manhattanDistanceTo(new THREE.Vector3()) + new THREE.Vector3().manhattanDistanceTo(minZ)
  if (y_distance < parseFloat(layer_planes[0].geometry.parameters.height)/2) y_distance = parseFloat(layer_planes[0].geometry.parameters.height)/2;
  if (z_distance < parseFloat(layer_planes[0].geometry.parameters.width)/2) z_distance = parseFloat(layer_planes[0].geometry.parameters.width)/2;
  scale_y = y_distance / parseFloat(layer_planes[0].geometry.parameters.height);
  scale_z = z_distance / parseFloat(layer_planes[0].geometry.parameters.width);
  //Keep the largest dimension
  if (scale_y > scale_z) {
    scale = scale_y;
    distance = y_distance
  } else {
    scale = scale_z;
    distance = z_distance
  }
  for (let i = 0; i < layer_planes.length; i++) {
    layer_planes[i].geometry.scale(1, scale, scale);
    layer_planes[i].geometry.parameters.height =  layer_planes[i].geometry.parameters.width = distance;
  }
  updateLayersRShiny();
  redrawLayerLabels();
}



// Called from mouse move event
// @return bool
const checkHoverOverNode = (event) => {
  vector.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1, - 1 ); // z = - 1 important!
  vector.unproject( camera );
  dir.set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );
  raycaster.set( vector, dir );
  
  let intersects = raycaster.intersectObjects(nodes),
    event_flag = false, //for performance optimization
    index,
    hover_flag = false;
    
  if (intersects.length > 0) {
    hover_flag = true;
    
    if (last_hovered_node_index != ""){
      hovered_nodes = hovered_nodes.filter(function(value, index, arr){ return value != last_hovered_node_index;});
      nodes[last_hovered_node_index].material.opacity = 1;
      last_hovered_node_index = "";
      event_flag = true;
    }
    intersects[0].object.material.opacity = 0.5;
    last_hovered_node_index = findIndexByUuid(nodes, intersects[0].object.uuid);
    if (!exists(hovered_nodes, last_hovered_node_index)) hovered_nodes.push(last_hovered_node_index);
    event_flag = true;
  } else {
    if (last_hovered_node_index != ""){
      hovered_nodes = hovered_nodes.filter(function(value, index, arr){ return value != last_hovered_node_index;});
      nodes[last_hovered_node_index].material.opacity = 1;
      last_hovered_node_index = "";
      event_flag = true;
    } else hovered_nodes = [];
  }
  
  if (event_flag) decideNodeLabelFlags(); //performance optimization
  
  return hover_flag;
}

// with ray caster
const checkNodeInteraction = (e) => {
  let node_selection = false;
  //if (event.ctrlKey) {
  vector.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1, - 1 ); // z = - 1 important!
  vector.unproject( camera );
  dir.set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );
  raycaster.set( vector, dir );
  
  let intersects = raycaster.intersectObjects(nodes);
  if (intersects.length > 0){
    node_selection = true;
    let ind = findIndexByUuid(nodes, intersects[0].object.uuid);
    if (exists(selectedNodePositions, ind)){
      if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
        pos = node_attributes.Node.indexOf(node_whole_names[ind]);
        if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
          nodes[ind].material.color = new THREE.Color( node_attributes.Color[pos] );
        else nodes[ind].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[ind]]])%colors.length]);
      } else nodes[ind].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[ind]]])%colors.length]);
      selectedNodePositions = selectedNodePositions.filter(function(value, index, arr){ return value != ind;}); //array remove/filter
    } else {
      selectedNodePositions.push(ind);
      if (selectedNodeColorFlag) nodes[ind].material.color = new THREE.Color( selectedDefaultColor );
    }
  }

  decideNodeLabelFlags();
  updateSelectedNodesRShiny();
  //}
  return node_selection;
}

// shift + drag left click
const lassoSelectNodes = (x, y) => {
  //create lasso rectangle graphics
  scene.remove(lasso);
  let points = [];
	points.push( new THREE.Vector3(shiftX, shiftY, 0), new THREE.Vector3(x, shiftY, 0), new THREE.Vector3(x, y, 0), new THREE.Vector3(shiftX, y, 0), new THREE.Vector3(shiftX, shiftY, 0) );
	let geometry = new THREE.BufferGeometry().setFromPoints( points );
	let material = new THREE.LineBasicMaterial( { color: "#eef1b6" } );
	lasso = new THREE.Line( geometry, material );
	scene.add(lasso);
  //check node interaction
  let minX = Math.min(shiftX, x);
  let maxX = Math.max(shiftX, x);
  let minY = Math.min(shiftY, y);
  let maxY = Math.max(shiftY, y);
  for (let i = 0; i < nodes.length; i++){
    let nodeX = nodes[i].getWorldPosition(new THREE.Vector3()).x;
    let nodeY = nodes[i].getWorldPosition(new THREE.Vector3()).y;
    if (nodeX < maxX && nodeX > minX && nodeY < maxY && nodeY > minY){
      nodes[i].material.opacity = 0.5;
    } else {
      nodes[i].material.opacity = 1;
    }
  }
  return true;
}

const translateNodes = (e) => {
  let step, i;
    
  if (e.screenX - e.screenY >=  previousX - previousY) step = 20;
  else step =-20;
  
  if (axisPressed=="z"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateZ(step);
    }
  /*} else if (axisPressed=="x"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateX(step);
    }*/
  } else if (axisPressed=="c"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateY(step);
    }
  }
  redrawEdges();
  updateNodesRShiny();
}

// Edges ====================
const drawEdges = () => {
  let index1 = 0, index2 = 0, color = "";
  for (let i = 0; i < edge_pairs.length; i++){ //random x,y,z
    color = edgeDefaultColor;
    if (edge_channels && edge_channels[i] && edge_channels[i].length === 1) {
      color = channel_color[edge_channels[i][0]];
    } else {
      color = edgeDefaultColor;
    }
    let points = [];
    let edge_split = edge_pairs[i].split("---");
    index1 = node_whole_names.indexOf(edge_split[0]);
    index2 = node_whole_names.indexOf(edge_split[1]);
    if (node_groups[node_whole_names[index1]] == node_groups[node_whole_names[index2]]){ //check if edge inside same Layer
      points.push( nodes[index1].position, nodes[index2].position );
  		let geometry = new THREE.BufferGeometry().setFromPoints( points );
  		let material = "";
  		if (edge_attributes !== "" && edgeAttributesPriority){
  		  pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
        pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);
        if (checkIfAttributeColorExist(edge_attributes, pos1)){ //if node not currently selected and exists in node attributes file and color is assigned
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        } else if (checkIfAttributeColorExist(edge_attributes, pos2)){ 
          color = edge_attributes.Color[pos2];
        }
      }

  		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[i] } );
      else material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: layerEdgeOpacity });
      let arrowHelper = createArrow(points, color,null, false);
      let ver_line = new THREE.Line(geometry, material);
      if (edge_channels[i]) {
        let curve_group = new THREE.Group();
        curve_group = createChannels(points[0], points[1], channelCurvature, ver_line, i, false);
        layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(curve_group);
        edges.push(curve_group);
      } else {
        layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(ver_line);
        edges.push(ver_line);
        //directed
        if (isDirectionEnabled) {
          const group = new THREE.Group();
          group.add( ver_line);
          group.add( arrowHelper );
          layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(group);
          edges[i] = group;
        }
        
      }
    } else { //identify between-layer edges
      edges.push(i); //pushing this to keep count of edges for redraw
      layer_edges_pairs.push(i);
      edge_channels &&  layer_edges_pairs_channels.push(edge_channels[i]); 
    }
  }
  return true;
}

// runs constantly on animate
const drawLayerEdges = (flag) => {
  let i;
  if (!flag && (dragging || animationPause)){
    for (let i = 0; i < layer_edges_pairs.length; i++){
      scene.remove(layerEdges[i]);
    }
  }
  else if (!flag && !(edgeWidthByWeight && interLayerEdgeOpacity > 0)){ //this optimizes execution for many connections by making them disappear
    for (let i = 0; i < layer_edges_pairs.length; i++){
      scene.remove(layerEdges[i]);
    }
    draw_inter_edges_flag = false;
  } else {
    let index1 = 0, index2 = 0, color = "", pos = -1, pos1 = -1, pos2 = -1;
    let c = document.getElementById("checkboxdiv").children;
    for (i = 0; i < layer_edges_pairs.length; i++){
      scene.remove(layerEdges[i]);
      // Keep default color
      if (layer_edges_pairs_channels && layer_edges_pairs_channels[i] &&  layer_edges_pairs_channels[i].length === 1) {  
        color = channel_color[layer_edges_pairs_channels[i][0]];
      } else {
        color = edgeDefaultColor;
      }
      let points = [];
      let edge_split = edge_pairs[layer_edges_pairs[i]].split("---");
      let node_layer1 = layer_groups[node_groups[edge_split[0]]];
      let node_layer2 = layer_groups[node_groups[edge_split[1]]];
      if (!c[node_layer1*7+2].checked && !c[node_layer2*7+2].checked){
        index1 = node_whole_names.indexOf(edge_split[0]);
        index2 = node_whole_names.indexOf(edge_split[1]);
        points.push( nodes[index1].getWorldPosition(new THREE.Vector3()), nodes[index2].getWorldPosition(new THREE.Vector3()) );
    		let geometry = new THREE.BufferGeometry().setFromPoints( points );
        let material = "";
        // set color to selectedDefault if the edge is selected
    		if (exists(selected_edges, layer_edges_pairs[i]) && selectedEdgeColorFlag) color = selectedDefaultColor;
        else if (edge_attributes !== "" && edgeAttributesPriority) {
    		  pos = edges.indexOf(layer_edges_pairs[i]);
    		  pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[pos]);
    		  pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[pos]);
          if (checkIfAttributeColorExist(edge_attributes, pos1)) color = edge_attributes.Color[pos1];
          else if (checkIfAttributeColorExist(edge_attributes, pos2)) color = edge_attributes.Color[pos2];
    		}
        if (edgeWidthByWeight) material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[layer_edges_pairs[i]] });
        else {
          material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: interLayerEdgeOpacity });
        }
        let arrowHelper = createArrow(points, color,null, true);
        let ver_line = new THREE.Line(geometry, material);

        // if the edge is multi channel create the multiple channels
        
        if (layer_edges_pairs_channels[i]) {
          let curve_group = new THREE.Group();
          curve_group = createChannels(points[0], points[1], interChannelCurvature, ver_line, i, true);
          scene.add(curve_group);
          layerEdges[i] = curve_group;
        } else {
          //directed
          if (isDirectionEnabled) {
            const group = new THREE.Group();
            group.add( ver_line );
            group.add( arrowHelper );
            scene.add(group);
            layerEdges[i] = group;
          } else {
            scene.add(ver_line);
            layerEdges[i] = ver_line;
          }
        }
      }
    }
  }
  return true;
}

const redrawEdges = () => {
  let index1 = 0, index2 = 0, color = "", pos = -1, pos1 = -1, pos2 = -1;
  for (let i = 0; i < edge_pairs.length; i++){
    if ( edge_channels && edge_channels[i] && edge_channels[i].length === 1) {
      color = channel_color[edge_channels[i][0]];
    } else {
      color = edgeDefaultColor;
    }
    let edge_split = edge_pairs[i].split("---");
    index1 = node_whole_names.indexOf(edge_split[0]);
    index2 = node_whole_names.indexOf(edge_split[1]);
    if (node_groups[node_whole_names[index1]] == node_groups[node_whole_names[index2]]){ //(exists(selectedNodePositions, index1) || exists(selectedNodePositions, index2)) &&
      let points = [];
      layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].remove(edges[i]);
  		points.push( nodes[index1].position, nodes[index2].position );
  		let geometry = new THREE.BufferGeometry().setFromPoints( points );
      let material = "";
      if (exists(selected_edges, i) && selectedEdgeColorFlag) color = selectedDefaultColor;
      else if (edge_attributes !== "" && edgeAttributesPriority){
  	    pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
        pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);

        if (checkIfAttributeColorExist(edge_attributes, pos1)){//if node not currently selected and exists in node attributes file and color is assigned
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        } else if (checkIfAttributeColorExist(edge_attributes, pos2)){ 
          color = edge_attributes.Color[pos2];
        }
      }      
  		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[i]}  );
  		else material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: layerEdgeOpacity}  );
      let arrowHelper = createArrow(points, color,null, false);
      let ver_line = new THREE.Line(geometry, material);

      if (edge_channels[i]) {
        let curve_group = new THREE.Group();
        curve_group = createChannels(points[0], points[1], channelCurvature, ver_line, i, false);
        layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(curve_group);
        edges[i] = curve_group;
      } else {
        layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(ver_line);
        edges[i] = ver_line;

        if (isDirectionEnabled) {
          const group = new THREE.Group();
          group.add( ver_line);
          group.add( arrowHelper );
          layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(group);
          edges[i] = group;
        }
      }
    }
  }
  return true;
}

const createArrow = (points, color, extra_point, isInterLayer) => {
  let headLengthPerArrowLength;
  if (color === edgeDefaultColor) {
    color = edgeDefaultColor;
  }
  let direction = points[1].clone().sub(points[0]);
  let length = direction.length();

  if (extra_point) {
    temp_dir = points[1].clone().sub(extra_point);
    length = temp_dir.length();
  }
  if (isInterLayer) headLengthPerArrowLength = directionArrowSize;
  else  headLengthPerArrowLength = intraDirectionArrowSize;

  //in order to keep line's opacity we create only the cone from the arrow
  //we create the arrow in order to have the correct direction and then change its length size in order to be almost the size of the headLength 
  let headLenth = headLengthPerArrowLength * length;
  length = 1.05 * headLenth;
  let origin = calcPointOnLine(points[1], points[0], headLengthPerArrowLength);
  return new THREE.ArrowHelper(direction.normalize(), origin, length, color, headLenth);
}

const calcPointOnLine = (point1, point2, length) => {
  let x = (1 - length) * point1.x + length * point2.x;
  let y = (1 - length) * point1.y + length * point2.y;
  let z = (1 - length) * point1.z + length * point2.z;
  return new THREE.Vector3( x, y, z );
}

const transformPoint = (point) => {
  temp = point.x
  point.x = 0
  point.z = temp
  return point
}

const createCurve = (p1, p2, lgth, color, isLayerEdges, group, tag) => {
  curve_opacity = isLayerEdges ? interLayerEdgeOpacity : layerEdgeOpacity;
  let p3 = p1.clone();
  let p4 = p2.clone();
  let curve;
  const points = 50;

  p3.addScalar(lgth);
  p4.addScalar(lgth);
  
  if (!isLayerEdges) curve = new THREE.CubicBezierCurve3(transformPoint(p1), transformPoint(p3), transformPoint(p4), transformPoint(p2))
  else curve = new THREE.CubicBezierCurve3(p1,p3,p4,p2)
 

  let curve_points = curve.getPoints(points);
  let curve_geometry = new THREE.BufferGeometry().setFromPoints(curve_points);
  let curve_material;
  // TODO check what i corresponds to
  //if (edgeWidthByWeight) curve_material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[i] } );
  //else 
  curve_material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05,  transparent: true, opacity: curve_opacity});
  
  my_curve = new THREE.Line( curve_geometry, curve_material)
  my_curve.userData.tag = tag;
  my_curve.visible = channelVisibility[my_curve.userData.tag];
  group.add(my_curve)

  if (isDirectionEnabled) {
    arrowHelper = createArrow([curve_points[points - 4], curve_points[points - 2]], color, curve_points[points / 2],isLayerEdges);
    arrowHelper.userData.tag = tag;
    arrowHelper.visible = channelVisibility[my_curve.userData.tag]
    group.add(arrowHelper)
  }
  // Create the final object to add to the scene
  return group;
}

const setEdgeColor = () =>{
  let i;
  // inter-layer edges automatically change from edgeDefaultColor
  for (i=0; i<edges.length; i++) {
    // intra-layer edges
    if (typeof (edges[i]) === 'object') {
      if (edges[i].children && edges[i].children.length > 0) {
        edges[i].children.forEach(child => {
          if (child.material && child.material.color) {
              if (exists(selected_edges, i) && selectedEdgeColorFlag) child.material.color = new THREE.Color(selectedDefaultColor);
              else if (child.userData && child.userData.tag) child.material.color = new THREE.Color(channel_color[child.userData.tag]);
              else child.material.color = new THREE.Color(edgeDefaultColor);
            } else {
              if (child.userData && child.userData.tag) child.setColor(channel_color[child.userData.tag])
              else child.setColor(edgeDefaultColor)
            }
        });
      } else {
        if (exists(selected_edges, i) && selectedEdgeColorFlag) edges[i].material.color = new THREE.Color(selectedDefaultColor);
        else edges[i].material.color = new THREE.Color(edgeDefaultColor);
      } 
    } 
  }
}

// Channels ====================
const changeChannelColor = (el) => {
  channel_name = el.id.substring(5);
  channel_color[channel_name] = el.value;
  redrawEdges();
  updateEdgesRShiny();
  return true;
}

const toggleChannelVisibility = (el) => {
  channel_name = el.id.substring(8);
  total_edges = edges.concat(layerEdges);
  toggleChildrenWithTag(channel_name, total_edges, el.checked);
  redrawEdges();
  return true;
}

const toggleChildrenWithTag = (tag, array, new_value) => {
  array.forEach(item => {
    if (item.children && item.children.length > 0) {
      for (let i = 0, l = item.children.length; i < l; i++) {
        if (item.children[i].userData && item.children[i].userData.tag && item.children[i].userData.tag === tag) {
          item.children[i].visible = !new_value;
          channelVisibility[tag] = !new_value;
        }
      }
    }
  });
}

const toggleChannelLayoutMenu = (el) => {
  icon = document.getElementById('buttonChannelLayout');
  select = document.getElementById('channelsLayout');
  if (icon.classList.contains('close')) {
    icon.classList.remove("close");
    select.classList.remove('display-none');
  } else {
      icon.classList.add("close");
    select.classList.add('display-none');
  }
  
  return true;
}

const toggleChannelLayout = (el) => {
  const index = channels_layout.indexOf(el.name);
  if (index > -1) {
    channels_layout.splice(index, 1);
  } else {
    channels_layout.push(el.name);
  }
   Shiny.setInputValue("channels_layout", channels_layout); //R monitors selected Channels
}

const attachChannelEditList = () => {
  let checkbox = "",
    label = "",
    label2 = "",
    br = "",
    colorPicker = "",
    subcontainer = "",
    title = "",
    container = document.getElementById('channelColorPicker');
    br = document.createElement('br');

    title = document.createElement("h4");
    title.textContent = 'Channels';
    container.innerHTML = ''; // clear
    container.appendChild(title);
    channels.forEach(channel => {
      subcontainer = document.createElement("div");
      subcontainer.className = "channel_subcontainer";

      label = document.createElement('h5');
      label.className = "channelLabel";
      label.textContent = channel.concat(":");

      colorPicker = document.createElement('input');
      colorPicker.type = "color";
      colorPicker.className = "colorPicker channel_colorPicker";
      colorPicker.name = "color".concat(channel);
      colorPicker.id = "color".concat(channel);
      colorPicker.value = channel_color[channel];
      colorPicker.setAttribute('onchange', "changeChannelColor(this)");
      

      checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkbox".concat(channel);
      checkbox.className = "checkbox_check channel_checkbox";
      checkbox.id = "checkbox".concat(channel);
      checkbox.setAttribute('onclick', "toggleChannelVisibility(this)");

      label2 = document.createElement('label');
      label2.className = "channelCheckboxLabel";
      label2.textContent = "Hide";
    
      subcontainer.appendChild(label);
      subcontainer.appendChild(colorPicker);
      subcontainer.appendChild(checkbox);
      subcontainer.appendChild(label2);
      // subcontainer.appendChild(br);

      container.appendChild(subcontainer);
      subcontainer = '';
    });
  if (edgeAttributesPriority) document.getElementById('channelColorPicker').style.display = 'none';
  else document.getElementById('channelColorPicker').style.display = 'block';
}

const attachChannelLayoutList = () => {
  let
    checkbox = '',
    label = document.createElement("label"),
    p = '',
    container = document.getElementById('channelColorLayoutDiv'),
    channelContainer  = document.createElement('div'),
    icon = document.createElement('i'),
    tooltip = document.createElement('i'),
    subcontainer = document.createElement('div');
    item = document.createElement('div');
  
  
  container.innerHTML = ''; // clear
  icon.setAttribute('class', 'fas fa-angle-up buttonChannelLayout close');
  icon.setAttribute('id', 'buttonChannelLayout');
  icon.setAttribute('onclick', "toggleChannelLayoutMenu(this)");
  label.textContent = 'Select Channels for layouts';
  label.setAttribute("for", "channelsLayout");

  tooltip.setAttribute('class', 'fas fa-info-circle channel-tooltip');
  tooltip.setAttribute('title', 'Channels selection do not apply for Circle, Grid and Random layout');

  channelContainer.setAttribute("name", "channelsLayout");
  channelContainer.setAttribute("id", "channelsLayout");
  channelContainer.setAttribute("class", "channelsLayout display-none");

  channels.forEach(channel => {
      //TODO for each channel add a row with a checkbox and channels name
    row = document.createElement('div');

    checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.name = channel;
    checkbox.className = "checkbox_check channel_checkbox";
    checkbox.id = "checkbox_layout".concat(channel);
    checkbox.checked = true;
    checkbox.setAttribute('onclick', "toggleChannelLayout(this)");

    p = document.createElement("p");
    p.className = "channel_layout_name";
    p.textContent = channel;

    row.appendChild(checkbox);
    row.appendChild(p);

    channelContainer.appendChild(row);
    row = '';
  });
  item.appendChild(label);
  item.appendChild(tooltip);
  subcontainer.appendChild(item);
  subcontainer.appendChild(icon);
  subcontainer.setAttribute('class', 'channelLayoutsub');
  container.appendChild(subcontainer);
  container.appendChild(channelContainer);

}

const createChannelColorMap = () => {
  for (let i = 0; i < channels.length; i++) {
    channel_color[channels[i]] = channel_colors[i];
  }
}

const getChannelColor = (i, c, isLayerEdges) => {
  let color, pos = -1;
  if (isLayerEdges) {
    pos = edges.indexOf(layer_edges_pairs[i]);
    j = pos;
  } else j = i;
  if (exists(selected_edges, j) && selectedEdgeColorFlag) {
    return selectedDefaultColor;
  }
  else if (edge_attributes !== "" && edgeAttributesPriority) {
    pos1arr = findIndices(edge_attributes.SourceNode, edge_pairs[j]);
    pos2arr = findIndices(edge_attributes.TargetNode, edge_pairs[j]);
    pos1arr != -1 && pos1arr.forEach(pos1 => {
      if (checkIfAttributeColorExist(edge_attributes, pos1)){//if node not currently selected and exists in node attributes file and color is assigned
        if (edge_attributes.Channel[pos1] === c) {
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        }
      }
    });
    pos2arr != -1 && pos2arr.forEach(pos2 => {
      if (checkIfAttributeColorExist(edge_attributes, pos2)) {
        if (edge_attributes.Channel[pos2] === c) {
          color = edge_attributes.Color[pos2];
        }
      }
    });
  }

  if (color && edge_attributes && edge_attributes.Channel) {
    return color;
  }
  return undefined;
}

// t is a random percentage that has been set after tries
// t is a factor between 0-1
const createChannels = (p1, p2, t, ver_line, group_pos, isLayerEdges) => {
  let arrowHelper;
  temp_channels = [];
  if (isLayerEdges) {
    temp_channels = layer_edges_pairs_channels[group_pos];
  } else {
    temp_channels = edge_channels[group_pos];
  }
  let curve_group = new THREE.Group();
  if (temp_channels.length === 1) {
    ver_line.userData.tag = temp_channels[0];
    ver_line.visible = channelVisibility[ver_line.userData.tag];
    color = getChannelColor(group_pos, ver_line.userData.tag, isLayerEdges);
    !color && (color = channel_color[ver_line.userData.tag]);
    ver_line.material.color = new THREE.Color(color);
    curve_group.add(ver_line);
    if (isDirectionEnabled) {
      arrowHelper = createArrow([p1, p2], color,null, isLayerEdges);
      arrowHelper.userData.tag = temp_channels[0];
      arrowHelper.visible = channelVisibility[ver_line.userData.tag]
      curve_group.add(arrowHelper)
    }
  } else if (temp_channels.length > 1) {
    let ver_line_const = p1.distanceTo(p2) * t;
    let lgth = ver_line_const;
    let curve;
    let color;
    let loopTotal = Math.trunc((temp_channels.length) / 2);
    for (let i = 0; i < loopTotal; i++) {
      lgth = ver_line_const * (loopTotal - i) / loopTotal;

      color = getChannelColor(group_pos, temp_channels[i], isLayerEdges);
      !color && (color = channel_color[temp_channels[i]]);
      curve_group = createCurve(p1, p2, lgth, color, isLayerEdges, curve_group, temp_channels[i]);
    }
    for (let i = 0; i < loopTotal; i++) {
      lgth = ver_line_const * (loopTotal - i) / loopTotal;
      color = getChannelColor(group_pos, temp_channels[loopTotal + i], isLayerEdges);
      !color && (color = channel_color[temp_channels[loopTotal + i]]);
      curve_group = createCurve(p1, p2, -1 * lgth, color, isLayerEdges,curve_group, temp_channels[loopTotal + i]);
    }

    
    //if numofcurves is even then no verline
    if (temp_channels.length % 2 == 1) {
      ver_line.userData.tag = temp_channels[temp_channels.length - 1];
      ver_line.visible = channelVisibility[ver_line.userData.tag];
      color = getChannelColor(group_pos, ver_line.userData.tag, isLayerEdges);
      !color && (color = channel_color[ver_line.userData.tag]);
      ver_line.material.color = new THREE.Color(color);
      curve_group.add(ver_line);
      if (isDirectionEnabled) {
        arrowHelper = createArrow([p1, p2], color,null, isLayerEdges);
        arrowHelper.userData.tag = temp_channels[temp_channels.length - 1];
        arrowHelper.visible = channelVisibility[ver_line.userData.tag]
        curve_group.add(arrowHelper)
    }
    }
  }
  return curve_group;
}

const toggleChannelCurvatureRange = (message) => {
  Shiny.setInputValue("js_channel_curvature_flag", message); //R monitors selected Channels
  return true;
}

const assignColor = (checkChannels, i, channels, tag, color, edgeNoChannel) => {
  if (checkChannels && checkChannels[i]) { //if this is a file with channels
       channels.forEach(channel => {
          if (channel.userData.tag === tag) {
            channel.material.color = new THREE.Color(color);
          }
        });
      } else { //if this is not a file with channels
        edgeNoChannel.material.color = new THREE.Color(color);
      }
}

// Labels ====================
const createLabels = () => {
  //nodes
  for (let i = 0; i < nodes.length; i++){
    let div = document.createElement('div');
    div.textContent = node_names[i];
    div.setAttribute('class', 'labels');
    div.setAttribute('id', node_whole_names[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    node_labels.push(div);
    node_labels[i].style.fontSize = nodeLabelDefaultSize;
    node_labels[i].style.display = "none"; //hiding labels on creation
    node_labels[i].style.color = globalLabelColor;
  }
  //layers
  for (i = 0; i < layer_names.length; i++){
    let div = document.createElement('div');
    div.textContent = layer_names[i];
    div.setAttribute('class', 'layer-labels');
    div.setAttribute('id', layer_names[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    layer_labels.push(div);
    layer_labels[i].style.display = "inline-block"; //hiding labels on creation
    layer_labels[i].style.color = globalLabelColor;
  }
  return true;
}

const redrawLayerLabels = () => {
  let  layerX = "",
       layerY = "",
       labelX = "",
       labelY = "",
       c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < layer_names.length; i++){
    if (!c[i*7+2].checked){ //if node's layer not hidden
      layerX = layer_spheres[i].getWorldPosition(new THREE.Vector3()).x,
      layerY = layer_spheres[i].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + layerX;
      labelY = yBoundMax - layerY;
      layer_labels[i].style.left = labelX.toString().concat("px");
      layer_labels[i].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      let canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth) layer_labels[i].style.display = "none";
      else layer_labels[i].style.display = "inline-block";
    } else layer_labels[i].style.display = "none";
  }
  return true;
}

const redrawSelectedLayerLabels = () => {
  let  layerX = "",
       layerY = "",
       labelX = "",
       labelY = "",
       c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < js_selected_layers.length; i++){
    if (!c[i*7+2].checked){ //if node's layer not hidden
      layerX = layer_spheres[js_selected_layers[i]].getWorldPosition(new THREE.Vector3()).x,
      layerY = layer_spheres[js_selected_layers[i]].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + layerX;
      labelY = yBoundMax - layerY;
      layer_labels[js_selected_layers[i]].style.left = labelX.toString().concat("px");
      layer_labels[js_selected_layers[i]].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      let canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth) layer_labels[js_selected_layers[i]].style.display = "none";
      else layer_labels[js_selected_layers[i]].style.display = "inline-block";
    } else layer_labels[js_selected_layers[i]].style.display = "none";
  }
  return true;
}

const setLabelColor = () =>{
  let i;
  for (i=0; i<layer_labels.length; i++) layer_labels[i].style.color = globalLabelColor;
  for (i=0; i<node_labels.length; i++) node_labels[i].style.color = globalLabelColor;
}

// logic behind node label show/hide
// TODO change checked calculation with checkbox names
const decideNodeLabelFlags = () => {
  let c = document.getElementById("checkboxdiv").children,
      node_layer = "";
  for (i = 0; i < node_names.length; i++){
    node_layer = layer_groups[node_groups[node_whole_names[i]]];
    if (c[node_layer*7+2].checked){ //1. if node's layer not hidden 
      node_label_flags[i] = false;
    } else if (labelSwitch){ //2. if showing all node labels
      node_label_flags[i] = true;
    } else if (layer_node_labels_flags[node_layer]){ //3. if showing layer node labels
      node_label_flags[i] = true;
    } else if (selectedLabelSwitch && exists(selectedNodePositions, i)){ //4. if showing selected node labels, and node is selected
      node_label_flags[i] = true;
    } else if (exists(hovered_nodes, i)){ //5. if hovering over node(s)
      node_label_flags[i] = true;
    } else node_label_flags[i] = false; //6. if none of the above apply, don't show label
  }
  return true;
}

const renderNodeLabels = () => {
  let nodeX = "",
      nodeY = "",
      labelX = "",
      labelY = "";
  for (let i = 0; i < node_label_flags.length; i++){
    let node_layer = layer_groups[node_groups[node_whole_names[i]]];
    if (node_label_flags[i]){ //ONLY CHECK THIS 
      nodeX = nodes[i].getWorldPosition(new THREE.Vector3()).x,
      nodeY = nodes[i].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + nodeX + 7;
      labelY = yBoundMax - nodeY - 10;
      node_labels[i].style.left = labelX.toString().concat("px");
      node_labels[i].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      let canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth) node_labels[i].style.display = "none";
      else node_labels[i].style.display = "inline-block";
    } else node_labels[i].style.display = "none";
  }
  return true;
}

// 3D graphics render animation ====================
const animate = () => {
  animationRunning = true;
  setTimeout( function() { //limiting FPS
    requestAnimationFrame( animate ); //pauses when the user navigates to another browser tab
  }, 1000 / fps );
  renderNodeLabels();
  if (layerLabelSwitch) redrawLayerLabels();
  else if (selectedLayerLabelSwitch && js_selected_layers !== []) redrawSelectedLayerLabels();
  // draw inter-layer edges only when necessary for performance improvement
  if (dragging || animationPause){
    drawLayerEdges(false);
  } 
  else if (edgeWidthByWeight || interLayerEdgeOpacity > 0){
    drawLayerEdges(true);
    draw_inter_edges_flag = true;
  }
  else if (draw_inter_edges_flag) drawLayerEdges(false);
	renderer.render( scene.THREE_Object, camera );
	return true;
}
        
