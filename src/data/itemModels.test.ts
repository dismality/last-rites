import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ITEMS } from './items'
import {
  HELD_GRIPS,
  ITEM_MODEL_SIZE_MM,
  WEAPON_PICKUP_POSES,
  fitScale,
  groundPose,
  isHeldModelId,
} from './itemModels'
import { WEAPON_PICKUPS } from './weaponPickups'
import type { ItemId } from '../game/types'

// Paths only: the tests have no Node typings, so the file list comes from Vite's glob.
const files = new Set(Object.keys(import.meta.glob('../../public/assets/models/items/*.glb')))

describe('item models', () => {
  it('gives every item a model file that exists on disk', () => {
    for (const item of ITEMS) {
      expect(item.model, `${item.id} has a model`).toBeTruthy()
      expect(files.has(`../../public/${item.model}`), `${item.id} -> ${item.model}`).toBe(true)
    }
  })

  it('points the five journal pages at the one shared model', () => {
    const models = ITEMS.filter((i) => i.id.startsWith('journal-page-')).map((i) => i.model)
    expect(models).toHaveLength(5)
    expect(new Set(models)).toEqual(new Set(['assets/models/items/journal-page.glb']))
  })

  it('has a grip transform for every held weapon', () => {
    for (const item of ITEMS.filter((i) => i.kind === 'weapon')) {
      expect(isHeldModelId(item.id), `${item.id} has a grip`).toBe(
        // Thrown flasks and bombs are not held in the viewmodel yet; every other weapon is.
        item.id !== 'holy-water-flask' && item.id !== 'nail-bomb',
      )
    }
    for (const id of Object.keys(HELD_GRIPS)) {
      expect(ITEM_MODEL_SIZE_MM[id as ItemId], `${id} has a measured size`).toBeDefined()
    }
  })

  it('poses every weapon pickup', () => {
    for (const p of WEAPON_PICKUPS) expect(WEAPON_PICKUP_POSES[p.id]).toBeDefined()
  })

  it('rests every sized item on the ground with a positive lift, and fits to any edge limit', () => {
    const ids = Object.keys(ITEM_MODEL_SIZE_MM) as ItemId[]
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.double({ min: 0.05, max: 1, noNaN: true }), (id, edge) => {
        expect(groundPose(id).lift).toBeGreaterThan(0)
        const s = fitScale(id, edge)
        const longest = Math.max(...ITEM_MODEL_SIZE_MM[id]!) / 1000
        expect(longest * s).toBeLessThanOrEqual(edge + 1e-9)
      }),
    )
  })
})
