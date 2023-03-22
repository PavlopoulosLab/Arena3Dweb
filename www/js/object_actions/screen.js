const setRenderer = () => {
  renderer = new THREE.WebGLRenderer({antialias: true});
}

const resetScreen = () => {
  setWindowBounds();
  setCamera();
  resizeRenderer();
}

const setWindowBounds = () => {
  xBoundMin = -window.innerWidth/2,
  xBoundMax = window.innerWidth/2,
  yBoundMin = -window.innerHeight/2,
  yBoundMax = window.innerHeight/2,
  zBoundMin = -window.innerHeight/2.5,
  zBoundMax = window.innerHeight/2.5;
}

const setCamera = () => {
  // camera: left, right, top, bottom, near, far
  camera = new THREE.OrthographicCamera(xBoundMin, xBoundMax,
    yBoundMax, yBoundMin, -4 * xBoundMax, 4 * xBoundMax);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
}

const resizeRenderer = () => {
  renderer.setSize(2 * xBoundMax , 2 * yBoundMax);
}

const setRendererColor = (hexColor) => {
  if (scene.exists()) {
    renderer.setClearColor(hexColor);
    updateScenePanRShiny();
  }
}

const setRaycaster = (event) => {
  RAYVECTOR.set((event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1, -1 ); // z = - 1 important!
  RAYVECTOR.unproject(camera);
  RAYDIR.set(0, 0, -1).transformDirection(camera.matrixWorld);
  RAYCASTER.set(RAYVECTOR, RAYDIR);
}

// 3D graphics render animation ====================
const animate = () => { // TODO optimize performance
  setTimeout(function() { // limiting FPS
    requestAnimationFrame(animate); // pauses when the user navigates to another browser tab
  }, 1000 / fps);

  renderLayerLabels();
  renderNodeLabels(); // TODO add/check flag conditions
  
  // draw inter-layer edges only when necessary for performance improvement
  if (scene.dragging || interLayerEdgesRenderPauseFlag) {
    drawLayerEdges(false);
  } else if (edgeWidthByWeight || interLayerEdgeOpacity > 0) {
    drawLayerEdges(true);
    draw_inter_edges_flag = true;
  } else if (draw_inter_edges_flag)
    drawLayerEdges(false);

	renderer.render(scene.THREE_Object, camera);
}

const renderLayerLabels = () => {
  if (showAllLayerLabelsFlag)
    redrawLayerLabels("all");
  else {
    if (showSelectedLayerLabelsFlag) {
      let selected_layers = getSelectedLayers();
      if (selected_layers.length > 0)
        redrawLayerLabels("selected");
    }
  }
}

const redrawLayerLabels = (mode) => {
  let  layerArray, layerX, layerY, labelX, labelY,
    i, position, hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox"),
    layer_spheres = layers.map(({ sphere }) => sphere);
  switch (mode) {
    case "all":
      layerArray = layers.map(({ name }) => name);
      break;
    case "selected":
      layerArray = getSelectedLayers();
  }
  
  for (i = 0; i < layerArray.length; i++) { // TODO replace for loop with map (objects)
    position = mode == "selected" ? layerArray[i] : i;
    if (!hidelayerCheckboxes[position].checked) { // if node's layer not hidden, counting elements
      layerX = layer_spheres[position].getWorldPosition(new THREE.Vector3()).x,
      layerY = layer_spheres[position].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + layerX;
      labelY = yBoundMax - layerY;
      layer_label_divs[position].style.left = labelX.toString().concat("px");
      layer_label_divs[position].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      let canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth)
          layer_label_divs[position].style.display = "none";
      else
        layer_label_divs[position].style.display = "inline-block";
    } else
      layer_label_divs[position].style.display = "none";
  }
}

const renderNodeLabels = () => { // TODO add/check flag conditions
  let nodeX = "",
      nodeY = "",
      labelX = "",
      labelY = "";
  for (let i = 0; i < node_label_flags.length; i++){
    let node_layer = layerGroups[node_groups[node_whole_names[i]]];
    if (node_label_flags[i]){ //ONLY CHECK THIS 
      nodeX = nodes[i].getWorldPosition(new THREE.Vector3()).x,
      nodeY = nodes[i].getWorldPosition(new THREE.Vector3()).y;
      labelX = xBoundMax + nodeX + 7;
      labelY = yBoundMax - nodeY - 10;
      node_labels[i].style.left = labelX.toString().concat("px");
      node_labels[i].style.top = labelY.toString().concat("px");
      //check if overlapping with canvas div to set visibility
      let canvas_div = document.getElementById("3d-graph");
      if (labelX < 0 || labelY < 0  || labelY >= canvas_div.offsetHeight
          || labelX > document.getElementsByTagName("canvas")[0].offsetWidth) node_labels[i].style.display = "none";
      else node_labels[i].style.display = "inline-block";
    } else node_labels[i].style.display = "none";
  }
} 

// runs constantly on animate
const drawLayerEdges = (flag) => {
  let i;
  if (!flag && (scene.dragging || interLayerEdgesRenderPauseFlag)){
    for (let i = 0; i < layer_edges_pairs.length; i++){
      scene.remove(layerEdges[i]);
    }
  } else if (!flag && !(edgeWidthByWeight && interLayerEdgeOpacity > 0)){ //this optimizes execution for many connections by making them disappear
    for (let i = 0; i < layer_edges_pairs.length; i++){
      scene.remove(layerEdges[i]);
    }
    draw_inter_edges_flag = false;
  } else {
    let index1 = 0, index2 = 0, color = "", pos = -1, pos1 = -1, pos2 = -1;
    let hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox");
    for (i = 0; i < layer_edges_pairs.length; i++){
      scene.remove(layerEdges[i]);
      // Keep default color
      if (layer_edges_pairs_channels && layer_edges_pairs_channels[i] &&  layer_edges_pairs_channels[i].length === 1) {  
        color = channel_color[layer_edges_pairs_channels[i][0]];
      } else {
        color = edgeDefaultColor;
      }
      let points = [];
      let edge_split = edge_pairs[layer_edges_pairs[i]].split("---");
      let node_layer1 = layerGroups[node_groups[edge_split[0]]];
      let node_layer2 = layerGroups[node_groups[edge_split[1]]];
      if (!hidelayerCheckboxes[node_layer1].checked && !hidelayerCheckboxes[node_layer2].checked) {
        index1 = node_whole_names.indexOf(edge_split[0]);
        index2 = node_whole_names.indexOf(edge_split[1]);
        points.push( nodes[index1].getWorldPosition(new THREE.Vector3()), nodes[index2].getWorldPosition(new THREE.Vector3()) );
    		let geometry = new THREE.BufferGeometry().setFromPoints( points );
        let material = "";
        // set color to selectedDefault if the edge is selected
    		if (exists(selected_edges, layer_edges_pairs[i]) && selectedEdgeColorFlag) color = selectedDefaultColor;
        else if (edge_attributes !== "" && edgeAttributesPriority) {
    		  pos = edges.indexOf(layer_edges_pairs[i]);
    		  pos1 = edge_attributes.SourceNode.indexOf(edge_pairs[pos]);
    		  pos2 = edge_attributes.TargetNode.indexOf(edge_pairs[pos]);
          if (checkIfAttributeColorExist(edge_attributes, pos1)) color = edge_attributes.Color[pos1];
          else if (checkIfAttributeColorExist(edge_attributes, pos2)) color = edge_attributes.Color[pos2];
    		}
        if (edgeWidthByWeight) material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: edge_values[layer_edges_pairs[i]] });
        else {
          material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: interLayerEdgeOpacity });
        }
        let arrowHelper = createArrow(points, color,null, true);
        let ver_line = new THREE.Line(geometry, material);

        // if the edge is multi channel create the multiple channels
        if (layer_edges_pairs_channels[i]) {
          let curve_group = new THREE.Group();
          curve_group = createChannels(points[0], points[1], interChannelCurvature, ver_line, i, true);
          scene.add(curve_group);
          layerEdges[i] = curve_group;
        } else {
          //directed
          if (isDirectionEnabled) {
            const group = new THREE.Group();
            group.add( ver_line );
            group.add( arrowHelper );
            scene.add(group);
            layerEdges[i] = group;
          } else {
            scene.add(ver_line);
            layerEdges[i] = ver_line;
          }
        }
      }
    }
  }
}
