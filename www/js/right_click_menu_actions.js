//This function returns node IDs of requested node's inter-layer neighbors
//iterates global variable edge_pairs (String Array, separating node couples by ---)
//@param node (integer): node whose neighbors are requested
//@return int array of neighbor IDs
const interLayerNeighbors = (node) => {
  let i, edge_split, index1, index2, neighbors = [];
  //TODO
  for (i = 0; i < edge_pairs.length; i++){
    edge_split = edge_pairs[i].split("---");
    index1 = node_whole_names.indexOf(edge_split[0]);
    index2 = node_whole_names.indexOf(edge_split[1]);
    if (node == index1) neighbors.push(index2);
    else if (node == index2) neighbors.push(index1);
  }
  return neighbors;
}

//This function returns the inter-layer edge connecting two nodes if exists, else null
//iterates global variable edge_pairs (String Array, separating node couples by ---)
//@param node1 (integer): first node
//@param node2 (integer): second node
//@return: String of inter-layer edge pair (as found in the edge_pairs array) or null if not found
const getInterLayerEdge = (node1, node2) => {
  let i, edge_split, index1, index2;
  //TODO
  for (i = 0; i < edge_pairs.length; i++){
    edge_split = edge_pairs[i].split("---");
    index1 = node_whole_names.indexOf(edge_split[0]);
    index2 = node_whole_names.indexOf(edge_split[1]);
    if ((node1 == index1 && node2 == index2) || (node1 == index2 && node2 == index1)) return edge_pairs[i];
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
  let neighbors, i, toCheckLayer, interLayerEdge, pos;
  if (!exists(downstreamCheckedNodes, currentNode)){
    downstreamCheckedNodes.push(currentNode);
    //selecting and painting node
    if (!exists(selectedNodePositions, currentNode)){
      selectedNodePositions.push(currentNode);
      if (selectedNodeColorFlag) nodes[currentNode].material.color = new THREE.Color( selectedDefaultColor );
    }
    //selecting and painting edge
    if (currentNode != previousNode){ //skipping first node call check wiuth itself
      interLayerEdge = getInterLayerEdge(currentNode, previousNode);
      if (interLayerEdge !== null){
        pos = edge_pairs.indexOf(interLayerEdge); //integer position of edge name in all-edges array
        if (!exists(selected_edges, pos)){
          selected_edges.push(pos);
          pos = layer_edges_pairs.indexOf(pos); //integer position needed for line object to be painted correctly
          if (selectedNodeColorFlag) changeColor(layerEdges[pos], selectedDefaultColor);
        }
      }
    }
    //find node inter-layer neighbors and continue recursively
    neighbors = interLayerNeighbors(currentNode);
    for (i = 0; i < neighbors.length; i++){
      toCheckLayer = node_groups[node_whole_names[neighbors[i]]];
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
  new_color = new THREE.Color( selectedDefaultColor );
  if (item.options[item.selectedIndex].text == "Select Neighbors"){ //select neighbors
    let pos = -1;
    for (let i = 0; i < edge_pairs.length; i++){ //random x,y,z
      let edge_split = edge_pairs[i].split("---");
      index1 = node_whole_names.indexOf(edge_split[0]);
      index2 = node_whole_names.indexOf(edge_split[1]);
      if (index1 == item.value) {
        if (!exists(selectedNodePositions, index2)) {
          selectedNodePositions.push(index2);
          if (selectedNodeColorFlag) changeColor(nodes[index2], new_color);
        }
        if (!exists(selected_edges, i)) {
          selected_edges.push(i);
            if (selectedEdgeColorFlag){
              if (typeof(edges[i]) == "number") {
                pos = layer_edges_pairs.indexOf(i);
                changeColor(layerEdges[pos], new_color);
              } else changeColor(edges[i], new_color);
            }
        }
      } else if (index2 == item.value) {
        if (!exists(selectedNodePositions, index1)){
          selectedNodePositions.push(index1);
          if (selectedNodeColorFlag) changeColor(nodes[index1], new_color);
        }
        if (!exists(selected_edges, i)){
          selected_edges.push(i);
          if (selectedEdgeColorFlag){
            if (typeof(edges[i]) == "number") {
              pos = layer_edges_pairs.indexOf(i);
              changeColor(layerEdges[pos], new_color);
            } else changeColor(edges[i], new_color); 
          }
        }
      }
    }
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
  } else if (item.options[item.selectedIndex].text == "Select MultiLayer Path"){
    let tempSelectedNodes = [],
        checkedNodes = [],
        flag = false,
        currentNode = item.value,
        startingLayer = node_groups[node_whole_names[currentNode]];
    startLoader(true);
    while (!flag){
      let pos = -1;
      for (let i = 0; i < edge_pairs.length; i++){
        let edge_split = edge_pairs[i].split("---");
        index1 = node_whole_names.indexOf(edge_split[0]);
        index2 = node_whole_names.indexOf(edge_split[1]);
        if (index1 == currentNode && node_groups[node_whole_names[index2]] != startingLayer && node_groups[node_whole_names[index2]] != node_groups[node_whole_names[index1]] && !(exists(tempSelectedNodes, index2))){ //path must not contain other nodes in starting layer or its own layer
          tempSelectedNodes.push(index2);
          // code from Select neighbors above
          if (!exists(selectedNodePositions, index2)){
            selectedNodePositions.push(index2);
            if (selectedNodeColorFlag) changeColor(nodes[index2], new_color);  
          }
          if (!exists(selected_edges, i)){
            selected_edges.push(i);
            if (selectedEdgeColorFlag){
              if (typeof(edges[i]) == "number") {
                pos = layer_edges_pairs.indexOf(i);
                changeColor(layerEdges[pos], new_color); 
              } else changeColor( edges[i], new_color);
            }
          } //until here
        } else if (index2 == currentNode && node_groups[node_whole_names[index1]] != startingLayer && node_groups[node_whole_names[index2]] != node_groups[node_whole_names[index1]] && !(exists(tempSelectedNodes, index1))){
          tempSelectedNodes.push(index1);
          // code from Select neighbors above
          if (!exists(selectedNodePositions, index1)){
            selectedNodePositions.push(index1);
            if (selectedNodeColorFlag) changeColor(nodes[index1], new_color);
          }
          if (!exists(selected_edges, i)){
            selected_edges.push(i);
            if (selectedEdgeColorFlag){
              if (typeof(edges[i]) == "number") {
                pos = layer_edges_pairs.indexOf(i);
                changeColor(layerEdges[pos], new_color);
              } else changeColor(edges[i], new_color);
            }
          } //until here
        }
      }
      //decide flag for exit, if no new nodes 
      checkedNodes.push(currentNode);
      let difference = tempSelectedNodes.filter(x => !checkedNodes.includes(x));
      if (difference.length === 0) flag = true;
      else currentNode = difference[0];
    }
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
    finishLoader(true);
  } else if (item.options[item.selectedIndex].text == "Select Downstream Path"){
    let currentNode = item.value, //int
        layerPath = [node_groups[node_whole_names[currentNode]]]; //array of 1 element at start
    startLoader(true);
    ///////////////////////////////
    recursiveDownstreamHighlight(layerPath, currentNode, currentNode);
    downstreamCheckedNodes = []; //resetting global variable
    ////////////////////////
    decideNodeLabelFlags();
    updateSelectedNodesRShiny();
    finishLoader(true);
  } else if (item.options[item.selectedIndex].text == "Link") window.open(item.value);
  else if (item.options[item.selectedIndex].text == "Description"){
    let descrDiv = document.getElementById("descrDiv"),
        p = descrDiv.getElementsByTagName('p')[0];
    p.innerHTML = item.value;
    descrDiv.style.display ="inline-block";
  }
  return true;
}
