// Export → Other tools → Send to Flame: the node names of the layers go to
// Flame (Koutrouli et al., 2023), the lab's functional enrichment tool, as
// gene lists through its GET API — `?url_genes=` carries the lists, separated
// by ';', the genes within a list by ','. One list per layer (Flame keeps the
// first ten), or the selected layers combined into one list.

import { ctx } from '../three'
import { store } from '../store'
import { ExportError } from './export'

// flame.pavlopouloslab.info and flame-enrich.org redirect here and drop the
// query on the way, so the app's own address is the default
export const FLAME_DEFAULT_SERVER =
  'https://pavlopoulos-lab-services.org/shiny/app/flame'
export const FLAME_LIST_LIMIT = 10
export const FLAME_URL_LIMIT = 8000 // characters a link can safely carry

export type FlameMode = 'perLayer' | 'combined'

export interface GeneList {
  name: string
  genes: string[]
}

// the layers ticked in Layer selection, or all
function chosenLayers(): string[] {
  const picked = store.get().selectedLayers
  return picked.length ? picked : ctx.layers.map((l) => l.name)
}

function genesOf(layers: string[]): string[] {
  const set = new Set<string>()
  ctx.nodeObjects.forEach((n, i) => {
    if (!layers.includes(ctx.nodeGroups[ctx.nodeLayerNames[i]])) return
    const gene = n.name.trim()
    if (gene) set.add(gene)
  })
  return [...set]
}

/** The gene lists to send: one per layer, or the layers combined. */
export function flameLists(mode: FlameMode): GeneList[] {
  if (ctx.nodeObjects.length === 0)
    throw new ExportError('Load a network first.')
  const layers = chosenLayers()
  const lists =
    mode === 'combined'
      ? [{ name: layers.join(' + '), genes: genesOf(layers) }]
      : layers.map((l) => ({ name: l, genes: genesOf([l]) }))
  const kept = lists.filter((l) => l.genes.length > 0)
  if (kept.length === 0)
    throw new ExportError('No node names in the chosen layers.')
  return kept
}

// a name can hold neither of Flame's separators
const clean = (gene: string) => gene.replace(/[,;\s]+/g, '_')

/** Flame's GET link with the lists in `url_genes`. */
export function flameUrl(server: string, lists: GeneList[]): string {
  const base = server.trim() || FLAME_DEFAULT_SERVER
  if (!/^https?:\/\//i.test(base))
    throw new ExportError(
      'The Flame address must start with http:// or https://.'
    )
  const sep = base.includes('?') ? '&' : '?'
  const param = lists
    .slice(0, FLAME_LIST_LIMIT)
    .map((l) => l.genes.map((g) => encodeURIComponent(clean(g))).join(','))
    .join(';')
  const url = `${base}${sep}url_genes=${param}`
  if (url.length > FLAME_URL_LIMIT)
    throw new ExportError(
      `Too many genes for a link (${Math.round(url.length / 1000)} kB): copy the gene lists and paste them into Flame instead.`
    )
  return url
}

/** The lists as text to paste into Flame: one line per list, genes comma-separated. */
export function flameText(lists: GeneList[]): string {
  return (
    lists.map((l) => `# ${l.name}\n${l.genes.join(', ')}`).join('\n\n') + '\n'
  )
}
