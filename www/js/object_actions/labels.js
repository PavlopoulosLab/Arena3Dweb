// Initialization ======
const createLabels = () => {
  createNodeLabels();
  createLayerLabels();
};

const createNodeLabels = () => {
  let div, nodeNames = nodeObjects.map(({ name }) => name);

  for (let i = 0; i < nodeNames.length; i++) {
    div = document.createElement('div');
    div.textContent = nodeNames[i];
    div.setAttribute('class', 'labels');
    div.setAttribute('id', nodeLayerNames[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);

    nodeLabelsDivs.push(div);
    nodeLabelsDivs[i].style.fontSize = NODE_LABEL_DEFAULT_SIZE;
    nodeLabelsDivs[i].style.display = "none";
    nodeLabelsDivs[i].style.color = globalLabelColor;
  }
};

const createLayerLabels = () => {
  let div, name;
  
  for (let i = 0; i < layers.length; i++) {
    name = layers[i].getName();
    div = document.createElement('div'),
    div.textContent = name;
    div.setAttribute('class', 'layer-labels');
    div.setAttribute('id', name.concat("_label"));
    document.getElementById("labelDiv").appendChild(div);

    layerLabelsDivs.push(div);
    layerLabelsDivs[i].style.display = "inline-block";
    layerLabelsDivs[i].style.color = globalLabelColor;
  }
};

const setLabelColorVariable = (labelColor) => {
  globalLabelColor = labelColor;
  setLabelColor();
};

const setLabelColor = () => {
  let i;

  for (i = 0; i < layerLabelsDivs.length; i++)
    layerLabelsDivs[i].style.color = globalLabelColor;

  for (i = 0; i < nodeLabelsDivs.length; i++)
    nodeLabelsDivs[i].style.color = globalLabelColor;
};

// Handlers ======
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
    layerLabelsDivs[i].style.display = "inline-block";

  renderLayerLabelsFlag = true;
};

const setGlobalLayerLabelFlags = (allFlag, selectedFLag) => {
  showAllLayerLabelsFlag = allFlag;
  showSelectedLayerLabelsFlag = selectedFLag;
};

const showSelectedLayerLabels = () => {
  setGlobalLayerLabelFlags(false, true);

  for (let i = 0; i < layers.length; i++) {
    if (layers[i].isSelected)
      layerLabelsDivs[i].style.display = "inline-block";
    else
      layerLabelsDivs[i].style.display = "none";
  }

  renderLayerLabelsFlag = true;
};

const hideAllLayerLabels = () => {
  setGlobalLayerLabelFlags(false, false);

  for (let i = 0; i < layers.length; i++)
      layerLabelsDivs[i].style.display = "none";
};

const resizeLayerLabels = (size) => {
  for (let i = 0; i < layerLabelsDivs.length; i++)
    layerLabelsDivs[i].style.fontSize = size.toString().concat("px");
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

const resizeNodeLabels = (size) => {
  for (let i = 0; i < nodeLabelsDivs.length; i++)
    nodeLabelsDivs[i].style.fontSize = size.toString().concat("px");
};

// on animate ======
const renderLayerLabels = () => {
  if (renderLayerLabelsFlag) {

    if (showAllLayerLabelsFlag)
      redrawLayerLabels("all");
    else {
      if (showSelectedLayerLabelsFlag) {
        let selected_layers = getSelectedLayers();

        removeAllLayerLabels();
        if (selected_layers.length > 0)
          redrawLayerLabels("selected");
      }
    }

    renderLayerLabelsFlag = false;
  }
};

const removeAllLayerLabels = () => {
  for (let i = 0; i < layers.length; i++)
    layerLabelsDivs[i].style.display = "none";
};

const redrawLayerLabels = (mode) => {
  let  layerArray, position,
    hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox"),
    layerX, layerY, labelX, labelY,
    layer_spheres = layers.map(({ sphere }) => sphere);

  layerArray = mode === "all" ? layers.map(({ name }) => name) : getSelectedLayers();

  for (let i = 0; i < layerArray.length; i++) {
    position = mode == "selected" ? layerArray[i] : i;
    
    if (!hidelayerCheckboxes[position].checked) { 
      layerX = layer_spheres[position].getWorldPosition(new THREE.Vector3()).x,
      layerY = layer_spheres[position].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + layerX;
      labelY = yBoundMax - layerY;

      layerLabelsDivs[position].style.left = labelX.toString().concat("px");
      layerLabelsDivs[position].style.top = labelY.toString().concat("px");
      layerLabelsDivs[position].style.display = "inline-block";
    } else
      layerLabelsDivs[position].style.display = "none";
  }
};

const renderNodeLabels = () => {
  if (renderNodeLabelsFlag) {

    let nodeX, nodeY, labelX, labelY;

    for (let i = 0; i < nodeObjects.length; i++) {
      if (nodeObjects[i].showLabel) { 
        nodeX = nodeObjects[i].getWorldPosition("x");
        nodeY = nodeObjects[i].getWorldPosition("y");
        labelX = xBoundMax + nodeX + 7;
        labelY = yBoundMax - nodeY - 10;
        
        nodeLabelsDivs[i].style.left = labelX.toString().concat("px");
        nodeLabelsDivs[i].style.top = labelY.toString().concat("px");
        nodeLabelsDivs[i].style.display = "inline-block";
      } else
        nodeLabelsDivs[i].style.display = "none";
    }
  
  renderNodeLabelsFlag = false;
  }
};
