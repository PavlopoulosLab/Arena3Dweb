const scrambleNodes = (yMin, yMax, zMin, zMax) => {
  !yMin && (yMin = yBoundMin)
  !yMax && (yMax = yBoundMax)
  !zMin && (zMin = zBoundMin)
  !zMax && (zMax = zBoundMax)
  for (let i = 0; i < nodes.length; i++){ //random y,z
    nodes[i].translateY(getRandomArbitrary(yMin, yMax));
    nodes[i].translateZ(getRandomArbitrary(zMin, zMax));
  }
}

// Called from mouse move event
// @return bool
const checkHoverOverNode = (event) => {
  setRaycaster(event);
  let intersects = RAYCASTER.intersectObjects(nodes),
    event_flag = false, //for performance optimization
    index,
    hover_flag = false;
    
  if (intersects.length > 0) {
    hover_flag = true;
    
    if (last_hovered_node_index != ""){
      hovered_nodes = hovered_nodes.filter(function(value, index, arr){ return value != last_hovered_node_index;});
      nodes[last_hovered_node_index].material.opacity = 1;
      last_hovered_node_index = "";
      event_flag = true;
    }
    intersects[0].object.material.opacity = 0.5;
    last_hovered_node_index = findIndexByUuid(nodes, intersects[0].object.uuid);
    if (!exists(hovered_nodes, last_hovered_node_index)) hovered_nodes.push(last_hovered_node_index);
    event_flag = true;
  } else {
    if (last_hovered_node_index != ""){
      hovered_nodes = hovered_nodes.filter(function(value, index, arr){ return value != last_hovered_node_index;});
      nodes[last_hovered_node_index].material.opacity = 1;
      last_hovered_node_index = "";
      event_flag = true;
    } else hovered_nodes = [];
  }
  
  if (event_flag) decideNodeLabelFlags(); //performance optimization
  
  return hover_flag;
}

// with ray caster
const checkNodeInteraction = (event) => {
  setRaycaster(event);
  let intersects = RAYCASTER.intersectObjects(nodes);
  let node_selection = false;
  if (intersects.length > 0) {
    node_selection = true;
    let ind = findIndexByUuid(nodes, intersects[0].object.uuid);
    if (exists(selectedNodePositions, ind)){
      if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
        pos = node_attributes.Node.indexOf(node_whole_names[ind]);
        if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
          nodes[ind].material.color = new THREE.Color( node_attributes.Color[pos] );
        else nodes[ind].material.color = new THREE.Color(colorVector[(layer_groups[node_groups[node_whole_names[ind]]])%colorVector.length]);
      } else nodes[ind].material.color = new THREE.Color(colorVector[(layer_groups[node_groups[node_whole_names[ind]]])%colorVector.length]);
      selectedNodePositions = selectedNodePositions.filter(function(value, index, arr){ return value != ind;}); //array remove/filter
    } else {
      selectedNodePositions.push(ind);
      if (selectedNodeColorFlag) nodes[ind].material.color = new THREE.Color( selectedDefaultColor );
    }
  }

  decideNodeLabelFlags();
  updateSelectedNodesRShiny();
  return node_selection;
}

// shift + drag left click
const lassoSelectNodes = (x, y) => {
  //create lasso rectangle graphics
  scene.remove(lasso);
  let points = [];
	points.push( new THREE.Vector3(shiftX, shiftY, 0), new THREE.Vector3(x, shiftY, 0), new THREE.Vector3(x, y, 0), new THREE.Vector3(shiftX, y, 0), new THREE.Vector3(shiftX, shiftY, 0) );
	let geometry = new THREE.BufferGeometry().setFromPoints( points );
	let material = new THREE.LineBasicMaterial( { color: "#eef1b6" } );
	lasso = new THREE.Line( geometry, material );
	scene.add(lasso);
  //check node interaction
  let minX = Math.min(shiftX, x);
  let maxX = Math.max(shiftX, x);
  let minY = Math.min(shiftY, y);
  let maxY = Math.max(shiftY, y);
  for (let i = 0; i < nodes.length; i++){
    let nodeX = nodes[i].getWorldPosition(new THREE.Vector3()).x;
    let nodeY = nodes[i].getWorldPosition(new THREE.Vector3()).y;
    if (nodeX < maxX && nodeX > minX && nodeY < maxY && nodeY > minY){
      nodes[i].material.opacity = 0.5;
    } else {
      nodes[i].material.opacity = 1;
    }
  }
  return true;
}

const translateNodes = (e) => {
  let step, i;
    
  if (e.screenX - e.screenY >=  mousePreviousX - mousePreviousY) step = 20;
  else step =-20;
  
  if (scene.axisPressed=="z"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateZ(step);
    }
  /*} else if (scene.axisPressed=="x"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateX(step);
    }*/
  } else if (scene.axisPressed=="c"){
    for (i = 0; i < selectedNodePositions.length; i++){
      nodes[selectedNodePositions[i]].translateY(step);
    }
  }
  redrawEdges();
  updateNodesRShiny();
}

// logic behind node label show/hide
// TODO change checked calculation with checkbox names
const decideNodeLabelFlags = () => {
  let c = document.getElementById("checkboxdiv").children,
      node_layer = "";
  for (i = 0; i < node_names.length; i++){
    node_layer = layer_groups[node_groups[node_whole_names[i]]];
    if (c[node_layer*7+2].checked){ //1. if node's layer not hidden 
      node_label_flags[i] = false;
    } else if (showAllNodeLabelsFlag){ //2. if showing all node labels
      node_label_flags[i] = true;
    } else if (layer_node_labels_flags[node_layer]){ //3. if showing layer node labels
      node_label_flags[i] = true;
    } else if (showSelectedNodeLabelsFlag && exists(selectedNodePositions, i)){ //4. if showing selected node labels, and node is selected
      node_label_flags[i] = true;
    } else if (exists(hovered_nodes, i)){ //5. if hovering over node(s)
      node_label_flags[i] = true;
    } else node_label_flags[i] = false; //6. if none of the above apply, don't show label
  }
  return true;
}      
