import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { GRIP_TABLE, type GripWeaponId } from '../../data/viewmodel'
import { GRIP_WEAPON_IDS, gripFor } from './gripClass'

describe('gripFor', () => {
  it('maps the named weapons', () => {
    expect(gripFor('revolver')).toBe('pistol')
    expect(gripFor('shotgun')).toBe('long')
    expect(gripFor('wood-axe')).toBe('haft')
  })

  // Feature: 11-horror-pass, Property 26: Grip class is total and matches the table
  // **Validates: Requirements 7.2**
  it('is total and matches the table for every weapon id', () => {
    fc.assert(
      fc.property(fc.constantFrom<GripWeaponId>(...GRIP_WEAPON_IDS), (id) => {
        const grip = gripFor(id)
        expect(['pistol', 'haft', 'long']).toContain(grip)
        expect(grip).toBe(GRIP_TABLE[id])
        if (id !== 'revolver' && id !== 'shotgun') expect(grip).toBe('haft')
      }),
      { numRuns: 100 },
    )
  })
})
