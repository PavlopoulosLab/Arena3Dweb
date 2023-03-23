// class objects
let scene, layers = []; // TODO add rest of the class objects here

// screen
let xBoundMin, xBoundMax, yBoundMin, yBoundMax, zBoundMin, zBoundMax,
    camera, renderer, mousePreviousX = 0, mousePreviousY = 0, animationRunning = false;

// layouts
let localLayoutFlag = false;

// labels
let globalLabelColor = "#ffffff",
    nodeLabelDefaultSize = "12px",
    layer_label_divs = [],
    node_labels = [],
    node_label_flags = []; //divs to be overlaid above canvas

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
let showAllNodeLabelsFlag = false,
    showSelectedNodeLabelsFlag = true,
    nodeIntervalTimeout = "",
    nodeAttributesPriority = true,
    selectedNodeColorFlag = true,
    selectedDefaultColor = "#A3FF00",
    nodes = [], //canvas objects
    node_names = [],
    node_whole_names = [],
    nodeGroups = new Map(),
    hovered_nodes = [], // if allowing more than one hovered nodes at a time
    nodeColorVector = [],
    last_hovered_node_index = "",
    node_cluster_colors = [],
    node_attributes = "",
    selectedNodePositions = [];

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
    channel_colors = [],
    draw_inter_edges_flag = true,
    edges = [], //canvas objects
    layerEdges = [], //canvas objects
    edge_pairs = [],
    layer_edges_pairs = [], //canvas objects
    edge_values = [],
    selected_edges = [],
    edge_attributes = "",
    // channels
    channels = [],
    channels_layout = [],
    channel_color = {},
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
