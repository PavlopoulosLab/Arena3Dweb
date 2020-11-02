//GLOBAL VARIABLES--------------------------

//scene bounds
var xBoundMin = -window.innerWidth/2,
    xBoundMax = window.innerWidth/2,
    yBoundMin = -window.innerHeight/2.1,
    yBoundMax = window.innerHeight/2.1,
    zBoundMin = -window.innerHeight/2.5,
    zBoundMax = window.innerHeight/2.5;
//scene, camera, renderer
var scene = new THREE.Scene();
var camera = new THREE.OrthographicCamera( xBoundMin, xBoundMax, yBoundMax, yBoundMin, -4 * xBoundMax, 4 * xBoundMax );//left, right, top, bottom, near, far
camera.position.set( 0, 0, 100 );
camera.lookAt( 0, 0, 0 );
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( 2* xBoundMax , 2 * yBoundMax );

//initializing static variables
var animationRunning = false, //flag to ensure animation function only executes once!
    leftClickPressed = false, //flag to check if dragging scene
    middleClickPressed = false, //flag to check if rotating scene
    previousX = 0, //variable to calculate drag and orbit controls
    previousY = 0, //variable to calculate drag and orbit controls
    sphereRadius = 6,
    attachedCanvasControls = false,
    labelSwitch = false,
    selectedLabelSwitch = true,
    selectedLayerLabelSwitch = false,
    layerLabelSwitch = true,
    edgeWidthByWeight = true,
    wireframeFlag = false,
    nodeAttributesPriority = true,
    selectedNodeColorFlag = true,
    selectedEdgeColorFlag = true,
    edgeAttributesPriority = true,
    localLayoutFlag = false,
    layerEdgeOpacity = 0.3,
    interLayerEdgeOpacity = 0.3,
    floorOpacity = 0.3,
    fps = 30,
    max_allowed_edges = "",
    sceneDefaultColor = "#000000",
    floorDefaultColor = "#777777",
    floorCurrentColor = floorDefaultColor,
    selectedDefaultColor = "#A3FF00",
    edgeDefaultColor = "#CFCFCF";
    
//Variables that are being refreshed on new network upload/import (nodes, edges, coords)
var nodes = [], //canvas objects
    node_labels = [], //divs to be overlaid above canvas
    node_labels = [],
    node_names = [],
    node_whole_names = [],
    node_label_flags = [],
    hovered_nodes = [],
    edges = [], //canvas objects
    layerEdges = [], //canvas objects
    edge_pairs = [],
    layer_edges_pairs = [], //canvas objects
    edge_values = [],
    layerCoords = [],
    sceneCoords = ["", "", ""],
    node_groups = new Map(),
    layer_groups = new Map(),
    layer_labels = [], //divs
    layer_names = [],
    layer_node_labels_flags = [],
    x = [],
    y = [],
    z = [],
    scene_pan = "",
    scene_sphere = "",
    layer_planes = [],
    layer_spheres = [],
    selected_layers = [],
    selected_nodes = [],
    selected_edges = [],
    shiftX = "",
    shiftY = "",
    lasso = "",
    lights = [],
    ambientLight = "",
    optionsList = "",
    node_attributes = "",
    edge_attributes = "",
    last_layer_scale = [],
    timeoutF;

//280 colors
var colors = ["#63b598", "#ce7d78", "#ea9e70", "#a48a9e", "#c6e1e8", "#648177", "#0d5ac1", 
  "#f205e6", "#1c0365", "#14a9ad", "#4ca2f9", "#a4e43f", "#d298e2", "#6119d0",
  "#d2737d", "#c0a43c", "#f2510e", "#651be6", "#79806e", "#61da5e", "#cd2f00", 
  "#9348af", "#01ac53", "#c5a4fb", "#996635","#b11573", "#4bb473", "#75d89e", 
  "#2f3f94", "#2f7b99", "#da967d", "#34891f", "#b0d87b", "#ca4751", "#7e50a8", 
  "#c4d647", "#e0eeb8", "#11dec1", "#289812", "#566ca0", "#ffdbe1", "#2f1179", 
  "#935b6d", "#916988", "#513d98", "#aead3a", "#9e6d71", "#4b5bdc", "#0cd36d",
  "#250662", "#cb5bea", "#228916", "#ac3e1b", "#df514a", "#539397", "#880977",
  "#f697c1", "#ba96ce", "#679c9d", "#c6c42c", "#5d2c52", "#48b41b", "#e1cf3b",
  "#5be4f0", "#57c4d8", "#a4d17a", "#225b8", "#be608b", "#96b00c", "#088baf",
  "#f158bf", "#e145ba", "#ee91e3", "#05d371", "#5426e0", "#4834d0", "#802234",
  "#6749e8", "#0971f0", "#8fb413", "#b2b4f0", "#c3c89d", "#c9a941", "#41d158",
  "#fb21a3", "#51aed9", "#5bb32d", "#807fb", "#21538e", "#89d534", "#d36647",
  "#7fb411", "#0023b8", "#3b8c2a", "#986b53", "#f50422", "#983f7a", "#ea24a3",
  "#79352c", "#521250", "#c79ed2", "#d6dd92", "#e33e52", "#b2be57", "#fa06ec",
  "#1bb699", "#6b2e5f", "#64820f", "#1c271", "#21538e", "#89d534", "#d36647",
  "#7fb411", "#0023b8", "#3b8c2a", "#986b53", "#f50422", "#983f7a", "#ea24a3",
  "#79352c", "#521250", "#c79ed2", "#d6dd92", "#e33e52", "#b2be57", "#fa06ec",
  "#1bb699", "#6b2e5f", "#64820f", "#1c271", "#9cb64a", "#996c48", "#9ab9b7",
  "#06e052", "#e3a481", "#0eb621", "#fc458e", "#b2db15", "#aa226d", "#792ed8",
  "#73872a", "#520d3a", "#cefcb8", "#a5b3d9", "#7d1d85", "#c4fd57", "#f1ae16",
  "#8fe22a", "#ef6e3c", "#243eeb", "#1dc18", "#dd93fd", "#3f8473", "#e7dbce",
  "#421f79", "#7a3d93", "#635f6d", "#93f2d7", "#9b5c2a", "#15b9ee", "#0f5997",
  "#409188", "#911e20", "#1350ce", "#10e5b1", "#fff4d7", "#cb2582", "#ce00be",
  "#32d5d6", "#17232", "#608572", "#c79bc2", "#00f87c", "#77772a", "#6995ba",
  "#fc6b57", "#f07815", "#8fd883", "#060e27", "#96e591", "#21d52e", "#d00043",
  "#b47162", "#1ec227", "#4f0f6f", "#1d1d58", "#947002", "#bde052", "#e08c56",
  "#28fcfd", "#bb09b", "#36486a", "#d02e29", "#1ae6db", "#3e464c", "#a84a8f",
  "#911e7e", "#3f16d9", "#0f525f", "#ac7c0a", "#b4c086", "#c9d730", "#30cc49",
  "#3d6751", "#fb4c03", "#640fc1", "#62c03e", "#d3493a", "#88aa0b", "#406df9",
  "#615af0", "#4be47", "#2a3434", "#4a543f", "#79bca0", "#a8b8d4", "#00efd4",
  "#7ad236", "#7260d8", "#1deaa7", "#06f43a", "#823c59", "#e3d94c", "#dc1c06",
  "#f53b2a", "#b46238", "#2dfff6", "#a82b89", "#1a8011", "#436a9f", "#1a806a",
  "#4cf09d", "#c188a2", "#67eb4b", "#b308d3", "#fc7e41", "#af3101", "#ff065",
  "#71b1f4", "#a2f8a5", "#e23dd0", "#d3486d", "#00f7f9", "#474893", "#3cec35",
  "#1c65cb", "#5d1d0c", "#2d7d2a", "#ff3420", "#5cdd87", "#a259a4", "#e4ac44",
  "#1bede6", "#8798a4", "#d7790f", "#b2c24f", "#de73c2", "#d70a9c", "#25b67",
  "#88e9b8", "#c2b0e2", "#86e98f", "#ae90e2", "#1a806b", "#436a9e", "#0ec0ff",
  "#f812b3", "#b17fc9", "#8d6c2f", "#d3277a", "#2ca1ae", "#9685eb", "#8a96c6",
  "#dba2e6", "#76fc1b", "#608fa4", "#20f6ba", "#07d7f6", "#dce77a", "#77ecca"];


//-------------------------------------------

//FUNCTIONS----------------------------------
function clearCanvas(){
  scene = new THREE.Scene();
  nodes = [], //canvas objects
  node_labels = [];
  if (!attachedCanvasControls) document.getElementById("info").innerHTML = "1. <b>Zoom</b>: Mouse Wheel<br/>2. <b>Pan</b>: Left Click/Arrow Keys<br/>3. <b>Orbit</b>: Mouse Middle<br/>4. <b>Node Selection</b>: Ctrl + Left Click<br/>5. <b> Batch Node Selection</b>: Shift + Left Click<br/>6. <b>Unselect All</b>: Double Click"; //delete all children of info div (node label divs)
  document.getElementById("labelDiv").innerHTML = "";
  node_names = [],
  node_whole_names = [],
  node_label_flags = [],
  hovered_nodes = [],
  edges = [], //canvas objects
  layerEdges = [], //canvas objects
  edge_pairs = [],
  layer_edges_pairs = [], //canvas objects
  edge_values = [],
  layerCoords = [],
  sceneCoords = ["", "", ""],
  node_groups = new Map(),
  layer_groups = new Map(),
  layer_labels = [], //divs
  layer_names = [],
  layer_node_labels_flags = [],
  x = [],
  y = [],
  z = [],
  scene_pan = "",
  scene_sphere = "",
  layer_planes = [],
  layer_spheres = [],
  selected_layers = [],
  selected_nodes = [],
  selected_edges = [],
  shiftX = "",
  shiftY = "",
  lasso = "",
  lights = [],
  ambientLight = "",
  optionsList = "",
  node_attributes = "",
  edge_attributes = "",
  last_layer_scale = [];
  return true;
}

function setLights(){
	var sphereGeom = new THREE.SphereGeometry();
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

function addScenePanAndSphere(){
  //scene_pan_sphere to apply all translations
	var geometry = new THREE.SphereGeometry();
  var material = new THREE.MeshBasicMaterial( {color:"blue", transparent: true, opacity: 0} );
  var sphere = new THREE.Mesh( geometry, material );
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

function mapper(inArr, min, max){
  let outArr = [],
      inArr_min = Math.min.apply(Math, inArr),
      inArr_max = Math.max.apply(Math, inArr);
  for (var i = 0; i < inArr.length; i++){
    if (inArr_max - inArr_min !== 0)
      outArr.push((Number(inArr[i]) - inArr_min) * (max - min) / (inArr_max - inArr_min) + min);
    else outArr.push(0.3);
  }
  return(outArr);
}

const mapValue = (value, x1, y1, x2, y2) => (value - x1) * (y2 - x2) / (y1 - x1) + x2; //no zero division check

function exists(arr, el){
  return(arr.some(l => l == el));
}

function getAllIndexes(arr, val) {
  var indexes = [], i;
  val = val.toLowerCase(); //case insensitive
  for(i = 0; i < arr.length; i++)
    if (arr[i].toLowerCase() === val)
      indexes.push(i);
  return indexes;
}

function selectCheckedLayers(){
  selected_layers = [];
  var c = document.getElementById("checkboxdiv").children;
  for (var i = 0; i < c.length; i++){
    if (i%7 === 0){ //(c[i].type == "checkbox"){
      if (c[i].checked) selected_layers.push(i/7); //7 -> checkbox, label, checkbox2, label2, checkbox3, label3, br
    }
  }
  Shiny.setInputValue("selected_layers", selected_layers); //R monitors selected Layers to apply Layouts correctly
  return true;
}

function paintSelectedLayers(){
  selectCheckedLayers();
  for (i = 0; i < layer_planes.length; i++){
    if (exists(selected_layers, i)) layer_planes[i].material.color = new THREE.Color( "#f7f43e" );
    else {
      layer_planes[i].material.color = new THREE.Color( floorCurrentColor );
      if (!layerLabelSwitch && selectedLayerLabelSwitch) layer_labels[i].style.display = "none";
    }
  }
  return true;
}

function decideNodeLabelFlags(){
  var c = document.getElementById("checkboxdiv").children,
      node_layer = "";
  for (i = 0; i < node_names.length; i++){
    node_layer = layer_groups[node_groups[node_whole_names[i]]];
    if (c[node_layer*7+2].checked){ //1. if node's layer not hidden 
      node_label_flags[i] = false;
    } else if (labelSwitch){ //2. if showing all node labels
      node_label_flags[i] = true;
    } else if (layer_node_labels_flags[node_layer]){ //3. if showing layer node labels
      node_label_flags[i] = true;
    } else if (selectedLabelSwitch && exists(selected_nodes, i)){ //4. if showing selected node labels, and node is selected
      node_label_flags[i] = true;
    } else if (exists(hovered_nodes, i)){ //5. if hovering over node(s)
      node_label_flags[i] = true;
    } else node_label_flags[i] = false; //6. if none of the above apply, don't show label
  }
  return true;
}

function hideLayers(){
  var c = document.getElementById("checkboxdiv").children;
  //layers
  for (var i = 0; i < c.length; i++){
    if (i >= 2 && i%7 == 2){ //(c[i].type == "checkbox"){
      if (!c[i].checked) layer_planes[Math.floor(i/7)].visible = true;
      else layer_planes[Math.floor(i/7)].visible = false;
    }
  }
  //node labels
  decideNodeLabelFlags();
  return true;
}

function showLayerNodeLabels(){
  var c = document.getElementById("checkboxdiv").children;
  for (var i = 0; i < c.length; i++){
    if (i >= 2 && i%7 == 4){
      if (!c[i].checked){
        layer_node_labels_flags[Math.floor(i/7)] = false;
      } else layer_node_labels_flags[Math.floor(i/7)] = true;
    }
  }
  decideNodeLabelFlags();
  return true;
}

function attachLayerCheckboxes(){ //insert #groups Checkboxes
  var checkbox = "",
    label = "",
    br = "",
    temp = "",
    container = document.getElementById('checkboxdiv');
  container.innerHTML = ''; //clear previous checkboxes
  for(var i = 0; i < Object.getOwnPropertyNames(layer_groups).length; i++){
    checkbox = document.createElement('input'); 
    checkbox.type = "checkbox";
    checkbox.name = "checkbox".concat(i);
    checkbox.className = "checkbox_check";
    checkbox.value = i;
    checkbox.id = "checkbox".concat(i);
    checkbox.setAttribute('onclick', 'paintSelectedLayers()');
    
    label = document.createElement('label');
    label.className = "checkbox_element";
    label.htmlFor = i;
    if (layer_names[i].length > 15) temp = layer_names[i].substr(0,15).concat("..");
    else temp = layer_names[i];
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

function coordsSystem(obj){ //adding coord lines to input object
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

function coordsSystemScene(obj){ //adding coord lines to input object
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

function getRandomArbitrary(min, max) { //random float between two values
  return Math.random() * (max - min) + min;
}

function scrambleNodes(){
  for (var i = 0; i < nodes.length; i++){ //random y,z
    x.push(0);
    y.push(getRandomArbitrary(yBoundMin, yBoundMax));
    z.push(getRandomArbitrary(zBoundMin, zBoundMax));
    nodes[i].translateX(x[i]);
    nodes[i].translateY(y[i]);
    nodes[i].translateZ(z[i]);
  }
  return true;
}

function moveLayers() {
  var window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
      numLayers = layer_planes.length;
  for (var i = 0; i < numLayers; i++){
    if (numLayers % 2) layer_planes[i].translateX( (-Math.floor(layer_planes.length/2) + i) * window_width); //odd number of Layers
    else layer_planes[i].translateX( (-layer_planes.length/2 + i) * window_width + window_width/2); //even number of Layers
  }
  return true;
}

function drawEdges() {
  let index1 = 0, index2 = 0, color = "";
  for (let i = 0; i < edge_pairs.length; i++){ //random x,y,z
    color= edgeDefaultColor;
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
        if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " "){ //if node not currently selected and exists in node attributes file and color is assigned
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        } else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " "){ 
          color = edge_attributes.Color[pos2];
        }
  		}
  		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[i] } );
  		else material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: layerEdgeOpacity } );
  		let line = new THREE.Line( geometry, material );
  		layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(line);
      edges.push(line);
    } else { //identify between-layer edges
      edges.push(i); //pushing this to keep count of edges for redraw
      layer_edges_pairs.push(i);
    }
  }
  return true;
}

function drawLayerEdges() { //runs constantly on animate
  let index1 = 0, index2 = 0, color = "", pos = -1, pos1 = -1, pos2 = -1;
  var c = document.getElementById("checkboxdiv").children;
  for (let i = 0; i < layer_edges_pairs.length; i++){
    scene.remove(layerEdges[i]);
    color= edgeDefaultColor;
    let points = [];
    let edge_split = edge_pairs[layer_edges_pairs[i]].split("---");
    var node_layer1 = layer_groups[node_groups[edge_split[0]]];
    var node_layer2 = layer_groups[node_groups[edge_split[1]]];
    if (!c[node_layer1*7+2].checked && !c[node_layer2*7+2].checked){
      index1 = node_whole_names.indexOf(edge_split[0]);
      index2 = node_whole_names.indexOf(edge_split[1]);
      points.push( nodes[index1].getWorldPosition(new THREE.Vector3()), nodes[index2].getWorldPosition(new THREE.Vector3()) );
  		let geometry = new THREE.BufferGeometry().setFromPoints( points );
  		let material = "";
  		if (exists(selected_edges, layer_edges_pairs[i]) && selectedEdgeColorFlag) color = selectedDefaultColor;
  		else if (edge_attributes !== "" && edgeAttributesPriority){
  		  pos = edges.indexOf(layer_edges_pairs[i]);
  		  pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[pos]);
  		  pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[pos]);
  		  if ( pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " ") color = edge_attributes.Color[pos1];
  		  else if ( pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " ") color = edge_attributes.Color[pos2];
  		}
  		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[layer_edges_pairs[i]] } );
  		else material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: interLayerEdgeOpacity } );
  		let line = new THREE.Line( geometry, material );
  		scene.add(line);
      layerEdges[i] = line;
    }
  }
  return true;
}

function redrawEdges() {
  let index1 = 0, index2 = 0, color = "", pos = -1, pos1 = -1, pos2 = -1;
  for (var i = 0; i < edge_pairs.length; i++){
    color = edgeDefaultColor;
    let edge_split = edge_pairs[i].split("---");
    index1 = node_whole_names.indexOf(edge_split[0]);
    index2 = node_whole_names.indexOf(edge_split[1]);
    if (node_groups[node_whole_names[index1]] == node_groups[node_whole_names[index2]]){ //(exists(selected_nodes, index1) || exists(selected_nodes, index2)) &&
      let points = [];
      layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].remove(edges[i]);
  		points.push( nodes[index1].position, nodes[index2].position );
  		let geometry = new THREE.BufferGeometry().setFromPoints( points );
  		let material = "";
  		if (exists(selected_edges, i) && selectedEdgeColorFlag) color = selectedDefaultColor;
  		else if (edge_attributes !== "" && edgeAttributesPriority){
  		  pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
        pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);
        if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " "){//if node not currently selected and exists in node attributes file and color is assigned
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        } else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " "){ 
          color = edge_attributes.Color[pos2];
        }
  		}
  		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[i]}  );
  		else material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: layerEdgeOpacity}  );
  		let line = new THREE.Line( geometry, material );
  		layer_planes[layer_groups[node_groups[node_whole_names[index1]]]].add(line);
      edges[i] = line;
    }
  }
  return true;
}

function createLabels() {
  //nodes
  for (var i = 0; i < nodes.length; i++){
    var div = document.createElement('div');
    div.textContent = node_names[i];
    div.setAttribute('class', 'labels');
    div.setAttribute('id', node_whole_names[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    node_labels.push(div);
    node_labels[i].style.display = "none"; //hiding labels on creation
  }
  //layers
  for (i = 0; i < layer_names.length; i++){
    var div = document.createElement('div');
    div.textContent = layer_names[i];
    div.setAttribute('class', 'layer-labels');
    div.setAttribute('id', layer_names[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    layer_labels.push(div);
    layer_labels[i].style.display = "inline-block"; //hiding labels on creation
  }
  return true;
}

function redrawLayerLabels() {
  var  layerX = "",
       layerY = "",
       labelX = "",
       labelY = "",
       c = document.getElementById("checkboxdiv").children;
  for (var i = 0; i < layer_names.length; i++){
    if (!c[i*7+2].checked){ //if node's layer not hidden
      layerX = layer_spheres[i].getWorldPosition(new THREE.Vector3()).x,
      layerY = layer_spheres[i].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + layerX;
      labelY = yBoundMax - layerY;
      layer_labels[i].style.left = labelX.toString().concat("px");
      layer_labels[i].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      var canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth) layer_labels[i].style.display = "none";
      else layer_labels[i].style.display = "inline-block";
    } else layer_labels[i].style.display = "none";
  }
  return true;
}

function redrawSelectedLayerLabels() {
  var  layerX = "",
       layerY = "",
       labelX = "",
       labelY = "",
       c = document.getElementById("checkboxdiv").children;
  for (var i = 0; i < selected_layers.length; i++){
    if (!c[i*7+2].checked){ //if node's layer not hidden
      layerX = layer_spheres[selected_layers[i]].getWorldPosition(new THREE.Vector3()).x,
      layerY = layer_spheres[selected_layers[i]].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + layerX;
      labelY = yBoundMax - layerY;
      layer_labels[selected_layers[i]].style.left = labelX.toString().concat("px");
      layer_labels[selected_layers[i]].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      var canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth) layer_labels[selected_layers[i]].style.display = "none";
      else layer_labels[selected_layers[i]].style.display = "inline-block";
    } else layer_labels[selected_layers[i]].style.display = "none";
  }
  return true;
}

function renderNodeLabels(){
  var nodeX = "",
      nodeY = "",
      labelX = "",
      labelY = "";
  for (var i = 0; i < node_label_flags.length; i++){
    var node_layer = layer_groups[node_groups[node_whole_names[i]]];
    if (node_label_flags[i]){ //ONLY CHECK THIS 
      nodeX = nodes[i].getWorldPosition(new THREE.Vector3()).x,
      nodeY = nodes[i].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + nodeX + 7;
      labelY = yBoundMax - nodeY - 10;
      node_labels[i].style.left = labelX.toString().concat("px");
      node_labels[i].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      var canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth) node_labels[i].style.display = "none";
      else node_labels[i].style.display = "inline-block";
    } else node_labels[i].style.display = "none";
  }
  return true;
}

function animate() {
  animationRunning = true;
  setTimeout( function() { //limiting FPS
    requestAnimationFrame( animate ); //pauses when the user navigates to another browser tab
  }, 1000 / fps );
  renderNodeLabels();
  if (layerLabelSwitch) redrawLayerLabels();
  else if (selectedLayerLabelSwitch && selected_layers !== []) redrawSelectedLayerLabels();
  drawLayerEdges();
	renderer.render( scene, camera );
	return true;
}

function loadGraph(){
  setLights();
	addScenePanAndSphere();
  //create layer planes
  var layerSphereGeometry = new THREE.SphereGeometry( 0 );
  var layerSphereMaterial = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0.5} );
  for(var i = 0; i < Object.getOwnPropertyNames(layer_groups).length; i++){
    var planeGeom = new THREE.PlaneGeometry(2*yBoundMax, 2*yBoundMax, 8, 8);
    planeGeom.rotateY(THREE.Math.degToRad(90));
    floorCurrentColor = floorDefaultColor;
    var planeMat = new THREE.MeshBasicMaterial({
      color: floorDefaultColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: floorOpacity,
      side: THREE.DoubleSide,
    });
    var plane = new THREE.Mesh(planeGeom, planeMat);
    var sphere = new THREE.Mesh( layerSphereGeometry, layerSphereMaterial );
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
    geometry = new THREE.SphereGeometry( sphereRadius, 4, 3 ); //default width and height segments -> 8,6
    material = new THREE.MeshStandardMaterial( {color: colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length], transparent: true} ); //standard material allows light reaction
    sphere = new THREE.Mesh( geometry, material );
    nodes.push(sphere);
    layer_planes[layer_groups[node_groups[node_whole_names[i]]]].add(sphere); //attaching to corresponding layer centroid
  }
  
  scrambleNodes();
  moveLayers();
  drawEdges();
  createLabels();
  scene_sphere.rotation.x = THREE.Math.degToRad(15); //starting a little tilted so layers as visible
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
  return true;
}

function sceneZoom(event){
  if (scene_pan != "") {
    var new_scale = scene_pan.scale.x;
    if (event.deltaY < 0 && new_scale < 2) new_scale = new_scale * 1.1;
    else if (event.deltaY > 0 && new_scale > 0.2) new_scale = new_scale * 0.9;
    scene_pan.scale.set(new_scale, new_scale, new_scale);
    updateScenePanRShiny();
  }
  return true;
}

function sceneArrowPan(event){
  if (scene_pan != "") {
    if (event.keyCode == 37) scene_pan.translateX(-25); //left
    if (event.keyCode == 38) scene_pan.translateY(25); //up
    if (event.keyCode == 39) scene_pan.translateX(25); //right
    if (event.keyCode == 40) scene_pan.translateY(-25); // down
    updateScenePanRShiny();
  }
  return true;
}

function sceneDragPan(x, y){
  scene_pan.translateX(x - previousX);
  scene_pan.translateY(previousY - y);
  updateScenePanRShiny();
  return true;
}

function lassoSelectNodes(x, y){
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
  for (var i = 0; i < nodes.length; i++){
    var nodeX = nodes[i].getWorldPosition(new THREE.Vector3()).x;
    var nodeY = nodes[i].getWorldPosition(new THREE.Vector3()).y;
    if (nodeX < maxX && nodeX > minX && nodeY < maxY && nodeY > minY){
      nodes[i].material.opacity = 0.5;
    } else {
      nodes[i].material.opacity = 1;
    }
  }
  return true;
}

function sceneOrbit(x, y){
  if (scene_sphere != ""){
    if (x - previousX < 0) scene_sphere.rotateY(0.05); 
    if (x - previousX > 0) scene_sphere.rotateY(-0.05);
    if (y - previousY < 0) scene_sphere.rotateX(-0.05);
    if (y - previousY > 0) scene_sphere.rotateX(0.05);
    updateSceneSphereRShiny();
  }
  return true;
}

function checkNodeInteraction(e){
  if (event.ctrlKey) {
    for (var i = 0; i < nodes.length; i++){
      var nodeX = xBoundMax + nodes[i].getWorldPosition(new THREE.Vector3()).x;
      var nodeY = yBoundMax - nodes[i].getWorldPosition(new THREE.Vector3()).y;
      if (Math.pow(nodeX - e.layerX, 2) + Math.pow(nodeY - e.layerY, 2) <= Math.pow(sphereRadius, 2)){
        if (exists(selected_nodes, i)){
          if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
            pos = node_attributes.Node.indexOf(node_whole_names[i]);
            if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
              nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
            else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
          } else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
          selected_nodes = selected_nodes.filter(function(value, index, arr){ return value != i;}); //array remove/filter
        } else {
          selected_nodes.push(i);
          if (selectedNodeColorFlag) nodes[i].material.color = new THREE.Color( selectedDefaultColor );
        }
      }
    }
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
  }
  return true;
}

function checkHoverOverNode(e, x, y){
  var c = document.getElementById("checkboxdiv").children,
      node_layer = "",
      event_flag = false; //for performance optimization
  for (var i = 0; i < nodes.length; i++){
    node_layer = layer_groups[node_groups[node_whole_names[i]]];
    if (!c[node_layer*7+2].checked){ //if layer hidden, do nothing here 
      var nodeX = xBoundMax + nodes[i].getWorldPosition(new THREE.Vector3()).x;
      var nodeY = yBoundMax - nodes[i].getWorldPosition(new THREE.Vector3()).y;
      if (Math.pow(nodeX - e.layerX, 2) + Math.pow(nodeY - e.layerY, 2) <= Math.pow(sphereRadius, 2)){
        if (!exists(hovered_nodes, i)) hovered_nodes.push(i);
        nodes[i].material.opacity = 0.5;
        event_flag = true;
      } else if (nodes[i].material.opacity == 0.5){ //performance optimization
        hovered_nodes = hovered_nodes.filter(function(value, index, arr){ return value != i;});
        nodes[i].material.opacity = 1;
        event_flag = true;
      }
    }
  }
  if (event_flag) decideNodeLabelFlags(); //performance optimization
  return true;
}

function clickDown(event){
  if (scene_pan != "") {
    //console.log(event); //mouse: 0 left, 1 middle, 2 right click
    if (event.button == 0){
      leftClickPressed = true;
      middleClickPressed = false;
      checkNodeInteraction(event);
      if (event.shiftKey && shiftX == ""){
        shiftX = event.layerX - xBoundMax;
        shiftY = yBoundMax - event.layerY; //then implementing drag
      }
    } else if (event.button == 1){
      middleClickPressed = true;
      leftClickPressed = false;
    } else{
      middleClickPressed = false;
      leftClickPressed = false;
    }
  }
  return true;
}

function clickDrag(event){
  if (scene_pan != "") {
    var x = event.screenX,
        y = event.screenY;
    if (leftClickPressed){
      if (event.shiftKey) lassoSelectNodes(event.layerX - xBoundMax, yBoundMax - event.layerY);
      if (!event.shiftKey && !event.ctrlKey) sceneDragPan(x, y);
    } else if (middleClickPressed){
      event.preventDefault();
      sceneOrbit(x, y);
    } else checkHoverOverNode(event, x, y);
    previousX = x;
    previousY = y;
  }
  return true;
}

function clickUp(event){
  if (scene_pan != "") {;
    if (event.button == 0){
      leftClickPressed = false;
      if (optionsList != ""){
        document.getElementById("labelDiv").removeChild(optionsList);
        optionsList = "";
      }
      if (lasso != 0){
        for (var i = 0; i < nodes.length; i++){
          if (nodes[i].material.opacity == 0.5){
            nodes[i].material.opacity = 1;
            if (!exists(selected_nodes, i)){
              selected_nodes.push(i);
              if (selectedNodeColorFlag) nodes[i].material.color = new THREE.Color( selectedDefaultColor );
            }
          }
        }
        decideNodeLabelFlags();
        updateSelectedNodesRShiny();
      }
      shiftX = "";
      shiftY = "";
      scene.remove(lasso);
      lasso = "";
    } else if (event.button == 1){
      middleClickPressed = false;
    }
  }
  return true;
}

function dblClick(event){
  if (scene_pan != "") {
    selected_nodes = [],
    selected_edges = [];
    var pos1 = pos2 = pos3 = -1;
    for (var i = 0; i < nodes.length; i++){
      if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
        pos = node_attributes.Node.indexOf(node_whole_names[i]);
        if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
          nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
        else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
      } else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
    }
    decideNodeLabelFlags();
    for (i = 0; i < edges.length; i++){
      if (edge_attributes !== "" && edgeAttributesPriority){ //check if color is overidden by user
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
        else{
          if (typeof(edges[i]) == "number") {
            pos3 = layer_edges_pairs.indexOf(i);
            layerEdges[pos3].material.color = new THREE.Color( edgeDefaultColor );
          } else edges[i].material.color = new THREE.Color( edgeDefaultColor );
        }
      } else{
        if (typeof(edges[i]) == "number") {
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edgeDefaultColor );
        } else edges[i].material.color = new THREE.Color( edgeDefaultColor );
      } 
    }
    updateSelectedNodesRShiny();
  }
  return true;
}

function executeCommand(item){
  //console.log(item.options[item.selectedIndex].text);
  if (item.options[item.selectedIndex].text == "Select Neighbors"){ //select neighbors
    var pos = -1;
    for (let i = 0; i < edge_pairs.length; i++){ //random x,y,z
      let edge_split = edge_pairs[i].split("---");
      index1 = node_whole_names.indexOf(edge_split[0]);
      index2 = node_whole_names.indexOf(edge_split[1]);
      if (index1 == item.value){
        if (!exists(selected_nodes, index2)){
          selected_nodes.push(index2);
          if (selectedNodeColorFlag) nodes[index2].material.color = new THREE.Color( selectedDefaultColor );
        }
        if (!exists(selected_edges, i)){
          selected_edges.push(i);
            if (selectedEdgeColorFlag){
              if (typeof(edges[i]) == "number") {
                pos = layer_edges_pairs.indexOf(i);
                layerEdges[pos].material.color = new THREE.Color( selectedDefaultColor );
              } else edges[i].material.color = new THREE.Color( selectedDefaultColor );
            }
        }
      } else if (index2 == item.value){
        if (!exists(selected_nodes, index1)){
          selected_nodes.push(index1);
          if (selectedNodeColorFlag) nodes[index1].material.color = new THREE.Color( selectedDefaultColor );
        }
        if (!exists(selected_edges, i)){
          selected_edges.push(i);
          if (selectedEdgeColorFlag){
            if (typeof(edges[i]) == "number") {
              pos = layer_edges_pairs.indexOf(i);
              layerEdges[pos].material.color = new THREE.Color( selectedDefaultColor );
            } else edges[i].material.color = new THREE.Color( selectedDefaultColor );
          }
        }
      }
    }
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
  } else if (item.options[item.selectedIndex].text == "Select MultiLayer Path"){
    var tempSelectedNodes = [],
        checkedNodes = [],
        flag = false,
        currentNode = item.value,
        startingLayer = node_groups[node_whole_names[currentNode]];
    startLoader(true);
    while (!flag){
      var pos = -1;
      for (let i = 0; i < edge_pairs.length; i++){
        let edge_split = edge_pairs[i].split("---");
        index1 = node_whole_names.indexOf(edge_split[0]);
        index2 = node_whole_names.indexOf(edge_split[1]);
        if (index1 == currentNode && node_groups[node_whole_names[index2]] != startingLayer && node_groups[node_whole_names[index2]] != node_groups[node_whole_names[index1]] && !(exists(tempSelectedNodes, index2))){ //path must not contain other nodes in starting layer or its own layer
          tempSelectedNodes.push(index2);
          // code from Select neighbors above
          if (!exists(selected_nodes, index2)){
            selected_nodes.push(index2);
            if (selectedNodeColorFlag) nodes[index2].material.color = new THREE.Color( selectedDefaultColor );
          }
          if (!exists(selected_edges, i)){
            selected_edges.push(i);
            if (selectedEdgeColorFlag){
              if (typeof(edges[i]) == "number") {
                pos = layer_edges_pairs.indexOf(i);
                layerEdges[pos].material.color = new THREE.Color( selectedDefaultColor );
              } else edges[i].material.color = new THREE.Color( selectedDefaultColor );
            }
          } //until here
        } else if (index2 == currentNode && node_groups[node_whole_names[index1]] != startingLayer && node_groups[node_whole_names[index2]] != node_groups[node_whole_names[index1]] && !(exists(tempSelectedNodes, index1))){
          tempSelectedNodes.push(index1);
          // code from Select neighbors above
          if (!exists(selected_nodes, index1)){
            selected_nodes.push(index1);
            if (selectedNodeColorFlag) nodes[index1].material.color = new THREE.Color( selectedDefaultColor );
          }
          if (!exists(selected_edges, i)){
            selected_edges.push(i);
            if (selectedEdgeColorFlag){
              if (typeof(edges[i]) == "number") {
                pos = layer_edges_pairs.indexOf(i);
                layerEdges[pos].material.color = new THREE.Color( selectedDefaultColor );
              } else edges[i].material.color = new THREE.Color( selectedDefaultColor );
            }
          } //until here
        }
      }
      //decide flag for exit, if no new nodes 
      checkedNodes.push(currentNode);
      let difference = tempSelectedNodes.filter(x => !checkedNodes.includes(x));
      if (difference.length === 0) flag = true;
      else currentNode = difference[0];
    }
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
    finishLoader(true);
  } else if (item.options[item.selectedIndex].text == "Link") window.open(item.value);
  else if (item.options[item.selectedIndex].text == "Description"){
    var descrDiv = document.getElementById("descrDiv"),
        p = descrDiv.getElementsByTagName('p')[0];
    p.innerHTML = item.value;
    descrDiv.style.display ="inline-block";
  }
  return true;
}

function replaceContextMenuOverNode(evt) { //right mouse click
  if (optionsList != ""){
    document.getElementById("labelDiv").removeChild(optionsList);
    optionsList = "";
  }
  var pos = "";
  for (var i = 0; i < nodes.length; i++){
    var nodeX = xBoundMax + nodes[i].getWorldPosition(new THREE.Vector3()).x;
    var nodeY = yBoundMax - nodes[i].getWorldPosition(new THREE.Vector3()).y;
    if (Math.pow(nodeX - evt.layerX, 2) + Math.pow(nodeY - evt.layerY, 2) <= Math.pow((sphereRadius+1), 2)){
      evt.preventDefault();
      //creating list and appending to 3d-graph div
      optionsList = document.createElement("select");
      optionsList.setAttribute('class', 'optionsBox');
      optionsList.setAttribute('id', 'mySelect');
      optionsList.setAttribute('onchange', 'executeCommand(this)');
      optionsList.style.left = nodeX.toString().concat("px");
      optionsList.style.top = nodeY.toString().concat("px");
      optionsList.style.display = "inline-block";
      var option = document.createElement("option");
      option.value = ""; //option 0
      option.text = "-";
      optionsList.appendChild(option);
      option = document.createElement("option");
      option.value = i; //option 1
      option.text = "Select Neighbors";
      optionsList.appendChild(option);
      option = document.createElement("option");
      option.value = i; //option 2
      option.text = "Select MultiLayer Path";
      optionsList.appendChild(option);
      if (node_attributes !== ""){
        pos = node_attributes.Node.indexOf(node_whole_names[i]);
        if (pos > -1){
          if (node_attributes.Url !== undefined && node_attributes.Url[pos] !== "" && node_attributes.Url[pos] != " " && node_attributes.Url[pos] != null){
            option = document.createElement("option");
            option.value = node_attributes.Url[pos];
            option.text = "Link"; //option 3
            optionsList.appendChild(option);
          }
          if (node_attributes.Description !== undefined && node_attributes.Description[pos] !== "" && node_attributes.Description[pos] != " " && node_attributes.Description[pos] != null){
            option = document.createElement("option");
            option.value = node_attributes.Description[pos];
            //option.name = i;
            option.text = "Description"; //option 4
            optionsList.appendChild(option);
          }
        }
      }
      document.getElementById("labelDiv").appendChild(optionsList);
      break;
    }
  }
  return true;
}

function canvasRescale() {
  xBoundMin = -window.innerWidth/2,
  xBoundMax = window.innerWidth/2,
  yBoundMin = -window.innerHeight/2.1,
  yBoundMax = window.innerHeight/2.1,
  zBoundMin = -window.innerHeight/2.5,
  zBoundMax = window.innerHeight/2.5;
  camera = new THREE.OrthographicCamera( xBoundMin, xBoundMax, yBoundMax, yBoundMin, -4 * xBoundMax, 4 * xBoundMax );
  camera.position.set( 0, 0, 100 );
  camera.lookAt( 0, 0, 0 );
  renderer.setSize( 2* xBoundMax , 2 * yBoundMax );
  scene.remove( lights[0] );
  scene.remove( lights[1] );
  scene.remove(ambientLight);
  lights = [];
  ambientLight = "";
  setLights();
  return true;
}

function sceneColor(){
  renderer.setClearColor(document.getElementById("scene_color").value);
  updateScenePanRShiny();
  return true;
}

function floorColor(){
  for (var i=0; i < layer_planes.length; i++){
    floorCurrentColor = document.getElementById("floor_color").value 
    layer_planes[i].material.color = new THREE.Color( floorCurrentColor );
  }
  updateLayersRShiny();
  return true;
}

function selectSearchedNodes(event){
  if (scene_pan != "") {
    var key = window.event.keyCode;
    // If the user has pressed enter
    if (key === 13) {
      event.preventDefault(); //bypassing newline enter
      startLoader(true);
      var searchString = document.getElementById("searchBar").value.replace(/\n/g, ""),
          tempIndexes, i, j;
      searchString = searchString.split(",");
      for (i=0; i<searchString.length; i++){
        tempIndexes = getAllIndexes(node_names, searchString[i].trim()) //case insensitive function
        if (tempIndexes.length > 0){
          for (j=0; j < tempIndexes.length; j++){
            if (!exists(selected_nodes, tempIndexes[j])){
              selected_nodes.push(tempIndexes[j]);
              if (selectedNodeColorFlag) nodes[tempIndexes[j]].material.color = new THREE.Color( selectedDefaultColor );
            }
          }
        }
      }
      decideNodeLabelFlags();
      updateSelectedNodesRShiny();
      finishLoader(true);
    }
  }
  return true;
}

document.addEventListener('DOMContentLoaded', function() {
  var canvas_div = document.getElementById("3d-graph");
  canvas_div.style.position='fixed'; //to scroll down togetehr with the page
  canvas_div.appendChild( renderer.domElement ); //create canvas element once
  //remove default scroll controls while hovering on canvas div
  canvas_div.addEventListener("keydown", function(e) { //removing scroll controls from arrows
      // space and arrow keys
      if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
          e.preventDefault();
      }
  }, false);
  canvas_div.addEventListener("mousedown", function(e) { //removing scroll controls from mouse wheel and middle click navigation
      // middle mouse click
      if(e.button == 1) {
          e.preventDefault();
      }
  }, false);
  canvas_div.addEventListener("mousewheel", function(e) { //removing scroll controls from mouse wheel and middle click navigation
      e.preventDefault(); // mouse wheel
  }, false);
  
  var canvas = document.getElementsByTagName("canvas")[0];
  canvas.tabIndex = 1; //default value = -1, giving focus on canvas so it can register keydown events
  canvas.addEventListener("wheel", sceneZoom);
  canvas.addEventListener("keydown", sceneArrowPan);
  canvas.addEventListener('mousedown', clickDown);
  canvas.addEventListener('mousemove', clickDrag);
  canvas.addEventListener('mouseup', clickUp);
  canvas.addEventListener('dblclick', dblClick);
  canvas.addEventListener('contextmenu', replaceContextMenuOverNode); //implementing right click toolbox over nodes

  document.getElementsByClassName("row")[0].children[0].addEventListener("mouseleave", clickUp); //release mouse buttons on network div exit

  window.onresize = canvasRescale;
  
  //node description div
  var descrDiv = document.getElementById("descrDiv");
  var btn = document.createElement("button");
  btn.id = "closeButton";
  btn.innerHTML = "X";
  btn.onclick = function(){
    descrDiv.style.display = "none";
    return true;
  };
  var p = document.createElement('p');
  p.className = "descrDiv_paragraph";
  descrDiv.appendChild(btn);
  descrDiv.appendChild(p);
  
  //scene colorpicker
  var sceneColorDiv = document.getElementById("sceneColorPicker");
  sceneColorDiv.innerHTML = '<input type="color" id="scene_color" name="scene_color" value="'.concat(sceneDefaultColor).concat('" onchange="sceneColor()"> <label for="scene_color">Background Color</label>');
  //floor colorpicker
  var floorColorDiv = document.getElementById("floorColorPicker");
  floorColorDiv.innerHTML = '<input type="color" id="floor_color" name="floor_color" value="'.concat(floorDefaultColor).concat('" onchange="floorColor()"> <label for="floor_color">Floor Color</label>');
  
  //searchbar
  var searchBar = document.getElementById("searchBar");
  searchBar.onkeypress = selectSearchedNodes;
  
  document.getElementById("helpDiv").innerHTML='<object type="text/html" data="help.html" id="helpObject" ></object>';
  
}, false);
        