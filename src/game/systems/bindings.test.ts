import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { rebind } from './bindings'

const actionArb = fc.constantFrom('Reload', 'Kick', 'Dodge', 'HeavyAttack', 'Aim', 'Interact', 'Sprint')
const keyArb = fc.constantFrom('KeyR', 'KeyQ', 'KeyC', 'KeyV', 'KeyE', 'Mouse2', 'ShiftLeft', 'Escape', 'KeyZ')
const bindingsArb = fc.dictionary(actionArb, keyArb)

describe('rebind', () => {
  it('rejects a key used by another action, naming it', () => {
    const r = rebind({ Reload: 'KeyR', Kick: 'KeyQ' }, 'Kick', 'KeyR')
    expect(r).toMatchObject({ ok: false, reason: 'conflict', conflictingAction: 'Reload' })
  })

  it('rejects Escape', () => {
    expect(rebind({ Reload: 'KeyR' }, 'Reload', 'Escape').ok).toBe(false)
  })

  it('allows rebinding an action to its own key', () => {
    expect(rebind({ Reload: 'KeyR' }, 'Reload', 'KeyR').ok).toBe(true)
  })

  // Feature: 07-combat-and-enemies, Property 32: Rebinding rejects conflicts and changes nothing
  // **Validates: Requirements 21.8, 21.9**
  it('Property 32: succeeds iff no other action uses the key; conflicts change nothing', () => {
    fc.assert(
      fc.property(bindingsArb, actionArb, keyArb, (bindings, action, key) => {
        const before = { ...bindings }
        const conflict = Object.entries(bindings).find(([a, k]) => a !== action && k === key)
        const r = rebind(bindings, action, key)
        expect(bindings).toEqual(before)
        if (key === 'Escape') {
          expect(r.ok).toBe(false)
          expect(r.bindings).toEqual(before)
        } else if (conflict) {
          expect(r.ok).toBe(false)
          if (!r.ok && r.reason === 'conflict') expect(r.conflictingAction).toBe(conflict[0])
          expect(r.bindings).toEqual(before)
        } else {
          expect(r.ok).toBe(true)
          expect(r.bindings).toEqual({ ...before, [action]: key })
        }
      }),
      { numRuns: 200 },
    )
  })
})
