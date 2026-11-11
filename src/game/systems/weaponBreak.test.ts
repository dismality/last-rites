import { afterEach, describe, expect, it } from 'vitest'
import { subscribeToType } from '../events'
import { emitCombatSound } from '../state/combatSounds'
import { crossedCracking, nextSlotAfterBreak } from './weaponBreak'

describe('crossedCracking', () => {
  it('fires exactly once while a weapon wears from full to broken', () => {
    let left = 30
    let warnings = 0
    while (left > 0) {
      const before = left
      left -= 1
      if (crossedCracking(before, left)) warnings += 1
    }
    expect(warnings).toBe(1)
  })

  it('fires on the hit that leaves 5, not on later hits or a loaded save', () => {
    expect(crossedCracking(6, 5)).toBe(true)
    expect(crossedCracking(5, 4)).toBe(false)
    expect(crossedCracking(3, 2)).toBe(false)
    expect(crossedCracking(undefined, 5)).toBe(false)
  })
})

describe('cracking caption', () => {
  const stops: (() => void)[] = []
  afterEach(() => stops.splice(0).forEach((s) => s()))

  it('shows "<weapon> is cracking" with no audio listener registered', () => {
    const texts: string[] = []
    stops.push(subscribeToType('subtitleShown', (e) => texts.push(e.text)))
    emitCombatSound('weapon-crack', undefined, undefined, 'Bone Club')
    expect(texts).toEqual(['Bone Club is cracking'])
  })
})

describe('nextSlotAfterBreak', () => {
  it('prefers the next melee weapon over a nearer non-melee slot', () => {
    // Slot 0 just broke; slot 1 is a bandage, slot 2 the axe.
    expect(nextSlotAfterBreak([null, 'bandage', 'wood-axe', 'rusty-shovel'], 0)).toBe(2)
  })

  it('wraps around the hotbar', () => {
    expect(nextSlotAfterBreak(['rusty-shovel', 'bandage', null, null], 3)).toBe(0)
  })

  it('falls back to the next filled slot when no melee weapon is left', () => {
    expect(nextSlotAfterBreak([null, null, 'bandage', 'lantern-trap'], 1)).toBe(2)
  })

  it('returns null when the hotbar is empty', () => {
    expect(nextSlotAfterBreak([null, null, null, null], 2)).toBeNull()
  })
})
