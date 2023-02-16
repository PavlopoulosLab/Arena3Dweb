# Input ####
READ_LIBRARY <- "base" # options: base, fread; fread faster load but slower operations
MANDATORY_NETWORK_COLUMNS <- c("SourceNode", "SourceLayer", "TargetNode", "TargetLayer")
MANDATORY_JSON_OBJECTS <- c("layers", "nodes", "edges")
MANDATORY_JSON_EDGE_COLUMNS <- c("src", "trg")
OPTIONAL_NETWORK_COLUMNS <- c("Channel", "Weight")
OPTIONAL_JSON_OBJECTS <- c("scene", "universalLabelColor", "direction", "edgeOpacityByWeight")
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
# Themes ####
CHANNEL_COLORS_LIGHT <- brewer.pal(MAX_CHANNELS, 'Set3')
CHANNEL_COLORS_DARK <- brewer.pal(MAX_CHANNELS, 'Set1')
# VR ####
VR_DOWNSCALE_FACTOR <- 300
