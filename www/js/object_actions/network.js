const executePreNetworkSetup = () => {
    colorVector = COLOR_VECTOR_DARK.concat(COLOR_VECTOR_271);
    clearCanvas();
    if (!canvasControlsAttached)
        attachCanvasControls();
};

const clearCanvas = () => {
  scene.reset();
  layers = [];


  nodes = [], //canvas objects
  node_labels = [];
  document.getElementById("labelDiv").innerHTML = "";
  if (document.getElementById("channelColorLayoutDiv")) document.getElementById("channelColorLayoutDiv").innerHTML = "";
  if (document.getElementById("channelColorPicker")) document.getElementById("channelColorPicker").innerHTML = "";
  node_names = [],
  node_whole_names = [],
  node_label_flags = [],
  hovered_nodes = [],
  last_hovered_node_index = "",
  last_hovered_layer_index = "",
  edges = [], //canvas objects
  layerEdges = [], //canvas objects
  edge_pairs = [],
  layer_edges_pairs = [], //canvas objects
  layer_edges_pairs_channels = [], //canvas objects
  edge_values = [],
  edge_channels = [],
  channels = [],
  layerCoords = [],
  node_groups = new Map(),
  layer_groups = new Map(),
  layer_labels = [], //divs
  layer_names = [],
  layer_node_labels_flags = [],
  floorDefaultColors = [], 
  layer_planes = [],
  layer_spheres = [],
  js_selected_layers = [],
  selectedNodePositions = [],
  selected_edges = [],
  shiftX = "",
  shiftY = "",
  lasso = "",
  optionsList = "",
  node_cluster_colors = [],
  node_attributes = "",
  edge_attributes = "",
  last_layer_scale = [];
  channel_values = [];
  isDirectionEnabled = false;
  toggleChannelCurvatureRange(false);
  return true;
}

const loadGraph = () => {
  //create layer planes
  let layerSphereGeometry = new THREE.SphereGeometry( 0 );
  let layerSphereMaterial = new THREE.MeshBasicMaterial( {color:"white", transparent: true, opacity: 0.5} );
  for(let i = 0; i < Object.getOwnPropertyNames(layer_groups).length; i++){
    let planeGeom = new THREE.PlaneGeometry(2*yBoundMax, 2*yBoundMax, PLANE_WIDTHSEGMENTS, PLANE_HEIGHTSEGMENTS);
    planeGeom.rotateY(THREE.Math.degToRad(90));
    let planeMat = new THREE.MeshBasicMaterial({
      color: floorCurrentColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: layerOpacity,
      side: THREE.DoubleSide,
    });
    let plane = new THREE.Mesh(planeGeom, planeMat);
    let sphere = new THREE.Mesh( layerSphereGeometry, layerSphereMaterial );
    plane.add(sphere);
    sphere.translateY(-yBoundMax);
	  sphere.translateZ(zBoundMax);
    layer_planes.push(plane);
    layer_spheres.push(sphere);
    scene.addLayer(plane); // TODO swap with scene.addLayer(newLayer.plane) where newLayer = new Layer(params)
    last_layer_scale.push(1);
  }
  //create node geometries
  for (i = 0; i < node_whole_names.length; i++){
    geometry = new THREE.SphereGeometry( SPHERE_RADIUS, SPHERE_WIDTHSEGMENTS, SPHERE_HEIGHTSEGMENTS );
    material = new THREE.MeshStandardMaterial( {color: colorVector[(layer_groups[node_groups[node_whole_names[i]]])%colorVector.length], transparent: true} ); //standard material allows light reaction
    sphere = new THREE.Mesh( geometry, material );
    nodes.push(sphere);
    layer_planes[layer_groups[node_groups[node_whole_names[i]]]].add(sphere); //attaching to corresponding layer centroid
  }
  
  
  channel_colors = CHANNEL_COLORS_LIGHT;
  createChannelColorMap();
  scrambleNodes();
  moveLayers();
  drawEdges();
  createLabels();

  //init selected channels for layout with all the channels
  channels_layout = channels;
  Shiny.setInputValue("channels_layout", channels_layout); //R monitors selected Channels
  
  scene.tiltDefault();
  scene.setScale(0.9); //starting a little zoomed out
}


const executePostNetworkSetup = () => {
    drag_controls = new DragControls(layer_planes, camera, renderer.domElement);

    updateScenePanRShiny();
    updateSceneSphereRShiny();
    updateLayersRShiny();
    updateNodesRShiny();
    updateEdgesRShiny();
    updateLabelColorRShiny();

    if (!animationRunning) { // ensure animation runs only once
        animate();
        animationRunning = true;
    }
}
