// Helpers for props built in code: bake a transform into a geometry, merge many parts into one
// mesh (one draw call), and turn a side profile into a lathe. Rendering only.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type V3 = readonly [number, number, number]

/** Bake a position, rotation and scale into a geometry, ready to merge. */
export function place(g: THREE.BufferGeometry, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s),
  )
  return g.applyMatrix4(m)
}

/** Merge parts into one geometry and dispose of the parts. Parts without an index get one first. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(
    parts.map((p) => (p.index ? p : indexed(p))),
    false,
  )
  for (const p of parts) p.dispose()
  return g ?? new THREE.BufferGeometry()
}

/** A lathe from [radius, height] pairs, bottom to top. */
export function lathe(pts: readonly (readonly [number, number])[], seg = 24): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  )
}

/** A flat outline extruded upwards (the outline is drawn in X/Z, the depth goes up Y). */
export function slab(outline: readonly (readonly [number, number])[], depth: number, bevel = 0): THREE.BufferGeometry {
  const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  })
  g.rotateX(-Math.PI / 2)
  return g
}

/** Give a non-indexed geometry a trivial index (0, 1, 2, ...), so it can merge with indexed parts. */
export function indexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  g.setIndex(Array.from({ length: n }, (_, i) => i))
  return g
}

/** Build once per page, however many components mount. */
export function once<T>(build: () => T): () => T {
  let v: T | null = null
  return () => (v ??= build())
}
