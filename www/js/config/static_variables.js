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
    nodeLabelDefaultSize = "12px",
    layer_label_divs = [],
    node_labels = [], //divs to be overlaid above canvas
    nodeLabelFlags = []; // TODO add to Node class as this.showLabel()

// layers
let layerGroups = new Map(),
    lastHoveredLayerIndex = "", // for correct hover coloring
    hoveredLayerPaintedFlag = false,
    layerDragControls = "",
    layerIntervalTimeout = "",
    showAllLayerLabelsFlag = true,
    showSelectedLayerLabelsFlag = false,
    layerColorPrioritySource = "default"; // or "picker"

// nodes
let nodeIntervalTimeout = "",
    selectedNodeColorFlag = true,
    selectedDefaultColor = "#A3FF00",
    showAllNodeLabelsFlag = false,
    showSelectedNodeLabelsFlag = true,
    nodeColorPrioritySource = "default", // or "cluster"
    nodeGroups = new Map(),
    hovered_nodes = [], // if allowing more than one hovered nodes at a time
    last_hovered_node_index = "",
    selectedNodePositions = [],
    nodeNames = [],
    nodeLayerNames = [],
    nodeColorVector = [],
    node_cluster_colors = [];

// edges
let selectedEdgeColorFlag = true,
    edgeDefaultColor = "#CFCFCF",
    edgeAttributesPriority = true,
    isDirectionEnabled = false,
    directionArrowSize = 0.03,
    intraDirectionArrowSize = 0.08,
    edgeWidthByWeight = true,
    interLayerEdgeOpacity = 0.4,
    layerEdgeOpacity = 1,
    interChannelCurvature = 0.05,
    channelCurvature = 0.05,
    draw_inter_edges_flag = true,
    edges = [], //canvas objects
    layerEdges = [], //canvas objects
    edgePairs = [],
    layer_edges_pairs = [], //canvas objects
    edgeValues = [],
    selected_edges = [],
    edge_attributes = "",
    // channels
    channels = [],
    selectedChannels = [], // selected ones from Layout tab
    channelColors = {},
    channelVisibility = {},
    edge_channels = [],
    layer_edges_pairs_channels = [];

// others
let interLayerEdgesRenderPauseFlag = false,
    canvasControlsAttached = false,
    fps = 30,
    shiftX = "",
    shiftY = "",
    lasso = "",
    optionsList = "",
    downstreamCheckedNodes = []; // for recursive 3rd option of onRightClick on node
