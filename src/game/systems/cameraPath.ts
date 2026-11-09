// Uniform Catmull-Rom sampling over data-defined control points. Pure: no three.js.

import type { Vec3 } from '../../data/cemeteryLayout'

const ZERO: Vec3 = [0, 0, 0]

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/** Position on the path at `u` (clamped to 0..1). End points are duplicated so the curve starts and ends on them. */
export const samplePath = (points: readonly Vec3[], u: number): Vec3 => {
  const n = points.length
  if (n === 0) return ZERO
  if (n === 1) return points[0]
  const c = Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0
  const scaled = c * (n - 1)
  const i = Math.min(n - 2, Math.floor(scaled))
  const t = scaled - i
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[Math.min(n - 1, i + 2)]
  return [
    catmull(p0[0], p1[0], p2[0], p3[0], t),
    catmull(p0[1], p1[1], p2[1], p3[1], t),
    catmull(p0[2], p1[2], p2[2], p3[2], t),
  ]
}
