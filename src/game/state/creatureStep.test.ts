import { beforeEach, describe, expect, it } from 'vitest'
import { CRAWLER, CREATURE_LIFETIME_S, HOUND_PACKS_MAX } from '../../data/creatures'
import { createRng } from '../rng'
import { sanitizeCreatureSave } from '../systems/creatureSave'
import { sanitizeProgression } from '../systems/progressionSave'
import { captureCreatureSave, creatureLiveCount, useCreatureStore } from './creatureStore'
import { queueWaveCreatures, stepCreatures } from './creatureStep'
import { clearNightState } from './nightState'
import { usePlayerStore } from './playerStore'
import { captureProgressionSave, restoreProgressionSave } from './progressionPersistence'
import { resetRun } from './resetRun'
import { useWorldStore } from './worldStore'
import { pendingScreenScares, tickScreenScareQueue } from './screenScareQueue'
import { useScreenScareStore } from './screenScareStore'
import { resetSimClock, simClock, stepSimClock } from './simClock'

const DT = 1 / 60
const FAR: [number, number, number] = [1000, 0, 1000]

beforeEach(() => {
  resetRun()
  useWorldStore.setState({ phase: 'night', nightNumber: 2 })
  usePlayerStore.setState({ position: FAR, health: 100 })
})

describe('crawlers', () => {
  it('seeds 3 to 6 hidden crawlers on distinct spots at night 2, none at night 1', () => {
    useWorldStore.setState({ nightNumber: 1 })
    stepCreatures(DT, createRng(1))
    expect(useCreatureStore.getState().crawlers).toEqual([])

    resetRun()
    useWorldStore.setState({ phase: 'night', nightNumber: 2 })
    stepCreatures(DT, createRng(1))
    const { crawlers } = useCreatureStore.getState()
    expect(crawlers.length).toBeGreaterThanOrEqual(3)
    expect(crawlers.length).toBeLessThanOrEqual(CRAWLER.spotsMax)
    expect(new Set(crawlers.map((c) => c.id)).size).toBe(crawlers.length)
    expect(new Set(crawlers.map((c) => `${c.c.x},${c.c.z}`)).size).toBe(crawlers.length)
    expect(crawlers.every((c) => c.c.phase === 'hidden')).toBe(true)
    // Hidden crawlers are not alive for the wave cap, and are not "seen".
    expect(creatureLiveCount()).toBe(0)
    expect(useCreatureStore.getState().seen).toEqual([])
  })

  it('grabs after its warning, never takes the player below 1 HP, and marks the crawler seen', () => {
    stepCreatures(DT, createRng(1))
    const first = useCreatureStore.getState().crawlers[0]
    usePlayerStore.setState({ position: [first.c.x + 0.5, 0, first.c.z], health: 5 })
    const rng = createRng(7)
    // One grab event: stop at the first hit. (A later grab that starts at 1 HP is a new event.)
    for (let i = 0; i < 60 * 4 && usePlayerStore.getState().health === 5; i++) stepCreatures(DT, rng)
    expect(usePlayerStore.getState().health).toBe(1)
    expect(useCreatureStore.getState().seen).toContain('crawler')
  })

  it('sinks an emerged crawler back after its time', () => {
    stepCreatures(DT, createRng(1))
    const first = useCreatureStore.getState().crawlers[0]
    usePlayerStore.setState({ position: [first.c.x + 0.5, 0, first.c.z], health: 100 })
    const rng = createRng(3)
    stepCreatures(DT, rng)
    expect(useCreatureStore.getState().crawlers.find((c) => c.id === first.id)?.c.phase).toBe('emerged')
    usePlayerStore.setState({ position: FAR })
    for (let i = 0; i < (CREATURE_LIFETIME_S.crawlerEmerged + 2) * 60; i++) stepCreatures(DT, rng)
    expect(useCreatureStore.getState().crawlers.find((c) => c.id === first.id)).toBeUndefined()
  })

  it('clears at dawn', () => {
    stepCreatures(DT, createRng(1))
    useWorldStore.setState({ phase: 'dawn' })
    stepCreatures(DT, createRng(1))
    expect(useCreatureStore.getState().crawlers).toEqual([])
    expect(useCreatureStore.getState().seededNight).toBeNull()
  })
})

describe('crawler face scare', () => {
  /** Puts the player 1 m south of the first crawler, facing it (yaw 0 looks down -Z). */
  function standInFront(): void {
    stepCreatures(DT, createRng(1))
    const first = useCreatureStore.getState().crawlers[0]
    usePlayerStore.setState({ position: [first.c.x, 0, first.c.z + 1], yaw: 0, health: 100 })
  }

  /** Runs the sim until the player is first hurt; returns the scare active at that moment. */
  function runToGrab() {
    const rng = createRng(7)
    for (let i = 0; i < 60 * 6; i++) {
      stepSimClock(DT)
      tickScreenScareQueue(() => {})
      stepCreatures(DT, rng)
      if (usePlayerStore.getState().health < 100) return useScreenScareStore.getState().scare.active
    }
    return 'never' as const
  }

  beforeEach(() => {
    resetSimClock()
  })

  it('queues the bottom zombie face on a burst in front, and holds the grab until the out phase starts', () => {
    standInFront()
    stepCreatures(DT, createRng(7))
    expect(pendingScreenScares().some((p) => p.kind === 'crawler')).toBe(true)

    const active = runToGrab()
    expect(active).not.toBe('never')
    expect(active).not.toBeNull()
    if (active && active !== 'never') {
      expect(active.set).toBe('zombie-bottom')
      const outStart = active.startSim + (active.timeline.inMs + active.timeline.holdMs) / 1000
      expect(simClock.now).toBeGreaterThanOrEqual(outStart)
    }
  })

  it('applies the grab at once when the scare is skipped by the cooldown', () => {
    standInFront()
    useScreenScareStore.setState({ scare: { ...useScreenScareStore.getState().scare, lastStartSim: 0 } })
    const active = runToGrab()
    expect(active).toBeNull()
    expect(usePlayerStore.getState().health).toBeLessThan(100)
  })

  it('does not scare for a burst behind the player', () => {
    stepCreatures(DT, createRng(1))
    const first = useCreatureStore.getState().crawlers[0]
    usePlayerStore.setState({ position: [first.c.x, 0, first.c.z - 1], yaw: 0, health: 100 })
    stepCreatures(DT, createRng(7))
    expect(pendingScreenScares()).toEqual([])
  })
})

describe('the Hollow Bride', () => {
  it('never appears in stage 1', () => {
    useWorldStore.setState({ nightNumber: 1 })
    const rng = createRng(5)
    for (let i = 0; i < 200; i++) stepCreatures(1, rng)
    expect(useCreatureStore.getState().bride.alive).toBe(false)
  })

  it('appears from stage 2 after her delay, one at a time, and stays unseen until drawn', () => {
    const rng = createRng(5)
    stepCreatures(DT, rng) // seeds the night and her first delay
    let alive = false
    for (let i = 0; i < 200 && !alive; i++) {
      stepCreatures(1, rng)
      alive = useCreatureStore.getState().bride.alive
    }
    expect(alive).toBe(true)
    // Far from the player and not in the lantern cone: not drawn, not in the Bestiary.
    expect(useCreatureStore.getState().brideVisible).toBe(false)
    expect(useCreatureStore.getState().seen).not.toContain('bride')
  })
})

describe('hounds', () => {
  const grave = { x: 1000, z: 1000 }
  const hounds = (n: number) => Array.from({ length: n }, () => ({ type: 'hound', ...grave }))

  it('routes wave hounds into packs of 2 to 3 inside the pack limit and counts them as alive', () => {
    queueWaveCreatures(hounds(3), createRng(1))
    expect(useCreatureStore.getState().packs.map((p) => p.pack.hounds.length)).toEqual([3])
    expect(creatureLiveCount()).toBe(3)

    resetRun()
    queueWaveCreatures(hounds(5), createRng(1))
    expect(useCreatureStore.getState().packs.map((p) => p.pack.hounds.length)).toEqual([3, 2])

    resetRun()
    queueWaveCreatures(hounds(12), createRng(1))
    expect(useCreatureStore.getState().packs.length).toBe(HOUND_PACKS_MAX)
  })

  it('puts wave crawlers hidden in the creature store, not the zombie list', () => {
    queueWaveCreatures([{ type: 'crawler', x: 4, z: 9 }], createRng(1))
    const [c] = useCreatureStore.getState().crawlers
    expect(c.wave).toBe(true)
    expect(c.c.phase).toBe('hidden')
    expect(creatureLiveCount()).toBe(0)
  })

  it('a hound bite never takes the player below 1 HP', () => {
    queueWaveCreatures(hounds(3), createRng(1))
    usePlayerStore.setState({ health: 4 })
    const rng = createRng(11)
    // Stop at the first bite: a bite that starts at 1 HP is a new event with no floor.
    for (let i = 0; i < 60 * 40 && usePlayerStore.getState().health === 4; i++) stepCreatures(DT, rng)
    expect(usePlayerStore.getState().health).toBe(1)
  })

  it('a pack leaves after its time', () => {
    queueWaveCreatures(hounds(2), createRng(1))
    const rng = createRng(2)
    for (let i = 0; i < (CREATURE_LIFETIME_S.houndPack + 2) * 60; i++) {
      usePlayerStore.setState({ health: 100 })
      stepCreatures(DT, rng)
    }
    expect(useCreatureStore.getState().packs).toEqual([])
  })
})

describe('saving', () => {
  it('round-trips the crawlers and the bride through the world save block', () => {
    stepCreatures(DT, createRng(1))
    useCreatureStore.setState({ bride: { alive: true, x: 3, z: -4, returnIn: 0, tellLeft: null } })
    const before = captureCreatureSave()
    const back = sanitizeCreatureSave(JSON.parse(JSON.stringify(before)))
    expect(back).toEqual(before)
    useCreatureStore.getState().clearNight()
    useCreatureStore.getState().restore(back)
    expect(captureCreatureSave()).toEqual(before)
  })

  it('loads junk and old saves as no creatures', () => {
    for (const junk of [undefined, null, 5, 'x', { crawlers: 'x', bride: 4 }, { crawlers: [{ id: 1 }] }]) {
      const s = sanitizeCreatureSave(junk)
      expect(s.crawlers).toEqual([])
      expect(s.bride.alive).toBe(false)
    }
  })

  it('keeps the seen set in the progression save, drops unknown ids, and Retry keeps it', () => {
    useCreatureStore.setState({ seen: ['hound', 'crawler'] })
    const ctx = { inventory: { slots: [] } as never, takenPickups: [] }
    const saved = JSON.parse(JSON.stringify(captureProgressionSave()))
    expect(saved.creaturesSeen).toEqual(['hound', 'crawler'])

    useCreatureStore.setState({ seen: [] })
    restoreProgressionSave(sanitizeProgression({ ...saved, creaturesSeen: ['hound', 'ghost', 'hound'] }, ctx))
    expect(useCreatureStore.getState().seen).toEqual(['hound'])

    // A night clear (Retry Night, death) removes the night's creatures but not the memory of them.
    clearNightState()
    expect(useCreatureStore.getState().seen).toEqual(['hound'])
    expect(useCreatureStore.getState().crawlers).toEqual([])

    // An old save without the field loads with nothing seen.
    expect(sanitizeProgression({}, ctx).creaturesSeen).toEqual([])
    // New Game forgets them.
    resetRun()
    expect(useCreatureStore.getState().seen).toEqual([])
  })
})
