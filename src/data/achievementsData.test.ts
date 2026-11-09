import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_THRESHOLDS, ACHIEVEMENTS, ACHIEVEMENTS_KEY, TOAST } from './achievements'

describe('achievement values (design bible §12)', () => {
  it('has the 12 ids in order', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'a-first-light', 'a-grave-robber', 'a-marksman', 'a-close-shave', 'a-combo', 'a-barricade',
      'a-pages', 'a-relics', 'a-crane', 'a-rest', 'a-endless-10', 'a-patron',
    ])
  })

  it('ids and names are unique', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(12)
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(12)
  })

  it('every name and goal text is non-empty', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.trim().length).toBeGreaterThan(0)
      expect(a.goal.trim().length).toBeGreaterThan(0)
    }
  })

  it('thresholds match the goal texts', () => {
    expect(ACHIEVEMENT_THRESHOLDS).toEqual({
      firstLightNights: 1,
      digs: 10,
      headshotsPerNight: 10,
      closeShaveHp: 10,
      comboCap: 3.0,
      boards: 20,
      pages: 5,
      relics: 5,
      endlessNight: 10,
      coinsSpent: 100,
    })
  })

  it('storage key and toast settings', () => {
    expect(ACHIEVEMENTS_KEY).toBe('lastrites:achievements')
    expect(TOAST.showS).toBeGreaterThan(0)
    expect(TOAST.maxVisible).toBeGreaterThan(0)
  })
})
