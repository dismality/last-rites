import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { STAMINA_DRAIN_PER_S } from '../../data/balance'
import { runTick, type TickSnapshot } from '../systems/gameTick'
import { tickStamina } from '../systems/stamina'
import { useLanternStore } from './lanternStore'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import {
  readStamina,
  resetStaminaRuntime,
  spendStamina,
  writeRegenDelay,
} from './staminaRuntime'

beforeEach(() => {
  resetStaminaRuntime()
  usePlayerStore.getState().setStamina(100)
})

describe('staminaRuntime', () => {
  it('a spend is not undone on the next tick', () => {
    expect(spendStamina(25)).toBe(true)
    const r = tickStamina(readStamina(), 1 / 60, false)
    expect(r.stamina).toBe(75)
  })

  it('refuses a spend the player cannot afford and changes nothing', () => {
    usePlayerStore.getState().setStamina(10)
    expect(spendStamina(15)).toBe(false)
    expect(usePlayerStore.getState().stamina).toBe(10)
  })

  it('stays within 0..100 for any spend/tick sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.double({ min: 0, max: 150, noNaN: true }), fc.boolean()), { maxLength: 40 }),
        (steps) => {
          usePlayerStore.getState().setStamina(100)
          resetStaminaRuntime()
          for (const [cost, sprint] of steps) {
            spendStamina(cost)
            const t = tickStamina(readStamina(), 0.2, sprint)
            usePlayerStore.getState().setStamina(t.stamina)
            writeRegenDelay(t.regenDelayTimer)
            const s = usePlayerStore.getState().stamina
            if (s < 0 || s > 100) return false
          }
          return true
        }
      )
    )
  })

  it('a 0.5 drain multiplier halves sprint drain through runTick', () => {
    const base: TickSnapshot = {
      player: usePlayerStore.getState(),
      stamina: { stamina: 100, regenDelayTimer: 0 },
      lantern: useLanternStore.getState(),
      world: useWorldStore.getState(),
    }
    const full = runTick(base, { sprinting: true }, 1)
    const half = runTick(base, { sprinting: true, sprintDrainMult: 0.5 }, 1)
    expect(100 - full.stamina.stamina).toBeCloseTo(STAMINA_DRAIN_PER_S)
    expect(100 - half.stamina.stamina).toBeCloseTo(STAMINA_DRAIN_PER_S / 2)
  })
})

