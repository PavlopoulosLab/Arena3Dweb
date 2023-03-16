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
    layer_label_divs = [];

// layers
let last_hovered_layer_index = "", // for correct hover coloring
    layerDragControls = "",
    layerIntervalTimeout = "",
    showAllLayerLabelsFlag = true,
    showSelectedLayerLabelsFlag = false,
    layer_groups = new Map(),
    layerColorPrioritySource = "default", // or "picker"
    hoveredLayerPaintedFlag = false;

// nodes
let showAllNodeLabelsFlag = false,
    showSelectedNodeLabelsFlag = true,
    nodeIntervalTimeout = "",
    nodeAttributesPriority = true,
    selectedNodeColorFlag = true,
    selectedDefaultColor = "#A3FF00";

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
    draw_inter_edges_flag = true;

// others
let interLayerEdgesRenderPauseFlag = false,
    canvasControlsAttached = false,
    colorVector = [];
    fps = 30,
    downstreamCheckedNodes = []; // for recursive 3rd option of onRightClick on node

// Variables that are being refreshed on new network upload/import (nodes, edges, coords)
let nodes = [], //canvas objects
    node_labels = [], //divs to be overlaid above canvas
    node_names = [],
    node_whole_names = [],
    node_label_flags = [],
    hovered_nodes = [], // if allowing more than one hovered nodes at a time
    last_hovered_node_index = "",
    edges = [], //canvas objects
    layerEdges = [], //canvas objects
    edge_pairs = [],
    layer_edges_pairs = [], //canvas objects
    layer_edges_pairs_channels = [],
    edge_values = [],
    edge_channels = [],
    node_groups = new Map(),
    selectedNodePositions = [],
    selected_edges = [],
    channels_layout = [],
    shiftX = "",
    shiftY = "",
    lasso = "",
    optionsList = "",
    node_cluster_colors = [],
    node_attributes = "",
    edge_attributes = "",
    channels = [],
    channel_color = {},
    channelVisibility = {};
