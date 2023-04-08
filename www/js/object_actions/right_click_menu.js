const executeCommand = (item) => {
  let selectedOption = item.options[item.selectedIndex].text;
  
  if (selectedOption !== "-") {
    startLoader();
    if (selectedOption == "Select Neighbors") {
      executeSelectNeightborsCommand(item);
    } else if (selectedOption == "Select MultiLayer Path") {
      executeSelectMultiLayerPathCommand(item);
    } else if (selectedOption == "Select Downstream Path") {
      executeSelectDownstreamPathCommand(item);
    } else if (selectedOption == "Link") {
      window.open(item.value);
    } else if (selectedOption == "Description") {
      let descrDiv = document.getElementById("descrDiv"),
        p = descrDiv.getElementsByTagName('p')[0];

      p.innerHTML = item.value;
      descrDiv.style.display = "inline-block";
    }
  
    renderInterLayerEdgesFlag = true;
    redrawIntraLayerEdges();
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();

    finishLoader();
  }
};

const executeSelectNeightborsCommand = (item) => {
  let index1, index2;

  for (let i = 0; i < edgeObjects.length; i++) {
    index1 = nodeLayerNames.indexOf(edgeObjects[i].source);
    index2 = nodeLayerNames.indexOf(edgeObjects[i].target);

    if (index1 == item.value)
      selectNodeAndEdge(index2, i);
    else if (index2 == item.value)
      selectNodeAndEdge(index1, i);
  }
};

const selectNodeAndEdge = (nodeIndex, edgeIndex) => {
  nodeObjects[nodeIndex].isSelected = true;
  repaintNode(nodeIndex);

  edgeObjects[edgeIndex].select();
};

const executeSelectMultiLayerPathCommand = (item) => {
  let flag = false, index1, index2,
    tempSelectedNodes = [],
    currentNode = item.value,
    startingLayer = nodeGroups[nodeLayerNames[currentNode]],
    checkedNodes = [],
    arrayDifference;

  while (!flag) {
    for (let i = 0; i < edgeObjects.length; i++) {
      index1 = nodeLayerNames.indexOf(edgeObjects[i].source);
      index2 = nodeLayerNames.indexOf(edgeObjects[i].target);

      if (index1 == currentNode &&
        nodeGroups[nodeLayerNames[index2]] != startingLayer && // path must not contain other nodes in starting layer
        nodeGroups[nodeLayerNames[index2]] != nodeGroups[nodeLayerNames[currentNode]] && // or its own layer
        !(exists(tempSelectedNodes, index2))) {
          tempSelectedNodes.push(index2);
          selectNodeAndEdge(index2, i);
      } else if (index2 == currentNode &&
        nodeGroups[nodeLayerNames[index1]] != startingLayer &&
        nodeGroups[nodeLayerNames[currentNode]] != nodeGroups[nodeLayerNames[index1]] &&
        !(exists(tempSelectedNodes, index1))) {
          tempSelectedNodes.push(index1);
          selectNodeAndEdge(index1, i);
      }
    }
    
    // decide flag for exit, if no unchecked nodes 
    checkedNodes.push(currentNode);
    arrayDifference = tempSelectedNodes.filter(x => !checkedNodes.includes(x));
    if (arrayDifference.length === 0)
      flag = true;
    else
      currentNode = arrayDifference[0];
  }
};

const executeSelectDownstreamPathCommand = (item) => {
  let currentNode = item.value,
    layerPath = [nodeGroups[nodeLayerNames[currentNode]]]; // begin with array of 1 layer
  
  recursiveDownstreamHighlight(layerPath, currentNode);
  downstreamCheckedNodes = []; // resetting global variable
};

// This function highlights recursively downstream nodes from the clicked node on the starting layer.
// Makes use of global variable downstreamCheckedNodes (int array) to keep track of already checked nodes for avoiding re-checks
// @param layerPath (String Array): current path's already checked Layers
// @param currentNode (integer): current node, whose Layer must be the last in the layerPath array
// @param previousNode (integer): previous node, to figure which edge to paint
const recursiveDownstreamHighlight = (layerPath, currentNode, previousNode = null) => {
  let interLayerEdge, neighbors, toCheckLayer;
  
  if (!exists(downstreamCheckedNodes, currentNode)) {
    downstreamCheckedNodes.push(currentNode);

    if (previousNode !== null) { // skipping first node call
      interLayerEdge = getInterLayerEdge(currentNode, previousNode);
      if (interLayerEdge !== null)
        selectNodeAndEdge(currentNode, interLayerEdge);
    }
    
    // find node inter-layer neighbors and continue recursively
    neighbors = getInterLayerNeighbors(currentNode);
    for (let i = 0; i < neighbors.length; i++) {
      toCheckLayer = nodeGroups[nodeLayerNames[neighbors[i]]];
      if (!exists(layerPath, toCheckLayer)) {
        layerPath.push(toCheckLayer);
        recursiveDownstreamHighlight(layerPath, neighbors[i], currentNode);
        layerPath.pop();
      }
    }
  }
};

// This function returns the inter-layer edge connecting two nodes if exists, else null
const getInterLayerEdge = (node1, node2) => {
  let index1, index2;

  for (let i = 0; i < edgeObjects.length; i++) {
    if (edgeObjects[i].interLayer) {
      index1 = nodeLayerNames.indexOf(edgeObjects[i].source);
      index2 = nodeLayerNames.indexOf(edgeObjects[i].target);
      
      if ((node1 == index1 && node2 == index2) ||
        (node1 == index2 && node2 == index1))
          return(i)
    }
  }

  return(null)
};

// This function returns the node IDs of requested node's inter-layer neighbors
// @param node (integer): node whose neighbors are requested
// @return int array of neighbor IDs
const getInterLayerNeighbors = (node) => {
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
};
