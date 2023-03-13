
const attachCanvasControls = () => { //adding control buttons above the canvas layer
  let info = document.getElementById("info"),
      navDiv = document.getElementById("navDiv"),
      tbl = document.createElement('table'),
      interLayerEdgesRenderPauseButton = document.createElement("button"),
      showBtn = document.createElement("button"),
      tbdy ="",
      tr = "",
      td = "",
      btn = "";

  info.innerHTML = `1. <b>Zoom</b>: Mouse Wheel<br/>
    2. <b>Pan</b>: Click Drag Scene / Arrow Keys<br/>
    3. <b>Orbit</b>: Mouse Middle Drag<br/>
    4. <b>Drag Layer</b>: Click Drag<br/>
    5. <b>Rotate Layer</b>: <span class='blue'>Z</span> / <span class='red'>X</span> / <span class='green'>C</span> + Click Drag<br/>
    6. <b>Move Selected Nodes</b>: <span class='blue'>Z</span> / <span class='green'>C</span> + Click Drag<br/>
    7. <b>Node/Layer Selection</b>: Double Click <br/>
    8. <b> Lasso Nodes</b>: Shift + Click Drag<br/>
    9. <b>Unselect All Nodes</b>: Double Click Scene`;

  tbl.id = "canvasControls_table";
  tbdy = document.createElement('tbody');

  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  td.innerHTML = "<h5>Scene</h5>";
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  td.innerHTML = "Rotation Controls";
  tr.appendChild(td);
  tbdy.appendChild(tr);
   
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.innerHTML = "Angle: 5".concat("&#730;");
  td.id = "sliderValue1";
  td.setAttribute('class', 'labelDrop');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusX');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusX');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('rowSpan', '3');
  td.setAttribute('colSpan', '2');
  sld = document.createElement("input");
  sld.className = "canvasSlider raiseSlider";
  sld.type = "range";
  sld.min = "1";
  sld.max = "15";
  sld.value = "5";
  sld.step = "1";
  td.appendChild(sld);
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusY');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusY');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusZ');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusZ');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  btn = document.createElement("button");
  btn.id = "recenterButton";
  btn.style.color = "black";
  btn.innerHTML = "Recenter Network";
  td.appendChild(btn);
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  tr.setAttribute('class', 'border_tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  td.innerHTML = "<h5>Layers</h5>";
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  td.innerHTML = "Rotation Controls";
  tr.appendChild(td);
  tbdy.appendChild(tr);
   
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.innerHTML = "Angle: 5".concat("&#730;");
  td.id = "sliderValue2";
  td.setAttribute('class', 'labelDrop');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusX');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusX');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('rowSpan', '3');
  td.setAttribute('colSpan', '2');
  sld = document.createElement("input");
  sld.className = "canvasSlider raiseSlider";
  sld.type = "range";
  sld.min = "1";
  sld.max = "15";
  sld.value = "5";
  sld.step = "1";
  td.appendChild(sld);
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusY');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusY');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusZ');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusZ');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  td.innerHTML = "Translation Controls";
  tr.appendChild(td);
  tbdy.appendChild(tr);
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.setAttribute('class', 'canvasControls image_expandLayers');
  tr.appendChild(td);
  
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.setAttribute('class', 'canvasControls image_collapseLayers');
  tr.appendChild(td);
  tbdy.appendChild(tr);

  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.innerHTML = "Step: 25";
  td.id = "sliderValue3";
  td.setAttribute('class', 'labelDrop');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusX_T');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusX_T');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('rowSpan', '3');
  td.setAttribute('colSpan', '2');
  sld = document.createElement("input");
  sld.className = "canvasSlider raiseSlider";
  sld.type = "range";
  sld.min = "5";
  sld.max = "50";
  sld.value = "25";
  sld.step = "5";
  td.appendChild(sld);
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusY_T');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusY_T');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusZ_T');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusZ_T');
  tr.appendChild(td);
  tbdy.appendChild(tr);

  tr = document.createElement('tr');
  td = document.createElement('td');
  td.innerHTML = "Scale";
  tr.appendChild(td);
  
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  sld = document.createElement("input");
  sld.className = "canvasSlider";
  sld.id = "layerScaleSlider";
  sld.type = "range";
  sld.min = 0.2;
  sld.max = 5;
  sld.value = 1;
  sld.step = 0.1;
  td.appendChild(sld);
  tr.appendChild(td);
  
  td = document.createElement('td');
  td.innerHTML = "x1";
  td.id = "sliderValue4";
  tr.appendChild(td);
  tbdy.appendChild(tr);

  tr = document.createElement('tr');
  tr.setAttribute('class', 'border_tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  td.innerHTML = "<h5>Nodes</h5>";
  tr.appendChild(td);
  tbdy.appendChild(tr);

  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '4');
  td.innerHTML = "Translation Controls";
  tr.appendChild(td);
  tbdy.appendChild(tr);

  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.setAttribute('class', 'canvasControls image_nodeExpand');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.setAttribute('class', 'canvasControls image_nodeCollapse');
  tr.appendChild(td);
  tbdy.appendChild(tr);

  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  td.innerHTML = "Step: 25";
  td.id = "sliderValue5";
  td.setAttribute('class', 'labelDrop');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusX_T');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusX_T');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('rowSpan', '3');
  td.setAttribute('colSpan', '2');
  sld = document.createElement("input");
  sld.className = "canvasSlider raiseSlider";
  sld.type = "range";
  sld.min = "5";
  sld.max = "50";
  sld.value = "25";
  sld.step = "5";
  td.appendChild(sld);
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusY_T');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusY_T');
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tr = document.createElement('tr');
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_minusZ_T');
  tr.appendChild(td);
  td = document.createElement('td');
  td.setAttribute('class', 'canvasControls image_plusZ_T');
  tr.appendChild(td);
  tbdy.appendChild(tr);

  tr = document.createElement('tr');
  td = document.createElement('td');
  td.innerHTML = "Scale";
  tr.appendChild(td);
  
  td = document.createElement('td');
  td.setAttribute('colSpan', '2');
  sld = document.createElement("input");
  sld.className = "canvasSlider";
  sld.id = "nodeScaleSlider";
  sld.type = "range";
  sld.min = 0.2;
  sld.max = 5;
  sld.value = 1;
  sld.step = 0.1;
  td.appendChild(sld);
  tr.appendChild(td);
  
  td = document.createElement('td');
  td.innerHTML = "x1";
  td.id = "sliderValue6";
  tr.appendChild(td);
  tbdy.appendChild(tr);
  
  tbl.appendChild(tbdy);
  interLayerEdgesRenderPauseButton.className = "displayCanvasControls";
  interLayerEdgesRenderPauseButton.id = "interLayerEdgesRenderPauseButton";
  interLayerEdgesRenderPauseButton.innerHTML = "Stop:Render Inter-Layer Edges";
  interLayerEdgesRenderPauseButton.style.position = "fixed";
  interLayerEdgesRenderPauseButton.style.zIndex = 1;
  navDiv.appendChild(interLayerEdgesRenderPauseButton);
  navDiv.appendChild(document.createElement('br'));
  showBtn.className = "displayCanvasControls";
  showBtn.id = "displayCanvasControlsButton";
  showBtn.innerHTML = "Navigation Controls";
  showBtn.style.position = "fixed";
  showBtn.style.zIndex = 1;
  showBtn.style.marginTop = "25px";
  navDiv.appendChild(showBtn);
  info.style.display = "inline-block";
  info.appendChild(tbl);

  //implementing functionality
  let recenterNetworkButton = document.getElementById("recenterButton");
  
  interLayerEdgesRenderPauseButton.onclick = toggleInterLayerEdgesRendering;
  showBtn.onclick = displayControlTable;
  recenterNetworkButton.onclick = recenterNetwork;
  
  let cavnasSliders = document.getElementsByClassName("canvasSlider");
  cavnasSliders[0].oninput = sliderSceneRotate;
  cavnasSliders[1].oninput = sliderLayerRotate;
  cavnasSliders[2].oninput = sliderLayerTranslate;
  cavnasSliders[3].oninput = scaleLayers;
  cavnasSliders[4].oninput = sliderNodeTranslate;
  cavnasSliders[5].oninput = scaleNodes;
  
  let cavnasButtons = document.getElementsByClassName("canvasControls");
  cavnasButtons[0].addEventListener("mousedown", function() { rotateScene(-1, "X") });
  cavnasButtons[0].onmousemove = cavnasButtons[0].onmouseup = mouseUpClearScene;
  cavnasButtons[1].addEventListener("mousedown", function() { rotateScene(1, "X") });
  cavnasButtons[1].onmousemove = cavnasButtons[1].onmouseup = mouseUpClearScene;
  cavnasButtons[2].addEventListener("mousedown", function() { rotateScene(-1, "Y") });
  cavnasButtons[2].onmousemove = cavnasButtons[2].onmouseup = mouseUpClearScene;
  cavnasButtons[3].addEventListener("mousedown", function() { rotateScene(1, "Y") });
  cavnasButtons[3].onmousemove = cavnasButtons[3].onmouseup = mouseUpClearScene;
  cavnasButtons[4].addEventListener("mousedown", function() { rotateScene(-1, "Z") });
  cavnasButtons[4].onmousemove = cavnasButtons[4].onmouseup = mouseUpClearScene;
  cavnasButtons[5].addEventListener("mousedown", function() { rotateScene(1, "Z") });
  cavnasButtons[5].onmousemove = cavnasButtons[5].onmouseup = mouseUpClearScene;
  cavnasButtons[6].addEventListener("mousedown", function() { rotateSelectedLayers(-1, "X") });
  cavnasButtons[6].onmousemove = cavnasButtons[6].onmouseup = mouseUpClear;
  cavnasButtons[7].addEventListener("mousedown", function() { rotateSelectedLayers(1, "X") });
  cavnasButtons[7].onmousemove = cavnasButtons[7].onmouseup = mouseUpClear;
  cavnasButtons[8].addEventListener("mousedown", function() { rotateSelectedLayers(-1, "Y") });
  cavnasButtons[8].onmousemove = cavnasButtons[8].onmouseup = mouseUpClear;
  cavnasButtons[9].addEventListener("mousedown", function() { rotateSelectedLayers(1, "Y") });
  cavnasButtons[9].onmousemove = cavnasButtons[9].onmouseup = mouseUpClear;
  cavnasButtons[10].addEventListener("mousedown", function() { rotateSelectedLayers(-1, "Z") });
  cavnasButtons[10].onmousemove = cavnasButtons[10].onmouseup = mouseUpClear;
  cavnasButtons[11].addEventListener("mousedown", function() { rotateSelectedLayers(1, "Z") });
  cavnasButtons[11].onmousemove = cavnasButtons[11].onmouseup = mouseUpClear;
  cavnasButtons[12].onclick = spreadLayers;
  cavnasButtons[13].onclick = congregateLayers;
  cavnasButtons[14].addEventListener("mousedown", function() { moveLayers(-1, "X") });
  cavnasButtons[14].onmousemove = cavnasButtons[14].onmouseup = mouseUpClear;
  cavnasButtons[15].addEventListener("mousedown", function() { moveLayers(1, "X") });
  cavnasButtons[15].onmousemove = cavnasButtons[15].onmouseup = mouseUpClear;
  cavnasButtons[16].addEventListener("mousedown", function() { moveLayers(-1, "Y") });
  cavnasButtons[16].onmousemove = cavnasButtons[16].onmouseup = mouseUpClear;
  cavnasButtons[17].addEventListener("mousedown", function() { moveLayers(1, "Y") });
  cavnasButtons[17].onmousemove = cavnasButtons[17].onmouseup = mouseUpClear;
  cavnasButtons[18].addEventListener("mousedown", function() { moveLayers(-1, "Z") });
  cavnasButtons[18].onmousemove = cavnasButtons[18].onmouseup = mouseUpClear;
  cavnasButtons[19].addEventListener("mousedown", function() { moveLayers(1, "Z") });
  cavnasButtons[19].onmousemove = cavnasButtons[19].onmouseup = mouseUpClear;
  cavnasButtons[20].onclick = spreadNodes;
  cavnasButtons[21].onclick = congregateNodes;
  cavnasButtons[22].addEventListener("mousedown", function() { moveNodes(-1, "X") });
  cavnasButtons[22].onmousemove = cavnasButtons[22].onmouseup = mouseUpClear;
  cavnasButtons[23].addEventListener("mousedown", function() { moveNodes(1, "X") });
  cavnasButtons[23].onmousemove = cavnasButtons[23].onmouseup = mouseUpClear;
  cavnasButtons[24].addEventListener("mousedown", function() { moveNodes(-1, "Y") });
  cavnasButtons[24].onmousemove = cavnasButtons[24].onmouseup = mouseUpClear;
  cavnasButtons[25].addEventListener("mousedown", function() { moveNodes(1, "Y") });
  cavnasButtons[25].onmousemove = cavnasButtons[25].onmouseup = mouseUpClear;
  cavnasButtons[26].addEventListener("mousedown", function() { moveNodes(-1, "Z") });
  cavnasButtons[26].onmousemove = cavnasButtons[26].onmouseup = mouseUpClear;
  cavnasButtons[27].addEventListener("mousedown", function() { moveNodes(1, "Z") });
  cavnasButtons[27].onmousemove = cavnasButtons[27].onmouseup = mouseUpClear;
  
  canvasControlsAttached = true;
}

//drawing and implementation of button controls for node and layer translations and rotations
const mouseUpClearScene = () => {
  if (!scene.autoRotate) {
    clearInterval(scene.intervalTimeout);
  }
}

const mouseUpClear = () => {
  clearInterval(layerIntervalTimeout);
  clearInterval(nodeIntervalTimeout);
}

const displayControlTable = () => {
  t = document.getElementById("info");
  if (t.style.display == "inline-block") t.style.display = "none";
  else t.style.display = "inline-block";
}

const toggleInterLayerEdgesRendering = () => {
  let interLayerEdgesRenderPauseButton = document.getElementById('interLayerEdgesRenderPauseButton');
  if (interLayerEdgesRenderPauseFlag) {
    interLayerEdgesRenderPauseFlag = false;
    interLayerEdgesRenderPauseButton.innerText = "Stop:Render Inter-Layer Edges";
  } else {
    interLayerEdgesRenderPauseFlag = true;
    interLayerEdgesRenderPauseButton.innerText = "Render Inter-Layer Edges";
  }
}

const sliderSceneRotate = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[0],
    td = document.getElementById("sliderValue1");
  td.innerHTML = "Angle: ".concat(cavnasSlider.value).concat("&#730;");
}

// direction 1 or -1
const rotateScene = (direction, axis) => {
  clearInterval(scene.intervalTimeout);
    scene.intervalTimeout = setInterval(function() {
    let value = document.getElementsByClassName("canvasSlider")[0].value;
    value = direction * THREE.Math.degToRad(value);
    if (axis == "X")
      scene.rotateX(value);
    else if (axis == "Y")
      scene.rotateY(value);
    else if (axis == "Z")
      scene.rotateZ(value);
    updateSceneSphereRShiny();
    updateLayersRShiny();
    updateNodesRShiny();
  }, 70);
}

const recenterNetwork = () => {
  if (scene.exists()){
    scene.recenter();
    updateScenePanRShiny();
    updateLayersRShiny();
    updateNodesRShiny();
  }
  return true;
}

const sliderLayerRotate = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[1],
    td = document.getElementById("sliderValue2");
  td.innerHTML = "Angle: ".concat(cavnasSlider.value).concat("&#730;");
}

const rotateSelectedLayers = (direction, axis) => {
  selectCheckedLayers();
  if (js_selected_layers.length == 0)
    alert("Please select at least one layer.");
  else {
    layerIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[1].value;
      value = direction * THREE.Math.degToRad(value);
      for (let i = 0; i < js_selected_layers.length; i++) {
        if (axis == "X")
          layer_planes[js_selected_layers[i]].rotateX(value);
        else if (axis == "Y")
          layer_planes[js_selected_layers[i]].rotateY(value);
        else if (axis == "Z")
          layer_planes[js_selected_layers[i]].rotateZ(value);
      }
      updateLayersRShiny();
      updateNodesRShiny(); // VR node world positions update
    }, 70);
  }
}

const sliderLayerTranslate = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[2],
    td = document.getElementById("sliderValue3");
  td.innerHTML = "Step: ".concat(cavnasSlider.value);
}

const spreadLayers = () => {
  let window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
      numLayers = layer_planes.length;
  for (let i = 0; i < numLayers; i++){
    layer_planes[i].rotation.x = layer_planes[i].rotation.y = layer_planes[i].rotation.z = 0;
    if (numLayers % 2) layer_planes[i].translateX( (-Math.floor(layer_planes.length/2) + i) * window_width); //odd number of Layers
    else layer_planes[i].translateX( (-layer_planes.length/2 + i) * window_width + window_width/2); //even number of Layers
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
  return true;
}

const congregateLayers = () => {
  let window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
      numLayers = layer_planes.length;
  for (let i = 0; i < numLayers; i++){
    layer_planes[i].rotation.x = layer_planes[i].rotation.y = layer_planes[i].rotation.z = 0;
    if (numLayers % 2) layer_planes[i].translateX( -((-Math.floor(layer_planes.length/2) + i) * window_width)); //odd number of Layers
    else layer_planes[i].translateX( -((-layer_planes.length/2 + i) * window_width + window_width/2)); //even number of Layers
  }
  updateLayersRShiny();
  updateNodesRShiny(); // VR node world positions update
  return true;
}

const moveLayers = (direction, axis) => {
  selectCheckedLayers();
  if (js_selected_layers.length == 0)
    alert("Please select at least one layer.");
  else {
    layerIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[2].value;
      value = direction * value;
      for (let i = 0; i < js_selected_layers.length; i++) {
        if (axis == "X")
          layer_planes[js_selected_layers[i]].translateX(value);
        else if (axis == "Y")
          layer_planes[js_selected_layers[i]].translateY(value);
        else if (axis == "Z")
          layer_planes[js_selected_layers[i]].translateZ(value);
      }
      updateLayersRShiny();
      updateNodesRShiny(); // VR node world positions update
    }, 70);
  }
}

const scaleLayers = (canvasSlider) => {
  let td = document.getElementById("sliderValue4"),
    cavnasSlider = document.getElementsByClassName("canvasSlider")[3];
  td.innerHTML = "x".concat(cavnasSlider.value);
  selectCheckedLayers();
  if (js_selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    for (let i = 0; i < js_selected_layers.length; i++){
      layer_planes[js_selected_layers[i]].geometry.scale(1, parseFloat(cavnasSlider.value)/last_layer_scale[js_selected_layers[i]], parseFloat(cavnasSlider.value)/last_layer_scale[js_selected_layers[i]]);
      for (let j = 0; j < layer_planes[js_selected_layers[i]].children.length; j++){
        layer_planes[js_selected_layers[i]].children[j].position.y = layer_planes[js_selected_layers[i]].children[j].position.y * parseFloat(cavnasSlider.value)/last_layer_scale[js_selected_layers[i]];
        layer_planes[js_selected_layers[i]].children[j].position.z = layer_planes[js_selected_layers[i]].children[j].position.z * parseFloat(cavnasSlider.value)/last_layer_scale[js_selected_layers[i]];
      }
      last_layer_scale[js_selected_layers[i]] = parseFloat(cavnasSlider.value);
    }
    redrawEdges();
    updateLayersRShiny();
    updateNodesRShiny();
  }
  return true;
}

const spreadNodes = () => {
  if (selectedNodePositions.length == 0) alert("Please select at least one node.");
  else{
    for (let i=0;i<selectedNodePositions.length;i++){
      nodes[selectedNodePositions[i]].position.y = nodes[selectedNodePositions[i]].position.y * 1.1;
      nodes[selectedNodePositions[i]].position.z = nodes[selectedNodePositions[i]].position.z * 1.1;
    }
    updateNodesRShiny();
    redrawEdges();
  }
  return true;
}

const congregateNodes = () => {
  if (selectedNodePositions.length == 0) alert("Please select at least one node.");
  else{
    for (let i=0;i<selectedNodePositions.length;i++){
      nodes[selectedNodePositions[i]].position.y = nodes[selectedNodePositions[i]].position.y * 0.9;
      nodes[selectedNodePositions[i]].position.z = nodes[selectedNodePositions[i]].position.z * 0.9;
    }
    updateNodesRShiny();
    redrawEdges();
  }
  return true;
}

const sliderNodeTranslate = () => {
  let cavnasSliders = document.getElementsByClassName("canvasSlider")[4];
  td = document.getElementById("sliderValue5");
  td.innerHTML = "Step: ".concat(cavnasSliders.value);
}

const moveNodes = (direction, axis) => {
  if (selectedNodePositions.length == 0)
    alert("Please select at least one node.");
  else {
    nodeIntervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[4].value;
      value = direction * value;
      for (let i = 0; i < selectedNodePositions.length; i++){
        if (axis == "X")
          nodes[selectedNodePositions[i]].translateX(value);
        else if (axis == "Y")
          nodes[selectedNodePositions[i]].translateY(value);
        else if (axis == "Z")
          nodes[selectedNodePositions[i]].translateZ(value);
      }
      redrawEdges();
      updateNodesRShiny();
    }, 70);
  }
}

const scaleNodes = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[5],
    td = document.getElementById("sliderValue6");
  td.innerHTML = "x".concat(cavnasSlider.value);
  if (selectedNodePositions.length == 0) alert("Please select at least one node.");
  else{
    for (let i = 0; i < selectedNodePositions.length; i++) {
      nodes[selectedNodePositions[i]].scale.x = nodes[selectedNodePositions[i]].scale.y = 
        nodes[selectedNodePositions[i]].scale.z = parseFloat(cavnasSlider.value);
    }
    updateNodesRShiny();
  }
  return true;
}
