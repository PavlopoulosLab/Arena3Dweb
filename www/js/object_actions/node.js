const createNodeObjects = () => {
  let nodeColor, sphere;
  for (let i = 0; i < nodeLayerNames.length; i++) {
    nodeColor = nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[i]]]) % nodeColorVector.length];
    sphere = createNodeObject(nodeColor);
    layers[layerGroups[nodeGroups[nodeLayerNames[i]]]].plane.add(sphere);
  }
};

const createNodeObject = (nodeColor) => {
  let geometry, material, sphere;
  geometry = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_WIDTHSEGMENTS, SPHERE_HEIGHTSEGMENTS);
  material = new THREE.MeshStandardMaterial({
    color: nodeColor,
    transparent: true
  });
  sphere = new THREE.Mesh(geometry, material);
  nodes.push(sphere);
  return(sphere);
};

const scrambleNodes = (yMin = yBoundMin, yMax = yBoundMax, // TODO remove parameters
    zMin = zBoundMin, zMax = zBoundMax) => {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].translateY(getRandomArbitrary(yMin, yMax)); // TODO and do this: node.getLayer.getWidth() * scale(?)
      nodes[i].translateZ(getRandomArbitrary(zMin, zMax));
    }
};

// Called from mouse move event
// @return bool
const checkHoverOverNode = (event) => {
  setRaycaster(event);
  let intersects = RAYCASTER.intersectObjects(nodes),
    event_flag = false, //for performance optimization
    index,
    hover_flag = false;
    
  if (intersects.length > 0) {
    hover_flag = true;
    
    if (last_hovered_node_index !== ""){
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
    if (last_hovered_node_index !== ""){
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
const checkNodeInteraction = (event) => {
  setRaycaster(event);
  let intersects = RAYCASTER.intersectObjects(nodes);
  let node_selection = false;
  if (intersects.length > 0) {
    node_selection = true;
    let ind = findIndexByUuid(nodes, intersects[0].object.uuid);
    if (exists(selectedNodePositions, ind)){
      if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
        pos = node_attributes.Node.indexOf(nodeLayerNames[ind]);
        if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
          nodes[ind].material.color = new THREE.Color( node_attributes.Color[pos] );
        else nodes[ind].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[ind]]])%nodeColorVector.length]);
      } else nodes[ind].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[ind]]])%nodeColorVector.length]);
      selectedNodePositions = selectedNodePositions.filter(function(value, index, arr){ return value != ind;}); //array remove/filter
    } else {
      selectedNodePositions.push(ind);
      if (selectedNodeColorFlag) nodes[ind].material.color = new THREE.Color( selectedDefaultColor );
    }
  }

  decideNodeLabelFlags();
  updateSelectedNodesRShiny();
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
    
  if (e.screenX - e.screenY >=  mousePreviousX - mousePreviousY) step = 20;
  else step =-20;
  
  if (scene.axisPressed=="z"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateZ(step);
    }
  /*} else if (scene.axisPressed=="x"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateX(step);
    }*/
  } else if (scene.axisPressed=="c"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateY(step);
    }
  }
  redrawEdges();
  updateNodesRShiny();
}

// logic behind node label show/hide
const decideNodeLabelFlags = () => {
  let hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox"),
      node_layer = "";
  for (i = 0; i < nodeNames.length; i++) {
    node_layer = layerGroups[nodeGroups[nodeLayerNames[i]]];
    if (hidelayerCheckboxes[node_layer].checked){ //1. if node's layer not hidden 
      nodeLabelFlags[i] = false;
    } else if (showAllNodeLabelsFlag){ //2. if showing all node labels
      nodeLabelFlags[i] = true;
    } else if (layers[node_layer].showNodeLabels) { //3. if showing layer node labels
      nodeLabelFlags[i] = true;
    } else if (showSelectedNodeLabelsFlag && exists(selectedNodePositions, i)){ //4. if showing selected node labels, and node is selected
      nodeLabelFlags[i] = true;
    } else if (exists(hovered_nodes, i)){ //5. if hovering over node(s)
      nodeLabelFlags[i] = true;
    } else nodeLabelFlags[i] = false; //6. if none of the above apply, don't show label
  }
  return true;
}      

const nodeAttributes = (message) => {
  node_attributes = message;
  let pos;
  for (let i = 0; i < nodes.length; i++){
    pos = node_attributes.Node.indexOf(nodeLayerNames[i]);
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
        pos = node_attributes.Node.indexOf(nodeLayerNames[i]);
        if(checkIfAttributeColorExist(node_attributes, pos)) //if node exists in node attributes file
          nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
        else nodes[i].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[i]]])%nodeColorVector.length]);
      } else if (nodes[i].userData.cluster)  nodes[i].material.color = new THREE.Color(nodeColorVector[nodes[i].userData.cluster]);
      else nodes[i].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[i]]]) % nodeColorVector.length]);
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
      pos = node_attributes.Node.indexOf(nodeLayerNames[selectedNodePositions[i]]);
      if(checkIfAttributeColorExist(node_attributes, pos))//if node exists in node attributes file
        nodes[selectedNodePositions[i]].material.color = new THREE.Color( node_attributes.Color[pos] );
      else nodes[selectedNodePositions[i]].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[selectedNodePositions[i]]]])%nodeColorVector.length]);
    } else nodes[selectedNodePositions[i]].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[selectedNodePositions[i]]]])%nodeColorVector.length]);
  }
  return true;
}

const spreadNodes = () => {
  if (selectedNodePositions.length == 0) alert("Please select at least one node.");
  else{
    for (let i=0;i<selectedNodePositions.length;i++){
      nodes[selectedNodePositions[i]].position.y = nodes[selectedNodePositions[i]].position.y * 1.1;
      nodes[selectedNodePositions[i]].position.z = nodes[selectedNodePositions[i]].position.z * 1.1;
    }
    updateNodesRShiny();
    redrawEdges();
  }
}

const congregateNodes = () => {
  if (selectedNodePositions.length == 0) alert("Please select at least one node.");
  else{
    for (let i=0;i<selectedNodePositions.length;i++){
      nodes[selectedNodePositions[i]].position.y = nodes[selectedNodePositions[i]].position.y * 0.9;
      nodes[selectedNodePositions[i]].position.z = nodes[selectedNodePositions[i]].position.z * 0.9;
    }
    updateNodesRShiny();
    redrawEdges();
  }
}

const moveNodes = (direction, axis) => {
  if (selectedNodePositions.length == 0)
    alert("Please select at least one node.");
  else {
    nodeIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[4].value;
      value = direction * value;
      for (let i = 0; i < selectedNodePositions.length; i++){
        if (axis == "X")
          nodes[selectedNodePositions[i]].translateX(value);
        else if (axis == "Y")
          nodes[selectedNodePositions[i]].translateY(value);
        else if (axis == "Z")
          nodes[selectedNodePositions[i]].translateZ(value);
      }
      redrawEdges();
      updateNodesRShiny();
    }, 70);
  }
}

const scaleNodes = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[5],
    td = document.getElementById("sliderValue6");
  td.innerHTML = "x".concat(cavnasSlider.value);
  if (selectedNodePositions.length == 0) alert("Please select at least one node.");
  else{
    for (let i = 0; i < selectedNodePositions.length; i++) {
      nodes[selectedNodePositions[i]].scale.x = nodes[selectedNodePositions[i]].scale.y = 
        nodes[selectedNodePositions[i]].scale.z = parseFloat(cavnasSlider.value);
    }
    updateNodesRShiny();
  }
}

// on node searchbar key-press
const selectSearchedNodes = (event) => {
  if (scene.exists()) {
    var key = window.event.keyCode;
    // If the user has pressed enter
    if (key === 13) {
      event.preventDefault(); //bypassing newline enter
      startLoader(true);
      var searchString = document.getElementById("searchBar").value.replace(/\n/g, ""),
          tempIndexes, i, j;
      searchString = searchString.split(",");
      for (i=0; i<searchString.length; i++){
        tempIndexes = getCaseInsensitiveIndices(nodeNames, searchString[i].trim()) //case insensitive function
        if (tempIndexes.length > 0){
          for (j=0; j < tempIndexes.length; j++){
            if (!exists(selectedNodePositions, tempIndexes[j])){
              selectedNodePositions.push(tempIndexes[j]);
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
}

const createNodeDescriptionDiv = () => {
    let descrDiv = document.getElementById("descrDiv"),
        btn = document.createElement("button");
    btn.id = "closeButton";
    btn.innerHTML = "X";
    btn.onclick = function() {
        descrDiv.style.display = "none";
    };
    let p = document.createElement('p');
    p.className = "descrDiv_paragraph";
    descrDiv.appendChild(btn);
    descrDiv.appendChild(p);
};

const unselectAllNodes = () => {
  selectedNodePositions = [],
  selected_edges = [];
  decideNodeColors();
  decideNodeLabelFlags();
};

const decideNodeColors = () => {
  for (let i = 0; i < nodes.length; i++) {
    if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
      pos = node_attributes.Node.indexOf(nodeLayerNames[i]);
      if (pos > -1 && node_attributes.Color !== undefined &&
        node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
          nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
      else
        nodes[i].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[i]]])%nodeColorVector.length]);
    } else if (nodes[i].userData.cluster)
      nodes[i].material.color = new THREE.Color(nodeColorVector[nodes[i].userData.cluster]);
    else
      nodes[i].material.color = new THREE.Color(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[i]]]) % nodeColorVector.length]);
  }
};
