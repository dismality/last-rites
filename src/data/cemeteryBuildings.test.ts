import { describe, expect, it } from 'vitest'
import {
  AVENUE_CRYPT_SIZE,
  BENCH_Z,
  CRANE_CRYPT,
  HUT,
  MAUSOLEUM_ROW,
  PLAYABLE_BOUNDS,
  avenueCrypts,
  avenueFarZ,
  craneCryptPosition,
  generateTrees,
} from './cemeteryLayout'
import { WORLD_MODEL_IDS } from './assets'
import { FIXED_SPAWNS, SPAWN_POINTS } from './zones'

describe('Crane crypt', () => {
  it('sits flush against the avenue end, inside the playable bounds, on ground', () => {
    const [x, , z] = craneCryptPosition()
    const avenueEnd = MAUSOLEUM_ROW.entranceZ + MAUSOLEUM_ROW.dir * MAUSOLEUM_ROW.length
    // Front face touches the end of the path.
    expect(z + CRANE_CRYPT.halfZ).toBeCloseTo(avenueEnd, 6)
    expect(Math.abs(z) + CRANE_CRYPT.halfZ).toBeLessThanOrEqual(PLAYABLE_BOUNDS.halfZ)
    expect(x).toBe(MAUSOLEUM_ROW.centerX)
    // The floor reaches the crypt's back edge.
    expect(avenueFarZ()).toBeCloseTo(z - CRANE_CRYPT.halfZ, 6)
  })
})

describe('Mausoleum Row avenue', () => {
  const c = MAUSOLEUM_ROW
  it('is open and lined with crypts on both sides, clear of the path', () => {
    expect(c.open).toBe(true)
    const crypts = avenueCrypts()
    expect(crypts.some((k) => k.position[0] < c.centerX)).toBe(true)
    expect(crypts.some((k) => k.position[0] > c.centerX)).toBe(true)
    for (const k of crypts) {
      const nearEdge = Math.abs(k.position[0] - c.centerX) - AVENUE_CRYPT_SIZE[k.model].depth / 2
      expect(nearEdge).toBeGreaterThan(c.width / 2)
      // Between the gate and the Crane crypt.
      expect(k.position[2]).toBeLessThan(c.entranceZ)
      expect(k.position[2]).toBeGreaterThan(c.entranceZ - c.length)
    }
  })
})

describe('keeper hut', () => {
  it('holds the spawn point and the workbench, and its supplies sit inside it', () => {
    expect(BENCH_Z).toBeGreaterThan(-HUT.halfZ)
    expect(BENCH_Z).toBeLessThan(0)
    const inside = (p: readonly [number, number, number]) =>
      Math.abs(p[0]) < HUT.halfX && Math.abs(p[2]) < HUT.halfZ
    expect(inside(SPAWN_POINTS.find((p) => p.id === 'hut-shelf')!.position)).toBe(true)
    expect(inside(FIXED_SPAWNS.find((p) => p.id === 'fx-page-1')!.position)).toBe(true)
  })
})

describe('trees', () => {
  it('never use the autumn pine, and only models that are loaded', () => {
    const kinds = new Set(generateTrees().map((t) => t.kind))
    expect(kinds.has('pine-fall-crooked' as never)).toBe(false)
    expect(WORLD_MODEL_IDS).not.toContain('pine-fall-crooked')
    for (const k of kinds) expect(WORLD_MODEL_IDS).toContain(k)
  })
})
