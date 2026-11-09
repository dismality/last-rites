import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import { tickDayNight } from './dayNight'
import { runTick, type TickSnapshot } from './gameTick'
import { startNight, tickWaves, type WaveState } from './waves'
import { tallyVisible } from '../../ui/hud/hudMath'

const start = (): TickSnapshot => ({
  player: { position: [0, 0, 0], yaw: 0, pitch: 0, health: 100, stamina: 100, interactTarget: null },
  stamina: { stamina: 100, regenDelayTimer: 0 },
  lantern: { on: true, fuel: 100, flicker: false },
  world: { phase: 'dusk', phaseTime: 29, nightNumber: 1, fogDensity: 0.02, wavesCleared: false },
})

describe('night cycle regression (nights were skipped)', () => {
  it('keeps night 2 running after night 1 was cleared and a full day passed', () => {
    let snap = start()
    let waves: WaveState = { ...startNight(1), phase: 'idle' }
    const rng = createRng(7)
    // Night 1 clears (no zombies alive); night 2's zombies never die.
    const live = () => (snap.world.nightNumber === 1 ? 0 : 5)
    let nightsStarted = 0
    let night2Dawn = false

    for (let i = 0; i < 20000 && !night2Dawn; i++) {
      const r = runTick(snap, { sprinting: false }, 0.5)
      snap = { ...r }
      for (const e of r.events) {
        if (e.type === 'nightStarted') {
          nightsStarted++
          waves = startNight(e.nightNumber)
          // WaveDirector resets the flag when the night starts.
          snap = { ...snap, world: { ...snap.world, wavesCleared: false } }
        }
        if (e.type === 'dawnStarted' && e.nightNumber === 2) night2Dawn = true
      }
      if (waves.phase !== 'idle' && waves.phase !== 'done') {
        const w = tickWaves(waves, 0.5, { playerPos: { x: 0, z: 0 }, liveCount: live(), rng })
        waves = w.state
        if (w.events.some((e) => e.type === 'wavesCleared'))
          snap = { ...snap, world: { ...snap.world, wavesCleared: true } }
      }
      if (snap.world.nightNumber === 2 && snap.world.phase === 'night') {
        expect(waves.phase).not.toBe('done')
      }
    }
    expect(nightsStarted).toBe(2)
    expect(night2Dawn).toBe(false)
    expect(snap.world.phase).toBe('night')
    expect(snap.world.nightNumber).toBe(2)
  })

  it('ignores a stale wavesCleared on the tick night begins', () => {
    const r = tickDayNight(
      { phase: 'dusk', phaseTime: 29.9, nightNumber: 2, fogDensity: 0.03, wavesCleared: true },
      1,
      { wavesCleared: true },
    )
    expect(r.state.phase).toBe('night')
    expect(r.state.wavesCleared).toBe(false)
  })

  it('clears wavesCleared when dawn ends', () => {
    const r = tickDayNight(
      { phase: 'dawn', phaseTime: 9.9, nightNumber: 1, fogDensity: 0.02, wavesCleared: true },
      1,
      { wavesCleared: true },
    )
    expect(r.state.phase).toBe('day')
    expect(r.state.wavesCleared).toBe(false)
  })
})

describe('tallyVisible', () => {
  it('shows only at night and dawn, never by day or dusk', () => {
    expect(tallyVisible('night')).toBe(true)
    expect(tallyVisible('dawn')).toBe(true)
    expect(tallyVisible('day')).toBe(false)
    expect(tallyVisible('dusk')).toBe(false)
  })
})
