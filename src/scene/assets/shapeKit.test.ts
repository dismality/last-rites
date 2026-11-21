import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { merge, place, slab } from './shapeKit'

describe('shapeKit', () => {
  it('merges indexed and non-indexed parts into one geometry', () => {
    const parts = [
      new RoundedBoxGeometry(0.1, 0.1, 0.1, 2, 0.02),
      new THREE.SphereGeometry(0.05, 8, 6),
      slab(
        [
          [0, 0],
          [0.1, 0],
          [0, 0.1],
        ],
        0.01,
      ),
    ]
    const total = parts.reduce((n, p) => n + p.getAttribute('position').count, 0)
    const g = merge(parts)
    expect(g.getAttribute('position').count).toBe(total)
    expect(g.index).not.toBeNull()
  })

  it('bakes a placement into the vertices', () => {
    const g = place(new THREE.BoxGeometry(1, 1, 1), [5, 0, 0])
    g.computeBoundingBox()
    expect(g.boundingBox?.min.x).toBeCloseTo(4.5)
  })

  it('extrudes a slab upwards from its outline', () => {
    const g = slab(
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      0.2,
    )
    g.computeBoundingBox()
    expect(g.boundingBox?.min.y).toBeCloseTo(0)
    expect(g.boundingBox?.max.y).toBeCloseTo(0.2)
    expect(g.boundingBox?.max.z).toBeCloseTo(1)
  })
})
