//drawing and implementation of button controls for node and layer translations and rotations

function mouseUpClear(){
  dragging = false;
  clearInterval(timeoutF);
  return false;
}

function displayControlTable(){
  t = document.getElementById("info");
  if (t.style.display == "inline-block") t.style.display = "none";
  else t.style.display = "inline-block";
  return true;
}

function pauseAnimate() {
  var pauseAnimateButton = document.getElementsByClassName("displayCanvasControls")[1];
  if (animationPause){
    animationPause = false;
    pauseAnimateButton.innerText = "Stop:Render Inter-Layer Edges";
  }
  else{
    animationPause = true;
    pauseAnimateButton.innerText = "Render Inter-Layer Edges";
  } 
  return true;
}

function sliderSceneRotate(){
  td = document.getElementById("sliderValue1");
  td.innerHTML = "Angle: ".concat(this.value).concat("&#730;");
  return true;
}

function rotateSceneXMinus(){
  dragging = true;
  timeoutF = setInterval(function(){
    var value = document.getElementsByClassName("canvasSlider")[0].value;
    scene_sphere.rotateX(-THREE.Math.degToRad(value));
    return true;
  }, 70);
  updateSceneSphereRShiny();
  return true;
}

function rotateSceneXPlus(){
  dragging = true;
  timeoutF = setInterval(function(){
    var value = document.getElementsByClassName("canvasSlider")[0].value;
    scene_sphere.rotateX(THREE.Math.degToRad(value));
    return true;
  }, 70);
  updateSceneSphereRShiny();
  return true;
}

function rotateSceneYMinus(){
  dragging = true;
  timeoutF = setInterval(function(){
    var value = document.getElementsByClassName("canvasSlider")[0].value;
    scene_sphere.rotateY(-THREE.Math.degToRad(value));
    return true;
  }, 70);
  updateSceneSphereRShiny();
  return true;
}

function rotateSceneYPlus(){
  dragging = true; timeoutF = setInterval(function(){
    var value = document.getElementsByClassName("canvasSlider")[0].value;
    scene_sphere.rotateY(THREE.Math.degToRad(value));
    return true;
  }, 70);
  updateSceneSphereRShiny();
  return true;
}

function rotateSceneZMinus(){
  dragging = true; timeoutF = setInterval(function(){
    var value = document.getElementsByClassName("canvasSlider")[0].value;
    scene_sphere.rotateZ(-THREE.Math.degToRad(value));
    return true;
  }, 70);
  updateSceneSphereRShiny();
  return true;
}

function rotateSceneZPlus(){
   dragging = true; timeoutF = setInterval(function(){
     var value = document.getElementsByClassName("canvasSlider")[0].value;
    scene_sphere.rotateZ(THREE.Math.degToRad(value));
    return true;
  }, 70);
  updateSceneSphereRShiny();
  return true;
}

function recenterNetwork(){
  if (scene_pan !== ""){
    scene_pan.position.x = 0;
    scene_pan.position.y = 0;
    scene_pan.position.z = 0;
    updateScenePanRShiny();
  }
  return true;
}

function sliderLayerRotate(){
  td = document.getElementById("sliderValue2");
  td.innerHTML = "Angle: ".concat(this.value).concat("&#730;");
  return true;
}

function rotateLayersXMinus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[1].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].rotateX(-THREE.Math.degToRad(value));
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function rotateLayersXPlus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[1].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].rotateX(THREE.Math.degToRad(value));
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function rotateLayersYMinus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[1].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].rotateY(-THREE.Math.degToRad(value));
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function rotateLayersYPlus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[1].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].rotateY(THREE.Math.degToRad(value));
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function rotateLayersZMinus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[1].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].rotateZ(-THREE.Math.degToRad(value));
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function rotateLayersZPlus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[1].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].rotateZ(THREE.Math.degToRad(value));
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function sliderLayerTranslate(){
  td = document.getElementById("sliderValue3");
  td.innerHTML = "Step: ".concat(this.value);
  return true;
}

function spreadLayers() {
  var window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
      numLayers = layer_planes.length;
  for (var i = 0; i < numLayers; i++){
    layer_planes[i].rotation.x = layer_planes[i].rotation.y = layer_planes[i].rotation.z = 0;
    if (numLayers % 2) layer_planes[i].translateX( (-Math.floor(layer_planes.length/2) + i) * window_width); //odd number of Layers
    else layer_planes[i].translateX( (-layer_planes.length/2 + i) * window_width + window_width/2); //even number of Layers
  }
  return true;
}

function congregateLayers() {
  var window_width = xBoundMax * 2 / Object.getOwnPropertyNames(layer_groups).length,
      numLayers = layer_planes.length;
  for (var i = 0; i < numLayers; i++){
    layer_planes[i].rotation.x = layer_planes[i].rotation.y = layer_planes[i].rotation.z = 0;
    if (numLayers % 2) layer_planes[i].translateX( -((-Math.floor(layer_planes.length/2) + i) * window_width)); //odd number of Layers
    else layer_planes[i].translateX( -((-layer_planes.length/2 + i) * window_width + window_width/2)); //even number of Layers
  }
  return true;
}

function moveLayersXMinus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[2].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].translateX(-value);
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function moveLayersXPlus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[2].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].translateX(value);
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function moveLayersYMinus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[2].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].translateY(-value);
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function moveLayersYPlus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
    var value = document.getElementsByClassName("canvasSlider")[2].value;
    for (var i = 0; i < selected_layers.length; i++){
      layer_planes[selected_layers[i]].translateY(value);
    }
    return true;
  }, 70);
  updateLayersRShiny();
  }
  return true;
}

function moveLayersZMinus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[2].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].translateZ(-value);
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function moveLayersZPlus(){
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[2].value;
      for (var i = 0; i < selected_layers.length; i++){
        layer_planes[selected_layers[i]].translateZ(value);
      }
      return true;
    }, 70);
    updateLayersRShiny();
  }
  return true;
}

function scaleLayers(){
  td = document.getElementById("sliderValue4");
  td.innerHTML = "x".concat(this.value);
  selectCheckedLayers();
  if (selected_layers.length == 0) alert("Please select at least one layer.");
  else{
    for (var i = 0; i < selected_layers.length; i++){
      layer_planes[selected_layers[i]].geometry.scale(1, parseFloat(this.value)/last_layer_scale[selected_layers[i]], parseFloat(this.value)/last_layer_scale[selected_layers[i]]);
      for (var j = 0; j < layer_planes[selected_layers[i]].children.length; j++){
        layer_planes[selected_layers[i]].children[j].position.y = layer_planes[selected_layers[i]].children[j].position.y * parseFloat(this.value)/last_layer_scale[selected_layers[i]];
        layer_planes[selected_layers[i]].children[j].position.z = layer_planes[selected_layers[i]].children[j].position.z * parseFloat(this.value)/last_layer_scale[selected_layers[i]];
      }
      last_layer_scale[selected_layers[i]] = parseFloat(this.value);
    }
    redrawEdges();
    updateLayersRShiny();
    updateNodesRShiny();
  }
  return true;
}

function spreadNodes() {
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    for (var i=0;i<selected_nodes.length;i++){
      nodes[selected_nodes[i]].position.y = nodes[selected_nodes[i]].position.y * 1.1;
      nodes[selected_nodes[i]].position.z = nodes[selected_nodes[i]].position.z * 1.1;
    }
    redrawEdges();
  }
  return true;
}

function congregateNodes() {
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    for (var i=0;i<selected_nodes.length;i++){
      nodes[selected_nodes[i]].position.y = nodes[selected_nodes[i]].position.y * 0.9;
      nodes[selected_nodes[i]].position.z = nodes[selected_nodes[i]].position.z * 0.9;
    }
    redrawEdges();
  }
  return true;
}

function sliderNodeTranslate(){
  td = document.getElementById("sliderValue5");
  td.innerHTML = "Step: ".concat(this.value);
  return true;
}

function moveNodesXMinus(){
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    timeoutF = setInterval(function(){
    var value = document.getElementsByClassName("canvasSlider")[4].value;
    for (var i = 0; i < selected_nodes.length; i++){
      nodes[selected_nodes[i]].translateX(-value);
    }
    redrawEdges();
    return true;
  }, 70);
  updateNodesRShiny();
  }
  return true;
}

function moveNodesXPlus(){
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[4].value;
      for (var i = 0; i < selected_nodes.length; i++){
        nodes[selected_nodes[i]].translateX(value);
      }
      redrawEdges();
      return true;
    }, 70);
    updateNodesRShiny();
  }
  return true;
}

function moveNodesYMinus(){
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[4].value;
      for (var i = 0; i < selected_nodes.length; i++){
        nodes[selected_nodes[i]].translateY(-value);
      }
      redrawEdges();
      return true;
    }, 70);
    updateNodesRShiny();
  }
  return true;
}

function moveNodesYPlus(){
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[4].value;
      for (var i = 0; i < selected_nodes.length; i++){
        nodes[selected_nodes[i]].translateY(value);
      }
      redrawEdges();
      return true;
    }, 70);
    updateNodesRShiny();
  }
  return true;
}

function moveNodesZMinus(){
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[4].value;
      for (var i = 0; i < selected_nodes.length; i++){
        nodes[selected_nodes[i]].translateZ(-value);
      }
      redrawEdges();
      return true;
    }, 70);
    updateNodesRShiny();
  }
  return true;
}

function moveNodesZPlus(){
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    timeoutF = setInterval(function(){
      var value = document.getElementsByClassName("canvasSlider")[4].value;
      for (var i = 0; i < selected_nodes.length; i++){
        nodes[selected_nodes[i]].translateZ(value);
      }
      redrawEdges();
      return true;
    }, 70);
    updateNodesRShiny();
  }
  return true;
}

function scaleNodes(){
  td = document.getElementById("sliderValue6");
  td.innerHTML = "x".concat(this.value);
  if (selected_nodes.length == 0) alert("Please select at least one node.");
  else{
    for (var i = 0; i < selected_nodes.length; i++){
      nodes[selected_nodes[i]].scale.x = parseFloat(this.value);
      nodes[selected_nodes[i]].scale.y = parseFloat(this.value);
      nodes[selected_nodes[i]].scale.z = parseFloat(this.value);
    }
    updateNodesRShiny();
  }
  return true;
}

function attachCanvasControls(){ //adding control buttons above the canvas layer
  attachedCanvasControls = true;
  var info = document.getElementById("info"),
      navDiv = document.getElementById("navDiv"),
      tbl = document.createElement('table'),
      showBtn = document.createElement("button"),
      pauseAnimeateButton = document.createElement("button"),
      tbdy ="",
      tr = "",
      td = "",
      btn = "";
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
  showBtn.className = "displayCanvasControls";
  showBtn.innerHTML = "Navigation Controls";
  showBtn.style.position = "fixed";
  showBtn.style.zIndex = 1;
  navDiv.appendChild(showBtn);
  navDiv.appendChild(document.createElement('br'));
  pauseAnimeateButton.className = "displayCanvasControls";
  pauseAnimeateButton.innerHTML = "Stop:Render Inter-Layer Edges";
  pauseAnimeateButton.style.position = "fixed";
  pauseAnimeateButton.style.zIndex = 1;
  pauseAnimeateButton.style.marginTop = "25px";
  navDiv.appendChild(pauseAnimeateButton);
  info.style.display = "inline-block";
  info.appendChild(tbl);

  //implementing functionality
  var displayCavnasButton = document.getElementsByClassName("displayCanvasControls"),
      recenterNetworkButton = document.getElementById("recenterButton");
  
  displayCavnasButton[0].onclick = displayControlTable;
  displayCavnasButton[1].onclick = pauseAnimate;
  recenterNetworkButton.onclick = recenterNetwork;
  
  var cavnasSliders = document.getElementsByClassName("canvasSlider");
  cavnasSliders[0].oninput = sliderSceneRotate;
  cavnasSliders[1].oninput = sliderLayerRotate;
  cavnasSliders[2].oninput = sliderLayerTranslate;
  cavnasSliders[3].oninput = scaleLayers;
  cavnasSliders[4].oninput = sliderNodeTranslate;
  cavnasSliders[5].oninput = scaleNodes;
  
  var cavnasButtons = document.getElementsByClassName("canvasControls");
  cavnasButtons[0].onmousedown = rotateSceneXMinus;
  cavnasButtons[0].onmousemove = cavnasButtons[0].onmouseup = mouseUpClear;
  cavnasButtons[1].onmousedown = rotateSceneXPlus;
  cavnasButtons[1].onmousemove = cavnasButtons[1].onmouseup = mouseUpClear;
  cavnasButtons[2].onmousedown = rotateSceneYMinus;
  cavnasButtons[2].onmousemove = cavnasButtons[2].onmouseup = mouseUpClear;
  cavnasButtons[3].onmousedown = rotateSceneYPlus;
  cavnasButtons[3].onmousemove = cavnasButtons[3].onmouseup = mouseUpClear;
  cavnasButtons[4].onmousedown = rotateSceneZMinus;
  cavnasButtons[4].onmousemove = cavnasButtons[4].onmouseup = mouseUpClear;
  cavnasButtons[5].onmousedown = rotateSceneZPlus;
  cavnasButtons[5].onmousemove = cavnasButtons[5].onmouseup = mouseUpClear;
  cavnasButtons[6].onmousedown = rotateLayersXMinus;
  cavnasButtons[6].onmousemove = cavnasButtons[6].onmouseup = mouseUpClear;
  cavnasButtons[7].onmousedown = rotateLayersXPlus;
  cavnasButtons[7].onmousemove = cavnasButtons[7].onmouseup = mouseUpClear;
  cavnasButtons[8].onmousedown = rotateLayersYMinus;
  cavnasButtons[8].onmousemove = cavnasButtons[8].onmouseup = mouseUpClear;
  cavnasButtons[9].onmousedown = rotateLayersYPlus;
  cavnasButtons[9].onmousemove = cavnasButtons[9].onmouseup = mouseUpClear;
  cavnasButtons[10].onmousedown = rotateLayersZMinus;
  cavnasButtons[10].onmousemove = cavnasButtons[10].onmouseup = mouseUpClear;
  cavnasButtons[11].onmousedown = rotateLayersZPlus;
  cavnasButtons[11].onmousemove = cavnasButtons[11].onmouseup = mouseUpClear;
  cavnasButtons[12].onclick = spreadLayers;
  cavnasButtons[13].onclick = congregateLayers;
  cavnasButtons[14].onmousedown = moveLayersXMinus;
  cavnasButtons[14].onmousemove = cavnasButtons[14].onmouseup = mouseUpClear;
  cavnasButtons[15].onmousedown = moveLayersXPlus;
  cavnasButtons[15].onmousemove = cavnasButtons[15].onmouseup = mouseUpClear;
  cavnasButtons[16].onmousedown = moveLayersYMinus;
  cavnasButtons[16].onmousemove = cavnasButtons[16].onmouseup = mouseUpClear;
  cavnasButtons[17].onmousedown = moveLayersYPlus;
  cavnasButtons[17].onmousemove = cavnasButtons[17].onmouseup = mouseUpClear;
  cavnasButtons[18].onmousedown = moveLayersZMinus;
  cavnasButtons[18].onmousemove = cavnasButtons[18].onmouseup = mouseUpClear;
  cavnasButtons[19].onmousedown = moveLayersZPlus;
  cavnasButtons[19].onmousemove = cavnasButtons[19].onmouseup = mouseUpClear;
  cavnasButtons[20].onclick = spreadNodes;
  cavnasButtons[21].onclick = congregateNodes;
  cavnasButtons[22].onmousedown = moveNodesXMinus;
  cavnasButtons[22].onmousemove = cavnasButtons[22].onmouseup = mouseUpClear;
  cavnasButtons[23].onmousedown = moveNodesXPlus;
  cavnasButtons[23].onmousemove = cavnasButtons[23].onmouseup = mouseUpClear;
  cavnasButtons[24].onmousedown = moveNodesYMinus;
  cavnasButtons[24].onmousemove = cavnasButtons[24].onmouseup = mouseUpClear;
  cavnasButtons[25].onmousedown = moveNodesYPlus;
  cavnasButtons[25].onmousemove = cavnasButtons[25].onmouseup = mouseUpClear;
  cavnasButtons[26].onmousedown = moveNodesZMinus;
  cavnasButtons[26].onmousemove = cavnasButtons[26].onmouseup = mouseUpClear;
  cavnasButtons[27].onmousedown = moveNodesZPlus;
  cavnasButtons[27].onmousemove = cavnasButtons[27].onmouseup = mouseUpClear;
  
  return true;
}
