const createLabels = () => {
  //nodes
  for (let i = 0; i < nodes.length; i++){
    let div = document.createElement('div');
    div.textContent = node_names[i];
    div.setAttribute('class', 'labels');
    div.setAttribute('id', node_whole_names[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    node_labels.push(div);
    node_labels[i].style.fontSize = nodeLabelDefaultSize;
    node_labels[i].style.display = "none"; //hiding labels on creation
    node_labels[i].style.color = globalLabelColor;
  }
  //layers
  for (i = 0; i < layer_names.length; i++){
    let div = document.createElement('div');
    div.textContent = layer_names[i];
    div.setAttribute('class', 'layer-labels');
    div.setAttribute('id', layer_names[i].concat("_label"));
    document.getElementById("labelDiv").appendChild(div);
    layer_labels.push(div);
    layer_labels[i].style.display = "inline-block"; //hiding labels on creation
    layer_labels[i].style.color = globalLabelColor;
  }
  return true;
}

const setLabelColor = () =>{
  let i;
  for (i=0; i<layer_labels.length; i++) layer_labels[i].style.color = globalLabelColor;
  for (i=0; i<node_labels.length; i++) node_labels[i].style.color = globalLabelColor;
}