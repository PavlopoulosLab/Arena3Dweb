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

  // assignXYZ
  for (let i = 0; i < nodeCoords.name.length; i++) {
    nodeName = nodeCoords.name[i];
    
    nodeObjects[nodeLayerNames.indexOf(nodeName)].setPosition("x", 0);

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

const scaleTopology = (nodeScale) => {
  let nodeName;

  for (let i = 0; i < nodeScale.nodeName.length; i++) {
    nodeName = nodeScale.nodeName[i];
    nodeObjects[nodeLayerNames.indexOf(nodeName)].setScale(nodeScale.scale[i]);
  }

  updateNodesRShiny();
};

const applyPredefinedLayout = (message) => {
  if (existEnoughLayers()) {
    resetSceneAndLayerPositions();

    if (message == "parallel") {
      initialSpreadLayers(1);
    } else if  (message == "zigZag") {
      for (let i = 1; i < layers.length; i += 2)
        layers[i].translateY(500);
      
      initialSpreadLayers(1); 
    } else if (message == "starLike") {
      applyStarLayout();
    } else if (message == "cube")
      applyCubeLayout();
    

    updateLayersRShiny();
    updateVRLayerLabelsRShiny();
    updateVRNodesRShiny();
  }
};

const existEnoughLayers = () => {
  return(layers.length > 1)
};

const resetSceneAndLayerPositions = () => {
  let layerPlanes = layers.map(({ plane }) => plane);
  
  scene.tiltDefault();

  for (let i = 0; i < layers.length; i++) {
    layerPlanes[i].position.set(0, 0, 0);
    layerPlanes[i].quaternion.copy(camera.quaternion);
  }
};

const applyStarLayout = () => {
  let layerPlanes = layers.map(({ plane }) => plane),
    degree =  360 / layers.length;

  for (let i = 0; i < layers.length; i++) {
    layerPlanes[i].rotateZ(THREE.Math.degToRad(degree * i));
    layerPlanes[i].translateY(-layerPlanes[i].geometry.parameters.height / 2 - 100);
  }
};

const applyCubeLayout = () => {
  let layerPlanes = layers.map(({ plane }) => plane),
    layerSize = getLargestLayerSize(layerPlanes),
    layersPerCube = 6,
    cubes = Math.ceil(layers.length / layersPerCube),
    distance = cubes * (Number(layerSize) + 400),
    cubeSideCode, max_i, x;

  for (let j = 0; j < cubes; j++) {
    cubeSideCode = 0;
    max_i = j * layersPerCube + layersPerCube;
    if (max_i > layers.length)
      max_i = layers.length;
    
    // Each cube
    for (let i = j * layersPerCube; i < max_i; i++) {
      if (cubes > 1) {
        x = decideLayerStartingPositionX(j, cubes, distance);
        layerPlanes[i].position.set(x, 0, 0);
      }

      if (!(cubeSideCode % 2))
        layerPlanes[i].rotateZ(THREE.Math.degToRad(90));

      if (cubeSideCode >= 4)
        layerPlanes[i].rotateY(THREE.Math.degToRad(90));

      if (cubeSideCode == 0 || cubeSideCode == 1 || cubeSideCode == 5)
        layerPlanes[i].translateX(layerPlanes[i].geometry.parameters.height / 2 + 100);
      else
        layerPlanes[i].translateX(-layerPlanes[i].geometry.parameters.height / 2 - 100);

      cubeSideCode++;
    }
  }
};

const getLargestLayerSize = (layerPlanes) => {
  let layerSize = layerPlanes[0].geometry.parameters.height;

  for (let i = 1; i < layers.length; i++)
    if (layerPlanes[i].geometry.parameters.height > layerSize)
      layerSize = layerPlanes[i].geometry.parameters.height;
  
  return(layerSize)
};

const decideLayerStartingPositionX = (j, cubes, distance) => {
  let x;
  
  if (cubes % 2) {
    if (j == Math.floor(cubes / 2))
      x = 0;
    else if (j < Math.floor(cubes / 2))
      x = -distance / cubes;
    else
      x = distance / cubes;
  } else {
    if (j < Math.floor(cubes / 2))
      x = -distance / cubes;
    else
      x = distance / cubes;
  }

  return(x)
};
