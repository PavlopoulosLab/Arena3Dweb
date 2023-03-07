// on mouse wheel scroll
const sceneZoom = (event) => {
  if (scene.exists()) {
    scene.zoom(event.deltaY);

    updateScenePanRShiny();
    updateLayersRShiny();
    updateNodesRShiny();
  }
  return true;
}

// on arrow keys press or axis select ot rotate layers
const sceneArrowPan = (event) => {
  if (scene.exists()) {
    if (event.keyCode == 90) axisPressed = 'z';
    if (event.keyCode == 88) axisPressed = 'x';
    if (event.keyCode == 67) axisPressed = 'c';
    if (event.keyCode == 37) scene.translateX(-25); //left
    if (event.keyCode == 38) scene.translateY(25); //up
    if (event.keyCode == 39) scene.translateX(25); //right
    if (event.keyCode == 40) scene.translateY(-25); // down
    updateScenePanRShiny();
    updateLayersRShiny();
    updateNodesRShiny();
  }
  return true;
}

const axisRelease = (event) => {
  if (scene.exists()) {
    axisPressed = "";
  }
  return true;
}

// mouse keys press event
const clickDown = (event) => {
  if (scene.exists()) {
    //console.log(event); //mouse: 0 left, 1 middle, 2 right click
    if (event.button == 0){
      leftClickPressed = true;
      middleClickPressed = false;
      if (event.shiftKey && shiftX == ""){
        shiftX = event.layerX - xBoundMax;
        shiftY = yBoundMax - event.layerY; //then implementing drag
      }
    } else if (event.button == 1){
      middleClickPressed = true;
      leftClickPressed = false;
    } else{
      middleClickPressed = false;
      leftClickPressed = false;
    }
  }
  return true;
}

// while mouse button held, drag event
const clickDrag = (event) => {
  if (scene.exists()) {
    let distance = Math.sqrt(Math.pow(previousX-event.screenX, 2) + Math.pow(previousY-event.screenY, 2)),
      node_hover_flag = false;

    if (distance > 10){
      let x = event.screenX,
        y = event.screenY;
        
      if (leftClickPressed){
        dragging = true;
        if (event.shiftKey){
          last_hovered_layer_index = ""; // to be able to lasso inside layer
          lassoSelectNodes(event.layerX - xBoundMax, yBoundMax - event.layerY);
        } 
        else if (axisPressed !== "" && selectedNodePositions.length > 0) translateNodes(event);
        else if (axisPressed !== "") rotateLayers(event);
        else if (last_hovered_layer_index === "" && last_hovered_node_index === "") sceneDragPan(x, y); // && !event.ctrlKey
      } else if (middleClickPressed){
        dragging = true;
        event.preventDefault();
        sceneOrbit(x, y);
      }
      previousX = x;
      previousY = y;
    } // end if distance
    
    if (!leftClickPressed && !middleClickPressed) {
      node_hover_flag = checkHoverOverNode(event);
      checkHoverOverLayer(event, node_hover_flag);
    }
  }
  return true;
}

const clickUp = (event) => {
  if (scene.exists()) {
    dragging = false;
    if (event.button == 0){
      leftClickPressed = false;
      if (optionsList != ""){
        document.getElementById("labelDiv").removeChild(optionsList);
        optionsList = "";
      }
      if (lasso != 0){
        for (let i = 0; i < nodes.length; i++){
          if (nodes[i].material.opacity == 0.5){
            nodes[i].material.opacity = 1;
            if (!exists(selectedNodePositions, i)){
              selectedNodePositions.push(i);
              if (selectedNodeColorFlag) nodes[i].material.color = new THREE.Color( selectedDefaultColor );
            }
          }
        }
        decideNodeLabelFlags();
        updateSelectedNodesRShiny();
      }
      shiftX = "";
      shiftY = "";
      scene.remove(lasso);
      lasso = "";
    } else if (event.button == 1){
      middleClickPressed = false;
    }
  }
  return true;
}

// double click event (left mouse), uncheck nodes
const dblClick = (event) => {
  if (scene.exists()) {
    let node_selection = checkNodeInteraction(event); //priority 1
      if (!node_selection) {
        let layer_selection = checkLayerInteraction(event); //priority 2
        if (!layer_selection) { //priority 3
          selectedNodePositions = [],
          selected_edges = [];
          let pos1 = pos2 = pos3 = -1;
          for (let i = 0; i < nodes.length; i++){
            if (node_attributes !== "" && nodeAttributesPriority){ //check if color is overidden by user
              pos = node_attributes.Node.indexOf(node_whole_names[i]);
              if (pos > -1 && node_attributes.Color !== undefined && node_attributes.Color[pos] !== "" && node_attributes.Color[pos] != " ") //if node exists in node attributes file
                nodes[i].material.color = new THREE.Color( node_attributes.Color[pos] );
              else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]])%colors.length]);
            } else if (nodes[i].userData.cluster)  nodes[i].material.color = new THREE.Color(colors[nodes[i].userData.cluster]);
            else nodes[i].material.color = new THREE.Color(colors[(layer_groups[node_groups[node_whole_names[i]]]) % colors.length]);
          }
          decideNodeLabelFlags();
          for (i = 0; i < edges.length; i++){
            if (edge_attributes !== "" && edgeAttributesPriority){ //check if color is overidden by user
              pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[i]);
              pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[i]);
              if (pos1 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " "){//if node not currently selected and exists in node attributes file and color is assigned
                if (typeof (edges[i]) == "number") { //edge is inter-layer
                  pos3 = layer_edges_pairs.indexOf(i);
                  changeColor(layerEdges[pos3], edge_attributes.Color[pos3]);
                }
                else changeColor(edges[i], edge_attributes.Color[pos3]);
              }
              else if (pos2 > -1 && edge_attributes.Color !== undefined && edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " "){ 
                if (typeof(edges[i]) == "number"){ //edge is inter-layer
                  pos3 = layer_edges_pairs.indexOf(i);
                  changeColor(layerEdges[pos3], edge_attributes.Color[pos2]);
                } else changeColor(edges[i], edge_attributes.Color[pos2]);
              }
              else{
                if (typeof(edges[i]) == "number") {
                  pos3 = layer_edges_pairs.indexOf(i);
                  changeColor(layerEdges[pos3], edgeDefaultColor);
                } else changeColor(edges[i], edgeDefaultColor);
              }
            } else{
              if (typeof (edges[i]) == "number") {
                pos3 = layer_edges_pairs.indexOf(i);
                changeColor(layerEdges[pos3], edgeDefaultColor);
              } else changeColor(edges[i], edgeDefaultColor);
            } 
          }
          redrawEdges();
          updateSelectedNodesRShiny();
        }
      }
  }
  return true;
}

// right mouse click on node
const replaceContextMenuOverNode = (evt) => { 
  if (optionsList != ""){
    document.getElementById("labelDiv").removeChild(optionsList);
    optionsList = "";
  }
  let pos = "";
  for (let i = 0; i < nodes.length; i++){
    let nodeX = xBoundMax + nodes[i].getWorldPosition(new THREE.Vector3()).x;
    let nodeY = yBoundMax - nodes[i].getWorldPosition(new THREE.Vector3()).y;
    if (Math.pow(nodeX - evt.layerX, 2) + Math.pow(nodeY - evt.layerY, 2) <= Math.pow((sphereRadius+1), 2)){
      evt.preventDefault();
      //creating list and appending to 3d-graph div
      optionsList = document.createElement("select");
      optionsList.setAttribute('class', 'optionsBox');
      optionsList.setAttribute('id', 'mySelect');
      optionsList.setAttribute('onchange', 'executeCommand(this)');
      optionsList.style.left = nodeX.toString().concat("px");
      optionsList.style.top = nodeY.toString().concat("px");
      optionsList.style.display = "inline-block";
      //Neighbors
      let option = document.createElement("option");
      option.value = ""; //option 0
      option.text = "-";
      optionsList.appendChild(option);
      option = document.createElement("option");
      option.value = i; //option 1
      option.text = "Select Neighbors";
      optionsList.appendChild(option);
      //MultiLayer Path
      option = document.createElement("option");
      option.value = i; //option 2
      option.text = "Select MultiLayer Path";
      optionsList.appendChild(option);
      //Downstream Path
      option = document.createElement("option");
      option.value = i; //option 3
      option.text = "Select Downstream Path";
      optionsList.appendChild(option);
      if (node_attributes !== ""){
        pos = node_attributes.Node.indexOf(node_whole_names[i]);
        if (pos > -1){
          if (node_attributes.Url !== undefined && node_attributes.Url[pos] !== "" && node_attributes.Url[pos] != " " && node_attributes.Url[pos] != null){
            option = document.createElement("option");
            option.value = node_attributes.Url[pos];
            option.text = "Link"; //option 3
            optionsList.appendChild(option);
          }
          if (node_attributes.Description !== undefined && node_attributes.Description[pos] !== "" && node_attributes.Description[pos] != " " && node_attributes.Description[pos] != null){
            option = document.createElement("option");
            option.value = node_attributes.Description[pos];
            //option.name = i;
            option.text = "Description"; //option 4
            optionsList.appendChild(option);
          }
        }
      }
      document.getElementById("labelDiv").appendChild(optionsList);
      break;
    }
  }
  return true;
}

// on node searchbar key-press
const selectSearchedNodes = (event) => {
  if (scene.exists()) {
    var key = window.event.keyCode;
    // If the user has pressed enter
    if (key === 13) {
      event.preventDefault(); //bypassing newline enter
      startLoader(true);
      var searchString = document.getElementById("searchBar").value.replace(/\n/g, ""),
          tempIndexes, i, j;
      searchString = searchString.split(",");
      for (i=0; i<searchString.length; i++){
        tempIndexes = getAllIndexes(node_names, searchString[i].trim()) //case insensitive function
        if (tempIndexes.length > 0){
          for (j=0; j < tempIndexes.length; j++){
            if (!exists(selectedNodePositions, tempIndexes[j])){
              selectedNodePositions.push(tempIndexes[j]);
              if (selectedNodeColorFlag) nodes[tempIndexes[j]].material.color = new THREE.Color( selectedDefaultColor );
            }
          }
        }
      }
      decideNodeLabelFlags();
      updateSelectedNodesRShiny();
      finishLoader(true);
    }
  }
  return true;
}
