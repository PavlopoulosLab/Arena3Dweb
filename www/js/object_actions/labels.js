const createLabels = () => {
  //nodes
  let nodeNames = nodeObjects.map(({ name }) => name);
  for (let i = 0; i < nodeObjects.length; i++){
    let div = document.createElement('div');
    div.textContent = nodeNames[i];
    div.setAttribute('class', 'labels');
    div.setAttribute('id', nodeLayerNames[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    node_labels.push(div);
    node_labels[i].style.fontSize = nodeLabelDefaultSize;
    node_labels[i].style.display = "none";
    node_labels[i].style.color = globalLabelColor;
  }
  //layers
  for (let i = 0; i < layers.length; i++) {
    let div = document.createElement('div'),
      name = layers[i].getName();
    div.textContent = name;
    div.setAttribute('class', 'layer-labels');
    div.setAttribute('id', name.concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    layer_label_divs.push(div);
    layer_label_divs[i].style.display = "inline-block";
    layer_label_divs[i].style.color = globalLabelColor;
  }
}

const setLabelColor = () =>{
  let i;
  for (i = 0; i < layer_label_divs.length; i++)
    layer_label_divs[i].style.color = globalLabelColor;
  for (i = 0; i < node_labels.length; i++)
    node_labels[i].style.color = globalLabelColor;
};

const setLabelColorVariable = (label_color) => {
  globalLabelColor = label_color;
  setLabelColor();
};

const showLayerLabels = (mode) => {
  if (mode == "all") {
    showAllLayerLabels();
  } else if (mode == "selected") {
    showSelectedLayerLabels();
  } else if (mode == "none") {
    hideAllLayerLabels();
  }
};

const showAllLayerLabels = () => {
  setGlobalLayerLabelFlags(true, false);
  for (let i = 0; i < layers.length; i++)
    layer_label_divs[i].style.display = "inline-block";
};

const setGlobalLayerLabelFlags = (allFlag, selectedFLag) => {
  showAllLayerLabelsFlag = allFlag;
  showSelectedLayerLabelsFlag = selectedFLag;
}

const showSelectedLayerLabels = () => {
  setGlobalLayerLabelFlags(false, true);
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].isSelected)
      layer_label_divs[i].style.display = "inline-block";
    else
      layer_label_divs[i].style.display = "none";
  }
};

const hideAllLayerLabels = () => {
  setGlobalLayerLabelFlags(false, false);
  for (let i = 0; i < layers.length; i++)
      layer_label_divs[i].style.display = "none";
};

const resizeLayerLabels = (size) => { // [1, 20]
  for (let i = 0; i < layers.length; i++)
    layer_label_divs[i].style.fontSize = size.toString().concat("px");
};

const showNodeLabels = (mode) => {
  if (mode == "all") {
    showAllNodeLabelsFlag = true;
    showSelectedNodeLabelsFlag = false;
  } else if (mode == "selected") {
    showAllNodeLabelsFlag = false;
    showSelectedNodeLabelsFlag = true;
  } else if (mode == "none") {
    showAllNodeLabelsFlag = false;
    showSelectedNodeLabelsFlag = false;
  }
  decideNodeLabelFlags();
};

const resizeNodeLabels = (message) => {
  let size = message; //message = [1, 20]
  for (let i = 0; i < nodeObjects.length; i++)
    node_labels[i].style.fontSize = size.toString().concat("px");
}

// on animate ======
const renderLayerLabels = () => {
  if (showAllLayerLabelsFlag)
    redrawLayerLabels("all");
  else {
    if (showSelectedLayerLabelsFlag) {
      let selected_layers = getSelectedLayers();
      if (selected_layers.length > 0)
        redrawLayerLabels("selected");
    }
  }
  renderLayerLabelsFlag = false;
}

const redrawLayerLabels = (mode) => {
  let  layerArray, layerX, layerY, labelX, labelY,
    position, hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox"),
    layer_spheres = layers.map(({ sphere }) => sphere);
  switch (mode) {
    case "all":
      layerArray = layers.map(({ name }) => name);
      break;
    case "selected":
      layerArray = getSelectedLayers();
  }
  
  for (let i = 0; i < layerArray.length; i++) {
    position = mode == "selected" ? layerArray[i] : i;
    if (!hidelayerCheckboxes[position].checked) { // if node's layer not hidden, counting elements
      layerX = layer_spheres[position].getWorldPosition(new THREE.Vector3()).x,
      layerY = layer_spheres[position].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + layerX;
      labelY = yBoundMax - layerY;
      layer_label_divs[position].style.left = labelX.toString().concat("px");
      layer_label_divs[position].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      let canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth)
          layer_label_divs[position].style.display = "none";
      else
        layer_label_divs[position].style.display = "inline-block";
    } else
      layer_label_divs[position].style.display = "none";
  }
}

const renderNodeLabels = () => {
  let nodeX = "",
      nodeY = "",
      labelX = "",
      labelY = "";

  for (let i = 0; i < nodeObjects.length; i++) {
    if (nodeObjects[i].showLabel) { 
      nodeX = nodeObjects[i].getWorldPosition("x");
      nodeY = nodeObjects[i].getWorldPosition("y");
      labelX = xBoundMax + nodeX + 7;
      labelY = yBoundMax - nodeY - 10;
      node_labels[i].style.left = labelX.toString().concat("px");
      node_labels[i].style.top = labelY.toString().concat("px");
      // check if overlapping with canvas div to set visibility
      let canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth)
            node_labels[i].style.display = "none";
      else
        node_labels[i].style.display = "inline-block";
    } else
      node_labels[i].style.display = "none";
  }
  renderNodeLabelsFlag = false;
}
