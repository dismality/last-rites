import { describe, expect, it } from 'vitest'
import { HELD_WEAPON_IDS, MIN_CLEARANCE_M, nearestClearanceM } from './viewmodelWeaponGeometry'

describe('held weapon placement', () => {
  it('keeps every held model well in front of the viewmodel camera, so none clips it', () => {
    for (const id of HELD_WEAPON_IDS) {
      const clearance = nearestClearanceM(id)
      expect(clearance, `${id} has a size`).not.toBeNull()
      expect(clearance!, `${id} clearance`).toBeGreaterThanOrEqual(MIN_CLEARANCE_M)
    }
  })
})
