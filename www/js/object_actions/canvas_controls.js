
const attachCanvasControls = () => {
  attachNavControlButtons();
  attachNavControlTable();
  
  implementSliderFunctionalities();
  implementButtonFunctionalities();
  
  canvasControlsAttached = true;
};

const attachNavControlButtons = () => {
  let interLayerEdgesRenderPauseButton = document.createElement("button"),
    showNavControlButton = document.createElement("button"),
    navControlButtonsDiv = document.getElementById("navControlButtonsDiv");

  interLayerEdgesRenderPauseButton.id = "interLayerEdgesRenderPauseButton";
  interLayerEdgesRenderPauseButton.className = "displayCanvasControls";
  interLayerEdgesRenderPauseButton.innerHTML = "Stop:Render Inter-Layer Edges";
  interLayerEdgesRenderPauseButton.style.position = "fixed";
  interLayerEdgesRenderPauseButton.style.zIndex = 1;
  interLayerEdgesRenderPauseButton.onclick = toggleInterLayerEdgesRendering;
  
  showNavControlButton.id = "displayCanvasControlsButton";
  showNavControlButton.className = "displayCanvasControls";
  showNavControlButton.innerHTML = "Navigation Controls";
  showNavControlButton.style.position = "fixed";
  showNavControlButton.style.zIndex = 1;
  showNavControlButton.style.marginTop = "25px";
  showNavControlButton.onclick = displayControlTable;

  navControlButtonsDiv.appendChild(interLayerEdgesRenderPauseButton);
  navControlButtonsDiv.appendChild(document.createElement("br"));
  navControlButtonsDiv.appendChild(showNavControlButton);
};

const displayControlTable = () => {
  let infoTable = document.getElementById("info");

  if (infoTable.style.display == "inline-block")
    infoTable.style.display = "none";
  else
    infoTable.style.display = "inline-block";
};

const attachNavControlTable = () => {
  let tr, td, tbdy = document.createElement('tbody'),
    btn = document.createElement("button"),
    tbl = document.createElement('table'),
    info = document.getElementById("info");

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

  btn.id = "recenterButton";
  btn.onclick = recenterNetwork;
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

  // controls table
  tbl.id = "canvasControls_table";
  tbl.appendChild(tbdy);

  // info div
  info.innerHTML = `1. <b>Zoom</b>: Mouse Wheel<br/>
    2. <b>Pan</b>: Click Drag Scene / Arrow Keys<br/>
    3. <b>Orbit</b>: Mouse Middle Drag<br/>
    4. <b>Drag Layer</b>: Click Drag<br/>
    5. <b>Rotate Layer</b>: <span class='blue'>Z</span> / <span class='red'>X</span> / <span class='green'>C</span> + Click Drag<br/>
    6. <b>Move Selected Nodes</b>: <span class='blue'>Z</span> / <span class='green'>C</span> + Click Drag<br/>
    7. <b>Node/Layer Selection</b>: Double Click <br/>
    8. <b> Lasso Nodes</b>: Shift + Click Drag<br/>
    9. <b>Unselect All Nodes</b>: Double Click Scene`;
  info.style.display = "inline-block";
  info.appendChild(tbl);
};

const recenterNetwork = async () => {
  if (scene.exists()) {
    scene.recenter();

    await delay_ms(100);
    updateScenePanRShiny();
    updateVRLayerLabelsRShiny();
    updateVRNodesRShiny();
  }
};

const implementSliderFunctionalities = () => {
  let cavnasSliders = document.getElementsByClassName("canvasSlider");

  cavnasSliders[0].oninput = sliderSceneRotate;
  cavnasSliders[1].oninput = sliderLayerRotate;
  cavnasSliders[2].oninput = sliderLayerTranslate;
  cavnasSliders[3].oninput = scaleLayers;
  cavnasSliders[4].oninput = sliderNodeTranslate;
  cavnasSliders[5].oninput = scaleNodes;
};

const sliderSceneRotate = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[0],
    td = document.getElementById("sliderValue1");

  td.innerHTML = "Angle: ".concat(cavnasSlider.value).concat("&#730;");
};

const sliderLayerRotate = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[1],
    td = document.getElementById("sliderValue2");

  td.innerHTML = "Angle: ".concat(cavnasSlider.value).concat("&#730;");
};

const sliderLayerTranslate = () => {
  let cavnasSlider = document.getElementsByClassName("canvasSlider")[2],
    td = document.getElementById("sliderValue3");

  td.innerHTML = "Step: ".concat(cavnasSlider.value);
};

const sliderNodeTranslate = () => {
  let cavnasSliders = document.getElementsByClassName("canvasSlider")[4],
    td = document.getElementById("sliderValue5");

  td.innerHTML = "Step: ".concat(cavnasSliders.value);
};

const implementButtonFunctionalities = () => {
  let cavnasButtons = document.getElementsByClassName("canvasControls");

  cavnasButtons[0].addEventListener("mousedown", function() { scene.rotate(-1, "X") });
  cavnasButtons[0].onmousemove = cavnasButtons[0].onmouseup = mouseUpClearScene;
  cavnasButtons[1].addEventListener("mousedown", function() { scene.rotate(1, "X") });
  cavnasButtons[1].onmousemove = cavnasButtons[1].onmouseup = mouseUpClearScene;
  cavnasButtons[2].addEventListener("mousedown", function() { scene.rotate(-1, "Y") });
  cavnasButtons[2].onmousemove = cavnasButtons[2].onmouseup = mouseUpClearScene;
  cavnasButtons[3].addEventListener("mousedown", function() { scene.rotate(1, "Y") });
  cavnasButtons[3].onmousemove = cavnasButtons[3].onmouseup = mouseUpClearScene;
  cavnasButtons[4].addEventListener("mousedown", function() { scene.rotate(-1, "Z") });
  cavnasButtons[4].onmousemove = cavnasButtons[4].onmouseup = mouseUpClearScene;
  cavnasButtons[5].addEventListener("mousedown", function() { scene.rotate(1, "Z") });
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
  cavnasButtons[12].addEventListener("click", function() { spreadLayers(1) });
  cavnasButtons[13].addEventListener("click", function() { spreadLayers(-1) });
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
  cavnasButtons[20].addEventListener("click", function() { spreadNodes(1.1) });
  cavnasButtons[21].addEventListener("click", function() { spreadNodes(0.9) });
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
};

const mouseUpClearScene = () => {
  if (!scene.autoRotate)
    clearInterval(scene.intervalTimeout);
};

const mouseUpClear = () => {
  clearInterval(layerIntervalTimeout);
  clearInterval(nodeIntervalTimeout);
};
