// Export to NORMA (https://normaviz.org) through its API — each Arena3D layer
// becomes a NORMA annotation group. NORMA works on one graph of named nodes,
// so copies of a node in several layers become one node that belongs to
// several groups; edges keep their channel (or, without channels, the name of
// their layer) as the NORMA edge type. Payload format: NORMA's
// norma_api_client.py / API help — {name, edges, groups, settings}.

import { store } from '../store'

export const NORMA_DEFAULT_SERVER = 'https://normaviz.org/'

export interface NormaEdge {
  source: string
  target: string
  type?: string
  weight?: number
}

export interface NormaPayload {
  name: string
  edges: NormaEdge[]
  groups: Record<string, string[]>
  settings: Record<string, unknown>
}

export class NormaError extends Error {}

// `layers`: which layers to send (default: all). Inter-layer edges between
// different nodes are kept (type "inter-layer"); links between copies of the
// same node are dropped (they are the same NORMA node).
export function normaPayload(name: string, layers?: string[]): NormaPayload {
  const net = store.get().network
  if (!net) throw new NormaError('Load a network first.')
  const keep = new Set(layers?.length ? layers : net.layers)
  const groups: Record<string, string[]> = {}
  for (const layer of net.layers) if (keep.has(layer)) groups[layer] = []
  for (const n of net.nodes)
    if (keep.has(n.layer) && !groups[n.layer].includes(n.label))
      groups[n.layer].push(n.label)

  const seen = new Set<string>()
  const edges: NormaEdge[] = []
  for (const e of net.edges) {
    if (!keep.has(e.source_layer) || !keep.has(e.target_layer)) continue
    if (e.source_node === e.target_node) continue
    const type =
      e.source_layer !== e.target_layer
        ? 'inter-layer'
        : (e.channel ?? e.source_layer)
    const [a, b] = [e.source_node, e.target_node].sort()
    const key = `${a}\t${b}\t${type}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({
      source: e.source_node,
      target: e.target_node,
      type,
      weight: e.weight,
    })
  }
  if (edges.length === 0)
    throw new NormaError('No edges to send for these layers.')
  return {
    name,
    edges,
    groups,
    settings: {
      layout: 'fr',
      showGroupHulls: true,
      hullStyle: 'bubble',
      edgeDirection: 'data',
      legendShow: true,
    },
  }
}

const normalise = (server: string) =>
  server.endsWith('/') ? server : `${server}/`

// POST <server>/api/external -> {token, url}. NORMA's API allows calls from
// any page (CORS), so the browser sends it directly.
export async function sendToNorma(
  server: string,
  payload: NormaPayload
): Promise<{ url: string; expiresInHours?: number }> {
  let res: Response
  try {
    res = await fetch(`${normalise(server)}api/external`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new NormaError(`Could not reach NORMA at ${server}.`)
  }
  const body = (await res.json().catch(() => ({}))) as {
    url?: string
    message?: string
    expiresInHours?: number
  }
  if (!res.ok || !body.url)
    throw new NormaError(body.message ?? `NORMA answered ${res.status}.`)
  // only a web address is opened: never a javascript: or data: link in
  // this origin, whatever the server answers
  if (!/^https?:\/\//i.test(body.url))
    throw new NormaError(
      'NORMA answered with a link that is not a web address.'
    )
  return { url: body.url, expiresInHours: body.expiresInHours }
}

// A link carrying the payload itself (no server; best for small networks).
export function normaLink(server: string, payload: NormaPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const code = btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const base = normalise(server)
  return `${base}norma.html#json=${code}`
}
