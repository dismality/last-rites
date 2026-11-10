// Debug views for the Dev_Panel: collider wireframes (sensors in another colour), FPS and draw
// calls, and the player position and objective id. Collider shapes are read straight from the
// Rapier collider set the player body belongs to and drawn into the live scene, so no scene
// component has to change. Browser only: it uses requestAnimationFrame and three.js.

import * as THREE from 'three'
import type { Collider, ColliderSet } from '@dimforge/rapier3d-compat'
import { create } from 'zustand'
import { useGuidanceStore } from '../game/state/guidanceStore'
import { usePlayerStore } from '../game/state/playerStore'
import { bodyRuntime } from '../scene/player/bodyRuntime'

export interface DebugViewFlags {
  colliders: boolean
  stats: boolean
  position: boolean
}

export interface DebugReadout {
  fps: number
  /** renderer.info.render.calls as of the last frame; null until a renderer has been seen. */
  drawCalls: number | null
  feet: [number, number, number] | null
  objectiveRule: number | null
  objectiveText: string
}

export const useDebugViewStore = create<DebugViewFlags>(() => ({
  colliders: false,
  stats: false,
  position: false,
}))

export const useDebugReadout = create<DebugReadout>(() => ({
  fps: 0,
  drawCalls: null,
  feet: null,
  objectiveRule: null,
  objectiveText: '',
}))

export const SOLID_COLOR = 0xe8913a
export const SENSOR_COLOR = 0x6fe0ff
const READOUT_MS = 250
const REBUILD_MS = 500
const CIRCLE_SEGMENTS = 16
/** The capsule centre is this far above the feet (see FirstPersonController). */
const CAPSULE_CENTRE_Y = 0.85

type Pts = number[]

const _centre = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

const CORNERS: readonly (readonly [number, number, number])[] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
]
const EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
]

function pushSegment(out: Pts, a: THREE.Vector3, b: THREE.Vector3): void {
  out.push(a.x, a.y, a.z, b.x, b.y, b.z)
}

/** Oriented box about the collider's centre; `local` is an offset in the collider's own frame. */
function pushBox(out: Pts, half: THREE.Vector3, local?: THREE.Vector3): void {
  const world = CORNERS.map(([x, y, z]) =>
    new THREE.Vector3(x * half.x + (local?.x ?? 0), y * half.y + (local?.y ?? 0), z * half.z + (local?.z ?? 0))
      .applyQuaternion(_quat)
      .add(_centre),
  )
  for (const [i, j] of EDGES) pushSegment(out, world[i], world[j])
}

function pushCircles(out: Pts, radius: number): void {
  for (let axis = 0; axis < 3; axis++) {
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const t0 = (i / CIRCLE_SEGMENTS) * Math.PI * 2
      const t1 = ((i + 1) / CIRCLE_SEGMENTS) * Math.PI * 2
      const p = (t: number): [number, number, number] => {
        const c = Math.cos(t) * radius
        const s = Math.sin(t) * radius
        return axis === 0 ? [0, c, s] : axis === 1 ? [c, 0, s] : [c, s, 0]
      }
      _a.set(...p(t0)).applyQuaternion(_quat).add(_centre)
      _b.set(...p(t1)).applyQuaternion(_quat).add(_centre)
      pushSegment(out, _a, _b)
    }
  }
}

interface ShapeLike {
  halfExtents?: { x: number; y: number; z: number }
  radius?: number
  halfHeight?: number
  vertices?: ArrayLike<number>
}

/** Draws one collider as lines: exact for cuboids and balls, a bounding box for the rest. */
function pushCollider(out: Pts, c: Collider): void {
  const shape = c.shape as unknown as ShapeLike | undefined
  if (!shape) return
  const t = c.translation()
  const r = c.rotation()
  _centre.set(t.x, t.y, t.z)
  _quat.set(r.x, r.y, r.z, r.w)
  if (shape.halfExtents) {
    pushBox(out, new THREE.Vector3(shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z))
  } else if (shape.halfHeight !== undefined && shape.radius !== undefined) {
    // Capsule and cylinder: a box of the same extents along the collider's Y axis.
    pushBox(out, new THREE.Vector3(shape.radius, shape.halfHeight + shape.radius, shape.radius))
  } else if (shape.radius !== undefined) {
    pushCircles(out, shape.radius)
  } else if (shape.vertices && shape.vertices.length >= 3) {
    const v = shape.vertices
    const min = new THREE.Vector3(Infinity, Infinity, Infinity)
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    for (let i = 0; i + 2 < v.length; i += 3) {
      min.min(_a.set(v[i], v[i + 1], v[i + 2]))
      max.max(_a)
    }
    const half = max.clone().sub(min).multiplyScalar(0.5)
    pushBox(out, half, min.clone().add(half))
  }
}

/** The collider set the player body lives in, i.e. the whole physics world's colliders. */
function colliderSetOf(): ColliderSet | null {
  const body = bodyRuntime.body
  if (!body || body.numColliders() === 0) return null
  // `colliderSet` is private in the typings but is a plain field at runtime.
  return (body.collider(0) as unknown as { colliderSet?: ColliderSet }).colliderSet ?? null
}

/** Splits every collider into solid and sensor line lists. Exported for the sake of tests. */
export function collectColliderLines(set: ColliderSet): { solid: Pts; sensor: Pts } {
  const solid: Pts = []
  const sensor: Pts = []
  set.forEach((c) => pushCollider(c.isSensor() ? sensor : solid, c))
  return { solid, sensor }
}

function lines(color: number): THREE.LineSegments {
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, fog: false })
  const obj = new THREE.LineSegments(new THREE.BufferGeometry(), mat)
  obj.frustumCulled = false
  obj.renderOrder = 999
  return obj
}

function setPoints(obj: THREE.LineSegments, pts: Pts): void {
  obj.geometry.dispose()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  obj.geometry = g
}

/**
 * Starts the debug-view loop. It is cheap while every view is off. Returns the stopper, which
 * also removes anything it added to the scene.
 */
export function startDebugViews(): () => void {
  const group = new THREE.Group()
  group.name = 'dev-debug-views'
  const solid = lines(SOLID_COLOR)
  const sensor = lines(SENSOR_COLOR)
  group.add(solid, sensor)

  // A zero-length line whose onBeforeRender hands us the renderer, for the draw-call count.
  const probeGeo = new THREE.BufferGeometry()
  probeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
  const probe = new THREE.LineSegments(
    probeGeo,
    new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  )
  probe.frustumCulled = false
  let renderer: THREE.WebGLRenderer | null = null
  probe.onBeforeRender = (r) => {
    renderer = r
  }
  group.add(probe)

  let host: THREE.Scene | null = null
  let raf = 0
  let frames = 0
  let readoutAt = performance.now()
  let rebuiltAt = -Infinity

  const attach = (): void => {
    const scene = bodyRuntime.scene
    if (scene === host) return
    host?.remove(group)
    host = scene
    host?.add(group)
    rebuiltAt = -Infinity
  }

  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick)
    frames++
    attach()
    const flags = useDebugViewStore.getState()

    const showColliders = flags.colliders && host !== null
    solid.visible = showColliders
    sensor.visible = showColliders
    if (showColliders && now - rebuiltAt >= REBUILD_MS) {
      rebuiltAt = now
      const set = colliderSetOf()
      if (set) {
        const l = collectColliderLines(set)
        setPoints(solid, l.solid)
        setPoints(sensor, l.sensor)
      }
    }

    if (now - readoutAt < READOUT_MS) return
    const seconds = (now - readoutAt) / 1000
    readoutAt = now
    const fps = Math.round(frames / seconds)
    frames = 0
    if (!flags.stats && !flags.position) return
    const body = bodyRuntime.body
    const t = body?.translation()
    const stored = usePlayerStore.getState().position
    const o = useGuidanceStore.getState().objective
    useDebugReadout.setState({
      fps,
      drawCalls: renderer ? (renderer as THREE.WebGLRenderer).info.render.calls : null,
      feet: t ? [t.x, t.y - CAPSULE_CENTRE_Y, t.z] : [stored[0], stored[1], stored[2]],
      objectiveRule: o?.rule ?? null,
      objectiveText: o?.main ?? '',
    })
  }
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    host?.remove(group)
    for (const l of [solid, sensor, probe]) {
      l.geometry.dispose()
      ;(l.material as THREE.Material).dispose()
    }
  }
}
