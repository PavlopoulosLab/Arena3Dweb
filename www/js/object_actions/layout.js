const assignXYZ = (nodeCoords) => {
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
      target_y_min = yBoundMin,
      target_y_max = yBoundMax,
      target_z_min = zBoundMin,
      target_z_max = zBoundMax;
  if (localLayoutFlag) { //if local layout, change target mins and maxes and then unset flag
    layerIndex = layer_groups[node_groups[nodeCoords.name[0]]];
    target_y_min = target_y_max = nodes[node_whole_names.indexOf(nodeCoords.name[0].trim())].position.y/last_layer_scale[layerIndex],
    target_z_min = target_z_max = nodes[node_whole_names.indexOf(nodeCoords.name[0].trim())].position.z/last_layer_scale[layerIndex];
    for (i = 1; i < nodeCoords.name.length; i++) {
      node_name = nodeCoords.name[i].trim();
      if (nodes[node_whole_names.indexOf(node_name)]) {
        y_coord = nodes[node_whole_names.indexOf(node_name)].position.y / last_layer_scale[layerIndex];
        z_coord = nodes[node_whole_names.indexOf(node_name)].position.z / last_layer_scale[layerIndex];
        if (y_coord < target_y_min) target_y_min = y_coord;
        if (y_coord > target_y_max) target_y_max = y_coord;
        if (z_coord < target_z_min) target_z_min = z_coord;
        if (z_coord > target_z_max) target_z_max = z_coord;
      }
      if (target_y_min == target_y_max) { //form a square
        target_y_min = target_y_min - Math.abs(target_z_min - target_z_max) / 2;
        target_y_max = target_y_max + Math.abs(target_z_min - target_z_max) / 2;
      } else if (target_z_min == target_z_max) {
        target_z_min = target_z_min - Math.abs(target_y_min - target_y_max) / 2;
        target_z_max = target_z_max + Math.abs(target_y_min - target_y_max) / 2;
      }
    }
    localLayoutFlag = false;
  }
  for (i = 0; i < nodeCoords.name.length; i++){
    node_name = nodeCoords.name[i].trim();
    if (nodes[node_whole_names.indexOf(node_name)]) {
      if (y_max - y_min != 0)
        nodes[node_whole_names.indexOf(node_name)].position.y = 
          ((y_arr[i] - y_min) * (target_y_max - target_y_min) /
            (y_max - y_min) + target_y_min) * last_layer_scale[layer_groups[node_groups[node_name]]]; //mapping * layer stretch scale
      else
        nodes[node_whole_names.indexOf(node_name)].position.y = 0;
      if (z_max - z_min != 0)
        nodes[node_whole_names.indexOf(node_name)].position.z = 
          ((z_arr[i] - z_min) * (target_z_max - target_z_min) / 
            (z_max - z_min) + target_z_min) * last_layer_scale[layer_groups[node_groups[node_name]]]; //mapping
      else
        nodes[node_whole_names.indexOf(node_name)].position.z = 0;
    }
  }
  
  // Clustering + colorVector
  if (nodeCoords.group != null) {
    for (i = 0; i < nodeCoords.name.length; i++){
      node_name = nodeCoords.name[i].trim();
      if (nodes[node_whole_names.indexOf(node_name)]) {
        nodes[node_whole_names.indexOf(node_name)].material.color = new THREE.Color(colorVector[nodeCoords.group[i]]);
        node_cluster_colors[node_whole_names.indexOf(node_name)] = colorVector[nodeCoords.group[i]];
        nodes[node_whole_names.indexOf(node_name)].userData.cluster = nodeCoords.group[i];
      }
    }
  }
  
  updateNodesRShiny();
  redrawEdges();
}

const setLocalFlag = (flag) => { // flag always true here
  localLayoutFlag = flag;
}

const topologyScale = (nodeScale) => {
  for (i = 0; i < nodeScale.nodeName.length; i++) {
    nodeName = nodeScale.nodeName[i];
    nodes[node_whole_names.indexOf(nodeName)].scale.x =
      nodes[node_whole_names.indexOf(nodeName)].scale.y =
      nodes[node_whole_names.indexOf(nodeName)].scale.z = nodeScale.scale[i];
  }
  updateNodesRShiny();
};

const applyPredefinedLayout = (message) => {
  let numLayers = layer_planes.length;
  if (numLayers <= 1)  alert("You need at least 2 layers for the layouts");
  else {
    if (message) {
      // init position in order to position layers more easily
      scene.tiltDefault();
      layer_size = layer_planes[0].geometry.parameters.height;
      for (let i = 0; i < numLayers; i++) {
        layer_planes[i].position.set(0, 0, 0)
        layer_planes[i].quaternion.copy(camera.quaternion);
        if(layer_size < layer_planes[i].geometry.parameters.height) layer_size = layer_planes[i].geometry.parameters.height
      }
      switch (message) {
        case "zigZag":
          for (let i = 1; i < numLayers; i+=2){
            layer_planes[i].translateY(500);
          }
          moveLayers();
          break;
        case "parallel":
         moveLayers();
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
              if (!(k % 2)) layer_planes[i].rotateZ(THREE.Math.degToRad(90));
              if (k >= 4) layer_planes[i].rotateY(THREE.Math.degToRad(90));
              // move
              if (k == 0 || k == 1 || k == 5) {
                layer_planes[i].translateX(layer_planes[i].geometry.parameters.height/2 + 100);
              } else {
                 layer_planes[i].translateX(-layer_planes[i].geometry.parameters.height/2 - 100);
              }
              k++;
            }
          }
          updateLayersRShiny();
          updateNodesRShiny(); // for VR global posistions
          break;
        case "starLike":
          degree =  360 / numLayers ;
          for (let i = 0; i < numLayers; i++){
            layer_planes[i].rotateZ(THREE.Math.degToRad(degree * i));
            layer_planes[i].translateY(-layer_planes[i].geometry.parameters.height/2 - 100);
          }
          updateLayersRShiny();
          updateNodesRShiny(); // for VR global posistions
          break;
        default:
          break;
      }
    }
  }

  return true;
}
