// Spec 09, F11: a day-time clue tells the player the Child's Locket only shows after dark.
import { describe, expect, it } from 'vitest'
import { CLUE_MAP } from './clues'
import { SCARE_ZONES } from './scares'
import { CLUE_SPOTS } from './tombstones'
import { FIXED_SPAWNS } from './zones'

const spot = CLUE_SPOTS.find((s) => s.clueId === 'clue-west-hill-glint')!
const locket = FIXED_SPAWNS.find((f) => f.item === 'childs-locket')!

describe('west hill clue', () => {
  it('exists, needs no item and says the find is night-only', () => {
    const clue = CLUE_MAP['clue-west-hill-glint']
    expect(clue.zone).toBe('grounds')
    expect(clue.requires).toBeUndefined()
    expect(clue.text).toMatch(/west hill/i)
    expect(clue.text).toMatch(/after dark/i)
    expect(locket.nightOnly).toBe(true)
  })

  it('is placed outside every scare zone and within 10 m of the locket', () => {
    const [x, , z] = spot.position
    for (const zone of SCARE_ZONES) {
      const { min, max } = zone.bounds
      const inside = x > min[0] && x < max[0] && z > min[2] && z < max[2]
      expect(inside, zone.id).toBe(false)
    }
    expect(Math.hypot(x - locket.position[0], z - locket.position[2])).toBeLessThan(10)
  })
})
