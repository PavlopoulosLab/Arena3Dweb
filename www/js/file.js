const executePreNetworkSetup = () => {
    colorVector = COLOR_VECTOR_DARK.concat(COLOR_VECTOR_271);
    clearCanvas();
    if (!canvasControlsAttached)
        attachCanvasControls();
};

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
