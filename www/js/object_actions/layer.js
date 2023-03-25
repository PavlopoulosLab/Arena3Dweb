// Layer Selection Checkbox Group =====
const attachLayerCheckboxes = () => {
  let br,
    container = document.getElementById('checkboxdiv');
  container.innerHTML = ''; //clear previous checkboxes

  for (let i = 0; i < layers.length; i++) {
    attachLayerCheckBox("checkbox_".concat(i), i, "layer_checkbox",
      "selectCheckedLayer(this)", " layer_label", layers[i].getName())
    attachLayerCheckBox("checkbox2_".concat(i), "show_hide".concat(i), "hideLayer_checkbox",
      "hideLayers()", "", 'Hide')
    attachLayerCheckBox("checkbox3_".concat(i), "show_labels".concat(i), "showLayerNodes_checkbox",
      "showLayerNodeLabels()", "", 'Labels')

    br = document.createElement('br');
    container.appendChild(br);
  }
};

const attachLayerCheckBox = (c_id, c_value, c_class, c_func, l_class, l_title) => {
  let checkbox, label,
    container = document.getElementById('checkboxdiv');
    
  checkbox = document.createElement('input');
  checkbox.type = "checkbox";
  checkbox.id = c_id;
  checkbox.value = c_value;
  checkbox.className = "checkbox_check ".concat(c_class);
  checkbox.setAttribute("onclick", c_func);
  
  label = document.createElement('label');
  label.htmlFor = c_value;
  label.className = "checkbox_element".concat(l_class);
  label.appendChild(document.createTextNode(l_title));

  container.appendChild(checkbox);
  container.appendChild(label);
};

const selectCheckedLayer = (checkbox) => {
  layers[checkbox.value].isSelected = checkbox.checked;
  repaintLayers();
  updateSelectedLayersRShiny();
};

const repaintLayers = () => { 
  for (i = 0; i < layers.length; i++) {
    if (layers[i].isSelected)
      layers[i].setColor(SELECTED_LAYER_DEFAULT_COLOR);
    else {
      if (layerColorPrioritySource == "default") {
        layers[i].setColor(layers[i].importedColor);
      } else if (layerColorPrioritySource == "picker") {
        layers[i].setColor(document.getElementById("floor_color").value);
      }
    }
  }
};

const hideLayers = () => {
  let hideLayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox");
  for (let i = 0; i < hideLayerCheckboxes.length; i++)
    layers[i].toggleVisibility(!hideLayerCheckboxes[i].checked);
  decideNodeLabelFlags();
};

const showLayerNodeLabels = () => {
  let showLayerNodesCheckboxes = document.getElementsByClassName("showLayerNodes_checkbox");
  for (let i = 0; i < showLayerNodesCheckboxes.length; i++)
    layers[i].showNodeLabels = showLayerNodesCheckboxes[i].checked;
  decideNodeLabelFlags();
};

// From R actions (layouts and upload/import) =====
// called from predefined layouts (parallel/zigzag), from upload and canvas controls
const initialSpreadLayers = (direction = 1) => {
  let numLayers = layers.length;
  let spacing = xBoundMax * 2 / numLayers;
    
  for (let i = 0; i < numLayers; i++) {
    if (numLayers % 2) // odd
      layers[i].translateX(direction * ((-Math.floor(layers.length / 2) + i) * spacing));
    else // even
      layers[i].translateX(direction * ((-layers.length / 2 + i) * spacing + spacing / 2));
  }
};

// Event Listeners =====
const checkHoverOverLayer = (event, node_hover_flag) => {
  setRaycaster(event);
  let layer_planes = layers.map(({ plane }) => plane);
  let intersects = RAYCASTER.intersectObjects(layer_planes);
  if (intersects.length > 0 & !node_hover_flag) {
    if (lastHoveredLayerIndex !== "") {
      repaintLayers();
      hoveredLayerPaintedFlag = true;
      lastHoveredLayerIndex = "";
    }
    intersects[0].object.material.color.set( 0xff0000 );
    lastHoveredLayerIndex = findIndexByUuid(layer_planes, intersects[0].object.uuid);
  } else {
    if (hoveredLayerPaintedFlag) {
      repaintLayers(); // remove red color from last hovered
      hoveredLayerPaintedFlag = false;
    }
    lastHoveredLayerIndex = "";
  }
};

const performDoubleClickLayerSelection = () => {
  layers[lastHoveredLayerIndex].toggleSelection();
  // toggle respective checkbox
  let layerCheckboxes = document.getElementsByClassName("layer_checkbox");
  layerCheckboxes[lastHoveredLayerIndex].checked ?
    layerCheckboxes[lastHoveredLayerIndex].checked = false :
    layerCheckboxes[lastHoveredLayerIndex].checked = true;
  
  lastHoveredLayerIndex = "";
  repaintLayers();
  updateSelectedLayersRShiny();
};

const rotateLayersWithHeldKey = (event) => {
  let rads, selected_layers = getSelectedLayers();

  if (event.screenX - event.screenY >= mousePreviousX - mousePreviousY)
    rads = 0.05;
  else
    rads = -0.05;

  for (let i = 0; i < selected_layers.length; i++) {
    if (scene.axisPressed == "z")
      layers[selected_layers[i]].rotateZ(rads);
    else if (scene.axisPressed == "x")
      layers[selected_layers[i]].rotateX(rads);
    else if (scene.axisPressed == "c")
      layers[selected_layers[i]].rotateY(rads);
  }

  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
};

const getSelectedLayers = () => {
  let selected_layers = layers.map(function(layer) {
    if (layer.isSelected)
      return(layer.id)
  });
  selected_layers = selected_layers.filter(function(id) {
    return(id !== undefined)
  });
  return(selected_layers)
};

const repaintLayersFromPicker = () => {
  chooseColorpickerPriority();
  repaintLayers();
  updateLayersRShiny();
};

const chooseColorpickerPriority = () => {
  let radioButtonDiv = document.getElementById("layerColorPriorityRadio");
  radioButtonDiv.children[1].children[1].click(); // choosing Theme / Colorpicker priority
};

// Handlers =====
const selectAllLayers = (flag) => {
  let layerCheckboxes = document.getElementsByClassName("layer_checkbox");
  for (let i = 0; i < layerCheckboxes.length; i++) {
    layerCheckboxes[i].checked = flag;
    layers[i].isSelected = flag;
  }
  repaintLayers();
  updateSelectedLayersRShiny();
};

const showLayerCoords = (showLabelCoordsFlag) => {
  for (let i = 0; i < layers.length; i++)
    layers[i].toggleCoords(showLabelCoordsFlag);
};

const setFloorOpacity = (selectedOpacity) => {
  for (let i = 0; i < layers.length; i++)
    layers[i].setOpacity(selectedOpacity);
};

const showWireFrames = (wireframeFlag) => {
  for (let i = 0; i < layers.length; i++)
    layers[i].toggleWireframe(wireframeFlag);
};

const layerColorPriority = (colorPriority) => {
  layerColorPrioritySource = colorPriority;
  repaintLayers();
  updateLayersRShiny();
};

// Canvas Controls =====
const rotateSelectedLayers = (direction, axis) => {
  let selected_layers = getSelectedLayers();
  if (selected_layers.length > 0) {
    layerIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[1].value;
      value = direction * THREE.Math.degToRad(value);
      for (let i = 0; i < selected_layers.length; i++) {
        if (axis == "X")
          layers[selected_layers[i]].rotateX(value);
        else if (axis == "Y")
          layers[selected_layers[i]].rotateY(value);
        else if (axis == "Z")
          layers[selected_layers[i]].rotateZ(value);
      }
      updateLayersRShiny();
      updateNodesRShiny(); // VR node world positions update
    }, 70);
  } else
    alert("Please select at least one layer.");
};

const spreadLayers = (direction) => {
  initialSpreadLayers(direction);

  updateLayersRShiny();
  updateVRLayerLabelsRShiny();
  updateNodesRShiny(); // VR node world positions update
};

const moveLayers = (direction, axis) => {
  let selected_layers = getSelectedLayers();
  if (selected_layers.length > 0) {
    layerIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[2].value;
      value = direction * value;
      for (let i = 0; i < selected_layers.length; i++) {
        if (axis == "X")
          layers[selected_layers[i]].translateX(value);
        else if (axis == "Y")
          layers[selected_layers[i]].translateY(value);
        else if (axis == "Z")
          layers[selected_layers[i]].translateZ(value);
      }
      updateLayersRShiny();
      updateVRLayerLabelsRShiny();
      updateNodesRShiny(); // VR node world positions update
    }, 70);
  } else
    alert("Please select at least one layer.");
};

const scaleLayers = () => {
  let moveFactor, childrenArray,
    sliderString = document.getElementById("sliderValue4"),
    scalingValue = document.getElementsByClassName("canvasSlider")[3].value,
    selected_layers = getSelectedLayers();

  sliderString.innerHTML = "x".concat(scalingValue);

  if (selected_layers.length > 0) {
    for (let i = 0; i < selected_layers.length; i++) {
      moveFactor = parseFloat(scalingValue) / layers[selected_layers[i]].getScale();
      childrenArray = layers[selected_layers[i]].plane.children;
      for (let j = 0; j < childrenArray.length; j++) { // TODO probably replace dpuble for loop with node.getLayer.getScale()
        if (childrenArray[j].type === "Mesh") { // only nodes, edges are "Line"
          childrenArray[j].position.y *= moveFactor;
          childrenArray[j].position.z *= moveFactor;
        }
      }
      layers[selected_layers[i]].setScale(scalingValue);
    }

    redrawEdges();
    updateLayersRShiny();
    updateNodesRShiny();
  } else
    alert("Please select at least one layer.");
};
