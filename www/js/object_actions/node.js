// Object Initialization =====
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

const createNodeObjects = () => {
  let nodeColor; // sphere
  for (let i = 0; i < nodeLayerNames.length; i++) {
    nodeColor = nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[i]]]) % nodeColorVector.length];
    nodeObjects.push(new Node({id: i, name: nodeNames[i], layer: nodeGroups[nodeLayerNames[i]],
      nodeLayerName: nodeLayerNames[i], color: nodeColor}));
    layers[layerGroups[nodeGroups[nodeLayerNames[i]]]].addNode(nodeObjects[i].sphere);
  }
  nodeNames = undefined; // releasing ram
};

const scrambleNodes = (yMin = yBoundMin, yMax = yBoundMax, // TODO remove parameters
    zMin = zBoundMin, zMax = zBoundMax) => {
    for (let i = 0; i < nodeObjects.length; i++) {
      nodeObjects[i].translateY(getRandomArbitrary(yMin, yMax)); // TODO and do this: node.getLayer.getWidth() * scale(?)
      nodeObjects[i].translateZ(getRandomArbitrary(zMin, zMax));
    }
};


// Event Listeners =====
const checkHoverOverNode = (event) => {
  setRaycaster(event);
  let node_spheres = nodeObjects.map(({ sphere }) => sphere);
  let intersects = RAYCASTER.intersectObjects(node_spheres),
    event_flag = false, //for performance optimization
    hover_flag = false;
    
  if (intersects.length > 0) {
    hover_flag = true;
    
    if (last_hovered_node_index !== ""){
      hovered_nodes = hovered_nodes.filter(function(value, index, arr){ return value != last_hovered_node_index;});
      nodeObjects[last_hovered_node_index].setOpacity(1);
      last_hovered_node_index = "";
      event_flag = true;
    }
    intersects[0].object.material.opacity = 0.5;
    last_hovered_node_index = findIndexByUuid(node_spheres, intersects[0].object.uuid); // TODO check if works properly
    if (!exists(hovered_nodes, last_hovered_node_index)) hovered_nodes.push(last_hovered_node_index);
    event_flag = true;
  } else {
    if (last_hovered_node_index !== ""){
      hovered_nodes = hovered_nodes.filter(function(value, index, arr){ return value != last_hovered_node_index;});
      nodeObjects[last_hovered_node_index].setOpacity(1);
      last_hovered_node_index = "";
      event_flag = true;
    } else hovered_nodes = [];
  }
  
  if (event_flag) decideNodeLabelFlags(); //performance optimization
  
  return hover_flag;
}

// logic behind node label show/hide
const decideNodeLabelFlags = () => {
  let hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox"),
      node_layer = "";
  for (let i = 0; i < nodeObjects.length; i++) {
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

const checkNodeInteraction = (event) => {
  setRaycaster(event);
  let node_spheres = nodeObjects.map(({ sphere }) => sphere);
  let intersects = RAYCASTER.intersectObjects(node_spheres);
  let node_selection = false;
  if (intersects.length > 0) {
    node_selection = true;
    let ind = findIndexByUuid(node_spheres, intersects[0].object.uuid);
    if (exists(selectedNodePositions, ind)) {
      selectedNodePositions = selectedNodePositions.filter(function(value, index, arr){ return value != ind;}); // array remove/filter
      if (selectedNodeColorFlag)
        nodeObjects[ind].setColor(nodeObjects[ind].getColor());
    } else {
      selectedNodePositions.push(ind);
      if (selectedNodeColorFlag)
        nodeObjects[ind].setColor(selectedDefaultColor);
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
  for (let i = 0; i < nodeObjects.length; i++) {
    let nodeX = nodeObjects[i].getWorldPosition("x");
    let nodeY = nodeObjects[i].getWorldPosition("y");
    if (nodeX < maxX && nodeX > minX && nodeY < maxY && nodeY > minY)
      nodeObjects[i].setOpacity(0.5);
    else
      nodeObjects[i].setOpacity(1);
  }
}

// on node searchbar key-press
const selectSearchedNodes = (event) => {
  if (scene.exists()) {
    let key = window.event.keyCode;
    // If the user has pressed enter
    if (key === 13) {
      event.preventDefault(); //bypassing newline enter
      startLoader(true);
      let searchString = document.getElementById("nodeSearchBar").value.replace(/\n/g, ""),
          tempIndexes, i, j,
          nodeNames = nodeObjects.map(({ name }) => name);
      searchString = searchString.split(",");
      for (i = 0; i < searchString.length; i++) {
        tempIndexes = getCaseInsensitiveIndices(nodeNames, searchString[i].trim()) //case insensitive function
        if (tempIndexes.length > 0){
          for (j = 0; j < tempIndexes.length; j++) {
            if (!exists(selectedNodePositions, tempIndexes[j])) {
              selectedNodePositions.push(tempIndexes[j]);
              if (selectedNodeColorFlag)
                nodeObjects[tempIndexes[j]].setColor(selectedDefaultColor);
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

const unselectAllNodes = () => {
  selectedNodePositions = [],
  selected_edges = [];
  decideNodeColors();
  decideNodeLabelFlags();
};

const decideNodeColors = () => { // TODO add isSelected condition, rename to repaintNodes
  for (let i = 0; i < nodeObjects.length; i++) {
    if (nodeObjects[i].getCluster() != "" && nodeColorPrioritySource == "cluster")
      nodeObjects[i].setColor(nodeColorVector[nodeObjects[i].getCluster()], clusterMode = true);
    else
      nodeObjects[i].setColor(nodeObjects[i].getColor());
  }
};

const translateNodesWithHeldKey = (e) => {
  let step, i;
    
  if (e.screenX - e.screenY >=  mousePreviousX - mousePreviousY) step = 20;
  else step =-20;
  
  if (scene.axisPressed=="z") {
    for (i = 0; i < selectedNodePositions.length; i++)
      nodeObjects[selectedNodePositions[i]].translateZ(step);
  } else if (scene.axisPressed=="c") {
    for (i = 0; i < selectedNodePositions.length; i++)
      nodeObjects[selectedNodePositions[i]].translateY(step);
  }
  redrawEdges();
  updateNodesRShiny();
  updateVRNodesRShiny();
}


// Handlers =====
const setNodeAttributes = (nodeAttributes) => {
  let pos;
  for (let i = 0; i < nodeObjects.length; i++) { // TODO change nodeAttributes to dataframe and iterate that length
    pos = nodeAttributes.Node.indexOf(nodeLayerNames[i]);
    if (pos > -1) { // if node exists in attributes file
      if (nodeAttributes.Color !== undefined && nodeAttributes.Color[pos] !== null && nodeAttributes.Color[pos].trim() !== "")
        nodeObjects[i].setColor(nodeAttributes.Color[pos]);
      if (nodeAttributes.Size !== undefined && nodeAttributes.Size[pos] !== null && nodeAttributes.Size[pos].trim() !== "")
        nodeObjects[i].setScale(Number(nodeAttributes.Size[pos]));
      if (nodeAttributes.Url !== undefined && nodeAttributes.Url[pos] !== null && nodeAttributes.Url[pos].trim() !== "")
        nodeObjects[i].url = nodeAttributes.Url[pos];
      if (nodeAttributes.Description !== undefined && nodeAttributes.Description[pos] !== null && nodeAttributes.Description[pos].trim() !== "")
        nodeObjects[i].descr = nodeAttributes.Description[pos];
    }
  }
  updateNodesRShiny();
  updateVRNodesRShiny();
}

const selectAllNodes = (message) => { // T | F
  if (message) {
    selectedNodePositions = []; // reseting, else multiple entries -> double transformations
    for (let i=0; i < nodeObjects.length; i++){
      selectedNodePositions.push(i);
      if (selectedNodeColorFlag)
        nodeObjects[i].setColor(selectedDefaultColor);
    }
    updateSelectedNodesRShiny();
  } else {
    selectedNodePositions = [];
    updateSelectedNodesRShiny();
    for (i=0; i < nodeObjects.length; i++) {
      // TODO replace with decideNodeColors()
      if (nodeObjects[i].getCluster() != "")
        nodeObjects[i].setColor(nodeColorVector[nodeObjects[i].getCluster()]);
      else
        nodeObjects[i].setColor(nodeColorVector[(layerGroups[nodeGroups[nodeLayerNames[i]]]) % nodeColorVector.length]);
    }
  }
  decideNodeLabelFlags();
}

const setNodeColorPriority = (colorPriority) => {
  nodeColorPrioritySource = colorPriority;
  decideNodeColors();
  updateNodesRShiny();
  updateVRNodesRShiny();
};

const setNodeSelectedColorPriority = (message) => {
  selectedNodeColorFlag = message;
  for (let i = 0; i < selectedNodePositions.length; i++){
    if (selectedNodeColorFlag)
      nodeObjects[selectedNodePositions[i]].setColor(selectedDefaultColor);
    else
      nodeObjects[selectedNodePositions[i]].setColor(nodeColorVector[(
        layerGroups[nodeGroups[nodeLayerNames[selectedNodePositions[i]]]]) % nodeColorVector.length]);
  }
}

const chooseNodeClusterColorPriority = (T) => {
  let radioButtonDiv = document.getElementById("nodeColorPriorityRadio");
  radioButtonDiv.children[1].children[1].click(); // choosing Clustering color priority
};

// Canvas Controls =====
const spreadNodes = () => {
  if (selectedNodePositions.length == 0)
    alert("Please select at least one node.");
  else {
    for (let i = 0; i < selectedNodePositions.length; i++) {
      nodeObjects[selectedNodePositions[i]].setPosition("y",
        nodeObjects[selectedNodePositions[i]].getPosition("y") * 1.1);
      nodeObjects[selectedNodePositions[i]].setPosition("z",
        nodeObjects[selectedNodePositions[i]].getPosition("z") * 1.1);
    }
    updateNodesRShiny();
    updateVRNodesRShiny();
    redrawEdges();
  }
}

const congregateNodes = () => {
  if (selectedNodePositions.length == 0) alert("Please select at least one node.");
  else {
    for (let i = 0; i < selectedNodePositions.length; i++){
      nodeObjects[selectedNodePositions[i]].setPosition("y",
        nodeObjects[selectedNodePositions[i]].getPosition("y") * 0.9);
      nodeObjects[selectedNodePositions[i]].setPosition("z",
        nodeObjects[selectedNodePositions[i]].getPosition("z") * 0.9);
    }
    updateNodesRShiny();
    updateVRNodesRShiny();
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
          nodeObjects[selectedNodePositions[i]].translateX(value);
        else if (axis == "Y")
          nodeObjects[selectedNodePositions[i]].translateY(value);
        else if (axis == "Z")
          nodeObjects[selectedNodePositions[i]].translateZ(value);
      }
      redrawEdges();
      updateNodesRShiny();
      updateVRNodesRShiny();
    }, 70);
  }
}

const scaleNodes = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[5],
    td = document.getElementById("sliderValue6");
  td.innerHTML = "x".concat(cavnasSlider.value);
  if (selectedNodePositions.length == 0)
    alert("Please select at least one node.");
  else {
    for (let i = 0; i < selectedNodePositions.length; i++)
      nodeObjects[selectedNodePositions[i]].setScale(parseFloat(cavnasSlider.value));
    updateNodesRShiny();
  }
}
