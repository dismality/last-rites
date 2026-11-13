import { describe, expect, it } from 'vitest'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import { HINT_FAR_M, HINT_NEAR_M } from '../../data/objectiveHints'
import { TUTORIAL_STEPS } from '../../data/tutorialSteps'
import { buildingAt, hintNear, hintPlacePosition } from './objectiveHint'
import { currentTutorialPlace, tutorialPrompt } from './tutorial'

const at = (x: number, z: number) => ({ x, z })
const BINDINGS = { Interact: 'KeyE' }

describe('buildingAt', () => {
  it('tells the hut, chapel, catacombs and open grounds apart', () => {
    expect(buildingAt(0, 0)).toBe('hut')
    expect(buildingAt(CHAPEL_CENTER[0], CHAPEL_CENTER[2])).toBe('chapel')
    expect(buildingAt(25, 50)).toBe('catacombs')
    expect(buildingAt(-20, 10)).toBe('outside')
  })
})

describe('hintNear', () => {
  it('is near within 6 m outside and far beyond', () => {
    expect(hintNear(false, at(-20, 10), at(-20, 14))).toBe(true)
    expect(hintNear(false, at(-20, 10), at(-20, 25))).toBe(false)
  })

  it('is far when the player and target are in different buildings, however close', () => {
    // Hut door is at z 3: one metre apart, one inside and one out.
    expect(hintNear(false, at(0, 2.9), at(0, 3.5))).toBe(false)
    expect(hintNear(true, at(0, 2.9), at(0, 3.5))).toBe(false)
    expect(hintNear(false, at(0, 0), at(1.8, -1))).toBe(true)
  })

  it('holds the near state between 6 m and 8 m (hysteresis)', () => {
    const target = at(-20, 0)
    const mid = at(-20, HINT_NEAR_M + 1)
    expect(hintNear(true, mid, target)).toBe(true)
    expect(hintNear(false, mid, target)).toBe(false)
    expect(hintNear(true, at(-20, HINT_FAR_M + 0.1), target)).toBe(false)
  })

  it('reads non-finite input as far', () => {
    expect(hintNear(true, at(NaN, 0), at(0, 0))).toBe(false)
  })
})

describe('tutorial prompt wording', () => {
  const base = {
    done: new Set([1] as const),
    enabled: true,
    phase: 'day' as const,
    nightNumber: 1,
    bindings: BINDINGS,
  }

  it('shows the key text near and where to go far (step 2, the oil)', () => {
    expect(tutorialPrompt({ ...base, near: true })).toContain('E to pick up the oil')
    expect(tutorialPrompt({ ...base, near: false })).toContain('Go to the hut')
    expect(tutorialPrompt(base)).toContain('E to pick up the oil')
  })

  it('keeps steps without a place unchanged when far', () => {
    const done = new Set([1, 2, 3] as const)
    expect(tutorialPrompt({ ...base, done, near: false })).toContain('Hold E on a grave mound')
    expect(currentTutorialPlace(done)).toBeNull()
  })

  it('every far step has a resolvable place', () => {
    for (const s of TUTORIAL_STEPS.filter((x) => x.farTemplate)) {
      expect(s.place && hintPlacePosition(s.place)).toBeTruthy()
    }
  })
})
