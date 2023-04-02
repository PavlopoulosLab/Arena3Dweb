const setRenderer = () => {
  renderer = new THREE.WebGLRenderer({ antialias: true });
};

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

  if (renderLayerLabelsFlag)
    renderLayerLabels();
  if (renderNodeLabelsFlag)
    renderNodeLabels();
  
  // TODO global flag
  // draw inter-layer edges only when necessary for performance improvement
  if (scene.dragging || interLayerEdgesRenderPauseFlag) {
    redrawInterLayerEdges(false);
  } else if (edgeWidthByWeight || interLayerEdgeOpacity > 0) {
    redrawInterLayerEdges(true);
    draw_inter_edges_flag = true;
  } else if (draw_inter_edges_flag)
    redrawInterLayerEdges(false);

	renderer.render(scene.THREE_Object, camera);
}
