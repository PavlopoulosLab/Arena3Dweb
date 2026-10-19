// Typed event bus — decouples UI panels from the Three.js scene.
// Replaces the role of rshiny_handlers.js / rshiny_update.js.

import type {
  GraphStats,
  LayerSimilarityResponse,
  LayoutPosition,
} from '../api/client'

export interface BusEvents {
  'network:loaded': { nodeCount: number; edgeCount: number; session: boolean }
  'node:color-changed': { nodeId: string; color: string }
  'node:size-changed': { nodeId: string; size: number }
  'edge:color-changed': { edgeId: string; color: string }
  'layout:applied': { positions: Record<string, LayoutPosition> }
  'clustering:applied': { clusters: Record<string, number> }
  'topology:applied': {
    metric: string
    scales: Record<string, number>
    raw?: Record<string, number> // the metric's values (absent on undo)
  }
  'layers:similarity': LayerSimilarityResponse
  'layers:selected': { names: string[] } // the ticked layers changed
  'network:stats': GraphStats[]
  'layer:moved': { layerIndex: number }
  'theme:changed': { theme: string; recolour?: boolean } // recolour: the user's own colours too
  'history:changed': { canUndo: boolean; canRedo: boolean }
  'mode:changed': { mode: 'multilayer' | 'single' }
  'groups:changed': { source: 'annotation' | 'cluster' | 'all' }
  // groups shown or hidden (Groups card, Clustering summary); the rest fade
  'groups:shown': { source: 'annotation' | 'cluster' }
  'workspace:changed': { active: number }
  'legend:changed': { title: string | null }
  'values:loaded': { columns: string[] }
  'selection:changed': { count: number } // nodes selected or unselected
  // open Edit → Attributes' inspector on one node or edge (indices)
  'attributes:inspect': { kind: 'node' | 'edge'; index: number }
}

type Handler<T> = (payload: T) => void

class EventBus {
  // one Set of handlers per event name; typed via the public method signatures
  private handlers = new Map<keyof BusEvents, Set<Handler<unknown>>>()

  on<K extends keyof BusEvents>(
    event: K,
    handler: Handler<BusEvents[K]>
  ): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<unknown>)
    return () => this.off(event, handler)
  }

  off<K extends keyof BusEvents>(
    event: K,
    handler: Handler<BusEvents[K]>
  ): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>)
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    this.handlers.get(event)?.forEach((h) => h(payload))
  }
}

export const bus = new EventBus()
