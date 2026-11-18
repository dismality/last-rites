import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LANTERN_HOOK_CAPTION } from '../../data/lanternLight'
import { VIEWMODEL_TIMING } from '../../data/viewmodel'
import {
  beginLanternAction,
  endLanternAction,
  equipWeapon,
  hookCaption,
  initialLanternHand,
  lanternAnchor,
  lanternLitByHand,
  stepLanternHand,
} from './lanternHand'

describe('lanternHand', () => {
  it('hooks on the shotgun and returns within 0.5 s of switching away', () => {
    let s = equipWeapon(initialLanternHand(), 'shotgun')
    expect(s.mode).toBe('belt')
    s = equipWeapon(s, 'wood-axe')
    s = stepLanternHand(s, 0.3)
    expect(s.mode).toBe('belt')
    s = stepLanternHand(s, 0.2)
    expect(s.mode).toBe('held')
  })

  it('goes on the strap during a throw and is caught 0.6 s after it ends', () => {
    let s = beginLanternAction(initialLanternHand())
    s = stepLanternHand(s, 5)
    expect(s.mode).toBe('strap')
    s = endLanternAction(s)
    s = stepLanternHand(s, 0.59)
    expect(s.mode).toBe('strap')
    s = stepLanternHand(s, 0.01)
    expect(s.mode).toBe('held')
  })

  it('asks for the caption once', () => {
    const first = hookCaption(false, 'held', 'belt')
    expect(first).toEqual({ text: LANTERN_HOOK_CAPTION, shown: true })
    expect(hookCaption(true, 'held', 'belt').text).toBeNull()
    expect(hookCaption(false, 'belt', 'belt').text).toBeNull()
  })

  // Feature: 11-horror-pass, Property 27: Lantern hand state machine
  // **Validates: Requirements 7.4, 7.5, 7.6, 7.8**
  it('keeps its invariants over any event sequence', () => {
    const weapon = fc.constantFrom('shotgun', 'revolver', 'wood-axe', 'rusty-shovel')
    const event = fc.oneof(
      fc.record({ k: fc.constant('equip' as const), w: weapon }),
      fc.record({ k: fc.constant('begin' as const) }),
      fc.record({ k: fc.constant('end' as const) }),
      fc.record({
        k: fc.constant('time' as const),
        dt: fc.double({ min: 0.001, max: 1, noNaN: true }),
      }),
    )
    fc.assert(
      fc.property(fc.array(event, { maxLength: 60 }), fc.boolean(), (events, shownStart) => {
        let s = initialLanternHand()
        let shown = shownStart
        let requests = 0
        let sinceActionEnd = Infinity
        let sinceLeftShotgun = Infinity
        let actionOpen = false
        for (const e of events) {
          const prev = s
          if (e.k === 'equip') s = equipWeapon(s, e.w)
          else if (e.k === 'begin') s = beginLanternAction(s)
          else if (e.k === 'end') s = endLanternAction(s)
          else s = stepLanternHand(s, e.dt)

          if (e.k === 'time') {
            sinceActionEnd += e.dt
            sinceLeftShotgun += e.dt
          }
          if (s.mode === 'strap' && s.acting) actionOpen = true
          if (e.k === 'end' && prev.mode === 'strap' && prev.acting) {
            actionOpen = false
            sinceActionEnd = 0
          }
          if (e.k === 'begin' && s.mode === 'strap') sinceActionEnd = -Infinity
          if (e.k === 'equip') {
            if (e.w === 'shotgun') sinceLeftShotgun = -Infinity
            else if (prev.shotgunEquipped) sinceLeftShotgun = 0
          }

          // Belt exactly while the shotgun is equipped, plus at most 0.5 s after leaving it.
          if (s.shotgunEquipped) expect(s.mode).toBe('belt')
          if (s.mode === 'belt' && !s.shotgunEquipped) {
            expect(sinceLeftShotgun).toBeLessThan(VIEWMODEL_TIMING.beltReturnS + 1e-9)
          }
          // Held again within 0.6 s of an action ending.
          if (s.mode === 'strap' && !actionOpen && sinceActionEnd >= 0) {
            expect(sinceActionEnd).toBeLessThan(VIEWMODEL_TIMING.strapCatchS + 1e-9)
          }
          expect(lanternAnchor(s.mode) === 'belt').toBe(s.mode === 'belt')
          expect(lanternLitByHand(s.mode)).toBe(true)

          const r = hookCaption(shown, prev.mode, s.mode)
          if (r.text !== null) requests++
          shown = r.shown
        }
        // A flag that started set requests nothing; otherwise at most one request.
        expect(requests).toBeLessThanOrEqual(shownStart ? 0 : 1)
      }),
      { numRuns: 200 },
    )
  })
})
