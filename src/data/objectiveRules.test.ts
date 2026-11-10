import { describe, expect, it } from 'vitest'
import { LOW_HEALTH_THRESHOLD } from './balance'
import { HEALTH_BAR } from './healthBar'
import { OBJECTIVE_MAX_LINE, OBJECTIVE_RULES } from './objectiveRules'
import { TUTORIAL_STEPS, TUTORIAL_WALK_TARGET_M } from './tutorialSteps'
import { FIXED_SPAWNS } from './zones'

describe('HEALTH_BAR', () => {
  it('matches design bible §11', () => {
    expect(HEALTH_BAR).toMatchObject({
      widthPx: 260,
      heightPx: 18,
      holdS: 0.15,
      drainS: 0.6,
      easeS: 0.4,
      flashS: 0.12,
      thickenS: 0.3,
      pulseCycleS: 1.2,
      lowBelow: LOW_HEALTH_THRESHOLD,
    })
  })
})

describe('OBJECTIVE_RULES', () => {
  it('has 12 rules in ascending id order with §11 main lines', () => {
    expect(OBJECTIVE_RULES.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(OBJECTIVE_RULES.map((r) => r.main)).toEqual([
      'Survive: Wave {n} of {m}',
      'Finish the rite at the altar',
      'Put Father Crane to rest',
      'Prepare for the night',
      'Read the page Elias left in the hut',
      'Find the Rusted Crypt Key',
      "Search Mausoleum Row for the sexton's whistle",
      'Blow the Bone Whistle at the chapel altar',
      'Find the Iron Ossuary Key in the Crane crypt',
      'Gather the relics of the rite',
      'Hold out until the fifth night',
      'Craft a weapon at the workbench',
    ])
  })

  it('uses the §11 progress targets', () => {
    const targets = Object.fromEntries(OBJECTIVE_RULES.map((r) => [r.id, r.target]))
    expect(targets).toMatchObject({ 2: 5, 5: 1, 6: 1, 7: 1, 9: 1, 10: 5 })
    expect(targets[1]).toBeUndefined()
    expect(targets[11]).toBeUndefined()
  })

  it('keeps rules 1, 4 and 11 without a place', () => {
    for (const id of [1, 4, 11]) {
      expect(OBJECTIVE_RULES.find((r) => r.id === id)?.place).toBeUndefined()
    }
  })

  it('refers only to fixed spawns that exist', () => {
    for (const r of OBJECTIVE_RULES) {
      if (r.place?.kind === 'fixed-spawn') {
        const id = r.place.id
        expect(FIXED_SPAWNS.some((s) => s.id === id)).toBe(true)
      }
    }
  })

  it('fits the line limit with room for a count', () => {
    for (const r of OBJECTIVE_RULES) {
      expect(`${r.main} (5/5)`.length).toBeLessThanOrEqual(OBJECTIVE_MAX_LINE)
    }
  })
})

describe('TUTORIAL_STEPS', () => {
  it('has 7 steps in §11 order with §11 prompts', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(TUTORIAL_STEPS.map((s) => s.action)).toEqual([
      'walk',
      'pickup',
      'readPage',
      'dig',
      'craft',
      'bindHotbar',
      'openJournal',
    ])
    expect(TUTORIAL_STEPS[0]?.template).toBe(
      '{MoveForward} {MoveLeft} {MoveBackward} {MoveRight} to move, mouse to look',
    )
    expect(TUTORIAL_STEPS[5]?.template).toBe(
      '{Satchel} opens the satchel; press {Hotbar1}–{Hotbar4} on an item to bind it',
    )
    expect(TUTORIAL_WALK_TARGET_M).toBe(3)
  })
})
