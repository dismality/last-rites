// Task 12.4: what blocks the player must match what they can see.
// The footprint table in src/data/colliderFootprints.ts is checked against the real .glb files,
// every headstone, tombstone, tree and lamp collider is checked against its model's footprint, and
// the source is scanned so no collider appears without an owner in this list.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { HEADSTONE_KINDS, LAMP_POSTS } from '../src/data/cemeteryLayout'
import {
  HEADSTONE_FOOTPRINTS,
  LAMP_FOOTPRINT,
  headstoneCollider,
  headstoneScale,
  lampCollider,
} from '../src/data/colliderFootprints'
import { TOMBSTONES } from '../src/data/tombstones'
import { glbBounds } from './helpers/glbBounds'

// Files are read as raw text through Vite's glob import (the tests have no Node typings).
const models = import.meta.glob('../public/assets/models/world/*.glb', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>
const bounds = (id: string) => {
  const raw = models[`../public/assets/models/world/${id}.glb`]
  if (!raw) throw new Error(`no model ${id}`)
  return glbBounds(raw)
}
const sources = import.meta.glob('../src/scene/**/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>
const PREFIX = '../src/scene/'
/** 3 mm: the table is rounded to the millimetre. */
const MM = 0.003

describe('footprint table vs the real models', () => {
  it.each(HEADSTONE_KINDS)('%s: table equals the GLB bounds', (kind) => {
    const b = bounds(kind)
    const f = HEADSTONE_FOOTPRINTS[kind]
    expect(f.minX).toBeCloseTo(b.min[0], 2)
    expect(f.maxX).toBeCloseTo(b.max[0], 2)
    expect(f.minZ).toBeCloseTo(b.min[2], 2)
    expect(f.maxZ).toBeCloseTo(b.max[2], 2)
    expect(f.height).toBeCloseTo(b.max[1], 2)
    expect(Math.abs(f.minX - b.min[0])).toBeLessThan(MM)
    expect(Math.abs(f.maxZ - b.max[2])).toBeLessThan(MM)
  })

  it('pins the five stones (cross is the tallest, wide the widest, broken a low stump)', () => {
    expect(HEADSTONE_FOOTPRINTS['gravestone-cross'].height).toBe(1.372)
    expect(HEADSTONE_FOOTPRINTS['gravestone-wide'].maxX - HEADSTONE_FOOTPRINTS['gravestone-wide'].minX).toBeCloseTo(
      1.276,
      3,
    )
    expect(HEADSTONE_FOOTPRINTS['gravestone-broken'].height).toBe(0.512)
  })

  it('lamp post: plinth radius and height match the model', () => {
    const b = bounds('lightpost-single')
    expect(LAMP_FOOTPRINT.height).toBeCloseTo(b.max[1], 2)
    expect(LAMP_FOOTPRINT.radius).toBeCloseTo((b.max[0] - b.min[0]) / 2, 2)
  })
})

describe('colliders match the visible models', () => {
  it('the old one-size 0.6 x 0.2 m box is gone: the wide stone is wider, the cross deeper', () => {
    const wide = headstoneCollider('gravestone-wide', 1, [0, 0, 0], 0)
    const cross = headstoneCollider('gravestone-cross', 1, [0, 0, 0], 0)
    expect(wide.half[0] * 2).toBeGreaterThan(1.2)
    expect(cross.half[2] * 2).toBeGreaterThan(0.45)
  })

  it('tombstones (Marsh family stone included) use their own model, not the generic box', () => {
    const marsh = TOMBSTONES.find((t) => t.id === 'marsh')!
    const c = headstoneCollider(marsh.model, headstoneScale(marsh.height), [0, 0, 0], 0)
    const f = HEADSTONE_FOOTPRINTS[marsh.model]
    expect(marsh.model).toBe('gravestone-wide')
    expect(c.half[0] * 2).toBeCloseTo((f.maxX - f.minX) * headstoneScale(marsh.height), 6)
    for (const t of TOMBSTONES) {
      const tc = headstoneCollider(t.model, headstoneScale(t.height), [0, 0, 0], 0)
      expect(tc.half[1] * 2).toBeCloseTo(HEADSTONE_FOOTPRINTS[t.model].height * headstoneScale(t.height), 6)
    }
  })

  it('every lamp has a cylinder that stands on its model', () => {
    for (const l of LAMP_POSTS) {
      const c = lampCollider(l.position)
      expect(c.radius).toBe(LAMP_FOOTPRINT.radius)
      expect(c.position[1] - c.halfHeight).toBeCloseTo(0, 6)
    }
  })

  it('property: the box is exactly the scaled, turned model bounds for any stone, scale and yaw', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HEADSTONE_KINDS),
        fc.double({ min: 0.7, max: 1.3, noNaN: true }),
        fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.double({ min: -30, max: 30, noNaN: true }),
        (kind, s, yaw, x, z) => {
          const f = HEADSTONE_FOOTPRINTS[kind]
          const c = headstoneCollider(kind, s, [x, 0, z], yaw)
          // Map the model's four footprint corners into the world and into the box's own frame:
          // they must all lie on the box's edge (within a millimetre), i.e. the box IS the footprint.
          const corners: Array<[number, number]> = [
            [f.minX, f.minZ],
            [f.maxX, f.minZ],
            [f.minX, f.maxZ],
            [f.maxX, f.maxZ],
          ]
          for (const [mx, mz] of corners) {
            const wx = x + (mx * Math.cos(yaw) + mz * Math.sin(yaw)) * s
            const wz = z + (-mx * Math.sin(yaw) + mz * Math.cos(yaw)) * s
            const dx = wx - c.position[0]
            const dz = wz - c.position[2]
            const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw)
            const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw)
            expect(Math.abs(Math.abs(lx) - c.half[0])).toBeLessThan(1e-6)
            expect(Math.abs(Math.abs(lz) - c.half[2])).toBeLessThan(1e-6)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

})

describe('no collider without a visible owner', () => {
  const COLLIDER = /<(Cuboid|Cylinder|Ball|Capsule|Trimesh|ConvexHull|Hull)Collider\b/g

  // Files that may declare colliders, each with the visible thing (or reason) behind them.
  const OWNERS: Record<string, string> = {
    'world/Cemetery.tsx': 'lamp posts; walls, floors and boundary are Blocks',
    'world/GraveyardScene.tsx': 'graveyard.glb: one box per entry of graveyard-colliders.json',
    'world/Tombstones.tsx': 'tombstone models (footprint table)',
    'world/Gates.tsx': 'gate bars (collider removed when the gate opens)',
    'world/Hut.tsx': 'hut table',
    'world/buildingParts.tsx': 'Slab: a box that is both drawn and solid',
    'world/Workbench.tsx': 'bench model',
    'world/ChapelBuilding.tsx': 'uses Slab',
    'scares/ScareZoneVolumes.tsx': 'sensor volumes: the player must walk through them',
    'player/FirstPersonController.tsx': 'the player capsule',
    'world/ThrownItems.tsx': 'thrown flask/bomb ball',
  }

  it('only known files declare colliders', () => {
    const found = Object.entries(sources)
      .filter(([, code]) => (code.match(COLLIDER) ?? []).length > 0)
      .map(([f]) => f.slice(PREFIX.length))
      .sort()
    const unknown = found.filter((f) => !(f in OWNERS))
    expect(unknown).toEqual([])
  })

  it('walk-over dressing and staged props stay collider-free', () => {
    for (const f of ['scares/ScareProps.tsx', 'world/GraveMounds.tsx', 'world/MaterialPickups.tsx', 'world/Interactable.tsx']) {
      expect(sources[PREFIX + f], f).toBeDefined()
      expect(sources[PREFIX + f].match(COLLIDER) ?? []).toEqual([])
    }
  })

  it('scare-zone sensors never block the player: the controller excludes sensors', () => {
    const zones = sources[PREFIX + 'scares/ScareZoneVolumes.tsx']
    const controller = sources[PREFIX + 'player/FirstPersonController.tsx']
    expect(zones).toMatch(/\bsensor\b/)
    expect(controller).toMatch(/computeColliderMovement\([\s\S]*?QueryFilterFlags\.EXCLUDE_SENSORS/)
  })

  it('Cemetery and Tombstones no longer use the one-size headstone box', () => {
    for (const f of ['world/Cemetery.tsx', 'world/Tombstones.tsx']) {
      expect(sources[PREFIX + f]).not.toMatch(/HEADSTONE\.(width|depth)|pineColliderHalf|LAMP_COLLIDER/)
    }
  })
})
