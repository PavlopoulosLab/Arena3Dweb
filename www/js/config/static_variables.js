// class objects
let scene, layers = []; // TODO add rest of the class objects here

// screen
let xBoundMin, xBoundMax, yBoundMin, yBoundMax, zBoundMin, zBoundMax,
    camera, renderer, mousePreviousX = 0, mousePreviousY = 0, animationRunning = false;

// layouts
let localLayoutFlag = false;

// labels
let globalLabelColor = "#ffffff",
    nodeLabelDefaultSize = "12px";

// layers
let layerDragControls = "",
    showAllLayerLabelsFlag = true,
    showSelectedLayerLabelsFlag = false,
    layerColorFromFile = true,
    layerOpacity = 0.6,
    floorDefaultColors = [], // TODO per class object element
    floorCurrentColor = LAYER_DEFAULT_COLOR,
    layerIntervalTimeout = "";
    //defaultLayerColor, importedLayerColor, pickerLayerColor, themeLayerColor

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
    last_hovered_layer_index = "",
    edges = [], //canvas objects
    layerEdges = [], //canvas objects
    edge_pairs = [],
    layer_edges_pairs = [], //canvas objects
    layer_edges_pairs_channels = [],
    edge_values = [],
    edge_channels = [],
    node_groups = new Map(),

    layer_labels = [], //divs
    layer_groups = new Map(),
    
    layerCoords = [], // TODO this.coordSystem
    layer_names = [], // TODO this.name
    layer_node_labels_flags = [], // TODO this.showNodeLabels
    layer_planes = [],
    layer_spheres = [],
    last_layer_scale = [], // TODO this.last_layer_scale
    js_selected_layers = [], // TODO this.isSelected

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
