// Initialization =====
const createNodeDescriptionDiv = () => {
  let descrDiv = document.getElementById("descrDiv"),
    btn = document.createElement("button"),
    p = document.createElement('p');

  btn.id = "closeButton";
  btn.innerHTML = "X";
  btn.onclick = function() { descrDiv.style.display = "none"; };
  p.className = "descrDiv_paragraph";

  descrDiv.appendChild(btn);
  descrDiv.appendChild(p);
};

const createNodeObjects = () => {
  let nodeColor;
  for (let i = 0; i < nodeLayerNames.length; i++) {
    nodeColor = getNodeGroupColor(nodeLayerNames[i]);
    
    nodeObjects.push(new Node({id: i, name: nodeNames[i], layer: nodeGroups[nodeLayerNames[i]],
      nodeLayerName: nodeLayerNames[i], color: nodeColor}));
    layers[layerGroups[nodeGroups[nodeLayerNames[i]]]].addNode(nodeObjects[i].sphere);
  }
  nodeNames = undefined; // releasing ram
};

// @return: hex color code
const getNodeGroupColor = (nodeLayerName) => {
  return(COLOR_VECTOR_280[(layerGroups[nodeGroups[nodeLayerName]]) % COLOR_VECTOR_280.length])
};

const scrambleNodes = (yMin = yBoundMin, yMax = yBoundMax,
    zMin = zBoundMin, zMax = zBoundMax) => {
    for (let i = 0; i < nodeObjects.length; i++) {
      nodeObjects[i].translateY(getRandomArbitrary(yMin, yMax));
      nodeObjects[i].translateZ(getRandomArbitrary(zMin, zMax));
    }
};

// Event Listeners =====
const checkHoverOverNode = (event) => {
  setRaycaster(event);
  let node_spheres = nodeObjects.map(({ sphere }) => sphere);
  let intersects = RAYCASTER.intersectObjects(node_spheres),
    event_flag = false, // for performance optimization
    hover_flag = false;

  // release previous hovered node if exists
  if (last_hovered_node_index !== "") {
    nodeObjects[last_hovered_node_index].setOpacity(1);
    last_hovered_node_index = "";
    event_flag = true;
  }

  // check for new hovered node
  if (intersects.length > 0) {
    last_hovered_node_index = findIndexByUuid(node_spheres, intersects[0].object.uuid);
    nodeObjects[last_hovered_node_index].setOpacity(0.5);
    event_flag = true;
    hover_flag = true;
  } 
  
  if (event_flag)
    decideNodeLabelFlags();
  
  return(hover_flag)
};

const decideNodeLabelFlags = () => {
  let hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox"),
    node_layer = "";

  renderNodeLabelsFlag = true;
  for (let i = 0; i < nodeObjects.length; i++) {
    node_layer = layerGroups[nodeGroups[nodeLayerNames[i]]];
    // Priorities list:
    if (hidelayerCheckboxes[node_layer].checked) { // 1. if node's layer not hidden 
      nodeObjects[i].showLabel = false;
    } else if (showAllNodeLabelsFlag) { // 2. if showing all node labels
      nodeObjects[i].showLabel= true;
    } else if (layers[node_layer].showNodeLabels) { // 3. if showing layer node labels
      nodeObjects[i].showLabel= true;
    } else if (showSelectedNodeLabelsFlag && nodeObjects[i].isSelected) { // 4. if showing selected node labels, and node is selected
      nodeObjects[i].showLabel= true;
    } else if (i === last_hovered_node_index) { // 5. if hovering over node
      nodeObjects[i].showLabel= true;
    } else
      nodeObjects[i].showLabel= false; // 6. if none of the above apply, don't show label
  }
};

const translateNodesWithHeldKey = (event) => {
  let i,
    selectedNodePositions = getSelectedNodes(),
    step = event.screenX - event.screenY >=  mousePreviousX - mousePreviousY ? 20 : -20;

  if (scene.axisPressed == "z") {
    for (i = 0; i < selectedNodePositions.length; i++)
      nodeObjects[selectedNodePositions[i]].translateZ(step);
  } else if (scene.axisPressed == "c") {
    for (i = 0; i < selectedNodePositions.length; i++)
      nodeObjects[selectedNodePositions[i]].translateY(step);
  }

  redrawIntraLayerEdges();
  updateNodesRShiny();
  updateVRNodesRShiny();
};

const getSelectedNodes = () => {
  let selectedNodePositions = nodeObjects.map(function(node) {
    if (node.isSelected)
      return(node.id)
  });
  selectedNodePositions = selectedNodePositions.filter(function(id) {
    return(id !== undefined)
  });
  return(selectedNodePositions)
};

const performDoubleClickNodeSelection = (event) => {
  let intersects, nodeSelected = false,
    node_spheres = nodeObjects.map(({ sphere }) => sphere);

  setRaycaster(event);
  
  intersects = RAYCASTER.intersectObjects(node_spheres);
  if (intersects.length > 0) {
    nodeSelected = true;

    let ind = findIndexByUuid(node_spheres, intersects[0].object.uuid);
    nodeObjects[ind].isSelected = !nodeObjects[ind].isSelected;
    
    repaintNode(ind);
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
  }

  return(nodeSelected)
};

const repaintNode = (i) => {
  if (selectedNodeColorFlag && nodeObjects[i].isSelected)
    nodeObjects[i].setColor(SELECTED_DEFAULT_COLOR);
  else if (nodeObjects[i].getCluster() != "" && nodeColorPrioritySource == "cluster")
    nodeObjects[i].setColor(
      COLOR_VECTOR_280[nodeObjects[i].getCluster()], 
      importMode = false, clusterMode = true
    );
  else
    nodeObjects[i].setColor(nodeObjects[i].getColor());
};

// shift + drag left click
const lassoSelectNodes = (x, y) => {
  let nodeX, nodeY,
    minX = Math.min(shiftX, x),
    maxX = Math.max(shiftX, x),
    minY = Math.min(shiftY, y),
    maxY = Math.max(shiftY, y);

  createLassoGeometry(x, y);
  
  for (let i = 0; i < nodeObjects.length; i++) {
    nodeX = nodeObjects[i].getWorldPosition("x");
    nodeY = nodeObjects[i].getWorldPosition("y");
    if (nodeX < maxX && nodeX > minX && nodeY < maxY && nodeY > minY)
      nodeObjects[i].setOpacity(0.5);
    else
      nodeObjects[i].setOpacity(1);
  }
};

const createLassoGeometry = (x, y) => {
  let geometry, material, points = [];

  scene.remove(lasso);
	points.push(
    new THREE.Vector3(shiftX, shiftY, 0),
    new THREE.Vector3(x, shiftY, 0),
    new THREE.Vector3(x, y, 0),
    new THREE.Vector3(shiftX, y, 0),
    new THREE.Vector3(shiftX, shiftY, 0)
  );
	geometry = new THREE.BufferGeometry().setFromPoints(points);
	material = new THREE.LineBasicMaterial({ color: "#eef1b6" });
	lasso = new THREE.Line(geometry, material);
	scene.add(lasso);
};

// on node searchbar key-press
const selectSearchedNodes = (event) => {
  if (scene.exists()) {
    let key = window.event.keyCode;
    
    if (key === 13) { // Enter button
      event.preventDefault(); // bypassing newline enter
      startLoader();

      let searchString = document.getElementById("nodeSearchBar").value.replace(/\n/g, ""),
        tempIndexes, i, j,
        nodeNames = nodeObjects.map(({ name }) => name);

      searchString = searchString.split(",");
      for (i = 0; i < searchString.length; i++) {
        tempIndexes = getCaseInsensitiveIndices(nodeNames, searchString[i].trim()) // case insensitive function
        if (tempIndexes.length > 0) {
          for (j = 0; j < tempIndexes.length; j++) {
            if (!nodeObjects[tempIndexes[j]].isSelected) {
              nodeObjects[tempIndexes[j]].isSelected = true;
              repaintNode(tempIndexes[j]);
            }
          }
        }
      }
      decideNodeLabelFlags();
      updateSelectedNodesRShiny();
      finishLoader();
    }
  }
};

const unselectAllNodes = () => {
  selectAllNodes(false);
};

// Handlers =====
const selectAllNodes = (selectedFlag) => { // T | F
  for (let i = 0; i < nodeObjects.length; i++) {
    nodeObjects[i].isSelected = selectedFlag;
    repaintNode(i);
  }
    
  decideNodeLabelFlags();
  updateSelectedNodesRShiny();
};

const setNodeShape = (shape) => {
  for (let i = 0; i < nodeObjects.length; i++) {
    nodeObjects[i].setGeometry(shape)
  }
};

const setNodeColorPriority = (colorPriority) => {
  nodeColorPrioritySource = colorPriority;
  
  repaintNodes();
  updateNodesRShiny();
  updateVRNodesRShiny();
};

const repaintNodes = () => {
  for (let i = 0; i < nodeObjects.length; i++)
    repaintNode(i);
};

const setNodeSelectedColorPriority = (colorPriority) => {
  selectedNodeColorFlag = colorPriority;
  repaintNodes();
};

const clickNodeColorPriority = (mode) => {
  let radioButtonDiv = document.getElementById("nodeColorPriorityRadio");
  if (mode == "default")
    radioButtonDiv.children[1].children[0].click();
  else if (mode == "cluster")
    radioButtonDiv.children[1].children[1].click();
};

const setNodeAttributes = (nodeAttributes) => {
  let pos;
  for (let i = 0; i < nodeAttributes.length; i++) {
    pos = nodeLayerNames.indexOf(nodeAttributes[i].NodeLayer);
    if (pos > -1) { // if node exists in network
      if (nodeAttributes[i].Color !== undefined && nodeAttributes[i].Color.trim() !== "")
        nodeObjects[pos].setColor(nodeAttributes[i].Color, importMode = true, clusterMode = false);
      if (nodeAttributes[i].Size !== undefined && nodeAttributes[i].Size.trim() !== "")
        nodeObjects[pos].setScale(Number(nodeAttributes[i].Size));
      if (nodeAttributes[i].Url !== undefined && nodeAttributes[i].Url.trim() !== "")
        nodeObjects[pos].url = nodeAttributes[i].Url;
      if (nodeAttributes[i].Description !== undefined && nodeAttributes[i].Description.trim() !== "")
        nodeObjects[pos].descr = nodeAttributes[i].Description;
    }
  }
  updateNodesRShiny();
  updateVRNodesRShiny();
};

// Canvas Controls =====
const spreadNodes = (multiplier) => { // 1.1 or 0.9
  let selectedNodePositions = getSelectedNodes();
  if (selectedNodePositions.length > 0) {
    for (let i = 0; i < selectedNodePositions.length; i++) {
      nodeObjects[selectedNodePositions[i]].setPosition("y",
        nodeObjects[selectedNodePositions[i]].getPosition("y") * multiplier);
      nodeObjects[selectedNodePositions[i]].setPosition("z",
        nodeObjects[selectedNodePositions[i]].getPosition("z") * multiplier);
    }
    updateNodesRShiny();
    updateVRNodesRShiny();
    redrawIntraLayerEdges();
  } else
    alert("Please select at least one node.");
};

const moveNodes = (direction, axis) => {
  let selectedNodePositions = getSelectedNodes();
  if (selectedNodePositions.length > 0) {
    nodeIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[4].value;
      value = direction * value;
      for (let i = 0; i < selectedNodePositions.length; i++) {
        if (axis == "X")
          nodeObjects[selectedNodePositions[i]].translateX(value);
        else if (axis == "Y")
          nodeObjects[selectedNodePositions[i]].translateY(value);
        else if (axis == "Z")
          nodeObjects[selectedNodePositions[i]].translateZ(value);
      }
      redrawIntraLayerEdges();
      updateNodesRShiny();
      updateVRNodesRShiny();
    }, 70);
  } else
    alert("Please select at least one node.");
};

const scaleNodes = () => {
  let selectedNodePositions = getSelectedNodes(),
    cavnasSlider = document.getElementsByClassName("canvasSlider")[5],
    td = document.getElementById("sliderValue6");
  td.innerHTML = "x".concat(cavnasSlider.value);

  if (selectedNodePositions.length > 0) {
    for (let i = 0; i < selectedNodePositions.length; i++)
      nodeObjects[selectedNodePositions[i]].setScale(parseFloat(cavnasSlider.value));

    updateNodesRShiny();
  } else
    alert("Please select at least one node.");
};
