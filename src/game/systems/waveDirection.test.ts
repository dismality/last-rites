import { describe, expect, it } from 'vitest'
import { ENEMY_MAP } from '../../data/enemies'
import { createRunStats } from './runStats'
import { clearedRoute, createWaveEnemy, eliteChanceFor, planNight, statsAfterClear } from './waveDirection'
import { endlessNight } from './endless'
import { tickWaves, type WaveSpawn } from './waves'

const spawn: WaveSpawn = { type: 'shambler', graveId: 'g', x: 1, z: 2, elite: false, doorAttacker: false }

describe('waveDirection', () => {
  it('Hard zombies have x1.25 HP and x1.4 damage', () => {
    const e = createWaveEnemy('z-0', spawn, 'hard', 2)
    expect(e.hp).toBeCloseTo(ENEMY_MAP.shambler.hp * 1.25)
    expect(e.damageMult).toBeCloseTo(1.4)
  })

  it('applies elite multipliers once', () => {
    const plain = createWaveEnemy('a', spawn, 'normal', 2)
    const elite = createWaveEnemy('b', { ...spawn, elite: true }, 'normal', 2)
    expect(elite.hp).toBeCloseTo(plain.hp * 2)
  })

  it('Endless night 6 uses the generated plan', () => {
    const { state, totalWaves } = planNight('endless', 6)
    expect(state.plan).toEqual(endlessNight(6).waves)
    expect(totalWaves).toBe(endlessNight(6).waves.length)
    expect(state.night).toBe(6)
  })

  it('uses the mode elite chance', () => {
    expect(eliteChanceFor('hard')).toBe(0.1)
    expect(eliteChanceFor('easy')).toBe(0.04)
  })

  it('wavesCleared fires once per cleared night', () => {
    let { state } = planNight('endless', 1)
    let cleared = 0
    const rng = () => 0.5
    for (let i = 0; i < 4000; i++) {
      const r = tickWaves(state, 1, { playerPos: { x: 0, z: 0 }, liveCount: 0, rng })
      state = r.state
      cleared += r.events.filter((e) => e.type === 'wavesCleared').length
    }
    expect(cleared).toBe(1)
  })

  it('runs the rite route only in story modes and caps stats accordingly', () => {
    expect(clearedRoute('normal', 3)).toBe('rite')
    expect(clearedRoute('endless', 5)).toBe('dawn')
    expect(clearedRoute('hard', 2)).toBe('dawn')
    expect(statsAfterClear(createRunStats(), 'endless', 10).nightsSurvived).toBe(10)
    expect(statsAfterClear(createRunStats(), 'normal', 3).nightsSurvived).toBe(0)
  })

  it('story nights are endless stage nights with no wave total', () => {
    const { state, totalWaves } = planNight('normal', 2)
    expect(state.stage).toBe(2)
    expect(totalWaves).toBe(0)
    expect(planNight('normal', 9).state.stage).toBe(3)
  })
})
