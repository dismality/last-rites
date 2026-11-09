import { describe, expect, it } from 'vitest'
import { BOSS_POINTS, COMBO, ELITE_POINTS_MULT, HEADSHOT_BONUS, KILL_POINTS, NIGHT_SCORE } from './scoring'

describe('scoring data matches §12', () => {
  const kills = { shambler: 10, wailer: 25, lurker: 30, bloater: 30, brute: 75 }
  it.each(Object.entries(kills))('%s kill points', (id, points) => {
    expect(KILL_POINTS[id as keyof typeof KILL_POINTS], `KILL_POINTS.${id}`).toBe(points)
  })

  it('has no extra kill rows', () => {
    expect(Object.keys(KILL_POINTS).sort()).toEqual(Object.keys(kills).sort())
  })

  it('boss, elite and headshot values', () => {
    expect(BOSS_POINTS, 'BOSS_POINTS').toBe(1000)
    expect(ELITE_POINTS_MULT, 'ELITE_POINTS_MULT').toBe(2)
    expect(HEADSHOT_BONUS, 'HEADSHOT_BONUS').toBe(5)
  })

  it('combo values', () => {
    expect(COMBO.step, 'COMBO.step').toBe(0.25)
    expect(COMBO.cap, 'COMBO.cap').toBe(3)
    expect(COMBO.windowS, 'COMBO.windowS').toBe(4)
    expect(COMBO.base, 'COMBO.base').toBe(1)
  })

  it('night score values', () => {
    expect(NIGHT_SCORE.clearPerNight, 'NIGHT_SCORE.clearPerNight').toBe(100)
    expect(NIGHT_SCORE.noDamageBonus, 'NIGHT_SCORE.noDamageBonus').toBe(200)
  })
})
