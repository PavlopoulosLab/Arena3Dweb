// on mouse wheel scroll
const sceneZoom = async (event) => {
  if (scene.exists()) {
    scene.zoom(event.deltaY);
    
    await delay_ms(100);
    updateScenePanRShiny();
    updateVRLayerLabelsRShiny();
    updateVRNodesRShiny();
  }
};

// on arrow keys press or axis select to rotate layers
const keyPressed = (event) => {
  if (scene.exists()) {
    let code = event.keyCode;
    if (code == 90)
      scene.axisPressed = 'z';
    else if (code == 88)
      scene.axisPressed = 'x';
    else if (code == 67)
      scene.axisPressed = 'c';
    else if (code == 37 || code == 38 || code == 39 || code == 40) {
      scene.translatePanWithArrow(code);

      updateScenePanRShiny();
      updateVRLayerLabelsRShiny();
      updateVRNodesRShiny();
    }
  }
};

const axisRelease = () => {
  if (scene.exists())
    scene.axisPressed = "";
};

// mouse keys press event
const clickDown = (event) => {
  if (scene.exists()) {
    //mouse: 0 left, 1 middle, 2 right click
    if (event.button == 0) {
      scene.leftClickPressed = true;
      scene.middleClickPressed = false;
      if (event.shiftKey && shiftX === "") {
        shiftX = event.layerX - xBoundMax;
        shiftY = yBoundMax - event.layerY; // used in drag
      }
    } else if (event.button == 1) {
      scene.middleClickPressed = true;
      scene.leftClickPressed = false;
    } else {
      scene.middleClickPressed = false;
      scene.leftClickPressed = false;
    }
  }
};

// while mouse button held, drag event
const clickDrag = (event) => {
  if (scene.exists()) {
    let distance = Math.sqrt(
      Math.pow(mousePreviousX - event.screenX, 2) + Math.pow(mousePreviousY - event.screenY, 2)
    );

    if (distance > 10) {
      let x = event.screenX, y = event.screenY;

      if (scene.leftClickPressed) {
        let selectedNodePositions = getSelectedNodes();

        scene.dragging = true;
        if (event.shiftKey) {
          lastHoveredLayerIndex = ""; // to be able to lasso inside layer
          lassoSelectNodes(event.layerX - xBoundMax, yBoundMax - event.layerY);
        } else if (scene.axisPressed !== "" && selectedNodePositions.length > 0)
          translateNodesWithHeldKey(event);
        else if (scene.axisPressed !== "")
          rotateLayersWithHeldKey(event);
        else if (lastHoveredLayerIndex === "" && last_hovered_node_index === "")
          sceneDragPan(x, y);
      } else if (scene.middleClickPressed) {
        scene.dragging = true;
        event.preventDefault();
        sceneOrbit(x, y);
      }

      mousePreviousX = x;
      mousePreviousY = y;
    }
    
    if (!scene.leftClickPressed && !scene.middleClickPressed)
      if (!checkHoverOverNode(event))
        checkHoverOverLayer(event);
  }
};

// left-click drag on scene
const sceneDragPan = async (x, y) => {
  scene.translatePanWithMouse(x, y);

  await delay_ms(100);
  updateScenePanRShiny();
  updateVRLayerLabelsRShiny();
  updateVRNodesRShiny();
};

// middle-click drag on scene
const sceneOrbit = async (x, y) => {
  scene.orbitSphereWithMouse(x, y);

  await delay_ms(100);
  updateSceneSphereRShiny();
  updateVRLayerLabelsRShiny();
  updateVRNodesRShiny();
};

const clickUp = (event) => {
  if (scene.exists()) {
    scene.dragging = false;
    if (event.button == 0) {
      scene.leftClickPressed = false;
      if (optionsList !== "") {
        document.getElementById("labelDiv").removeChild(optionsList);
        optionsList = "";
      }
      if (lasso !== "") {
        for (let i = 0; i < nodeObjects.length; i++) {
          if (nodeObjects[i].getOpacity() == 0.5) { // means is inside lasso event
            nodeObjects[i].setOpacity(1);
            nodeObjects[i].isSelected = true;
            repaintNode(i);
          }
        }
        decideNodeLabelFlags();
        updateSelectedNodesRShiny();
      }

      shiftX = "";
      shiftY = "";
      scene.remove(lasso);
      lasso = "";
    } else if (event.button == 1)
      scene.middleClickPressed = false;
  }
};

// double click event (left mouse), select node -> select layer -> unselect all nodes
const dblClick = (event) => {
  if (scene.exists()) {
    // Priorities:
    if (!performDoubleClickNodeSelection(event)) { // 1. select node
      if (lastHoveredLayerIndex !== "") { // 2. select layer
        performDoubleClickLayerSelection();
      } else { // 3. unselect all nodes
        unselectAllNodes();
        unselectAllEdges();
        
        redrawIntraLayerEdges();
        updateSelectedEdgesRShiny();
      }
    }
  }
};

// right mouse click on node
const replaceContextMenuOverNode = (event) => {
  if (optionsList !== "") {
    document.getElementById("labelDiv").removeChild(optionsList);
    optionsList = "";
  }
  
  for (let i = 0; i < nodeObjects.length; i++) {
    let nodeX = xBoundMax + nodeObjects[i].getWorldPosition("x"),
      nodeY = yBoundMax - nodeObjects[i].getWorldPosition("y");

    if (rightClickedOnNode(nodeX, nodeY, event)) {
      let option;

      event.preventDefault();

      // creating list and appending to 3d-graph div
      optionsList = document.createElement("select");
      optionsList.setAttribute('class', 'optionsBox');
      optionsList.setAttribute('id', 'mySelect');
      optionsList.setAttribute('onchange', 'executeCommand(this)');
      optionsList.style.left = nodeX.toString().concat("px");
      optionsList.style.top = nodeY.toString().concat("px");
      optionsList.style.display = "inline-block";
      
      // Do nothing
      option = document.createElement("option");
      option.value = "";
      option.text = "-";
      optionsList.appendChild(option);

      // Neighbors
      option = document.createElement("option");
      option.value = i;
      option.text = "Select Neighbors";
      optionsList.appendChild(option);
      
      // MultiLayer Path
      option = document.createElement("option");
      option.value = i;
      option.text = "Select MultiLayer Path";
      optionsList.appendChild(option);
      
      // Downstream Path
      option = document.createElement("option");
      option.value = i;
      option.text = "Select Downstream Path";
      optionsList.appendChild(option);

      // Link
      if (nodeObjects[i].url != "") {
        option = document.createElement("option");
        option.value = nodeObjects[i].url;
        option.text = "Link";
        optionsList.appendChild(option);
      }

      // Description
      if (nodeObjects[i].descr != "") {
        option = document.createElement("option");
        option.value = nodeObjects[i].descr;
        option.text = "Description";
        optionsList.appendChild(option);
      }

      document.getElementById("labelDiv").appendChild(optionsList);

      break;
    }
  }
};

const rightClickedOnNode = (nodeX, nodeY, event) => {
  return(Math.pow(nodeX - event.layerX, 2) + Math.pow(nodeY - event.layerY, 2) <= Math.pow((SPHERE_RADIUS + 1), 2))
};
