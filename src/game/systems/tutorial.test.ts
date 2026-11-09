import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { TUTORIAL_STEPS, TUTORIAL_WALK_TARGET_M, type TutorialStepId } from '../../data/tutorialSteps'
import { DEFAULT_SETTINGS } from './settings'
import {
  currentTutorialStep,
  formatPrompt,
  isWalkComplete,
  keyLabel,
  markActionDone,
  parseTutorial,
  serializeTutorial,
  tutorialPrompt,
  walkStep,
} from './tutorial'

const RUNS = { numRuns: 100 }
const stepId = fc.integer({ min: 1, max: 7 }) as fc.Arbitrary<TutorialStepId>
const doneSet = fc.uniqueArray(stepId).map((a) => new Set<TutorialStepId>(a))
const phases = fc.constantFrom('day', 'dusk', 'night', 'dawn') as fc.Arbitrary<
  'day' | 'dusk' | 'night' | 'dawn'
>
const bindingNames = [
  'MoveForward',
  'MoveLeft',
  'MoveBackward',
  'MoveRight',
  'Interact',
  'Satchel',
  'Hotbar1',
  'Hotbar4',
  'Journal',
]
const keyCode = fc.stringMatching(/^Key[A-Z]$/)
const bindingsArb = fc
  .tuple(...bindingNames.map(() => keyCode))
  .map((codes) => Object.fromEntries(bindingNames.map((n, i) => [n, codes[i]])))

describe('tutorial director', () => {
  it('starts at step 1 and ends at null', () => {
    expect(currentTutorialStep(new Set())).toBe(1)
    expect(currentTutorialStep(new Set([1, 2, 3, 4, 5, 6, 7]))).toBeNull()
  })

  it('keeps existing keyLabel behaviour for mouse buttons', () => {
    expect(keyLabel('KeyE')).toBe('E')
    expect(keyLabel('MouseLeft')).toBe('LMB')
  })

  it('formats the default move prompt', () => {
    const p = formatPrompt(TUTORIAL_STEPS[0].template, DEFAULT_SETTINGS.bindings)
    expect(p).toContain('W A S D to move')
  })

  // Feature: 06-clarity-and-hud, Property 16: Tutorial director invariant
  it('Property 16: current step is lowest not-done and advances when done', () => {
    // **Validates: Requirements 4.2, 4.3, 4.4, 4.10, 4.15**
    fc.assert(
      fc.property(doneSet, fc.array(fc.constantFrom(...TUTORIAL_STEPS.map((s) => s.action))), (start, actions) => {
        let done: ReadonlySet<TutorialStepId> = start
        for (const a of actions) {
          const before = currentTutorialStep(done)
          done = markActionDone(done, a)
          const cur = currentTutorialStep(done)
          if (cur !== null) {
            expect(done.has(cur)).toBe(false)
            for (let i = 1; i < cur; i++) expect(done.has(i as TutorialStepId)).toBe(true)
          } else {
            expect(done.size).toBe(7)
          }
          if (before !== null && TUTORIAL_STEPS[before - 1].action === a) {
            expect(cur === null || cur > before).toBe(true)
          }
        }
      }),
      RUNS,
    )
  })

  // Feature: 06-clarity-and-hud, Property 17: Walking completes the move step
  it('Property 17: walked distance is the sum of segments; complete iff >= 3 m', () => {
    // **Validates: Requirements 4.5**
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.double({ min: -50, max: 50, noNaN: true }), fc.double({ min: -50, max: 50, noNaN: true }))),
        (path) => {
          let walked = 0
          let expected = 0
          let prev: [number, number] | null = null
          for (const p of path) {
            walked = walkStep(walked, prev, p)
            if (prev) expected += Math.hypot(p[0] - prev[0], p[1] - prev[1])
            prev = p
          }
          expect(walked).toBeCloseTo(expected, 6)
          expect(isWalkComplete(walked)).toBe(walked >= TUTORIAL_WALK_TARGET_M)
        },
      ),
      RUNS,
    )
  })

  // Feature: 06-clarity-and-hud, Property 18: Prompts follow bindings, setting and phase
  it('Property 18: prompt uses bound keys, and is null when off or outside night-1 day', () => {
    // **Validates: Requirements 4.6, 4.7, 4.9**
    fc.assert(
      fc.property(doneSet, bindingsArb, keyCode, phases, fc.integer({ min: 1, max: 5 }), (done, b, other, phase, night) => {
        const base = { done, enabled: true, phase: 'day' as const, nightNumber: 1, bindings: b }
        const p = tutorialPrompt(base)
        const cur = currentTutorialStep(done)
        if (cur === null) expect(p).toBeNull()
        else {
          expect(p).not.toBeNull()
          const tokens = [...TUTORIAL_STEPS[cur - 1].template.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
          for (const t of tokens) expect(p).toContain(keyLabel(b[t]))
          // Changing one used binding to a different key changes the text.
          const t0 = tokens[0]
          if (t0 && keyLabel(other) !== keyLabel(b[t0])) {
            const changed = tutorialPrompt({ ...base, bindings: { ...b, [t0]: other } })
            expect(changed).not.toBe(p)
            expect(changed).toContain(keyLabel(other))
          }
        }
        expect(tutorialPrompt({ ...base, enabled: false })).toBeNull()
        if (phase !== 'day' || night !== 1) {
          expect(tutorialPrompt({ ...base, phase, nightNumber: night })).toBeNull()
        }
      }),
      RUNS,
    )
  })

  // Feature: 06-clarity-and-hud, Property 19: Tutorial serialization round trip
  it('Property 19: serialize/parse round trips and junk never throws', () => {
    // **Validates: Requirements 4.14, 4.16**
    fc.assert(
      fc.property(doneSet, (s) => {
        expect(parseTutorial(serializeTutorial(s))).toEqual(s)
      }),
      RUNS,
    )
    fc.assert(
      fc.property(fc.anything(), (junk) => {
        const out = parseTutorial(junk)
        for (const v of out) expect(v >= 1 && v <= 7 && Number.isInteger(v)).toBe(true)
      }),
      RUNS,
    )
  })
})
