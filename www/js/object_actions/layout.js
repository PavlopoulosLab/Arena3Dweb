const setPerLayerFlag = (numFlag) => { // from -1: to length of Layers
  perLayerLayoutFLag = numFlag;
};

const setLocalFlag = (flag) => { // flag always true here
  localLayoutFlag = flag;
};

const executeLayout = (nodeCoords) => {
  // x always 0, assign on floor every time
  let y_arr = [], z_arr = [],
    y_min, y_max, z_min, z_max, minWidth,
    target_y_min, target_y_max, target_z_min, target_z_max,
    nodeName;

  for (let i = 0; i < nodeCoords.name.length; i++) {
    y_arr.push(Number(nodeCoords.y[i]));
    z_arr.push(Number(nodeCoords.z[i]));
  }

  [y_min, y_max, z_min, z_max] = getMinAndMaxInputCoordValues(y_arr, z_arr);
  minWidth = getMinLayerWidth();

  if (isPerLayerOrLocalLayoutChosen())
    minWidth = getPerLayerMinWidth();

  target_y_min = target_z_min = -minWidth / 2;
  target_y_max = target_z_max = minWidth / 2;

  if (isLocalLayoutChosen())
    [target_y_min, target_y_max, target_z_min, target_z_max] = getMinAndMaxTargetCoordValues(nodeCoords);

  // assignYZ
  for (let i = 0; i < nodeCoords.name.length; i++) {
    nodeName = nodeCoords.name[i];
    
    if (y_max - y_min != 0)
      nodeObjects[nodeLayerNames.indexOf(nodeName)].setPosition("y", 
        ((y_arr[i] - y_min) * (target_y_max - target_y_min) /
          (y_max - y_min) + target_y_min) * layers[layerGroups[nodeGroups[nodeName]]].getScale());
    else
      nodeObjects[nodeLayerNames.indexOf(nodeName)].setPosition("y", 0);

    if (z_max - z_min != 0)
      nodeObjects[nodeLayerNames.indexOf(nodeName)].setPosition("z",
        ((z_arr[i] - z_min) * (target_z_max - target_z_min) / 
          (z_max - z_min) + target_z_min) * layers[layerGroups[nodeGroups[nodeName]]].getScale());
    else
      nodeObjects[nodeLayerNames.indexOf(nodeName)].setPosition("z", 0);
  }
  
  if (isClusteringChosen(nodeCoords))
    setClustersAndColors(nodeCoords);

  updateNodesRShiny();
  updateVRNodesRShiny();
  redrawIntraLayerEdges();
};

const getMinAndMaxInputCoordValues = (y_arr, z_arr) => {
  let y_min = Math.min.apply(Math, y_arr),
    y_max = Math.max.apply(Math, y_arr),
    z_min = Math.min.apply(Math, z_arr),
    z_max = Math.max.apply(Math, z_arr);
    
    return([y_min, y_max, z_min, z_max])
};

const getMinLayerWidth = () => {
  let layerWidths = layers.map(({ geometry_parameters_width }) => geometry_parameters_width),
    minWidth = Math.min(...layerWidths);

  return(minWidth);
};

const isPerLayerOrLocalLayoutChosen = () => {
  return(perLayerLayoutFLag !== undefined)
};

const getPerLayerMinWidth = () => {
  let minWidth = layers.find(x => x.name === perLayerLayoutFLag).geometry_parameters_width;
  perLayerLayoutFLag = undefined;
  return(minWidth)
};

const isLocalLayoutChosen = () => {
  return(localLayoutFlag);
};

const getMinAndMaxTargetCoordValues = (nodeCoords) => {
  // all nodes in same layer always at this point ( = executeLayout executed per Layer, here)
  let layerIndex = layerGroups[nodeGroups[nodeCoords.name[0]]],
    scale = layers[layerIndex].getScale(),
    y_coord, z_coord;

  // init with element 0
  target_y_min = target_y_max =
    nodeObjects[nodeLayerNames.indexOf(nodeCoords.name[0])].getPosition("y") / scale;
  target_z_min = target_z_max =
    nodeObjects[nodeLayerNames.indexOf(nodeCoords.name[0])].getPosition("z") / scale;

  for (let i = 1; i < nodeCoords.name.length; i++) {
    y_coord = nodeObjects[nodeLayerNames.indexOf(nodeCoords.name[i])].getPosition("y") / scale;
    z_coord = nodeObjects[nodeLayerNames.indexOf(nodeCoords.name[i])].getPosition("z") / scale;

    if (y_coord < target_y_min)
      target_y_min = y_coord;
    if (y_coord > target_y_max)
      target_y_max = y_coord;
    if (z_coord < target_z_min)
      target_z_min = z_coord;
    if (z_coord > target_z_max)
      target_z_max = z_coord;
  }
  
  localLayoutFlag = false;

  return([target_y_min, target_y_max, target_z_min, target_z_max])
};

const isClusteringChosen = (nodeCoords) => {
  return(nodeCoords.group != null)
};

const setClustersAndColors = (nodeCoords) => {
  for (let i = 0; i < nodeCoords.name.length; i++) {
    nodeObjects[nodeLayerNames.indexOf(nodeCoords.name[i])].setColor(COLOR_VECTOR_280[nodeCoords.group[i]]);
    nodeObjects[nodeLayerNames.indexOf(nodeCoords.name[i])].setCluster(nodeCoords.group[i]);
  }
};

const topologyScale = (nodeScale) => {
  let nodeName;

  for (let i = 0; i < nodeScale.nodeName.length; i++) {
    nodeName = nodeScale.nodeName[i];
    nodeObjects[nodeLayerNames.indexOf(nodeName)].setScale(nodeScale.scale[i]);
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
          updateVRNodesRShiny();
          break;
        case "parallel":
          initialSpreadLayers(1);
          updateLayersRShiny();
          updateVRLayerLabelsRShiny();
          updateVRNodesRShiny();
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
          updateVRNodesRShiny();
          break;
        case "starLike":
          degree =  360 / numLayers ;
          for (let i = 0; i < numLayers; i++){
            layer_planes[i].rotateZ(THREE.Math.degToRad(degree * i));
            layer_planes[i].translateY(-layer_planes[i].geometry.parameters.height/2 - 100);
          }
          updateLayersRShiny();
          updateVRLayerLabelsRShiny();
          updateVRNodesRShiny();
          break;
        default:
          break;
      }
    }
  }
}
