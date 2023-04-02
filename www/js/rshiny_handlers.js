// General ====================
const initializeGlobals = (RGlobalsList) => {
  MAX_LAYERS = RGlobalsList.MAX_LAYERS;
  MAX_EDGES = RGlobalsList.MAX_EDGES;
  MAX_CHANNELS = RGlobalsList.MAX_CHANNELS;
  EDGE_DEFAULT_COLOR = RGlobalsList.EDGE_DEFAULT_COLOR;
  CHANNEL_COLORS_DARK = RGlobalsList.CHANNEL_COLORS_DARK;
  CHANNEL_COLORS_LIGHT = RGlobalsList.CHANNEL_COLORS_LIGHT;
};

const startLoader = (m) => {
  let canvas_div = document.getElementById("3d-graph"),
    loader = document.getElementById("loader");
  canvas_div.style.opacity = 0.5;
  loader.style.display = "inline-block";
};

const finishLoader = (m) => {
  let canvas_div = document.getElementById("3d-graph"),
      loader = document.getElementById("loader");
  canvas_div.style.opacity = 1;
  loader.style.display = "none";
};

const changeFPS = (message) => {
  fps = Number(message);
  if (isNaN(fps))
    fps = 30;
};

const browseUrl = url => {
  window.open(url, "_blank");
};

// Scene ====================
const toggleSceneCoords = (sceneCoordsSwitch) => { // true or false
  if (scene.exists())
    scene.toggleCoords(sceneCoordsSwitch);
}

const autoRotateScene = (autoRotateFlag) => {
  if (scene.exists()) {
    scene.autoRotate = autoRotateFlag;
    if (!scene.autoRotate)
      clearInterval(scene.intervalTimeout);
  }
}

//RSHINY HANDLERS----------------------------
// General ====================
Shiny.addCustomMessageHandler("handler_initializeGlobals", initializeGlobals);
Shiny.addCustomMessageHandler("handler_startLoader", startLoader);
Shiny.addCustomMessageHandler("handler_finishLoader", finishLoader);
Shiny.addCustomMessageHandler("handler_fps", changeFPS);
Shiny.addCustomMessageHandler("handler_browseUrl", browseUrl);
// Files ====================
Shiny.addCustomMessageHandler("handler_uploadNetwork", uploadNetwork);
Shiny.addCustomMessageHandler("handler_importNetwork", importNetwork);
Shiny.addCustomMessageHandler("handler_setNodeAttributes", setNodeAttributes);
Shiny.addCustomMessageHandler("handler_setEdgeAttributes", setEdgeAttributes);
// Scene ====================
Shiny.addCustomMessageHandler("handler_toggleSceneCoords", toggleSceneCoords);
Shiny.addCustomMessageHandler("handler_autoRotateScene", autoRotateScene);
// Layers ====================
Shiny.addCustomMessageHandler("handler_showLayerCoords", showLayerCoords);
Shiny.addCustomMessageHandler("handler_floorOpacity", setFloorOpacity);
Shiny.addCustomMessageHandler("handler_showWireFrames", showWireFrames);
Shiny.addCustomMessageHandler("handler_selectAllLayers", selectAllLayers);
Shiny.addCustomMessageHandler("handler_setLayerColorPriority", setLayerColorPriority);
// Nodes ====================
Shiny.addCustomMessageHandler("handler_selectAllNodes", selectAllNodes);
Shiny.addCustomMessageHandler("handler_setNodeColorPriority", setNodeColorPriority);
Shiny.addCustomMessageHandler("handler_setNodeSelectedColorPriority", setNodeSelectedColorPriority);
Shiny.addCustomMessageHandler("handler_clickNodeColorPriority", clickNodeColorPriority);
// Edges ====================
Shiny.addCustomMessageHandler("handler_directionArrowSize", setDirectionArrowSize);
Shiny.addCustomMessageHandler("handler_intraDirectionArrowSize", setIntraDirectionArrowSize);
Shiny.addCustomMessageHandler("handler_layerEdgeOpacity", setLayerEdgeOpacity);
Shiny.addCustomMessageHandler("handler_interLayerEdgeOpacity", setInterLayerEdgeOpacity);
Shiny.addCustomMessageHandler("handler_edgeWidthByWeight", redrawEdgeWidthByWeight);
Shiny.addCustomMessageHandler("handler_edgeSelectedColorPriority", edgeSelectedColorPriority);
Shiny.addCustomMessageHandler("handler_edgeFileColorPriority", edgeFileColorPriority);
Shiny.addCustomMessageHandler("handler_toggleDirection", toggleDirection);
// Channels ====================
Shiny.addCustomMessageHandler("handler_channelCurvature", toggleChannelCurvature);
Shiny.addCustomMessageHandler("handler_interChannelCurvature", interToggleChannelCurvature);
// Labels ====================
Shiny.addCustomMessageHandler("handler_showLayerLabels", showLayerLabels);
Shiny.addCustomMessageHandler("handler_resizeLayerLabels", resizeLayerLabels);
Shiny.addCustomMessageHandler("handler_showNodeLabels", showNodeLabels);
Shiny.addCustomMessageHandler("handler_resizeNodeLabels", resizeNodeLabels);
// Layouts and Topology ====================
Shiny.addCustomMessageHandler("handler_layout", assignYZ);
Shiny.addCustomMessageHandler("handler_setPerLayerFlag", setPerLayerFlag);
Shiny.addCustomMessageHandler("handler_setLocalFlag", setLocalFlag);
Shiny.addCustomMessageHandler("handler_topologyScale", topologyScale);
Shiny.addCustomMessageHandler("handler_predefined_layer_layout", applyPredefinedLayout);
