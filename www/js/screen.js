let xBoundMin, xBoundMax, yBoundMin, yBoundMax, zBoundMin, zBoundMax,
  camera, renderer, mousePreviousX = 0, mousePreviousY = 0;

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
  // TODO probably communicate to R form here
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