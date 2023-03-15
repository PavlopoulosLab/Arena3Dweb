const selectAllLayers = (flag) => {
  let layerCheckboxes = document.getElementsByClassName("layer_checkbox");
  for (let i = 0; i < layerCheckboxes.length; i++) {
    layerCheckboxes[i].checked = flag;
    layers[i].isSelected = flag;
  }
  paintSelectedLayers();
  updateSelectedLayersRShiny();
}

const selectCheckedLayer = (checkbox) => {
  layers[checkbox.value].isSelected = checkbox.checked;
  updateSelectedLayersRShiny();
  paintSelectedLayers();
}

const existsClickedLayer = (e) => {
  let exists = false;
  if (last_hovered_layer_index !== "") {
    exists = true;
    performDoubleClickLayerSelection(last_hovered_layer_index);
    last_hovered_layer_index = "";
    updateSelectedLayersRShiny();
    paintSelectedLayers();
  }
  return exists;
}

const performDoubleClickLayerSelection = (index) => {
  layers[index].toggleSelection();
  // toggle respective checkbox
  let layerCheckboxes = document.getElementsByClassName("layer_checkbox");
  layerCheckboxes[index].checked ? layerCheckboxes[index].checked = false : layerCheckboxes[index].checked = true;
};

const paintSelectedLayers = () => {
  for (i = 0; i < layers.length; i++) {
    if (layers[i].isSelected)
      layers[i].setColor("#f7f43e");
    else {
      if (floorDefaultColors.length > 0 && layerColorFromFile) {
        layers[i].setColor(floorDefaultColors[i]);
      } else
       layers[i].setColor(floorCurrentColor);
      if (!showAllLayerLabelsFlag && showSelectedLayerLabelsFlag)
        layer_label_divs[i].style.display = "none";
    }
  }
}

const hideLayers = () => {
  let hideLayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox");
  //layers
  for (let i = 0; i < hideLayerCheckboxes.length; i++)
    layers[i].toggleVisibility(!hideLayerCheckboxes[i].checked);
  //node labels
  decideNodeLabelFlags();
};

const showLayerNodeLabels = () => {
  let showLayerNodesCheckboxes = document.getElementsByClassName("showLayerNodes_checkbox");
  for (let i = 0; i < showLayerNodesCheckboxes.length; i++)
    layers[Math.floor(i)].showNodeLabels = showLayerNodesCheckboxes[i].checked;
  decideNodeLabelFlags();
};

const attachLayerCheckboxes = () => {
  let checkbox = "",
    label = "",
    br = "",
    temp = "",
    container = document.getElementById('checkboxdiv');
  container.innerHTML = ''; //clear previous checkboxes

  for(let i = 0; i < Object.getOwnPropertyNames(layer_groups).length; i++) {
    checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.name = "checkbox".concat(i);
    checkbox.className = "checkbox_check layer_checkbox";
    checkbox.value = i;
    checkbox.id = "checkbox".concat(i);
    checkbox.setAttribute('onclick', 'selectCheckedLayer(this)');
    
    label = document.createElement('label');
    label.className = "checkbox_element layer_label";
    label.htmlFor = i;
    temp = layers[i].getName();
    label.title = layers[i].getName();
    label.appendChild(document.createTextNode(temp));
    
    checkbox2 = document.createElement('input');
    checkbox2.className = "checkbox_check hideLayer_checkbox";
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
    checkbox3.className = "checkbox_check showLayerNodes_checkbox";
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
}

const positionLayers = () => {
  let window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
    numLayers = layers.length;
  for (let i = 0; i < numLayers; i++) {
    //if(checkMoveFlag && layer_planes[i].move || !checkMoveFlag) {
      if (numLayers % 2)
        layers[i].translateX( (-Math.floor(layers.length/2) + i) * window_width); //odd number of Layers
      else
        layers[i].translateX( (-layers.length/2 + i) * window_width + window_width/2); //even number of Layers
    //}
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
}

// @param color (string): hex color
const setFloorColor = (color) => {
  // from picker: floorCurrentColor = document.getElementById("floor_color").value;
  floorCurrentColor = color;
  for (let i = 0; i < layers.length; i++) {
      if (floorDefaultColors.length > 0 && layerColorFromFile) {
        layers[i].setColor(floorDefaultColors[i]);
      } else
        layers[i].setColor(color);
  }
  updateLayersRShiny();
}

const checkHoverOverLayer = (event, node_hover_flag) => {
  setRaycaster(event);
  let layer_planes = layers.map(({ plane }) => plane);
  let intersects = RAYCASTER.intersectObjects(layer_planes); // TODO get all layer object planes in an array first
  
  if (intersects.length > 0 & !node_hover_flag) {
    if (last_hovered_layer_index != ""){
      paintSelectedLayers();
      hoveredLayerPaintedFlag = true;
      last_hovered_layer_index = "";
    }
    intersects[0].object.material.color.set( 0xff0000 );
    last_hovered_layer_index = findIndexByUuid(layer_planes, intersects[0].object.uuid);
  } else {
    if (hoveredLayerPaintedFlag) {
      paintSelectedLayers(); // remove red color from last hovered
      hoveredLayerPaintedFlag = false;
    }
    last_hovered_layer_index = "";
  }
}

const rotateLayersWithHeldKey = (e) => {
  let rads, i,
    js_selected_layers = getSelectedLayers();

  if (e.screenX - e.screenY >= mousePreviousX - mousePreviousY) rads = 0.05;
  else rads = -0.05;

  if (scene.axisPressed=="z"){
    for (i = 0; i < js_selected_layers.length; i++) {
      layers[js_selected_layers[i]].rotateZ(rads);
    }
  } else if (scene.axisPressed=="x"){
    for (i = 0; i < js_selected_layers.length; i++) {
      layers[js_selected_layers[i]].rotateX(rads);
    }
  } else if (scene.axisPressed=="c"){
    for (i = 0; i < js_selected_layers.length; i++) {
      layers[js_selected_layers[i]].rotateY(rads);
    }
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
}

const getSelectedLayers = () => {
  let js_selected_layers = layers.map(function(layer) { if (layer.isSelected) return layer.id; });
  js_selected_layers = js_selected_layers.filter(function(id) { return id !== undefined; });
  return(js_selected_layers)
};

const adjustLayerSize = () => { // TODO check if works with import different width/height
  let maxY = minY = maxZ = minZ = nodes[0].position,
    layer_planes = layers.map(({ plane }) => plane);
    
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

const showLayerCoords = (labelCoordsSwitch) => { //message = true or false
  for (let i = 0; i < layers.length; i++)
    layers[i].toggleCoords(labelCoordsSwitch);
};

const setFloorOpacity = (selectedOpacity) => {
  for (let i = 0; i < layers.length; i++)
    layers[i].setOpacity(selectedOpacity);
};

const showWireFrames = (wireframeFlag) => { // true or false
  for (let i = 0; i < layers.length; i++)
    layers[i].toggleWireframe(wireframeFlag);
}

const layerColorFilePriority = (message) => {
  layerColorFromFile = message;
  for (let i = 0; i < layers.length; i++) {
    if (!layerColorFromFile)
      layers[i].setColor(floorCurrentColor);
    else
      layers[i].setColor(floorDefaultColors[i]);
  }
  updateLayersRShiny();
}

// Canvas Controls =====
const rotateSelectedLayers = (direction, axis) => {
  let js_selected_layers = getSelectedLayers();
  if (js_selected_layers.length == 0)
    alert("Please select at least one layer.");
  else {
    layerIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[1].value;
      value = direction * THREE.Math.degToRad(value);
      for (let i = 0; i < js_selected_layers.length; i++) {
        if (axis == "X")
          layers[js_selected_layers[i]].rotateX(value);
        else if (axis == "Y")
          layers[js_selected_layers[i]].rotateY(value);
        else if (axis == "Z")
          layers[js_selected_layers[i]].rotateZ(value);
      }
      updateLayersRShiny();
      updateNodesRShiny(); // VR node world positions update
    }, 70);
  }
}

const spreadLayers = () => {
  let window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
      numLayers = layers.length;
  for (let i = 0; i < numLayers; i++) {
    layers[i].setRotation("x", 0);
    layers[i].setRotation("y", 0);
    layers[i].setRotation("z", 0);
    if (numLayers % 2)
      layers.translateX( (-Math.floor(layers.length/2) + i) * window_width); //odd number of Layers
    else
      layers[i].translateX( (-layers.length/2 + i) * window_width + window_width/2); //even number of Layers
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
}

const congregateLayers = () => {
  let window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
      numLayers = layers.length;
  for (let i = 0; i < numLayers; i++) {
    layers[i].setRotation("x", 0);
    layers[i].setRotation("y", 0);
    layers[i].setRotation("z", 0);
    if (numLayers % 2)
      layers[i].translateX( -((-Math.floor(layers.length/2) + i) * window_width)); //odd number of Layers
    else
      layers[i].translateX( -((-layers.length/2 + i) * window_width + window_width/2)); //even number of Layers
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
}

const moveLayers = (direction, axis) => {
  let js_selected_layers = getSelectedLayers();
  if (js_selected_layers.length == 0)
    alert("Please select at least one layer.");
  else {
    layerIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[2].value;
      value = direction * value;
      for (let i = 0; i < js_selected_layers.length; i++) {
        if (axis == "X")
          layers[js_selected_layers[i]].translateX(value);
        else if (axis == "Y")
          layers[js_selected_layers[i]].translateY(value);
        else if (axis == "Z")
          layers[js_selected_layers[i]].translateZ(value);
      }
      updateLayersRShiny();
      updateNodesRShiny(); // VR node world positions update
    }, 70);
  }
}

const scaleLayers = () => {
  let td = document.getElementById("sliderValue4"),
    cavnasSlider = document.getElementsByClassName("canvasSlider")[3],
    js_selected_layers = getSelectedLayers();;
  td.innerHTML = "x".concat(cavnasSlider.value);
  if (js_selected_layers.length == 0)
    alert("Please select at least one layer.");
  else {
    for (let i = 0; i < js_selected_layers.length; i++) {
      for (let j = 0; j < layers[js_selected_layers[i]].plane.children.length; j++) {
        layers[js_selected_layers[i]].plane.children[j].position.y = 
          layers[js_selected_layers[i]].plane.children[j].position.y * parseFloat(cavnasSlider.value) / layers[js_selected_layers[i]].getScale();
        layers[js_selected_layers[i]].plane.children[j].position.z =
          layers[js_selected_layers[i]].plane.children[j].position.z * parseFloat(cavnasSlider.value) / layers[js_selected_layers[i]].getScale();
      }
      layers[js_selected_layers[i]].setScale(cavnasSlider.value)
    }
    redrawEdges();
    updateLayersRShiny();
    updateNodesRShiny();
  }
}
