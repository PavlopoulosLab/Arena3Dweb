// Edit → Layers → Shape & container: the layer shape (floor, none or a 3D
// container, grouped Flat / Solid / Soft), nodes inside it or on its surface,
// and the container's look — colour, opacity, outline, wire cage, rim light
// and the floor under it. Applies to the selected layers, or all; undoable.

import { setLayerContainer } from '../actions/modes'
import { history } from '../commands/base'
import { ChangeContainerStyleCommand } from '../commands/scene'
import { bus } from '../bus'
import { ctx } from '../three'
import {
  CONTAINER_GROUP_LABELS,
  CONTAINER_KINDS,
  CONTAINERS,
  VOLUME_CONTAINERS,
  type ContainerGroup,
  type ContainerPlacement,
  type LayerContainer,
} from '../three/containers'
import type { ContainerLook } from '../three/Layer'

const optionGroups = (Object.keys(CONTAINER_GROUP_LABELS) as ContainerGroup[])
  .map(
    (g) =>
      `<optgroup label="${CONTAINER_GROUP_LABELS[g]}">${CONTAINER_KINDS.filter(
        (k) => CONTAINERS[k].group === g
      )
        .map(
          (k) =>
            `<option value="${k}" title="${CONTAINERS[k].hint}">${CONTAINERS[k].label}</option>`
        )
        .join('')}</optgroup>`
  )
  .join('')

export const CONTAINER_CARD_HTML = `
  <details class="lp-section lp-more" id="layerCard_shape">
  <summary>Shape &amp; container</summary>
  <label class="form-label" for="layerContainer">Layer Shape (selected layers, or all):</label>
  <div class="d-flex gap-2 mb-1">
    <select id="layerContainer" class="form-select form-select-sm" style="width:auto">${optionGroups}</select>
    <button id="applyLayerContainer" class="btn btn-outline-primary btn-sm">Apply</button>
  </div>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-1" id="containerPlacement" title="Where the nodes of a 3D container go">
    <span class="small">Nodes:</span>
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="radio" name="containerPlacement" id="containerPlacement_inside" value="inside" checked />
      <label class="form-check-label small" for="containerPlacement_inside">Inside</label>
    </div>
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="radio" name="containerPlacement" id="containerPlacement_surface" value="surface" />
      <label class="form-check-label small" for="containerPlacement_surface">On the surface</label>
    </div>
  </div>
  <div class="form-text mb-2" id="containerHint"></div>
  <div id="containerStyle">
    <label class="form-label small mb-1">3D Container Look (selected layers, or all):</label>
    <div class="container-look">
      <span class="small">Colour</span>
      <div class="container-look__value">
        <input type="color" id="containerColor" class="form-control form-control-color form-control-sm" value="#5b8def" title="Container colour" aria-label="Container colour" />
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="containerFollowFloor" checked />
          <label class="form-check-label small" for="containerFollowFloor">Theme default (contrasts with the background)</label>
        </div>
      </div>
      <label class="small" for="containerOpacity">Opacity</label>
      <div class="container-look__value">
        <input type="range" class="form-range" id="containerOpacity" min="0" max="1" step="0.05" value="0.3" />
        <span id="containerOpacityValue" class="small">0.30</span>
      </div>
      <span class="small">Outline</span>
      <div class="container-look__value">
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="containerOutline" checked />
          <label class="form-check-label small" for="containerOutline">On</label>
        </div>
        <input type="color" id="containerOutlineColor" class="form-control form-control-color form-control-sm" value="#5b8def" title="Outline colour" aria-label="Outline colour" />
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="containerOutlineFollow" checked />
          <label class="form-check-label small" for="containerOutlineFollow">As the container</label>
        </div>
      </div>
      <span class="small">Show</span>
      <div class="container-look__value">
        <div class="form-check mb-0" title="A light cage of lines over the whole surface">
          <input class="form-check-input" type="checkbox" id="containerWireframe" />
          <label class="form-check-label small" for="containerWireframe">Wireframe</label>
        </div>
        <div class="form-check mb-0" title="A rim light, brighter where the surface turns away, like glass">
          <input class="form-check-input" type="checkbox" id="containerGlow" />
          <label class="form-check-label small" for="containerGlow">Glow</label>
        </div>
        <div class="form-check mb-0" title="Keep the layer's floor visible under its container">
          <input class="form-check-input" type="checkbox" id="containerShowFloor" />
          <label class="form-check-label small" for="containerShowFloor">Floor under it</label>
        </div>
      </div>
    </div>
    <button id="applyContainerStyle" class="btn btn-outline-primary btn-sm">Apply Look</button>
  </div>
  </details>`

const input = (id: string) => document.getElementById(id) as HTMLInputElement
const kindSelect = () =>
  document.getElementById('layerContainer') as HTMLSelectElement

// the selected layers, or all
function targets(): number[] {
  const selected = ctx.layers.filter((l) => l.isSelected).map((l) => l.id)
  return selected.length ? selected : ctx.layers.map((l) => l.id)
}

const describe = (k: LayerContainer) =>
  CONTAINERS[k].label.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())

// the hint under the select, and "On the surface" only where it makes sense
function syncKind(): void {
  const kind = kindSelect().value as LayerContainer
  const info = CONTAINERS[kind]
  const hint = document.getElementById('containerHint')
  if (hint)
    hint.textContent =
      info.group === 'flat'
        ? `${info.label}: ${info.hint}. 3D shapes lay their nodes out in 3D inside; use Layouts with "3D Layout" for other algorithms.`
        : `${info.label}: ${info.hint}.`
  const surface = input('containerPlacement_surface')
  surface.disabled = !info.surface
  if (!info.surface) input('containerPlacement_inside').checked = true
}

function placement(): ContainerPlacement {
  return input('containerPlacement_surface').checked ? 'surface' : 'inside'
}

function lookFromControls(): ContainerLook {
  return {
    color: input('containerFollowFloor').checked
      ? null
      : input('containerColor').value,
    opacity: Number(input('containerOpacity').value),
    outline: input('containerOutline').checked,
    outlineColor: input('containerOutlineFollow').checked
      ? null
      : input('containerOutlineColor').value,
    wireframe: input('containerWireframe').checked,
    glow: input('containerGlow').checked,
    floor: input('containerShowFloor').checked,
  }
}

// The controls show the first target layer's container and look.
export function syncContainerControls(): void {
  const layer = ctx.layers[targets()[0]]
  if (!layer || !document.getElementById('layerContainer')) return
  kindSelect().value = layer.container
  input(`containerPlacement_${layer.containerPlacement}`).checked = true
  const look = layer.containerLook()
  input('containerFollowFloor').checked = look.color === null
  input('containerColor').value = look.color ?? ctx.containerDefaultColor
  input('containerOpacity').value = String(look.opacity)
  document.getElementById('containerOpacityValue')!.textContent =
    look.opacity.toFixed(2)
  input('containerOutline').checked = look.outline
  input('containerOutlineFollow').checked = look.outlineColor === null
  input('containerOutlineColor').value =
    look.outlineColor ?? look.color ?? ctx.containerDefaultColor
  input('containerWireframe').checked = look.wireframe
  input('containerGlow').checked = look.glow
  input('containerShowFloor').checked = look.floor
  syncKind()
}

export function initContainerCard(
  status: (msg: string, isError?: boolean) => void
): void {
  kindSelect().addEventListener('change', syncKind)
  syncKind()
  input('containerOpacity').addEventListener('input', (e) => {
    document.getElementById('containerOpacityValue')!.textContent = Number(
      (e.target as HTMLInputElement).value
    ).toFixed(2)
  })
  // picking a colour means using it
  input('containerColor').addEventListener('input', () => {
    input('containerFollowFloor').checked = false
  })
  input('containerOutlineColor').addEventListener('input', () => {
    input('containerOutlineFollow').checked = false
    input('containerOutline').checked = true
  })
  bus.on('layers:selected', syncContainerControls)
  bus.on('network:loaded', syncContainerControls)

  document
    .getElementById('applyContainerStyle')
    ?.addEventListener('click', () => {
      const ids = targets()
      if (ids.length === 0) return status('Load a network first.', true)
      history.execute(new ChangeContainerStyleCommand(ids, lookFromControls()))
      status(
        ids.some((i) => VOLUME_CONTAINERS.includes(ctx.layers[i].container))
          ? 'Container look applied.'
          : 'Container look saved; it shows once the layers have a 3D container.'
      )
    })

  document
    .getElementById('applyLayerContainer')
    ?.addEventListener('click', () => {
      const kind = kindSelect().value as LayerContainer
      const ids = targets()
      if (ids.length === 0) return status('Load a network first.', true)
      const endsHive = !!ctx.hive && VOLUME_CONTAINERS.includes(kind)
      const where = placement()
      const onSurface = where === 'surface' && CONTAINERS[kind].surface
      setLayerContainer(ids, kind, undefined, where)
        .then((outcome) =>
          status(
            (endsHive ? 'Hive plot ended (its layers are axes). ' : '') +
              (outcome === 'laidOut'
                ? `Layers set to ${describe(kind)}; nodes laid out in 3D ${onSurface ? 'on the surface' : 'inside'}.`
                : outcome === 'placed'
                  ? `Layers set to ${describe(kind)}; nodes moved ${onSurface ? 'onto the surface' : 'inside'}.`
                  : `Layers set to ${describe(kind)}.`)
          )
        )
        .catch((err: unknown) =>
          status(err instanceof Error ? err.message : String(err), true)
        )
    })
}
