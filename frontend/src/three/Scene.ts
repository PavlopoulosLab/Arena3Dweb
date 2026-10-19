import * as THREE from 'three'
import { ctx } from './runtime'
import type { Axis } from './Node'
import {
  DEFAULT_AXES_OPACITY,
  disposeAxes,
  makeAxes,
  setAxesOpacity,
} from './axes'

// Scene scale bounds: wide enough to read as unlimited zoom (1/100 to 100x).
// The camera's depth range (screen.ts setCamera) follows SCALE_MAX, so the
// stack is not clipped when zoomed in.
export const SCALE_MIN = 0.01
export const SCALE_MAX = 100
export const clampScale = (s: number): number =>
  Math.min(SCALE_MAX, Math.max(SCALE_MIN, s))

export class Scene {
  THREE_Object!: THREE.Scene
  pan: THREE.Mesh | null = null // scene translations applied here
  sphere: THREE.Mesh | null = null // scene rotations applied here
  coordSystem: THREE.Object3D[] = []
  axesOpacity = DEFAULT_AXES_OPACITY
  defaultColor = '#000000'
  autoRotate = false
  dragging = false
  leftClickPressed = false // drag translating scene
  middleClickPressed = false // drag rotating scene
  axisPressed = '' // z, x, c

  constructor() {
    this.reset()
  }

  reset(): void {
    this.THREE_Object = new THREE.Scene()
    this.pan = null
    this.sphere = null
    this.coordSystem = []
    this.defaultColor = '#000000'
    this.autoRotate = false
    this.dragging = false
    this.leftClickPressed = false
    this.middleClickPressed = false
    this.axisPressed = ''

    this.addLights()
    this.addPan()
    this.addSphere()
    this.appendCoordSystem()
  }

  addLights(): void {
    this.add(this.createPointLight(1))
    this.add(this.createPointLight(-1))
    // three r155+ lights are physical: the Lambert BRDF divides irradiance by
    // PI, so intensity 1 renders a node at ~32% of its own color. PI is the
    // intensity that makes a node read as the color the user picked — same as
    // the minimap, which draws the raw hex.
    this.add(new THREE.AmbientLight(0xffffff, Math.PI))
  }

  createPointLight(orientation: number): THREE.PointLight {
    const sphereGeom = new THREE.SphereGeometry()
    // decay 0: the lights sit a whole viewport away, where inverse-square
    // falloff leaves nothing. They only add the top/bottom shading that keeps
    // the spheres reading as 3D on top of the flat ambient.
    const lightObject = new THREE.PointLight(
      0xffffff,
      0.5,
      2 * ctx.yBoundMax,
      0
    )
    lightObject.add(
      new THREE.Mesh(
        sphereGeom,
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      )
    )
    lightObject.position.set(0, orientation * ctx.yBoundMax, 0)
    lightObject.rotateX(THREE.MathUtils.degToRad(90))
    return lightObject
  }

  addPan(): void {
    const threePan = this.createSphere()
    this.add(threePan)
    this.pan = threePan
  }

  createSphere(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry()
    const material = new THREE.MeshBasicMaterial({
      color: 'white',
      transparent: true,
      opacity: 0,
    })
    return new THREE.Mesh(geometry, material)
  }

  add(threeObject: THREE.Object3D): void {
    this.THREE_Object.add(threeObject)
  }

  remove(threeObject: THREE.Object3D): void {
    this.THREE_Object.remove(threeObject)
  }

  addSphere(): void {
    const threeSphere = this.createSphere()
    this.pan!.add(threeSphere)
    this.sphere = threeSphere
  }

  // the X/Y/Z arrows through the centre of the scene (three/axes.ts)
  appendCoordSystem(): void {
    disposeAxes(this.coordSystem)
    this.coordSystem = makeAxes(800, this.axesOpacity)
    for (const axis of this.coordSystem) this.sphere!.add(axis)
  }

  toggleCoords(sceneCoordsSwitch: boolean): void {
    for (const axis of this.coordSystem) axis.visible = sceneCoordsSwitch
  }

  setAxesOpacity(opacity: number): void {
    this.axesOpacity = opacity
    setAxesOpacity(this.coordSystem, opacity)
  }

  exists(): boolean {
    return this.pan !== null
  }

  tiltDefault(): void {
    this.setRotation('x', THREE.MathUtils.degToRad(15))
    this.setRotation('y', THREE.MathUtils.degToRad(15))
    this.setRotation('z', THREE.MathUtils.degToRad(5))
  }

  addLayer(threePlane: THREE.Object3D): void {
    this.sphere!.add(threePlane)
  }

  translateX(x: number): void {
    this.pan!.translateX(x)
  }

  translateY(y: number): void {
    this.pan!.translateY(y)
  }

  translatePanWithArrow(code: number): void {
    if (code == 37) this.translateX(-25) // left
    if (code == 38) this.translateY(25) // up
    if (code == 39) this.translateX(25) // right
    if (code == 40) this.translateY(-25) // down
  }

  translatePanWithMouse(x: number, y: number): void {
    this.translateX(x - ctx.mousePreviousX)
    this.translateY(ctx.mousePreviousY - y)
  }

  orbitSphereWithMouse(x: number, y: number): void {
    const deltaMove = { x: x - ctx.mousePreviousX, y: y - ctx.mousePreviousY }
    const deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(deltaMove.y),
        THREE.MathUtils.degToRad(deltaMove.x),
        0,
        'XYZ'
      )
    )
    this.setQuaternion(deltaRotationQuaternion)
  }

  setQuaternion(deltaRotationQuaternion: THREE.Quaternion): void {
    this.sphere!.quaternion.multiplyQuaternions(
      deltaRotationQuaternion,
      this.getQuaternion()
    )
  }

  getQuaternion(): THREE.Quaternion {
    return this.sphere!.quaternion
  }

  // ponytail: v2 Scene.rotate() (continuous-rotation button: setInterval + DOM
  // slider read + Shiny sync) is UI glue, not scene data model. It lands in
  // Phase 11 with canvas_controls, wired to the real slider + EventBus. The
  // rotateX/Y/Z primitives it drove are kept here.

  rotateX(x: number): void {
    this.sphere!.rotateX(x)
  }

  rotateY(y: number): void {
    this.sphere!.rotateY(y)
  }

  rotateZ(z: number): void {
    this.sphere!.rotateZ(z)
  }

  recenter(): void {
    this.pan!.position.x = this.pan!.position.y = 0
  }

  zoom(deltaY: number): void {
    const factor = deltaY < 0 ? 1.1 : deltaY > 0 ? 0.9 : 1
    this.setScale(clampScale(this.getScale() * factor))
  }

  getPosition(axis: Axis): number {
    return this.pan!.position[axis]
  }

  setPosition(axis: Axis, value: number): void {
    this.pan!.position[axis] = value
  }

  getPointPosition(): THREE.Vector3 {
    return this.sphere!.position
  }

  getRotation(axis: Axis): number {
    return this.sphere!.rotation[axis]
  }

  setRotation(axis: Axis, value: number): void {
    this.sphere!.rotation[axis] = value
  }

  getScale(): number {
    return this.pan!.scale.x
  }

  setScale(value: number): void {
    this.pan!.scale.set(value, value, value)
  }
}
