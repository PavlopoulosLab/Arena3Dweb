// Export formats — PLAN-ROADMAP Phase 8: GraphML, Cytoscape CX2, MuxViz
// (zip of edges/layers/layout), glTF binary (.glb), SVG (2D projection of the
// current view) and a WebM video of the auto-rotation. The PNG export lives in
// screen.ts (exportSceneImage).

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { store } from '../store'
import { ctx } from '../three'

export class ExportError extends Error {}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function network() {
  const net = store.get().network
  if (!net || ctx.nodeObjects.length === 0)
    throw new ExportError('Load a network first.')
  return net
}

const xml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Current node positions (scene-world), keyed by Node_Layer id
function positions(): Map<string, THREE.Vector3> {
  ctx.scene?.THREE_Object.updateMatrixWorld(true)
  return new Map(
    ctx.nodeObjects.map((n, i) => [ctx.nodeLayerNames[i], n.getWorldPosition()])
  )
}

// ---------------------------------------------------------------- GraphML
export function graphmlText(): string {
  const net = network()
  const pos = positions()
  const nodes = net.nodes
    .map((n) => {
      const p = pos.get(n.id)
      return `    <node id="${xml(n.id)}"><data key="name">${xml(n.label)}</data><data key="layer">${xml(n.layer)}</data>${
        p
          ? `<data key="x">${p.x.toFixed(2)}</data><data key="y">${p.y.toFixed(2)}</data><data key="z">${p.z.toFixed(2)}</data>`
          : ''
      }</node>`
    })
    .join('\n')
  const edges = net.edges
    .map(
      (e) =>
        `    <edge source="${xml(e.src)}" target="${xml(e.trg)}"><data key="weight">${e.weight}</data>${
          e.channel ? `<data key="channel">${xml(e.channel)}</data>` : ''
        }</edge>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="name" for="node" attr.name="name" attr.type="string"/>
  <key id="layer" for="node" attr.name="layer" attr.type="string"/>
  <key id="x" for="node" attr.name="x" attr.type="double"/>
  <key id="y" for="node" attr.name="y" attr.type="double"/>
  <key id="z" for="node" attr.name="z" attr.type="double"/>
  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>
  <key id="channel" for="edge" attr.name="channel" attr.type="string"/>
  <graph edgedefault="undirected">
${nodes}
${edges}
  </graph>
</graphml>
`
}

// ---------------------------------------------------------------- CX2
export function cx2Json(): unknown[] {
  const net = network()
  const pos = positions()
  const ids = new Map(net.nodes.map((n, i) => [n.id, i]))
  return [
    { CXVersion: '2.0', hasFragments: false },
    {
      metaData: [
        { name: 'attributeDeclarations', elementCount: 1 },
        { name: 'networkAttributes', elementCount: 1 },
        { name: 'nodes', elementCount: net.nodes.length },
        { name: 'edges', elementCount: net.edges.length },
      ],
    },
    {
      attributeDeclarations: [
        {
          networkAttributes: { name: { d: 'string' } },
          nodes: { name: { d: 'string' }, layer: { d: 'string' } },
          edges: { interaction: { d: 'string' }, weight: { d: 'double' } },
        },
      ],
    },
    { networkAttributes: [{ name: 'Arena3D network' }] },
    {
      nodes: net.nodes.map((n, i) => {
        const p = pos.get(n.id)
        return {
          id: i,
          v: { name: n.label, layer: n.layer },
          ...(p ? { x: p.x, y: -p.y, z: p.z } : {}),
        }
      }),
    },
    {
      edges: net.edges.map((e, i) => ({
        id: i,
        s: ids.get(e.src),
        t: ids.get(e.trg),
        v: { interaction: e.channel ?? 'interacts with', weight: e.weight },
      })),
    },
    { status: [{ error: '', success: true }] },
  ]
}

// ---------------------------------------------------------------- MuxViz
// MuxViz multilayer input: an extended edge list
// (node_from layer_from node_to layer_to weight) with numeric ids, plus the
// layers and layout (node labels) files, and the config line tying them.
export function muxvizFiles(): Record<string, string> {
  const net = network()
  const labels = [...new Set(net.nodes.map((n) => n.label))]
  const nodeId = new Map(labels.map((l, i) => [l, i + 1]))
  const layerId = new Map(net.layers.map((l, i) => [l, i + 1]))
  const edges = net.edges
    .map(
      (e) =>
        `${nodeId.get(e.source_node)} ${layerId.get(e.source_layer)} ${nodeId.get(e.target_node)} ${layerId.get(e.target_layer)} ${e.weight}`
    )
    .join('\n')
  return {
    'arena3d_edges.edges': edges + '\n',
    'arena3d_layers.txt':
      'layerID layerLabel\n' +
      net.layers
        .map((l, i) => `${i + 1} ${l.replace(/\s+/g, '_')}`)
        .join('\n') +
      '\n',
    'arena3d_layout.txt':
      'nodeID nodeLabel\n' +
      labels.map((l, i) => `${i + 1} ${l.replace(/\s+/g, '_')}`).join('\n') +
      '\n',
    'arena3d_config.txt':
      'arena3d_edges.edges;arena3d_layers.txt;arena3d_layout.txt\n',
  }
}

// Minimal store-only (uncompressed) ZIP writer — enough for a few text files.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zip(files: Record<string, string>): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name)
    const data = enc.encode(text)
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(new Uint8Array(local.buffer), nameBytes, data)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, data.length, true)
    cd.setUint32(24, data.length, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), nameBytes)
    offset += 30 + nameBytes.length + data.length
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, Object.keys(files).length, true)
  end.setUint16(10, Object.keys(files).length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  return new Blob(
    [...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[],
    {
      type: 'application/zip',
    }
  )
}

// ---------------------------------------------------------------- 3D (GLB)
// Edges are Line2 meshes whose LineMaterial is a shader material glTF cannot
// carry: the exporter would drop the material and keep only the instanced
// quad, so the model had no edges. For the export every visible Line2 is
// stood in for by a plain line through the same points under the same
// parent (one material per colour and opacity), and put back afterwards.
export async function glbBlob(): Promise<Blob> {
  network()
  const scene = ctx.scene!.THREE_Object
  scene.updateMatrixWorld(true)
  const lines: Line2[] = []
  scene.traverse((o) => {
    if (o instanceof Line2 && o.visible) lines.push(o)
  })
  const materials = new Map<string, THREE.MeshBasicMaterial>()
  const standIns = lines.map((l) => {
    // LineGeometry stores segments as (start, end) pairs: the polyline is
    // every start plus the last end
    const start = l.geometry.attributes
      .instanceStart as THREE.InterleavedBufferAttribute
    const end = l.geometry.attributes
      .instanceEnd as THREE.InterleavedBufferAttribute
    const n = start.count
    const positions = new Float32Array((n + 1) * 3)
    for (let i = 0; i < n; i++) {
      positions[3 * i] = start.getX(i)
      positions[3 * i + 1] = start.getY(i)
      positions[3 * i + 2] = start.getZ(i)
    }
    positions[3 * n] = end.getX(n - 1)
    positions[3 * n + 1] = end.getY(n - 1)
    positions[3 * n + 2] = end.getZ(n - 1)
    const m = l.material
    const key = `${m.color.getHexString()}|${m.opacity}`
    let material = materials.get(key)
    if (!material) {
      // a basic material: glTF keeps its colour and opacity without warnings
      material = new THREE.MeshBasicMaterial({
        color: m.color,
        transparent: m.transparent,
        opacity: m.opacity,
      })
      materials.set(key, material)
    }
    const plain = new THREE.Line(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      ),
      material
    )
    plain.position.copy(l.position)
    plain.quaternion.copy(l.quaternion)
    plain.scale.copy(l.scale)
    l.parent!.add(plain)
    l.visible = false
    return { line: l, plain }
  })
  try {
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(scene, {
      binary: true,
      onlyVisible: true,
    })
    return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
  } finally {
    for (const { line, plain } of standIns) {
      plain.parent?.remove(plain)
      plain.geometry.dispose()
      line.visible = true
    }
    for (const m of materials.values()) m.dispose()
  }
}

// ---------------------------------------------------------------- SVG
// The current view flattened: edges as straight lines, nodes as circles
// (colour + size), labels for nodes whose label is shown.
export function svgText(): string {
  network()
  const camera = ctx.camera!
  ctx.scene!.THREE_Object.updateMatrixWorld(true)
  const w = 2 * ctx.xBoundMax
  const h = 2 * ctx.yBoundMax
  const project = (v: THREE.Vector3) => {
    const p = v.clone().project(camera)
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h] as const
  }
  const pts = ctx.nodeObjects.map((n) => project(n.getWorldPosition()))
  const lines = ctx.edgeObjects
    .filter((e) => e.weights.some((x) => x >= ctx.edgeWeightThreshold))
    .map((e) => {
      const [x1, y1] = pts[e.sourceNodeIndex]
      const [x2, y2] = pts[e.targetNodeIndex]
      const color = e.decideColor(0, true)
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${xml(color)}" stroke-opacity="${Math.max(0.15, e.decideOpacity(0)).toFixed(2)}" stroke-width="1"/>`
    })
  const circles = ctx.nodeObjects.map((n, i) => {
    const [x, y] = pts[i]
    const r = 4 * n.getScale()
    const label = n.showLabel
      ? `<text x="${(x + r + 2).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" fill="${xml(ctx.labelColor)}">${xml(n.name)}</text>`
      : ''
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${xml(n.color)}"/>${label}`
  })
  const bg = `#${ctx.renderer!.getClearColor(new THREE.Color()).getHexString()}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="100%" height="100%" fill="${bg}"/>
<g>${lines.join('')}</g>
<g font-family="sans-serif">${circles.join('')}</g>
</svg>
`
}

// ---------------------------------------------------------------- video
// Record the canvas while the scene auto-rotates (one full turn by default).
export function recordRotation(
  seconds: number,
  onDone: (blob: Blob) => void
): () => void {
  network()
  const canvas = ctx.renderer!.domElement
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream)
    throw new ExportError('This browser cannot record video.')
  const mime = ['video/webm;codecs=vp9', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m)
  )
  if (!mime) throw new ExportError('This browser cannot record WebM video.')
  const recorder = new MediaRecorder(canvas.captureStream(30), {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const wasRotating = ctx.scene!.autoRotate
  recorder.onstop = () => {
    ctx.scene!.autoRotate = wasRotating
    onDone(new Blob(chunks, { type: 'video/webm' }))
  }
  ctx.scene!.autoRotate = true
  recorder.start(250)
  const timer = window.setTimeout(() => recorder.stop(), seconds * 1000)
  return () => {
    window.clearTimeout(timer)
    if (recorder.state !== 'inactive') recorder.stop()
  }
}

export { download }

// ---------------------------------------------------------------- Cytoscape
// Cytoscape.js JSON (.cyjs): Cytoscape desktop (File → Import → Network from
// File) and its cyREST service read it. Layers sit side by side in the plane
// with each layer's own node positions; node colour, size, shape and layer
// and edge channel and weight travel as table columns.
export interface CyjsNetwork {
  format_version: string
  generated_by: string
  data: { name: string; shared_name: string }
  elements: {
    nodes: {
      data: Record<string, string | number>
      position: { x: number; y: number }
    }[]
    edges: { data: Record<string, string | number> }[]
  }
}

export function cyjsJson(): CyjsNetwork {
  const net = network()
  const index = new Map(ctx.nodeLayerNames.map((id, i) => [id, i]))
  const column = new Map(net.layers.map((l, i) => [l, i]))
  // layers side by side, a quarter floor apart
  const width = Math.max(
    1,
    ...ctx.layers.map((l) => l.getWidth() * l.getScale())
  )
  const nodes = net.nodes.map((n) => {
    const obj = ctx.nodeObjects[index.get(n.id) ?? -1] as
      (typeof ctx.nodeObjects)[number] | undefined
    const col = column.get(n.layer) ?? 0
    return {
      data: {
        id: n.id,
        name: n.label,
        layer: n.layer,
        color: obj?.color ?? '',
        size: obj ? Number(obj.getScale().toFixed(3)) : 1,
        shape: obj?.shape ?? 'sphere',
      },
      position: {
        x: Math.round(col * width * 1.25 + (obj?.getPosition('y') ?? 0)),
        y: Math.round(-(obj?.getPosition('z') ?? 0)),
      },
    }
  })
  const edges = net.edges.map((e, i) => ({
    data: {
      id: `e${i}`,
      source: e.src,
      target: e.trg,
      interaction:
        e.channel ??
        (e.source_layer === e.target_layer ? 'intra-layer' : 'inter-layer'),
      weight: e.weight,
      source_layer: e.source_layer,
      target_layer: e.target_layer,
    },
  }))
  return {
    format_version: '1.0',
    generated_by: 'Arena3D',
    data: { name: 'Arena3D network', shared_name: 'Arena3D network' },
    elements: { nodes, edges },
  }
}

// The classic Cytoscape trio: a SIF network plus node and edge attribute
// tables (CSV) with the same columns as the .cyjs data.
export function sifFiles(): Record<string, string> {
  const cy = cyjsJson()
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const row = (vs: (string | number)[]) => vs.map(q).join(',')
  const sif = cy.elements.edges
    .map((e) => `${e.data.source}\t${e.data.interaction}\t${e.data.target}`)
    .join('\n')
  const nodes = [
    'id,name,layer,color,size,shape,x,y',
    ...cy.elements.nodes.map((n) =>
      row([
        n.data.id,
        n.data.name,
        n.data.layer,
        n.data.color,
        n.data.size,
        n.data.shape,
        n.position.x,
        n.position.y,
      ])
    ),
  ].join('\n')
  const edges = [
    'source,interaction,target,weight,source_layer,target_layer',
    ...cy.elements.edges.map((e) =>
      row([
        e.data.source,
        e.data.interaction,
        e.data.target,
        e.data.weight,
        e.data.source_layer,
        e.data.target_layer,
      ])
    ),
  ].join('\n')
  return {
    'arena3d_network.sif': sif + '\n',
    'arena3d_node_attributes.csv': nodes + '\n',
    'arena3d_edge_attributes.csv': edges + '\n',
  }
}

export const CYTOSCAPE_DEFAULT_SERVER = 'http://localhost:1234'

// Open the network in a running Cytoscape desktop through its cyREST service
// (part of Cytoscape 3): POST the .cyjs, then fit the new view.
export async function sendToCytoscape(
  server = CYTOSCAPE_DEFAULT_SERVER
): Promise<{ suid: number; nodes: number; edges: number }> {
  const body = cyjsJson()
  const base = server.trim().replace(/\/+$/, '') || CYTOSCAPE_DEFAULT_SERVER
  let res: Response
  try {
    res = await fetch(
      `${base}/v1/networks?collection=Arena3D&title=${encodeURIComponent(body.data.name)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
  } catch {
    throw new ExportError(
      `Cytoscape is not answering at ${base}. Start Cytoscape 3 on this computer (its cyREST service listens on port 1234 — Edit → Preferences → Properties → rest.port) and try again.`
    )
  }
  if (!res.ok)
    throw new ExportError(
      `Cytoscape answered ${res.status}: ${(await res.text()).slice(0, 200)}`
    )
  const { networkSUID } = (await res.json()) as { networkSUID: number }
  await fetch(`${base}/v1/apply/fit/${networkSUID}`).catch(() => undefined)
  return {
    suid: networkSUID,
    nodes: body.elements.nodes.length,
    edges: body.elements.edges.length,
  }
}
