import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { clearSubscribers, emit } from '../events'
import { useCoinStore } from '../state/coinStore'
import { useEnemyStore } from '../state/enemyStore'
import { useGameStore } from '../state/gameStore'
import { installProgressionWatchers, resetCoinStream } from '../state/progressionEvents'
import { useProgressionStore } from '../state/progressionStore'
import { useScoreStore } from '../state/scoreStore'
import { resetSimClock } from '../state/simClock'
import { applyDamage } from './combat'
import { createEnemy } from './enemyAI'
import { killReports } from './killReports'
import { resolveMelee } from './melee'
import { resolveBlast } from './projectiles'

const shambler = (uid: string, x: number, hp?: number) => {
  const e = createEnemy(uid, 'shambler', { x, z: 1 })
  return hp === undefined ? e : { ...e, hp }
}

describe('killReports', () => {
  it('reports only zombies that went from alive to 0 HP, with source and elite flag', () => {
    const before = [shambler('a', 0), { ...shambler('b', 1), elite: true }, shambler('c', 2), shambler('d', 3, 0)]
    const after = [{ ...before[0], hp: 0 }, { ...before[1], hp: 0 }, { ...before[2], hp: 5 }, before[3]]
    const ev = killReports(before, after, 'nail-bomb', new Set(['a']))
    expect(ev.map((e) => [e.uid, e.source, e.elite, e.headshot])).toEqual([
      ['a', 'nail-bomb', false, true],
      ['b', 'nail-bomb', true, false],
    ])
  })

  it('a second pass over the same dead list reports nothing (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 60 }), { maxLength: 8 }), (hps) => {
        const before = hps.map((_, i) => shambler(`z${i}`, i, 60))
        const after = before.map((e, i) => ({ ...e, hp: hps[i] }))
        const first = killReports(before, after, 'melee')
        expect(first).toHaveLength(hps.filter((h) => h <= 0).length)
        expect(killReports(after, after, 'melee')).toHaveLength(0)
      }),
    )
  })

  it('a trap burn slice that finishes a zombie reports it once across ticks', () => {
    const z0 = shambler('t', 0, 3)
    const burn = (list: ReturnType<typeof shambler>[]) =>
      resolveBlast({ x: 0, z: 1 }, 3, 10, list, { lanternFuel: 100, source: 'lantern-trap' }).enemies
    const t1 = burn([z0])
    const t2 = burn(t1)
    const all = [...killReports([z0], t1, 'lantern-trap'), ...killReports(t1, t2, 'lantern-trap')]
    expect(all).toHaveLength(1)
    expect(all[0].source).toBe('lantern-trap')
  })
})

describe('a melee kill pays out', () => {
  let off: () => void
  beforeEach(() => {
    clearSubscribers()
    useProgressionStore.getState().reset()
    useScoreStore.getState().resetNight()
    useCoinStore.getState().clear()
    useEnemyStore.getState().setEnemies([])
    useGameStore.setState({ screen: 'game', taken: false })
    resetSimClock()
    resetCoinStream()
    off = installProgressionWatchers()
  })
  afterEach(() => {
    off()
    clearSubscribers()
  })

  it('score and exactly one coin pile, once, for a light swing kill', () => {
    // Facing +z (yaw 0 forward vector assumed by the resolver's dir), zombie 1 m ahead with 5 HP.
    const z = { ...createEnemy('m1', 'wailer', { x: 0, z: 1 }), hp: 5 }
    useEnemyStore.getState().setEnemies([z])
    const before = useEnemyStore.getState().enemies
    const res = resolveMelee({ x: 0, z: 0 }, { x: 0, z: 1 }, 15, before, { lanternFuel: 100 })
    expect(res.killedUids).toEqual(['m1'])
    useEnemyStore.getState().setEnemies(res.enemies)
    const events = killReports(before, res.enemies, 'melee')
    for (const ev of events) emit(ev)
    // A second swing over the corpse (hp 0) reports nothing.
    expect(killReports(res.enemies, res.enemies, 'melee')).toHaveLength(0)
    for (const ev of events) emit(ev)

    const pr = useProgressionStore.getState()
    expect(pr.score).toBe(25)
    expect(pr.stats.kills.wailer).toBe(1)
    expect(useCoinStore.getState().piles).toHaveLength(1)
    expect(applyDamage(res.enemies[0], 5, { lanternFuel: 100 }).hp).toBe(0)
  })
})
