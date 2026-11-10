import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DAY1_HUT_MIN_CLOTH } from '../../data/balance'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../../data/zones'
import { createRng } from '../rng'
import {
  availableFixedSpawns,
  collectFixedSpawn,
  createSpawnWorld,
  dayOneSpawns,
  HUT_SHELF_ID,
  respawnForDay,
  takeMaterial,
} from './spawns'

describe('respawnForDay', () => {
  it('refills every material spawn point', () => {
    const w = respawnForDay(createSpawnWorld(), createRng(7))
    for (const p of SPAWN_POINTS.filter((q) => q.lootTable !== 'grave-dig')) {
      expect(w.materials[p.id].length).toBeGreaterThan(0)
    }
  })
  it('leaves graves empty until they are dug', () => {
    const w = respawnForDay(createSpawnWorld(), createRng(7))
    for (const p of SPAWN_POINTS.filter((q) => q.lootTable === 'grave-dig')) {
      expect(w.materials[p.id]).toEqual([])
    }
  })

  it('refills points emptied the previous day', () => {
    let w = respawnForDay(createSpawnWorld(), createRng(7))
    w = takeMaterial(w, 'hut-shelf', 0)
    expect(w.materials['hut-shelf']).toHaveLength(0)
    w = respawnForDay(w, createRng(8))
    expect(w.materials['hut-shelf'].length).toBeGreaterThan(0)
  })
})

describe('once-only fixed spawns', () => {
  it('keys, relics and pages do not return after collection or a new day', () => {
    let w = createSpawnWorld()
    w = collectFixedSpawn(w, 'fx-crypt-key', 'day')
    expect(availableFixedSpawns(w, 'day').some((s) => s.id === 'fx-crypt-key')).toBe(false)
    w = respawnForDay(w, createRng(3))
    expect(availableFixedSpawns(w, 'day').some((s) => s.id === 'fx-crypt-key')).toBe(false)
  })

  it('cannot be collected twice', () => {
    const w = collectFixedSpawn(createSpawnWorld(), 'fx-page-1', 'day')
    expect(collectFixedSpawn(w, 'fx-page-1', 'day')).toBe(w)
  })
})

describe("Child's Locket", () => {
  const visible = (phase: 'day' | 'dusk' | 'night' | 'dawn') =>
    availableFixedSpawns(createSpawnWorld(), phase).some((s) => s.id === 'fx-locket')

  it('is only visible at night', () => {
    expect(FIXED_SPAWNS.find((s) => s.id === 'fx-locket')?.nightOnly).toBe(true)
    expect(visible('day')).toBe(false)
    expect(visible('dusk')).toBe(false)
    expect(visible('dawn')).toBe(false)
    expect(visible('night')).toBe(true)
  })

  it('cannot be collected outside night', () => {
    const w = createSpawnWorld()
    expect(collectFixedSpawn(w, 'fx-locket', 'day')).toBe(w)
    expect(collectFixedSpawn(w, 'fx-locket', 'night').collectedFixed).toContain('fx-locket')
  })
})

describe('dayOneSpawns (spec 09, F1)', () => {
  it('property: the hut shelf always holds cloth on day 1, whatever the seed', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const shelf = dayOneSpawns(createRng(seed)).materials[HUT_SHELF_ID]
        const cloth = shelf.filter((s) => s.item === 'cloth').reduce((n, s) => n + s.qty, 0)
        expect(cloth).toBeGreaterThanOrEqual(DAY1_HUT_MIN_CLOTH)
      }),
    )
  })

  it('places the day-1 path oil, which always holds lamp oil', () => {
    const oil = dayOneSpawns(createRng(1891)).materials['grounds-path-oil']
    expect(oil).toEqual([{ item: 'lamp-oil', qty: 1 }])
  })
})
