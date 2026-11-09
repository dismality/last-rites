import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyNoise, noiseAffects } from './noise'
import { createEnemy, type AIEnemy, type AIState } from './enemyAI'
import { FIREARM_MAP, NOISE } from '../../data/firearms'

const STATES: AIState[] = [
  'rise', 'dormant', 'chase', 'lunge', 'attack', 'stagger', 'keepDistance', 'scream', 'down', 'swell', 'dying', 'dead',
]
const TYPES = ['shambler', 'lurker', 'wailer', 'bloater', 'brute'] as const

const arbEnemy = fc
  .record({
    type: fc.constantFrom(...TYPES),
    state: fc.constantFrom(...STATES),
    x: fc.double({ min: -60, max: 60, noNaN: true }),
    z: fc.double({ min: -60, max: 60, noNaN: true }),
    alive: fc.boolean(),
    old: fc.option(fc.record({ x: fc.double({ min: -5, max: 5, noNaN: true }), z: fc.double({ min: -5, max: 5, noNaN: true }) }), { nil: null }),
  })
  .map(({ type, state, x, z, alive, old }, ) => {
    const e = createEnemy('z', type, { x, z })
    return { ...e, state, hp: alive ? e.hp : 0, investigate: old } as AIEnemy
  })

const arbEvent = fc.record({
  pos: fc.record({ x: fc.double({ min: -60, max: 60, noNaN: true }), z: fc.double({ min: -60, max: 60, noNaN: true }) }),
  radiusM: fc.constantFrom(FIREARM_MAP.revolver.noiseRadiusM, FIREARM_MAP.shotgun.noiseRadiusM),
})

describe('noise', () => {
  // Feature: 07-combat-and-enemies, Property 13: Noise affects a zombie if and only if it is in range
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
  it('Property 13: only in-range eligible zombies get the destination; Lurkers wake within 15 m', () => {
    fc.assert(
      fc.property(fc.array(arbEnemy, { maxLength: 12 }), arbEvent, (zs, ev) => {
        const { enemies, events } = applyNoise(zs, ev)
        let wakeCount = 0
        zs.forEach((z, i) => {
          const out = enemies[i]
          const d = Math.hypot(z.pos.x - ev.pos.x, z.pos.z - ev.pos.z)
          const living = z.hp > 0
          const wakes = living && z.type === 'lurker' && z.state === 'dormant' && d <= NOISE.lurkerWakeM
          const eligible = living && !['dying', 'dead', 'swell', 'dormant', 'attack'].includes(z.state)
          if (wakes) {
            wakeCount++
            expect(out.state).toBe('lunge')
          } else if (eligible && d <= ev.radiusM) {
            expect(out.investigate).toEqual(ev.pos)
            expect(out.state).toBe(z.state)
          } else {
            expect(out).toBe(z)
          }
          expect(noiseAffects(z, ev)).toBe(eligible && d <= ev.radiusM)
        })
        expect(events.filter((e) => e.type === 'lurkerTriggered')).toHaveLength(wakeCount)
      }),
    )
  })

  it('a newer event replaces an older destination', () => {
    const z = { ...createEnemy('a', 'shambler', { x: 5, z: 0 }), state: 'chase' as const }
    const a = applyNoise([z], { pos: { x: 1, z: 1 }, radiusM: 30 }).enemies
    const b = applyNoise(a, { pos: { x: 2, z: 2 }, radiusM: 30 }).enemies
    expect(b[0].investigate).toEqual({ x: 2, z: 2 })
  })

  it('an attacking zombie keeps its target', () => {
    const z = { ...createEnemy('a', 'shambler', { x: 1, z: 0 }), state: 'attack' as const }
    expect(applyNoise([z], { pos: { x: 0, z: 0 }, radiusM: 30 }).enemies[0]).toBe(z)
  })

  it('a Lurker at 14 m wakes, one at 16 m stays dormant', () => {
    const near = createEnemy('n', 'lurker', { x: 14, z: 0 })
    const far = createEnemy('f', 'lurker', { x: 16, z: 0 })
    const r = applyNoise([near, far], { pos: { x: 0, z: 0 }, radiusM: 40 })
    expect(r.enemies[0].state).toBe('lunge')
    expect(r.enemies[1].state).toBe('dormant')
    expect(r.events).toHaveLength(1)
  })
})
