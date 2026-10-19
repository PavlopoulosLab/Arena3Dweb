import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import {
  Node,
  Layer,
  Scene,
  Edge,
  ctx,
  edgeResolution,
  resetContext,
} from './index'
import { EDGE_WIDTH_MAX, EDGE_WIDTH_MIN } from './constants'
import { SCALE_MAX, SCALE_MIN } from './Scene'

beforeEach(() => {
  resetContext()
})

describe('Node', () => {
  it('constructs a sphere mesh at the given position with defaults', () => {
    const n = new Node({
      name: 'A',
      position_x: 1,
      position_y: 2,
      position_z: 3,
    })
    expect(n.sphere).toBeInstanceOf(THREE.Mesh)
    expect(n.getPosition('x')).toBe(1)
    expect(n.getPosition()).toBeInstanceOf(THREE.Vector3)
    expect(n.color).toBe('#FFFFFF')
  })

  it('getColor follows the runtime priority source', () => {
    const n = new Node({ color: '#111111' })
    n.setColor('#222222', true /* import */, false)
    n.setColor('#333333', false, true /* cluster */)
    ctx.nodeColorPrioritySource = 'default'
    expect(n.getColor()).toBe('#222222')
    ctx.nodeColorPrioritySource = 'cluster'
    expect(n.getColor()).toBe('#333333')
  })

  it('setScale and getScale round-trip', () => {
    const n = new Node({})
    n.setScale(2.5)
    expect(n.getScale()).toBe(2.5)
  })

  it('setGeometry swaps the mesh geometry', () => {
    const n = new Node({})
    n.setGeometry('box')
    expect(n.sphere.geometry).toBeInstanceOf(THREE.BoxGeometry)
    n.setGeometry('diamond')
    expect(n.sphere.geometry).toBeInstanceOf(THREE.OctahedronGeometry)
  })
})

describe('Layer', () => {
  it('constructs a plane of the requested width', () => {
    const l = new Layer({ name: 'L1', geometry_parameters_width: 400 })
    expect(l.plane).toBeInstanceOf(THREE.Mesh)
    expect(l.getWidth()).toBe(400)
    // three arrows: shaft, head, dashed negative half, ticks, letter
    expect(l.coordSystem).toHaveLength(3)
    expect(l.coordSystem[0].children.length).toBeGreaterThanOrEqual(5)
    expect(l.coordSystem.every((a) => !a.visible)).toBe(true)
    l.toggleCoords(true)
    expect(l.coordSystem.every((a) => a.visible)).toBe(true)
  })

  it('setColor updates the material color', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setColor('#ff0000')
    expect(l.color).toBe('#ff0000')
    const mat = l.plane.material as THREE.MeshBasicMaterial
    expect(mat.color.getHexString()).toBe('ff0000')
  })

  it('setFloorShape swaps to a disk, keeps scale, and back', () => {
    const l = new Layer({ geometry_parameters_width: 100, last_layer_scale: 2 })
    l.setFloorShape('disk')
    expect(l.plane.geometry).toBeInstanceOf(THREE.CircleGeometry)
    l.plane.geometry.computeBoundingBox()
    const box = l.plane.geometry.boundingBox!
    expect(box.max.y - box.min.y).toBeCloseTo(200) // diameter 100 x scale 2
    expect(l.getWidth()).toBe(100)
    l.setFloorShape('square')
    expect(l.plane.geometry).toBeInstanceOf(THREE.PlaneGeometry)
  })

  it('setContainer draws a volume, hides the floor, follows scale', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setContainer('cube')
    expect(l.volume?.userData.layerVolume).toBe('cube')
    expect(l.plane.children).toContain(l.volume)
    expect((l.plane.material as THREE.MeshBasicMaterial).visible).toBe(false)
    l.setScale(2)
    expect(l.containerRadius()).toBe(100)
    l.setContainer('sphere')
    expect(l.volume?.userData.layerVolume).toBe('sphere')
    l.setContainer('floor')
    expect(l.volume).toBeNull()
    expect((l.plane.material as THREE.MeshBasicMaterial).visible).toBe(true)
    l.setContainer('none')
    expect((l.plane.material as THREE.MeshBasicMaterial).visible).toBe(false)
  })

  it('toggleFloor hides the floor material but keeps children visible', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.toggleFloor(false)
    expect((l.plane.material as THREE.MeshBasicMaterial).visible).toBe(false)
    expect(l.plane.visible).toBe(true) // nodes/edges hang off the plane
    expect(l.floorVisible).toBe(false)
  })

  it('toggleVisibility syncs plane + flag', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.toggleVisibility(false)
    expect(l.isVisible).toBe(false)
    expect(l.plane.visible).toBe(false)
  })

  it('getColor prefers importedColor when selected in default mode', () => {
    const l = new Layer({
      geometry_parameters_width: 100,
      floor_current_color: '#abcabc',
    })
    l.setColor('#123123')
    l.isSelected = true
    ctx.layerColorPrioritySource = 'default'
    expect(l.getColor()).toBe('#abcabc') // importedColor
    l.isSelected = false
    expect(l.getColor()).toBe('#123123') // stored color
  })

  it('setScale records last_layer_scale', () => {
    const l = new Layer({ geometry_parameters_width: 100 })
    l.setScale(3)
    expect(l.getScale()).toBe(3)
  })
})

describe('Scene', () => {
  it('constructs with pan/sphere and a 3-axis coord system', () => {
    const s = new Scene()
    expect(s.exists()).toBe(true)
    expect(s.THREE_Object).toBeInstanceOf(THREE.Scene)
    expect(s.coordSystem).toHaveLength(3)
  })

  it('axes are arrows whose opacity the panel sets', () => {
    const s = new Scene()
    s.setAxesOpacity(0.3)
    const opacities: number[] = []
    for (const axis of s.coordSystem)
      axis.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m) opacities.push(m.opacity)
      })
    expect(opacities.length).toBeGreaterThanOrEqual(12)
    expect(opacities.every((o) => o === 0.3)).toBe(true)
    s.toggleCoords(false)
    expect(s.coordSystem.every((a) => !a.visible)).toBe(true)
  })

  it('zoom scales within the (wide) clamps', () => {
    const s = new Scene()
    expect(s.getScale()).toBe(1)
    s.zoom(-1) // zoom in
    expect(s.getScale()).toBeCloseTo(1.1)
    s.setScale(0.2)
    s.zoom(1) // no 0.2 floor any more: zooming out goes on
    expect(s.getScale()).toBeCloseTo(0.18)
    s.setScale(SCALE_MIN)
    s.zoom(1)
    expect(s.getScale()).toBe(SCALE_MIN)
    s.setScale(SCALE_MAX)
    s.zoom(-1)
    expect(s.getScale()).toBe(SCALE_MAX)
  })

  it('rotate primitives rotate the sphere', () => {
    const s = new Scene()
    s.setRotation('x', 0)
    s.rotateX(0.5)
    expect(s.getRotation('x')).toBeCloseTo(0.5)
  })
})

describe('Edge', () => {
  // Minimal populated runtime: one layer, two nodes, both on layer "L".
  function seedTwoNodeLayer(): void {
    const scene = new Scene()
    const layer = new Layer({ geometry_parameters_width: 100 })
    const a = new Node({ name: 'A', position_y: 0, position_z: 0 })
    const b = new Node({ name: 'B', position_y: 10, position_z: 10 })
    ctx.scene = scene
    ctx.layers = [layer]
    ctx.nodeObjects = [a, b]
    ctx.nodeLayerNames = ['A::L', 'B::L']
    ctx.nodeGroups = { 'A::L': 'L', 'B::L': 'L' }
    ctx.layerGroups = { L: 0 }
  }

  it('draws an intra-layer line and attaches it to the source layer', () => {
    seedTwoNodeLayer()
    const e = new Edge({ source: 'A::L', target: 'B::L', weights: [1] })
    expect(e.THREE_Object).toBeInstanceOf(Line2)
    expect(e.sourceLayerIndex).toBe(0)
    expect(ctx.layers[0].plane.children).toContain(e.THREE_Object)
    expect(e.decideColor()).toBe(ctx.edgeDefaultColor)
  })

  it('attaches an inter-layer edge to the scene, not a layer', () => {
    seedTwoNodeLayer()
    const e = new Edge({
      source: 'A::L',
      target: 'B::L',
      weights: [1],
      interLayer: true,
    })
    expect(ctx.scene!.THREE_Object.children).toContain(e.THREE_Object)
  })

  it('builds a channel curve group coloured by channelColors', () => {
    seedTwoNodeLayer()
    ctx.channelColors = { ch1: '#123456' }
    ctx.channelVisibility = { ch1: true }
    const e = new Edge({
      source: 'A::L',
      target: 'B::L',
      weights: [0.5],
      channels: ['ch1'],
    })
    expect(e.THREE_Object).toBeInstanceOf(THREE.Group)
    expect(e.THREE_Object.children.length).toBeGreaterThan(0)
    expect(e.decideColor(0)).toBe('#123456')
  })

  it('decideOpacity uses weight when edgeOpacityByWeight is on', () => {
    seedTwoNodeLayer()
    const e = new Edge({ source: 'A::L', target: 'B::L', weights: [0.7] })
    ctx.edgeOpacityByWeight = true
    expect(e.decideOpacity(0)).toBe(0.7)
    ctx.edgeOpacityByWeight = false
    expect(e.decideOpacity(0)).toBe(ctx.intraLayerEdgeOpacity)
  })

  it('decideWidth maps the scaled weight onto the width range', () => {
    seedTwoNodeLayer()
    const e = new Edge({ source: 'A::L', target: 'B::L', weights: [0.5] })
    ctx.edgeWidthByWeight = true
    expect(e.decideWidth(0)).toBe(
      EDGE_WIDTH_MIN + 0.5 * (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN)
    )
    ctx.edgeWidthByWeight = false
    expect(e.decideWidth(0)).toBe(ctx.intraLayerEdgeWidth)
  })

  it('applies the resolved width to the line material', () => {
    seedTwoNodeLayer()
    ctx.edgeWidthByWeight = false
    ctx.intraLayerEdgeWidth = 4
    const e = new Edge({ source: 'A::L', target: 'B::L', weights: [1] })
    const material = (e.THREE_Object as Line2).material
    expect(material.linewidth).toBe(4)
    // Screen-space widths (worldUnits breaks under the orthographic camera),
    // sized against the shared frustum-tracking resolution uniform.
    expect(material.worldUnits).toBe(false)
    expect(material.uniforms.resolution.value).toBe(edgeResolution)
  })

  it('skips edges too faint to see instead of building invisible lines', () => {
    seedTwoNodeLayer()
    ctx.edgeOpacityByWeight = true
    const e = new Edge({ source: 'A::L', target: 'B::L', weights: [0.01] })
    expect(e.THREE_Object).not.toBeInstanceOf(Line2)
    expect(e.THREE_Object.children).toHaveLength(0)
  })
})
