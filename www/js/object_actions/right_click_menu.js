//This function returns node IDs of requested node's inter-layer neighbors
//iterates global variable edgePairs (String Array, separating node couples by ---)
//@param node (integer): node whose neighbors are requested
//@return int array of neighbor IDs
const interLayerNeighbors = (node) => {
  let index1, index2, neighbors = [];
  for (let i = 0; i < edgeObjects.length; i++) {
    index1 = nodeLayerNames.indexOf(edgeObjects[i].source);
    index2 = nodeLayerNames.indexOf(edgeObjects[i].target);
    if (node == index1)
      neighbors.push(index2);
    else if (node == index2)
      neighbors.push(index1);
  }
  return(neighbors)
}

// This function returns the inter-layer edge connecting two nodes if exists, else null
const getInterLayerEdge = (node1, node2) => {
  let index1, index2;
  for (let i = 0; i < edgeObjects.length; i++) {
    index1 = nodeLayerNames.indexOf(edgeObjects[i].source);
    index2 = nodeLayerNames.indexOf(edgeObjects[i].target);
    if ((node1 == index1 && node2 == index2) || (node1 == index2 && node2 == index1))
      return edgeObjects[i].name;
  }
  return null;
}

//This function highlights recursively downstream nodes from the clicked node on the starting layer
//makes use of global variable downstreamCheckedNodes (int array) to keep track of already checked nodes for avoiding re-checks
//@param layerPath (String Array): current path's already checked Layers
//@param currentNode (integer): current node, whose Layer must be the last in the layerPath array
//@param previousNode (integer): previous node, to figure which edge to paint
//@return void
const recursiveDownstreamHighlight = (layerPath, currentNode, previousNode) => {
  let neighbors, toCheckLayer, interLayerEdge, pos;
  
  if (!exists(downstreamCheckedNodes, currentNode)){
    downstreamCheckedNodes.push(currentNode);
    //selecting and painting node
    if (!nodeObjects[currentNode].isSelected) {
      nodeObjects[currentNode].isSelected = true;
      if (selectedNodeColorFlag)
        nodeObjects[currentNode].setColor(SELECTED_DEFAULT_COLOR);
    }
    //selecting and painting edge
    if (currentNode != previousNode){ // skipping first node call check with itself
      interLayerEdge = getInterLayerEdge(currentNode, previousNode);
      if (interLayerEdge !== null) {
        pos = edgePairs.indexOf(interLayerEdge); //integer position of edge name in all-edges array
        edgeObjects[pos].select();
      }
    }
    //find node inter-layer neighbors and continue recursively
    neighbors = interLayerNeighbors(currentNode);
    for (let i = 0; i < neighbors.length; i++) {
      toCheckLayer = nodeGroups[nodeLayerNames[neighbors[i]]];
      if (!exists(layerPath, toCheckLayer)){
        layerPath.push(toCheckLayer);
        recursiveDownstreamHighlight(layerPath, neighbors[i], currentNode);
        layerPath.pop();
      }
    }
  }
  return true;
}

const executeCommand = (item) => {
  if (item.options[item.selectedIndex].text == "Select Neighbors"){ //select neighbors
    for (let i = 0; i < edgeObjects.length; i++){ //random x,y,z
      index1 = nodeLayerNames.indexOf(edgeObjects[i].source);
      index2 = nodeLayerNames.indexOf(edgeObjects[i].target);
      if (index1 == item.value) {
        if (!nodeObjects[index2].isSelected) {
          nodeObjects[index2].isSelected = true;
          if (selectedNodeColorFlag)
            nodeObjects[index2].setColor(SELECTED_DEFAULT_COLOR);
        }
        edgeObjects[i].select();
      } else if (index2 == item.value) {
        if (!nodeObjects[index1].isSelected){
          nodeObjects[index1].isSelected = true;
          if (selectedNodeColorFlag)
            nodeObjects[index1].setColor(SELECTED_DEFAULT_COLOR);
        }
        edgeObjects[i].select();
      }
    }
    renderInterLayerEdgesFlag = true;
    redrawIntraLayerEdges();
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
  } else if (item.options[item.selectedIndex].text == "Select MultiLayer Path"){
    let tempSelectedNodes = [],
        checkedNodes = [],
        flag = false,
        currentNode = item.value,
        startingLayer = nodeGroups[nodeLayerNames[currentNode]];
    startLoader();
    while (!flag) {
      for (let i = 0; i < edgeObjects.length; i++){
        index1 = nodeLayerNames.indexOf(edgeObjects[i].source);
        index2 = nodeLayerNames.indexOf(edgeObjects[i].target);
        if (index1 == currentNode && nodeGroups[nodeLayerNames[index2]] != startingLayer && nodeGroups[nodeLayerNames[index2]] != nodeGroups[nodeLayerNames[index1]] && !(exists(tempSelectedNodes, index2))){ //path must not contain other nodes in starting layer or its own layer
          tempSelectedNodes.push(index2);
          // code from Select neighbors above
          if (!nodeObjects[index2].isSelected) {
            nodeObjects[index2].isSelected = true;
            if (selectedNodeColorFlag)
              nodeObjects[index2].setColor(SELECTED_DEFAULT_COLOR); 
          }
          edgeObjects[i].select();
          //until here
        } else if (index2 == currentNode && nodeGroups[nodeLayerNames[index1]] != startingLayer && nodeGroups[nodeLayerNames[index2]] != nodeGroups[nodeLayerNames[index1]] && !(exists(tempSelectedNodes, index1))){
          tempSelectedNodes.push(index1);
          // code from Select neighbors above
          if (!nodeObjects[index1].isSelected){
            nodeObjects[index1].isSelected = true;
            if (selectedNodeColorFlag)
              nodeObjects[index1].setColor(SELECTED_DEFAULT_COLOR);
          }
          edgeObjects[i].select(); //until here
        }
      }
      //decide flag for exit, if no new nodes 
      checkedNodes.push(currentNode);
      let difference = tempSelectedNodes.filter(x => !checkedNodes.includes(x));
      if (difference.length === 0)
        flag = true;
      else
        currentNode = difference[0];
    }
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
    renderInterLayerEdgesFlag = true;
    redrawIntraLayerEdges();
    finishLoader();
  } else if (item.options[item.selectedIndex].text == "Select Downstream Path"){
    let currentNode = item.value, //int
        layerPath = [nodeGroups[nodeLayerNames[currentNode]]]; //array of 1 element at start
    startLoader();
    ///////////////////////////////
    recursiveDownstreamHighlight(layerPath, currentNode, currentNode);
    downstreamCheckedNodes = []; //resetting global variable
    ////////////////////////
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
    renderInterLayerEdgesFlag = true;
    redrawIntraLayerEdges();
    finishLoader();
  } else if (item.options[item.selectedIndex].text == "Link") // Link
    window.open(item.value);
  else if (item.options[item.selectedIndex].text == "Description") { // Description
    let descrDiv = document.getElementById("descrDiv"),
        p = descrDiv.getElementsByTagName('p')[0];
    p.innerHTML = item.value;
    descrDiv.style.display ="inline-block";
  }
  return true;
}
