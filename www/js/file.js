const executePreNetworkSetup = () => {
    colorVector = COLOR_VECTOR_DARK.concat(COLOR_VECTOR_271);
    clearCanvas();
    if (!canvasControlsAttached)
        attachCanvasControls();
};
