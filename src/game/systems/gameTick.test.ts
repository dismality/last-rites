import { describe, expect, it } from 'vitest'
import { runTick, type TickSnapshot } from './gameTick'

const base = (): TickSnapshot => ({
  player: { position: [0, 0, 0], yaw: 0, pitch: 0, health: 100, stamina: 100, interactTarget: null },
  stamina: { stamina: 100, regenDelayTimer: 0 },
  lantern: { on: true, fuel: 100, flicker: false },
  world: { phase: 'day', phaseTime: 0, nightNumber: 1, fogDensity: 0.02, wavesCleared: false },
})

describe('runTick', () => {
  it('drains stamina while sprinting and mirrors it to the player', () => {
    const r = runTick(base(), { sprinting: true }, 0.5)
    expect(r.stamina.stamina).toBeCloseTo(90)
    expect(r.player.stamina).toBeCloseTo(90)
  })

  it('does not sprint with empty stamina', () => {
    const s = base()
    s.stamina = { stamina: 0, regenDelayTimer: 0 }
    const r = runTick(s, { sprinting: true }, 1)
    expect(r.stamina.stamina).toBeGreaterThan(0)
  })

  it('drains lantern fuel', () => {
    expect(runTick(base(), { sprinting: false }, 6).lantern.fuel).toBeCloseTo(99)
  })

  it('collects dayNight events', () => {
    const s = base()
    s.world.phaseTime = 359.99
    const r = runTick(s, { sprinting: false }, 0.02)
    expect(r.events).toContainEqual({ type: 'phaseChanged', phase: 'dusk' })
  })
})
