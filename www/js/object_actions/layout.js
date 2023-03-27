const assignYZ = (nodeCoords) => {
  let y_arr = [], //x always 0, assign on floor every time
      z_arr = [],
      node_name = "",
      y_coord = z_coord = 0,
      layerIndex = "";

  for (let i = 0; i < nodeCoords.name.length; i++){
    y_arr.push(Number(nodeCoords.y[i]));
    z_arr.push(Number(nodeCoords.z[i]));
  }

  let y_min = Math.min.apply(Math, y_arr),
    y_max = Math.max.apply(Math, y_arr),
    z_min = Math.min.apply(Math, z_arr),
    z_max = Math.max.apply(Math, z_arr),
    minWidth,
    target_y_min, target_y_max,
    target_z_min, target_z_max,
    layerWidths = layers.map(({ geometry_parameters_width }) => geometry_parameters_width);

  minWidth = Math.min(...layerWidths); 

  if (perLayerLayoutFLag !== undefined) {
    minWidth = layers.find(x => x.name === perLayerLayoutFLag).geometry_parameters_width;
    perLayerLayoutFLag = undefined;
  }

  target_y_min = target_z_min = -minWidth / 2;
  target_y_max = target_z_max = minWidth / 2;

  if (localLayoutFlag) { // if local layout, change target mins and maxes and then unset flag
    layerIndex = layerGroups[nodeGroups[nodeCoords.name[0]]];
    target_y_min = target_y_max =
      nodes[nodeLayerNames.indexOf(nodeCoords.name[0])].position.y / layers[layerIndex].getScale();
    target_z_min = target_z_max =
      nodes[nodeLayerNames.indexOf(nodeCoords.name[0])].position.z / layers[layerIndex].getScale();

    for (let i = 1; i < nodeCoords.name.length; i++) {
      node_name = nodeCoords.name[i];
      if (nodes[nodeLayerNames.indexOf(node_name)]) {
        y_coord = nodes[nodeLayerNames.indexOf(node_name)].position.y / layers[layerIndex].getScale();
        z_coord = nodes[nodeLayerNames.indexOf(node_name)].position.z / layers[layerIndex].getScale();
        if (y_coord < target_y_min)
          target_y_min = y_coord;
        if (y_coord > target_y_max)
          target_y_max = y_coord;
        if (z_coord < target_z_min)
          target_z_min = z_coord;
        if (z_coord > target_z_max)
          target_z_max = z_coord;
      }
    }
    localLayoutFlag = false;
  }

  for (i = 0; i < nodeCoords.name.length; i++) {

    node_name = nodeCoords.name[i];
    if (nodes[nodeLayerNames.indexOf(node_name)]) {
      if (y_max - y_min != 0)
        nodes[nodeLayerNames.indexOf(node_name)].position.y = 
          ((y_arr[i] - y_min) * (target_y_max - target_y_min) /
            (y_max - y_min) + target_y_min) * layers[layerGroups[nodeGroups[node_name]]].getScale(); //mapping * layer stretch scale
      else
        nodes[nodeLayerNames.indexOf(node_name)].position.y = 0;
      if (z_max - z_min != 0)
        nodes[nodeLayerNames.indexOf(node_name)].position.z = 
          ((z_arr[i] - z_min) * (target_z_max - target_z_min) / 
            (z_max - z_min) + target_z_min) * layers[layerGroups[nodeGroups[node_name]]].getScale(); //mapping
      else
        nodes[nodeLayerNames.indexOf(node_name)].position.z = 0;
    }
  }
  
  // Clustering + nodeColorVector
  if (nodeCoords.group != null) {
    for (i = 0; i < nodeCoords.name.length; i++){
      node_name = nodeCoords.name[i].trim();
      if (nodes[nodeLayerNames.indexOf(node_name)]) {
        nodes[nodeLayerNames.indexOf(node_name)].material.color = new THREE.Color(nodeColorVector[nodeCoords.group[i]]);
        node_cluster_colors[nodeLayerNames.indexOf(node_name)] = nodeColorVector[nodeCoords.group[i]];
        nodes[nodeLayerNames.indexOf(node_name)].userData.cluster = nodeCoords.group[i];
      }
    }
  }
  
  updateNodesRShiny();
  redrawEdges();
}

const setPerLayerFlag = (numFlag) => { // from -1: to length of Layers
  perLayerLayoutFLag = numFlag;
}

const setLocalFlag = (flag) => { // flag always true here
  localLayoutFlag = flag;
}

const topologyScale = (nodeScale) => {
  for (i = 0; i < nodeScale.nodeName.length; i++) {
    nodeName = nodeScale.nodeName[i];
    nodes[nodeLayerNames.indexOf(nodeName)].scale.x =
      nodes[nodeLayerNames.indexOf(nodeName)].scale.y =
      nodes[nodeLayerNames.indexOf(nodeName)].scale.z = nodeScale.scale[i];
  }
  updateNodesRShiny();
};

const applyPredefinedLayout = (message) => {
  let numLayers = layers.length;
  if (numLayers <= 1)  alert("You need at least 2 layers for the layouts");
  else {
    if (message) {
      let layer_planes = layers.map(({ plane }) => plane);
      // init position in order to position layers more easily
      scene.tiltDefault();
      layer_size = layer_planes[0].geometry.parameters.height;
      for (let i = 0; i < numLayers; i++) {
        layer_planes[i].position.set(0, 0, 0)
        layer_planes[i].quaternion.copy(camera.quaternion);
        if (layer_size < layer_planes[i].geometry.parameters.height) // TODO probably remove this
          layer_size = layer_planes[i].geometry.parameters.height
      }
      switch (message) {
        case "zigZag":
          for (let i = 1; i < numLayers; i += 2) {
            layers[i].translateY(500);
          }
          initialSpreadLayers(1);
          updateLayersRShiny();
          updateVRLayerLabelsRShiny();
          updateNodesRShiny(); // VR node world positions update
          break;
        case "parallel":
          initialSpreadLayers(1);
          updateLayersRShiny();
          updateVRLayerLabelsRShiny();
          updateNodesRShiny(); // VR node world positions update
          break;
        case "cube":
          let cube_size = 6;
          let groups = Math.ceil(numLayers / cube_size);
          if (numLayers == 6) groups = 1;
          let distance = groups * (Number(layer_size) + 400);
          for (let j = 0; j < groups; j++) {
            if (j * cube_size + cube_size > numLayers) length = numLayers;
            else length = j * cube_size + cube_size;
            k = 0;
            for (let i = j * cube_size; i < length; i++) {
              //position each group
              if (groups > 1) {
                let x;
                if ((groups % 2)) {
                  if(j == Math.floor(groups / 2)) x = 0
                  else if (j < Math.floor(groups / 2))  x = -distance/groups
                  else  x =  distance/groups
                } else {
                  if (j < Math.floor(groups / 2))  x = -distance/groups
                  else x = distance/groups
                }
                layer_planes[i].position.set(x , 0, 0);
              }
              if (!(k % 2))
                layer_planes[i].rotateZ(THREE.Math.degToRad(90));
              if (k >= 4)
                layer_planes[i].rotateY(THREE.Math.degToRad(90));
              // move
              if (k == 0 || k == 1 || k == 5)
                layer_planes[i].translateX(layer_planes[i].geometry.parameters.height/2 + 100);
              else
                layer_planes[i].translateX(-layer_planes[i].geometry.parameters.height/2 - 100);
              k++;
            }
          }
          updateLayersRShiny();
          updateVRLayerLabelsRShiny();
          updateNodesRShiny(); // for VR global posistions
          break;
        case "starLike":
          degree =  360 / numLayers ;
          for (let i = 0; i < numLayers; i++){
            layer_planes[i].rotateZ(THREE.Math.degToRad(degree * i));
            layer_planes[i].translateY(-layer_planes[i].geometry.parameters.height/2 - 100);
          }
          updateLayersRShiny();
          updateVRLayerLabelsRShiny();
          updateNodesRShiny(); // for VR global posistions
          break;
        default:
          break;
      }
    }
  }
}
