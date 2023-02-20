# Input ####
READ_LIBRARY <- "base" # options: base, fread; fread faster load but slower operations
MANDATORY_NETWORK_COLUMNS <- c("SourceNode", "SourceLayer", "TargetNode", "TargetLayer")
OPTIONAL_NETWORK_COLUMNS <- c("Channel", "Weight")
MANDATORY_JSON_OBJECTS <- c("layers", "nodes", "edges")
OPTIONAL_JSON_OBJECTS <- c("scene", "universalLabelColor", "direction", "edgeOpacityByWeight")
MANDATORY_JSON_NODE_COLUMNS <- c("name", "layer")
MANDATORY_JSON_EDGE_COLUMNS <- c("src", "trg")
MAX_EDGES <- 10000
MAX_CHANNELS <- 9
MAX_LAYERS <- 18
DEFAULT_MAP_VALUE <- 0.3
TARGET_NODE_SCALE_MIN <- 0.5
TARGET_NODE_SCALE_MAX <- 2.5
# API
POST_REQUEST_PATH <- 'tmp/'
API_URL <- "https://bib.fleming.gr/bib/api/arena3dweb/vr/" # "http://localhost:8080/api/arena3dweb/vr/"
# UI ####
HIDE_BUTTONS <- paste0("hideButton", c(1:8))
FLOOR_DEFAULT_COLOR <- "#777777"
FLOOR_DEFAULT_WIDTH <- "1001.90476190476"
# Themes ####
NODE_COLORS <- c(brewer.pal(12, 'Set3'), brewer.pal(6, 'Set3')) # 18 Layers # TODO same with JS
EDGE_DEFAULT_COLOR = "#CFCFCF"
CHANNEL_COLORS_LIGHT <- brewer.pal(MAX_CHANNELS, 'Set3')
CHANNEL_COLORS_DARK <- brewer.pal(MAX_CHANNELS, 'Set1')
# VR ####
VR_DOWNSCALE_FACTOR <- 300
