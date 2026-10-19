import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Layer, ctx, resetContext } from './index'
import { VOLUME_CONTAINERS, type VolumeKind } from './containers'
import {
  containerPool,
  fillGeometry,
  outlineGeometry,
  wireGeometry,
} from './container_geometry'

beforeEach(() => {
  resetContext()
})

const KINDS = VOLUME_CONTAINERS as VolumeKind[]

// what a layer's container drawing is made of
function parts(l: Layer) {
  const out = { meshes: [] as THREE.Mesh[], lines: [] as THREE.LineSegments[] }
  l.volume?.traverse((o) => {
    if (o instanceof THREE.LineSegments) out.lines.push(o as THREE.LineSegments)
    else if (o instanceof THREE.Mesh) out.meshes.push(o as THREE.Mesh)
  })
  return out
}

describe('container geometry', () => {
  it.each(KINDS.filter((k) => k !== 'cloud'))(
    '%s: unit shapes inside the box [-1, 1]³',
    (kind) => {
      for (const g of [
        fillGeometry(kind),
        outlineGeometry(kind),
        wireGeometry(kind),
      ]) {
        const pos = g.getAttribute('position')
        expect(pos.count).toBeGreaterThan(0)
        g.computeBoundingBox()
        const box = g.boundingBox!
        for (const v of [box.min, box.max])
          for (const c of [v.x, v.y, v.z]) {
            expect(Number.isFinite(c)).toBe(true)
            expect(Math.abs(c)).toBeLessThanOrEqual(1 + 1e-6)
          }
        g.dispose()
      }
    }
  )
})

describe('Layer containers', () => {
  it.each(KINDS)('%s: drawn, scaled to the layer, and gone again', (kind) => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setContainer(kind)
    expect(l.volume?.userData.layerVolume).toBe(kind)
    expect(l.volume?.scale.x).toBe(50)
    expect((l.plane.material as THREE.MeshBasicMaterial).visible).toBe(false)
    l.setScale(2)
    expect(l.volume?.scale.x).toBe(100)
    l.setContainer('floor')
    expect(l.volume).toBeNull()
  })

  it('layers with the same container share geometry and materials', () => {
    const before = containerPool.size
    const layers = Array.from(
      { length: 20 },
      (_, i) => new Layer({ id: i, geometry_parameters_width: 100 + i })
    )
    for (const l of layers) l.setContainer('torus')
    const fills = new Set(layers.map((l) => parts(l).meshes[0].geometry))
    const mats = new Set(layers.map((l) => parts(l).meshes[0].material))
    expect(fills.size).toBe(1)
    expect(mats.size).toBe(1)
    // fill + outline geometry, fill + line material
    expect(containerPool.size - before).toBe(4)
    expect(containerPool.refs('geo:fill:torus')).toBe(20)
  })

  it('the last layer to drop a shape disposes it', () => {
    const a = new Layer({ geometry_parameters_width: 100 })
    const b = new Layer({ geometry_parameters_width: 100 })
    a.setContainer('cone')
    b.setContainer('cone')
    const geometry = parts(a).meshes[0].geometry
    const dispose = vi.spyOn(geometry, 'dispose')
    a.setContainer('sphere')
    expect(dispose).not.toHaveBeenCalled()
    b.setContainer('floor')
    expect(dispose).toHaveBeenCalledOnce()
    expect(containerPool.refs('geo:fill:cone')).toBe(0)
    a.setContainer('none')
  })

  it('outline, wireframe, glow and the floor under the container', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setContainer('cylinder')
    expect(parts(l).lines).toHaveLength(1) // the outline
    l.setContainerLook({ outline: false })
    expect(parts(l).lines).toHaveLength(0)
    l.setContainerLook({ wireframe: true, glow: true, floor: true })
    expect(parts(l).lines).toHaveLength(1) // the cage
    const glow = parts(l).meshes.find(
      (m) => m.material instanceof THREE.ShaderMaterial
    )
    expect(glow?.userData.outline).toBe(true) // left out of GLB exports
    expect((l.plane.material as THREE.MeshBasicMaterial).visible).toBe(true)
    l.setContainerLook({ floor: false })
    expect((l.plane.material as THREE.MeshBasicMaterial).visible).toBe(false)
    l.setContainerLook({ outline: true, outlineColor: '#ff8800' })
    const outline = parts(l).lines.find(
      (s) => (s.material as THREE.LineBasicMaterial).opacity > 0.5
    )
    expect(
      (outline?.material as THREE.LineBasicMaterial).color.getHexString()
    ).toBe('ff8800')
    l.setContainer('floor')
  })

  it('a bubble glows and has no outline; a fog cloud is puffs', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setContainer('bubble')
    expect(parts(l).lines).toHaveLength(0)
    expect(
      parts(l).meshes.some((m) => m.material instanceof THREE.ShaderMaterial)
    ).toBe(true)
    l.setContainer('cloud')
    let sprites = 0
    l.volume?.traverse((o) => (sprites += o instanceof THREE.Sprite ? 1 : 0))
    expect(sprites).toBe(37)
    l.setContainer('floor')
  })

  it('opacity scales every part; the look comes back on undo-style restore', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setContainer('cube')
    const before = l.containerLook()
    l.setContainerLook({ opacity: 0.6, color: '#123456' })
    const fill = parts(l).meshes[0].material as THREE.MeshBasicMaterial
    expect(fill.opacity).toBeCloseTo(0.16)
    expect(fill.color.getHexString()).toBe('123456')
    l.setContainerLook(before)
    expect(l.containerLook()).toEqual(before)
    l.setContainer('floor')
  })

  it('hover and selection tint the container; a repaint clears hover', () => {
    ctx.containerDefaultColor = '#5b8def'
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setContainer('dome')
    const colour = () =>
      (
        parts(l).lines[0].material as THREE.LineBasicMaterial
      ).color.getHexString()
    expect(colour()).toBe('5b8def')
    l.paintHover('#ff0000')
    expect(colour()).toBe('ff0000')
    l.setColor('#777777') // repaint, not selected
    expect(colour()).toBe('5b8def')
    l.isSelected = true
    l.setColor('#f7f43e')
    expect(colour()).toBe('f7f43e')
    l.setContainer('floor')
  })
})
