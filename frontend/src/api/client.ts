// Typed REST client — mirrors the FastAPI Pydantic models (backend/app/models).
// Every interaction with the backend is one typed fetch() call (SPEC §3).

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
  floor_shape?: 'square' | 'disk'
  floor_style?: 'solid' | 'wireframe' | 'grid' | 'dots' | 'outline'
  container?: 'floor' | 'none' | 'cube' | 'sphere' | 'cloud'
  floor_visible?: boolean
  container_color?: string | null // null/absent = the theme's container colour
  container_opacity?: number
  // 3D-network mode: where the layer goes when the layers come back
  layered?: {
    position: [number, number, number]
    quaternion: [number, number, number, number]
    container: 'floor' | 'none' | 'cube' | 'sphere' | 'cloud'
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
}

export interface SessionEdge {
  src: string
  trg: string
  opacity: string | number
  color: string
  channel?: string
  width_factor?: number // Style panel per-edge width multiplier
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
  // multi-channel edges (Edit → Edges → Edge Shape)
  edgeShape?: 'parallel' | 'curved' | 'straight'
  warnings?: string[]
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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<T>
}

// JSON POST with upload progress (XHR; fetch has no upload events). The
// 'server' stage fires once the body is sent, while the server computes.
function postJson<T>(
  path: string,
  body: unknown,
  onProgress?: UploadProgress
): Promise<T> {
  if (!onProgress) return post<T>(path, body)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
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
