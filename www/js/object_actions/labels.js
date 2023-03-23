const createLabels = () => {
  //nodes
  for (let i = 0; i < nodes.length; i++){
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
  for (i = 0; i < layers.length; i++) {
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
  for (i=0; i<layer_label_divs.length; i++) layer_label_divs[i].style.color = globalLabelColor;
  for (i=0; i<node_labels.length; i++) node_labels[i].style.color = globalLabelColor;
}

const setLabelColorVariable = (label_color) => {
  globalLabelColor = label_color;
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
  for (i = 0; i < layers.length; i++)
    layer_label_divs[i].style.fontSize = size.toString().concat("px");
};

const showAllNodeLabels = (flag) => { // true or false
  showAllNodeLabelsFlag = flag;
  decideNodeLabelFlags();
}

const showSelectedNodeLabels = (flag) => { // true or false
  showSelectedNodeLabelsFlag = flag;
  decideNodeLabelFlags();
}

const resizeLabels = (message) => {
  let size = message; //message = [1, 20]
  for (let i = 0; i < nodes.length; i++){
    node_labels[i].style.fontSize = size.toString().concat("px");
  }
  return true;
}
