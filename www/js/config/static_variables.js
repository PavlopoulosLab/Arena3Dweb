// class objects
let scene, layers = [], nodeObjects = [], edgeObjects = [];

// screen
let xBoundMin, xBoundMax, yBoundMin, yBoundMax, zBoundMin, zBoundMax,
    camera, renderer, mousePreviousX = 0, mousePreviousY = 0, animationRunning = false;

// layouts
let perLayerLayoutFLag = undefined,
    localLayoutFlag = false;

// labels
let globalLabelColor = "#ffffff",
    layerLabelsDivs = [],
    renderLayerLabelsFlag = false,
    showAllLayerLabelsFlag = true,
    showSelectedLayerLabelsFlag = false,
    nodeLabelsDivs = [],
    renderNodeLabelsFlag = false,
    showAllNodeLabelsFlag = false,
    showSelectedNodeLabelsFlag = true;

// layers
let layerGroups = new Map(),
    lastHoveredLayerIndex = "", // for correct hover coloring
    hoveredLayerPaintedFlag = false,
    layerDragControls = "",
    layerIntervalTimeout = "",
    layerColorPrioritySource = "default"; // or "picker"

// nodes
let nodeIntervalTimeout = "",
    selectedNodeColorFlag = true,
    nodeColorPrioritySource = "default", // or "cluster"
    nodeGroups = new Map(),
    last_hovered_node_index = "",
    nodeLayerNames = [], // keeping this for performance
    nodeNames = []; // to init upload network nodes

// edges
let renderInterLayerEdgesFlag = false,
    waitEdgeRenderFlag = true,
    interEdgesRemoved = false,
    selectedEdgeColorFlag = true,
    edgeFileColorPriority = false,
    isDirectionEnabled = false,
    edgeWidthByWeight = true,
    interLayerEdgeOpacity = 0.4,
    intraLayerEdgeOpacity = 1,
    interDirectionArrowSize = 5,
    intraDirectionArrowSize = 5,
    interChannelCurvature = 5,
    intraChannelCurvature = 15,
    edgePairs = [], // keeping for faster recursive node/edge selections
    edgePairs_source = [], // to init upload/import edge source nodeLayer names
    edgePairs_target = [], // to init upload/import edge target nodeLayer names
    edgeValues = [], // to init upload/import edge weights
    edgeColors = [], // to init upload/import edge weights
    // channels
    channels = [],
    selectedChannels = [], // selected ones from Layout tab
    channelColors = {},
    channelVisibility = {},
    edgeChannels = []; // to init upload/import edge channels

// others
let interLayerEdgesRenderPauseFlag = false,
    canvasControlsAttached = false,
    fps = 30,
    shiftX = "",
    shiftY = "",
    lasso = "",
    optionsList = "",
    downstreamCheckedNodes = []; // for recursive 3rd option of onRightClick on node
