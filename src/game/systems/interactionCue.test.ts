import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CUE_FADE_S, INTERACTABLE_KINDS, INTERACTABLES } from '../../data/interactables'
import { fadeAlpha, interactionCue, type CueFacts } from './interactionCue'

const settings = { keyCode: 'KeyE', flashingLights: true }

const factsArb: fc.Arbitrary<CueFacts> = fc.record({
  usedUp: fc.boolean(),
  need: fc.option(fc.constantFrom('a shovel', 'the Rusted Crypt Key', 'satchel space'), { nil: undefined }),
  idle: fc.boolean(),
})
const kindArb = fc.constantFrom(...INTERACTABLE_KINDS)

describe('interactionCue', () => {
  it('shows an action prompt with the key when the action can happen', () => {
    expect(interactionCue('material-pickup', { usedUp: false }, settings).prompt).toBe('E: Take')
    expect(interactionCue('workbench', { usedUp: false }, settings).prompt).toBe('E: Open')
    expect(interactionCue('tombstone', { usedUp: false }, settings)).toMatchObject({
      actionable: true,
      pulse: true,
    })
  })

  it('uses the current Interact binding in the prompt', () => {
    const cue = interactionCue('weapon-pickup', { usedUp: false }, { ...settings, keyCode: 'KeyF' })
    expect(cue.prompt).toBe('F: Take')
  })

  it('holds E only for digging, and only when digging can start', () => {
    expect(interactionCue('grave-mound', { usedUp: false }, settings).prompt).toBe('Hold E: Dig')
    const noShovel = interactionCue('grave-mound', { usedUp: false, need: 'a shovel in hand: press 1' }, settings)
    expect(noShovel.prompt).toBe('Needs a shovel in hand: press 1')
    expect(noShovel.actionable).toBe(false)
  })

  it('names the need for blocked-but-fixable interactables', () => {
    const cases: Array<[Parameters<typeof interactionCue>[0], string, string]> = [
      ['gate', 'the Rusted Crypt Key', 'Locked: needs the Rusted Crypt Key'],
      ['material-pickup', 'satchel space', 'Satchel full'],
      ['weapon-pickup', 'satchel space', 'Satchel full'],
      ['barricade-door', 'Need 2 iron nails', 'Need 2 iron nails'],
      ['clue-spot', 'the parish ledger', 'Needs the parish ledger to make sense of this'],
    ]
    for (const [kind, need, text] of cases) {
      const cue = interactionCue(kind, { usedUp: false, need }, settings)
      expect(cue.prompt, kind).toBe(text)
      expect(cue.targetable).toBe(true)
    }
  })

  it('used up means not targetable and no cue, with a 0.5 s fade', () => {
    for (const kind of INTERACTABLE_KINDS) {
      const cue = interactionCue(kind, { usedUp: true }, settings)
      expect(cue, kind).toMatchObject({ targetable: false, actionable: false, prompt: null, pulse: false })
      expect(cue.fade?.durationS).toBe(CUE_FADE_S)
      expect(CUE_FADE_S).toBe(0.5)
    }
  })

  it('a repeatable with nothing new keeps its prompt but stops pulsing', () => {
    const stone = interactionCue('tombstone', { usedUp: false, idle: true }, settings)
    expect(stone).toMatchObject({ targetable: true, actionable: true, prompt: 'E: Read', pulse: false })
    const door = interactionCue('barricade-door', { usedUp: false, idle: true }, settings)
    expect(door).toMatchObject({ targetable: true, actionable: false, prompt: 'Door is full', pulse: false })
  })

  it('property: never "Hold" or "Press" or a key label unless actionable', () => {
    fc.assert(
      fc.property(kindArb, factsArb, fc.boolean(), (kind, facts, flashingLights) => {
        const cue = interactionCue(kind, facts, { keyCode: 'KeyE', flashingLights })
        if (cue.actionable) return
        expect(cue.prompt ?? '').not.toMatch(/\bHold\b|\bPress\b|^E:/)
      }),
    )
  })

  it('property: used up is never targetable, anything else always is', () => {
    fc.assert(
      fc.property(kindArb, factsArb, (kind, facts) => {
        const cue = interactionCue(kind, facts, settings)
        expect(cue.targetable).toBe(!facts.usedUp)
        expect(cue.fade !== null).toBe(facts.usedUp)
        if (facts.usedUp) expect(cue.prompt).toBeNull()
        else expect(cue.prompt).toBeTruthy()
      }),
    )
  })

  it('property: a fade is steady exactly when Flashing lights is off', () => {
    fc.assert(
      fc.property(kindArb, fc.boolean(), (kind, flashingLights) => {
        const cue = interactionCue(kind, { usedUp: true }, { keyCode: 'KeyE', flashingLights })
        expect(cue.fade?.steady).toBe(!flashingLights)
      }),
    )
  })

  it('every kind with a hold prompt is a dig', () => {
    expect(INTERACTABLE_KINDS.filter((k) => INTERACTABLES[k].hold)).toEqual(['grave-mound'])
  })
})

describe('fadeAlpha', () => {
  it('runs 1 to 0 over the duration', () => {
    expect(fadeAlpha(0, 0.5, true)).toBe(1)
    expect(fadeAlpha(0.25, 0.5, true)).toBeCloseTo(0.5)
    expect(fadeAlpha(0.5, 0.5, true)).toBe(0)
    expect(fadeAlpha(3, 0.5, false)).toBe(0)
  })

  it('steady fade (Flashing lights off) is linear and never rises', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 0.6, noNaN: true }), { minLength: 2, maxLength: 40 }),
        (times) => {
          const sorted = [...times].sort((a, b) => a - b)
          const alphas = sorted.map((t) => fadeAlpha(t, 0.5, true))
          for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeLessThanOrEqual(alphas[i - 1] + 1e-12)
          for (const [i, t] of sorted.entries()) {
            expect(alphas[i]).toBeCloseTo(Math.max(0, 1 - t / 0.5), 9)
          }
        },
      ),
    )
  })

  it('the flicker variant stays within 0 and 1', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
        const a = fadeAlpha(t, 0.5, false)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThanOrEqual(1)
      }),
    )
  })
})
