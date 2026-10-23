// Typed REST client — mirrors the FastAPI Pydantic models (backend/app/models).
// Every interaction with the backend is one typed fetch() call (SPEC §3).

import type { ContainerPlacement, LayerContainer } from '../three/containers'

export interface NodeModel {
  id: string
  label: string
  layer: string
}

export interface EdgeModel {
  src: string
  trg: string
  source_node: string
  source_layer: string
  target_node: string
  target_layer: string
  weight: number
  scaled_weight: number
  channel: string | null
}

export interface NetworkData {
  nodes: NodeModel[]
  edges: EdgeModel[]
  layers: string[]
  channels: string[]
  warnings: string[]
}

// Normalized session (SessionImportResponse; backend fills defaults, values
// stay stringly-typed as in the v2 export format).
export interface SessionScene {
  position_x: string | number
  position_y: string | number
  scale: string | number
  color: string
  rotation_x: string | number
  rotation_y: string | number
  rotation_z: string | number
}

export interface SessionLayer {
  name: string
  position_x: string | number
  position_y: string | number
  position_z: string | number
  rotation_x: string | number
  rotation_y: string | number
  rotation_z: string | number
  last_layer_scale: string | number
  floor_current_color: string
  geometry_parameters_width: string | number
  floor_shape?: 'square' | 'disk' | 'axis' // axis: a hive plot axis
  floor_style?: 'solid' | 'wireframe' | 'grid' | 'dots' | 'outline'
  container?: LayerContainer
  floor_visible?: boolean
  container_color?: string | null // null/absent = the theme's container colour
  container_opacity?: number
  // Shape & container: nodes inside or on the surface, and the container's
  // outline (colour null = the container's), wire cage, rim light and floor
  container_placement?: ContainerPlacement
  container_outline?: boolean
  container_outline_color?: string | null
  container_wireframe?: boolean
  container_glow?: boolean
  container_floor?: boolean
  // Labels & axes: the layer label's look, font, bold, italic, colour and
  // place, only when set
  label_style?: {
    style: 'plain' | 'halo' | 'box' | 'shadow'
    color: string
    width: number
    opacity: number
    bold: boolean
  }
  label_font?: 'sans' | 'serif' | 'mono' | 'condensed'
  label_bold?: boolean
  label_italic?: boolean
  label_color?: string
  label_position?: 'above' | 'below'
  // 3D-network mode: where the layer goes when the layers come back
  layered?: {
    position: [number, number, number]
    quaternion: [number, number, number, number]
    container: LayerContainer
  }
  generate_coordinates: boolean
}

export interface SessionNode {
  name: string
  layer: string
  position_x: string | number
  position_y: string | number
  position_z: string | number
  scale: string | number
  color: string
  url: string
  descr: string
  annotations?: string[]
  shape?: string
  layered_position?: LayoutPosition // 3D-network mode, as [y, z(, x)]
  // Edit → Style, only when set: opacity, outline, stretch along the layer's
  // z / y / x (width, height, depth), label text / colour / size / look /
  // position
  opacity?: number
  border_color?: string
  border_width?: number
  stretch?: [number, number, number]
  label?: string
  label_color?: string
  label_size?: number
  label_style?: {
    style: 'plain' | 'halo' | 'box' | 'shadow'
    color: string
    width: number
    opacity: number
    bold: boolean
  }
  label_position?: 'centre' | 'above' | 'below'
  label_shown?: boolean // pinned: shown with Show Labels: Chosen
}

export interface SessionEdge {
  src: string
  trg: string
  opacity: string | number
  color: string
  channel?: string
  width_factor?: number // Style panel per-edge width multiplier
  // Edit → Style, only when set
  opacity_factor?: number
  line_type?: 'solid' | 'dashed' | 'dotted'
  arrow_color?: string
}

export interface SessionData {
  scene: SessionScene
  layers: SessionLayer[]
  nodes: SessionNode[]
  edges: SessionEdge[]
  universalLabelColor: string
  direction: boolean
  edgeOpacityByWeight: boolean
  edgeWidthByWeight: boolean
  scramble_nodes: boolean
  intraEdgeBundling?: number
  interEdgeBundling?: number
  // where Show Direction draws arrowheads (null or missing = every layer)
  arrowLayers?: string[] | null
  interLayerArrows?: boolean
  // multi-channel edges (Edit → Edges → Edge Shape)
  edgeShape?: 'parallel' | 'curved' | 'straight'
  // Edit → Nodes → Show Labels, when saved (older sessions keep the current)
  nodeLabels?: {
    mode: 'all' | 'selected' | 'chosen' | 'none'
    withSelection: boolean
  } | null
  // the hive plot arrangement, when it was on (three/hive.ts)
  hive?: {
    curved: boolean
    right: [number, number, number]
    up: [number, number, number]
    axes?: 'flat' | '3d'
  } | null
  // the network's name and its annotation set's name (Networks menu)
  name?: string | null
  annotationSet?: string | null
  // how the annotation groups are drawn (Annotations menu)
  annotationView?: AnnotationView | null
  // the scene theme (actions/theme_presets.ts) and whether its colours were
  // applied to the network or the network kept its own
  theme?: { name: string; applied: boolean } | null
  warnings?: string[]
}

// View → Annotations: Draw around, Draw as, Opacity, Padding, pie charts,
// and the groups whose shape is switched off (Groups card)
export interface AnnotationView {
  source: 'none' | 'cluster' | 'annotation'
  style: 'hull' | 'outline' | 'fog' | 'cloud' | 'sphere' | 'ellipsoid' | 'box'
  opacity: number
  padding: number
  pies: boolean
  hidden: string[]
}

export type TopologyScope = 'perLayer' | 'allLayers' | 'nodesPerLayers'
// 'coupled' (align nodes across layers) is layout-only
export type Scope = TopologyScope | 'coupled'

export interface ClusteringOptions {
  algorithm: string
  local_layout: string
}

// POST /api/clustering: communities only, the nodes stay where they are
export interface ClusteringRequest {
  nodes: NodeModel[]
  edges: EdgeModel[]
  algorithm: string
  scope?: 'perLayer' | 'allLayers' | 'coupled'
  selected_layers: string[]
  selected_channels?: string[] | null
  seed?: number
}

export interface LayoutRequest {
  nodes: NodeModel[]
  edges: EdgeModel[]
  algorithm: string
  scope?: Scope
  selected_layers: string[]
  selected_nodes?: string[] | null
  selected_channels?: string[] | null
  clustering?: ClusteringOptions | null
  seed?: number
  use_weights?: boolean
  dimensions?: 2 | 3
  alignment?: 'none' | 'soft' | 'anchor' | 'chain'
  group_strategy?: 'none' | 'virtual' | 'gravity' | 'supernodes'
  groups?: Record<string, string[]> | null // Node_Layer id -> its groups
  group_local?: string // layout name, or 'keep'
  group_force?: number
  group_scale?: number
  alignment_strength?: number
  reference_layer?: string | null
  channel_weights?: Record<string, number> | null
  umap?: UmapOptions | null // algorithm 'UMAP' only
}

// backend models/layout.py UmapOptions (services/umap_layout.py)
export type UmapMode = 'topology' | 'attributes' | 'hybrid'
export interface UmapOptions {
  mode: UmapMode
  n_neighbors?: number
  min_dist?: number
  metric?: 'euclidean' | 'cosine'
  balance?: number // hybrid: 0 = topology .. 1 = attributes
  feature_names?: string[]
  features?: Record<string, (number | null)[]> | null // Node_Layer id -> row
  metrics?: string[] // node metrics computed on the server
}

// [y, z] in the layer plane; a 3D layout (dimensions: 3) adds x = depth
export type LayoutPosition = [number, number] | [number, number, number]

export interface LayoutResponse {
  positions: Record<string, LayoutPosition>
  clusters: Record<string, number> | null
  // % of layout diagonal; null for one layer / 3D
  misalignment?: number | null
}

// how the edges make a graph for the node metrics
export type TopologyGraph = 'undirected' | 'directed' | 'multi'

export interface TopologyRequest {
  nodes: NodeModel[]
  edges: EdgeModel[]
  metric: string
  scope?: TopologyScope
  selected_layers: string[]
  selected_nodes?: string[] | null
  selected_channels?: string[] | null
  directed?: boolean
  graph?: TopologyGraph
}

export interface TopologyResponse {
  scales: Record<string, number>
  raw: Record<string, number>
}

// FastAPI errors carry {"detail": "..."} (or a list of validation errors);
// surface that message rather than the raw status line + JSON.
export async function errorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const detail = (JSON.parse(text) as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail))
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) =>
          [d.loc?.slice(1).join('.'), d.msg].filter(Boolean).join(': ')
        )
        .join('; ')
  } catch {
    /* not JSON */
  }
  if (res.status === 413) return 'The file is too large.'
  return text.trim() || `Server error ${res.status}.`
}

async function post<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<T>
}

// JSON POST with upload progress (XHR; fetch has no upload events). The
// 'server' stage fires once the body is sent, while the server computes.
function postJson<T>(
  path: string,
  body: unknown,
  onProgress?: UploadProgress,
  signal?: AbortSignal
): Promise<T> {
  if (!onProgress) return post<T>(path, body, signal)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    // Cancel: the request stops here (the server finishes its own run)
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.onabort = () => reject(new DOMException('Cancelled', 'AbortError'))
    xhr.open('POST', path)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress('upload', e.loaded / e.total)
    }
    xhr.upload.onload = () => onProgress('server', 0)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      } else {
        let detail = ''
        try {
          detail = String(
            (JSON.parse(xhr.responseText) as { detail?: string }).detail ?? ''
          )
        } catch {
          /* not JSON */
        }
        reject(new Error(detail || `POST ${path} failed: ${xhr.status}`))
      }
    }
    xhr.onerror = () =>
      reject(new Error('Network error — is the server running?'))
    xhr.send(JSON.stringify(body))
  })
}

// Upload stages for progress UIs: bytes sent (0-1), then server processing.
export type UploadProgress = (
  stage: 'upload' | 'server',
  fraction: number
) => void

// XHR rather than fetch: fetch has no upload-progress events.
function postFile<T>(
  path: string,
  file: File | Blob,
  name = 'file',
  onProgress?: UploadProgress
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file, name)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', path)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.('upload', e.loaded / e.total)
    }
    xhr.upload.onload = () => onProgress?.('server', 0)
    xhr.onerror = () =>
      reject(new Error('Network error — is the server running?'))
    xhr.onload = () => {
      const res = new Response(xhr.responseText, { status: xhr.status })
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new Error('The server sent an unreadable response.'))
        }
      } else void errorMessage(res).then((m) => reject(new Error(m)))
    }
    xhr.send(form)
  })
}

export interface EnrichedTerm {
  category: string
  term: string
  description: string
  fdr: number
  p_value: number
  genes: string[]
}

export interface GraphStats {
  name: string
  nodes: number
  edges: number
  density: number
  average_degree: number
  max_degree: number
  components: number
  largest_component: number
  diameter: number
  average_path_length: number
  average_clustering: number
  transitivity: number
  assortativity: number | null
  degree_distribution: Record<string, number>
}

// POST /api/perturbation/knockout and /attack (backend models/perturbation.py)
export type RankMetric = 'degree' | 'betweenness' | 'pagerank'
export type AttackStrategy = 'random' | 'degree' | 'betweenness'

interface PerturbationBase {
  nodes: NodeModel[]
  edges: EdgeModel[]
  layers: string[]
  selected_channels?: string[] | null
}

export interface KnockoutRequest extends PerturbationBase {
  remove_nodes?: string[] // Node_Layer ids
  remove_names?: string[] // every analysed copy, any case
  top_k?: { metric: RankMetric; k: number; per_layer?: boolean } | null
  every_copy?: boolean
  remove_edges?: { src: string; trg: string }[] // every channel of the pair
  remove_channels?: string[]
  remove_inter_layer?: boolean
  random_edge_fraction?: number
  seed?: number
  propagation_seeds?: string[]
  restart?: number
}

export interface GlobalMeasures {
  name: string
  nodes: number
  edges: number
  components: number
  largest_component: number
  density: number
  average_path_length: number
  diameter: number
  efficiency: number
  cut_off: number
}

export interface NodeChange {
  id: string
  label: string
  layer: string
  removed: boolean
  cut_off_layer: boolean
  cut_off_whole: boolean
  degree: number
  degree_after: number | null
  betweenness: number
  betweenness_after: number | null
  closeness: number
  closeness_after: number | null
  propagation: number | null
  propagation_after: number | null
}

export interface KnockoutResponse {
  removed_nodes: string[]
  removed_edges: number[] // indices into the request's edges
  before: GlobalMeasures[]
  after: GlobalMeasures[]
  nodes: NodeChange[]
  warnings: string[]
}

export interface AttackRequest extends PerturbationBase {
  strategy: AttackStrategy
  recalculate?: boolean
  runs?: number
  steps?: number
  max_fraction?: number
  efficiency?: boolean
  seed?: number
  whole_only?: boolean // only the whole network's curve
}

export interface Curve {
  name: string
  nodes: number
  fraction: number[]
  largest: number[]
  largest_sd: number[] | null
  components: number[]
  efficiency: number[] | null
  robustness: number
  complete: boolean
}

export interface AttackResponse {
  strategy: AttackStrategy
  recalculate: boolean
  curves: Curve[]
  warnings: string[]
}

// POST /api/plots (backend models/plots.py)
export type PlotScope = 'perLayer' | 'combined'
export type PlotExtra =
  | 'components'
  | 'paths'
  | 'clustering_by_degree'
  | 'neighbour_degree'
  | 'rich_club'

export interface PlotRequest extends PerturbationBase {
  scope: PlotScope
  metrics?: string[]
  extras?: PlotExtra[]
  rich_club_random?: number // rewired graphs to normalise by (0 = raw)
  seed?: number
}

export interface PlotScopeData {
  name: string
  nodes: string[]
  metrics: Record<string, number[]> // in `nodes` order
  components: number[] | null
  path_lengths: Record<string, number> | null // hops -> pairs
  unconnected: number | null
  clustering_by_degree: [number, number][] | null
  neighbour_degree: [number, number][] | null
  rich_club: { k: number; phi: number; phi_random: number | null }[] | null
}

export interface PlotResponse {
  scopes: PlotScopeData[]
  warnings: string[]
}

export interface LayerSimilarityResponse {
  layers: string[]
  node_jaccard: number[][] // rows/columns in `layers` order
  edge_jaccard: number[][]
}

export interface StringGroupingOptions {
  mode: 'enrichment' | 'annotation'
  fdr: number
  categories: string[] // STRING collection keys: Process, KEGG, RCTM, ...
  other_categories: boolean
  max_terms: number // groups per collection
  min_group: number // smallest group
}

type RawRows = Record<string, unknown>[]

// STRING's own answers, fetched by the browser (Connect: Directly)
export interface StringRaw {
  version?: RawRows | null
  ids: RawRows
  network: RawRows
  info?: RawRows | null
  terms?: RawRows | null
}

export interface StringImportRequest {
  identifiers: string[]
  species?: number
  network_type?: 'functional' | 'physical'
  required_score?: number
  channels?: string[] | null // STRING score fields: escore, dscore, ...
  edge_mode?: 'channels' | 'combined'
  add_nodes?: number
  descriptions?: boolean
  groupings?: StringGroupingOptions | null
  address?: string | null
  raw?: StringRaw | null
}

export interface StringGrouping {
  category: string
  name: string
  terms: {
    term: string
    description: string
    members: string[] // node names
    fdr: number | null
    p_value: number | null
  }[]
}

// The STRING extras are optional: older servers answer with the network only
export interface StringImportResponse extends NetworkData {
  string_version?: string | null
  taxon_name?: string | null
  node_info?: {
    name: string
    string_id: string
    description: string | null
    url: string
    query: boolean
  }[]
  groupings?: StringGrouping[]
}

export interface StringGroupingsRequest {
  identifiers: string[]
  species: number
  groupings: StringGroupingOptions
  address?: string | null
  raw_terms?: RawRows | null
}

export interface DatabaseImportRequest {
  identifiers: string[]
  species?: number
  databases: string[] // STRING | IntAct | OmniPath
  required_score?: number
  only_among?: boolean
}

export interface NodeAttributeRow {
  node_layer: string
  color: string | null
  size: number | null
  url: string | null
  description: string | null
  annotations?: string[] | null
  // written by Edit → Attributes (Export node attributes)
  shape?: string | null
  opacity?: number | null
  label?: string | null
  label_color?: string | null
  label_size?: number | null
  label_style?: string | null // "halo #ffffff 3 bold" (three/Node.ts labelLookFromText)
  label_position?: string | null // right | centre | above | below
  label_shown?: boolean | null // pinned: shown with Show Labels: Chosen
  label_bold?: boolean | null // bold labels (with the look of LabelStyle)
}

// POST /api/attributes/groups — a node and the groups a group file puts it in
export interface GroupRow {
  node: string
  groups: string[]
}

// POST /api/attributes/values — numeric node values (expression, scores)
export interface ValueTable {
  columns: string[]
  rows: { node: string; values: (number | null)[] }[]
}

export interface EdgeAttributeRow {
  edge_pair: string
  color: string
  channel: string | null
  // written by Edit → Attributes (Export edge attributes)
  width?: number | null
  opacity?: number | null
  line_type?: string | null
  arrow_color?: string | null
}

export const api = {
  // the backend picks the format (GraphML, GML, SIF, CX2, TSV) by extension
  uploadNetwork: (file: File | Blob, onProgress?: UploadProgress) =>
    postFile<NetworkData>(
      '/api/network',
      file,
      file instanceof File ? file.name : 'network.tsv',
      onProgress
    ),
  uploadNodeAttributes: (file: File | Blob) =>
    postFile<NodeAttributeRow[]>('/api/attributes/nodes', file),
  uploadEdgeAttributes: (file: File | Blob) =>
    postFile<EdgeAttributeRow[]>('/api/attributes/edges', file),
  uploadGroups: (file: File | Blob) =>
    postFile<GroupRow[]>('/api/attributes/groups', file),
  uploadValues: (file: File | Blob) =>
    postFile<ValueTable>('/api/attributes/values', file),
  layout: (req: LayoutRequest, onProgress?: UploadProgress) =>
    postJson<LayoutResponse>('/api/layout', req, onProgress),
  layerSimilarity: (req: {
    nodes: NodeModel[]
    edges: EdgeModel[]
    layers: string[]
  }) => post<LayerSimilarityResponse>('/api/layer-similarity', req),
  enrichment: (req: {
    genes: string[]
    species?: number
    max_terms?: number
    categories?: string[] | null
  }) => post<EnrichedTerm[]>('/api/enrichment', req),
  knockout: (
    req: KnockoutRequest,
    onProgress?: UploadProgress,
    signal?: AbortSignal
  ) =>
    postJson<KnockoutResponse>(
      '/api/perturbation/knockout',
      req,
      onProgress,
      signal
    ),
  plots: (req: PlotRequest, signal?: AbortSignal) =>
    post<PlotResponse>('/api/plots', req, signal),
  attack: (req: AttackRequest, signal?: AbortSignal) =>
    post<AttackResponse>('/api/perturbation/attack', req, signal),
  networkStats: (req: {
    nodes: NodeModel[]
    edges: EdgeModel[]
    layers: string[]
  }) => post<GraphStats[]>('/api/network-stats', req),
  importString: (req: StringImportRequest) =>
    post<StringImportResponse>('/api/import/string', req),
  stringGroupings: (req: StringGroupingsRequest) =>
    post<{ groupings: StringGrouping[]; warnings: string[] }>(
      '/api/import/string/groupings',
      req
    ),
  importDatabases: (req: DatabaseImportRequest) =>
    post<NetworkData>('/api/import/databases', req),
  importReactome: (req: {
    pathways: string[]
    species: number
    required_score: number
    max_genes: number
  }) => post<NetworkData>('/api/import/reactome', req),
  importGo: (req: {
    terms: string[]
    taxon: number
    include_children: boolean
    required_score: number
    max_genes: number
  }) => post<NetworkData>('/api/import/go', req),
  searchSets: async (
    kind: 'reactome' | 'go',
    q: string,
    species: number
  ): Promise<{ id: string; name: string; detail: string }[]> => {
    const res = await fetch(
      `/api/import/${kind}/search?q=${encodeURIComponent(q)}&species=${species}`
    )
    if (!res.ok) throw new Error(await errorMessage(res))
    return res.json() as Promise<{ id: string; name: string; detail: string }[]>
  },
  clustering: (req: ClusteringRequest) =>
    post<{ clusters: Record<string, number>; count: number }>(
      '/api/clustering',
      req
    ),
  share: (content: string, mediaType: string, name: string) =>
    post<{ token: string; url: string }>('/api/share', {
      content,
      media_type: mediaType,
      name,
    }),
  importNdex: (uuid: string) => post<NetworkData>('/api/import/ndex', { uuid }),
  topology: (req: TopologyRequest) =>
    post<TopologyResponse>('/api/topology', req),
  importSession: (file: File | Blob, onProgress?: UploadProgress) =>
    postFile<SessionData>('/api/session/import', file, 'file', onProgress),
  exportSession: async (session: SessionData): Promise<Blob> => {
    const res = await fetch('/api/session/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    })
    if (!res.ok)
      throw new Error(`POST /api/session/export failed: ${res.status}`)
    return res.blob()
  },
  createExternal: (session: unknown) =>
    post<{ token: string; url: string }>('/api/external', session),
  // Backend returns a normalized SessionImportResponse, same shape as import.
  resolveExternal: async (token: string): Promise<SessionData> => {
    // token comes from the ?session= query param — encode it so a stray
    // '/' or '?' can't build a malformed URL / wrong path
    const path = `/api/external/${encodeURIComponent(token)}`
    const res = await fetch(path)
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
    return res.json() as Promise<SessionData>
  },
}
