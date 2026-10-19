"""Application constants — ports config/server_variables.R + global_variables.R.

RColorBrewer palettes are inlined as hex (Set3 / Set1), matching v2 output exactly.
"""

import os

# Input validation
MANDATORY_NETWORK_COLUMNS = ["SourceNode", "SourceLayer", "TargetNode", "TargetLayer"]
OPTIONAL_NETWORK_COLUMNS = ["Channel", "Weight"]
# Layer assigned to every node when a minimal 2-column edgelist omits the layer columns
DEFAULT_LAYER_NAME = "Layer1"
MANDATORY_JSON_OBJECTS = ["layers", "nodes", "edges"]
OPTIONAL_JSON_OBJECTS = ["scene", "universalLabelColor", "direction", "edgeOpacityByWeight"]
MANDATORY_JSON_NODE_COLUMNS = ["name", "layer"]
MANDATORY_JSON_EDGE_COLUMNS = ["src", "trg"]
# DoS fix: MAX_EDGES/MAX_NODES used to be enforced only by the TSV-upload
# parser, leaving /api/layout, /api/topology, /api/session/import and
# /api/external free to accept unbounded graphs. Env-overridable so
# deployments can size limits to their hardware without a code change
# (docker-compose.yml sets these for local dev/prod).
MAX_EDGES = int(os.environ.get("ARENA_MAX_EDGES", "10000"))
MAX_NODES = int(os.environ.get("ARENA_MAX_NODES", "20000"))
MAX_CHANNELS = 10
MAX_LAYERS = 20
# DoS fix: caps request-body size for TSV/JSON uploads (bare uvicorn has no
# built-in limit; nginx's client_max_body_size only covers the prod Docker
# image, not local/dev deployments).
MAX_UPLOAD_BYTES = int(os.environ.get("ARENA_MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
# Crash isolation: igraph's C core can abort() the whole interpreter on certain
# inputs (observed: 3D Kamada-Kawai on specific weighted graphs — an upstream
# igraph defect, not catchable from Python). /api/layout and /api/clustering run
# in a worker pool of this size so an abort() only kills that worker.
LAYOUT_WORKERS = int(os.environ.get("ARENA_LAYOUT_WORKERS", "2"))

# PPI database importers (services/databases.py). Overridable for mirrors/tests.
STRING_API = os.environ.get("ARENA_STRING_API", "https://string-db.org/api")
INTACT_PSICQUIC = os.environ.get(
    "ARENA_INTACT_PSICQUIC",
    "https://www.ebi.ac.uk/Tools/webservices/psicquic/intact/webservices/current/search",
)
OMNIPATH_API = os.environ.get("ARENA_OMNIPATH_API", "https://omnipathdb.org")
NDEX_API = os.environ.get("ARENA_NDEX_API", "https://www.ndexbio.org")
REACTOME_API = os.environ.get("ARENA_REACTOME_API", "https://reactome.org/ContentService")
QUICKGO_API = os.environ.get("ARENA_QUICKGO_API", "https://www.ebi.ac.uk/QuickGO/services")
MAX_GENES_PER_SET = 300  # genes per pathway / GO term layer (STRING query size)
DB_TIMEOUT_SECONDS = float(os.environ.get("ARENA_DB_TIMEOUT_SECONDS", "60"))
MAX_DB_IDENTIFIERS = 500
MAX_GROUPING_IDENTIFIERS = 2000  # node names sent for "groupings for the current view"
STRING_CALL_GAP_SECONDS = 1.0  # STRING asks for one second between calls

# Topology scaling
DEFAULT_MAP_VALUE = 0.3
TARGET_NODE_SCALE_MIN = 0.5
TARGET_NODE_SCALE_MAX = 2.5
TOPOLOGY_METRICS = [
    "Degree",
    "Clustering Coefficient",
    "Betweenness Centrality",
    # Phase 21 node metrics (per scope, like the three above)
    "Closeness Centrality",
    "Eigenvector Centrality",
    "PageRank",
    "Coreness (k-core)",
    "Eccentricity",
    # multilayer (services/multilayer.py): computed across the selected layers
    "Multiplex Degree",
    "Participation Coefficient",
    "Multilayer PageRank",
]

# Layouts
NO_EDGE_LAYOUTS = ["Circle", "Grid", "Random"]

# Themes — RColorBrewer::brewer.pal(12, "Set3")
_SET3 = [
    "#8DD3C7",
    "#FFFFB3",
    "#BEBADA",
    "#FB8072",
    "#80B1D3",
    "#FDB462",
    "#B3DE69",
    "#FCCDE5",
    "#D9D9D9",
    "#BC80BD",
    "#CCEBC5",
    "#FFED6F",
]
# brewer.pal(9, "Set1")
_SET1 = [
    "#E41A1C",
    "#377EB8",
    "#4DAF4A",
    "#984EA3",
    "#FF7F00",
    "#FFFF33",
    "#A65628",
    "#F781BF",
    "#999999",
]
NODE_COLORS = _SET3 + _SET3[:8]  # 20 layers
EDGE_DEFAULT_COLOR = "#CFCFCF"
CHANNEL_COLORS_LIGHT = _SET3[:MAX_CHANNELS]
# Set1 has nine colours; a cyan (category10) completes the ten channels
CHANNEL_COLORS_DARK = [*_SET1, "#17BECF"]

# UI defaults
FLOOR_DEFAULT_COLOR = "#777777"
FLOOR_DEFAULT_WIDTH = 1000

# VR
VR_DOWNSCALE_FACTOR = 300

# Ephemeral storage for external-API sessions + VR output (SPEC §5)
TMP_PATH = "tmp/"

# Kamada-Kawai, MDS, Graphopt and Sugiyama build n×n structures; the cap keeps one
# request from exhausting the memory or the CPU of the whole service.
MAX_QUADRATIC_NODES = int(os.environ.get("ARENA_MAX_QUADRATIC_NODES", "2000"))
# UMAP layouts (services/umap_layout.py): ~10–20 s for 5000 nodes once its numba
# kernels are compiled; the feature cap bounds the request body.
MAX_UMAP_NODES = int(os.environ.get("ARENA_MAX_UMAP_NODES", "5000"))
MAX_UMAP_FEATURES = 500
# the whole of a database import, every upstream call together
DB_TOTAL_SECONDS = float(os.environ.get("ARENA_DB_TOTAL_SECONDS", "150"))
# database imports running at once; more wait for a free slot
DB_CONCURRENCY = int(os.environ.get("ARENA_DB_CONCURRENCY", "8"))

# Perturbation analysis (services/perturbation.py). A robustness curve has at
# most MAX_ATTACK_STEPS steps and averages at most MAX_ATTACK_RUNS random runs;
# a request stops after PERTURBATION_TIME_BUDGET seconds and returns what it
# has, with a warning. Graphs above MAX_QUADRATIC_NODES nodes rank by a
# betweenness estimated from BETWEENNESS_SAMPLE source nodes, and their
# robustness curves skip the global efficiency.
MAX_ATTACK_STEPS = 50
MAX_ATTACK_RUNS = 20
PERTURBATION_TIME_BUDGET = float(os.environ.get("ARENA_PERTURBATION_SECONDS", "30"))
# A layout, clustering or metric in the worker pool that runs longer than this
# is stopped (its workers restarted), so no request holds a worker for ever.
COMPUTE_SECONDS = float(os.environ.get("ARENA_COMPUTE_SECONDS", "300"))
# Stored sessions and hosted exports (backend/tmp): at most this many bytes on
# disk; the oldest go first.
MAX_STORE_BYTES = int(os.environ.get("ARENA_MAX_STORE_BYTES", str(1024 * 1024 * 1024)))
BETWEENNESS_SAMPLE = 200
