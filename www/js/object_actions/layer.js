const appendCoordsSystem = (obj) => { //adding coord lines to input object
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

const selectCheckedLayers = () => {
  js_selected_layers = [];
  let c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < c.length; i++){
    if (i%7 === 0){ //(c[i].type == "checkbox"){
      if (c[i].checked) js_selected_layers.push(i/7); //7 -> checkbox, label, checkbox2, label2, checkbox3, label3, br
    }
  }
  // js_selected_layers = layers.map(function(l) { if (l.isSelected) return l.id; });
  // js_selected_layers = js_selected_layers.filter(function(id) { return id !== undefined; });
  //  TODO check if switching to this
  // 
  Shiny.setInputValue("js_selected_layers", js_selected_layers); // TODO layers.map(({ isSelected }) => isSelected)
  return true;
}

const paintSelectedLayers = () => {
  selectCheckedLayers();
  for (i = 0; i < layer_planes.length; i++) {
    if (exists(js_selected_layers, i))
      layer_planes[i].material.color = new THREE.Color( "#f7f43e" );
    else {
      if (floorDefaultColors.length > 0 && layerColorFromFile) {
        layer_planes[i].material.color = new THREE.Color(floorDefaultColors[i]);
      } else
        layer_planes[i].material.color = new THREE.Color(floorCurrentColor);
      if (!showAllLayerLabelsFlag && showSelectedLayerLabelsFlag)
        layer_labels[i].style.display = "none";
    }
  }
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
  for (let i = 0; i < layer_planes.length; i++) {
      if (floorDefaultColors.length > 0 && layerColorFromFile) {
        layer_planes[i].material.color = new THREE.Color(floorDefaultColors[i]);
      } else layer_planes[i].material.color = new THREE.Color(color);
  }
  updateLayersRShiny();
  return true;
}

const checkHoverOverLayer = (event, node_hover_flag) => {
  setRaycaster(event);
  let intersects = RAYCASTER.intersectObjects(layer_planes); //TODO get all layer object planes in an array first
  
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
  if (last_hovered_layer_index !== "") {
    // layers[last_hovered_layer_index].isSelected = true; // TODO check if swithc to this
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

  if (e.screenX - e.screenY >= mousePreviousX - mousePreviousY) rads = 0.05;
  else rads = -0.05;

  if (scene.axisPressed=="z"){
    for (i = 0; i < js_selected_layers.length; i++){
      layer_planes[js_selected_layers[i]].rotateZ(rads);
    }
  } else if (scene.axisPressed=="x"){
    for (i = 0; i < js_selected_layers.length; i++){
      layer_planes[js_selected_layers[i]].rotateX(rads);
    }
  } else if (scene.axisPressed=="c"){
    for (i = 0; i < js_selected_layers.length; i++){
      layer_planes[js_selected_layers[i]].rotateY(rads);
    }
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
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
  redrawLayerLabels("all");
}

const showLayerCoords = (message) => {
  let labelCoordsSwitch = message; //message = true or false
  if (labelCoordsSwitch){
    for (let i = 0; i < layer_planes.length; i++){
      appendCoordsSystem(layer_planes[i]);
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

const setFloorOpacity = (selectedOpacity) => {
  layerOpacity = selectedOpacity;
  for (let i = 0; i < layer_planes.length; i++) {
    layer_planes[i].material.opacity = layerOpacity;
  }
  return true;
}

const showWireFrames = (wireframeFlag) => { // true or false
  for (let i = 0; i < layer_planes.length; i++) {
    layer_planes[i].material.wireframe = wireframeFlag;
  }
}

const layerColorFilePriority = (message) => {
  layerColorFromFile = message;
  for (let i = 0; i < layer_planes.length; i++){
    if (!layerColorFromFile) layer_planes[i].material.color = new THREE.Color(floorCurrentColor)
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
        if (floorDefaultColors.length > 0 && layerColorFromFile) {
          layer_planes[i/7].material.color = new THREE.Color(floorDefaultColors[i/7]);
        } else layer_planes[i/7].material.color = new THREE.Color(floorCurrentColor);
        layer_labels[i/7].style.display = "none";
      }
    }
  }
  Shiny.setInputValue("js_selected_layers", js_selected_layers);
  return true;
}
