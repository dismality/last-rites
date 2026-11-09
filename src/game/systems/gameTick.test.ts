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

  it('does not end a held dawn', () => {
    const s = base()
    s.world = { ...s.world, phase: 'dawn', phaseTime: 100 }
    const r = runTick(s, { sprinting: false, holdDawn: true }, 5)
    expect(r.world.phase).toBe('dawn')
    expect(r.world.phaseTime).toBe(100)
    expect(r.events).toEqual([])
  })

  it('uses a 120 s day and no last night for Endless', () => {
    const s = base()
    s.world.phaseTime = 119.99
    const r = runTick(s, { sprinting: false, dayLengthS: 120, lastNight: Infinity }, 0.02)
    expect(r.world.phase).toBe('dusk')
    const d = base()
    d.world = { ...d.world, phase: 'dawn', phaseTime: 9.99, nightNumber: 5 }
    const n = runTick(d, { sprinting: false, dayLengthS: 120, lastNight: Infinity }, 0.02)
    expect(n.world.nightNumber).toBe(6)
  })

  it('scales lantern drain by the multiplier (Long Wick, storm)', () => {
    const slow = runTick(base(), { sprinting: false, lanternDrainMult: 0.8 }, 6).lantern.fuel
    const fast = runTick(base(), { sprinting: false, lanternDrainMult: 1.2 }, 6).lantern.fuel
    expect(100 - slow).toBeCloseTo(0.8)
    expect(100 - fast).toBeCloseTo(1.2)
  })

  it('raises stamina regeneration with regenMult (Second Wind)', () => {
    const s = base()
    s.stamina = { stamina: 50, regenDelayTimer: 0 }
    const plain = runTick(s, { sprinting: false }, 1).stamina.stamina
    const wind = runTick(s, { sprinting: false, regenMult: 1.25 }, 1).stamina.stamina
    expect(wind - 50).toBeCloseTo((plain - 50) * 1.25)
  })

  it('collects dayNight events', () => {
    const s = base()
    s.world.phaseTime = 359.99
    const r = runTick(s, { sprinting: false }, 0.02)
    expect(r.events).toContainEqual({ type: 'phaseChanged', phase: 'dusk' })
  })
})
