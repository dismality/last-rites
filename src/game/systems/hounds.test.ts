import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createRng } from '../rng'
import { createPack, isDarting, isScattered, stepPack, type PackEvent } from './hounds'

const DT = 1 / 60
const dist = (h: { x: number; z: number }, p: { x: number; z: number }): number => Math.hypot(h.x - p.x, h.z - p.z)

describe('createPack', () => {
  it('forms 2 to 3 hounds on the ring', () => {
    const rng = createRng(1)
    expect(createPack({ x: 0, z: 0 }, 1, rng).hounds).toHaveLength(2)
    expect(createPack({ x: 0, z: 0 }, 9, rng).hounds).toHaveLength(3)
  })
})

describe('Property 8: hound pack rules', () => {
  const eventArb = fc.option(
    fc.record({ kind: fc.constantFrom('gunshot' as const, 'flare' as const), distM: fc.double({ min: 0, max: 40, noNaN: true }) }),
    { nil: null, freq: 30 },
  )

  it('one dart at a time, 2 s apart, 10 damage, 4 to 6 m while circling, harmless 4 s after a scatter', () => {
    // Feature: 11-horror-pass, Property 8: Hound pack rules
    // **Validates: Requirements 2.12, 2.13**
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 2, max: 3 }), fc.array(eventArb, { minLength: 600, maxLength: 600 }), (seed, size, events) => {
        const rng = createRng(seed)
        const player = { x: 0, z: 0 }
        let pack = createPack(player, size, rng)
        const dartStarts: number[] = []
        let lastScatter = -Infinity
        events.forEach((ev: PackEvent | null, i) => {
          // The player drifts, so the pack has to follow.
          player.x = Math.sin(i / 90) * 5
          const t = (i + 1) * DT
          const r = stepPack(pack, player, ev, DT, rng)
          pack = r.pack
          expect(pack.hounds.filter(isDarting).length).toBeLessThanOrEqual(1)
          for (const e of r.events) {
            if (e.type === 'tell') dartStarts.push(t)
            if (e.type === 'scatter') lastScatter = t
            if (e.type === 'bite') expect(e.damage).toBe(10)
          }
          expect(r.damage % 10).toBe(0)
          if (t < lastScatter + 4 - 1e-9) expect(r.damage).toBe(0)
          if (ev && ev.distM <= 15) expect(isScattered(pack)).toBe(true)
          pack.hounds
            .filter((h) => h.mode === 'circle')
            .forEach((h) => {
              expect(dist(h, player)).toBeGreaterThanOrEqual(4 - 1e-6)
              expect(dist(h, player)).toBeLessThanOrEqual(6 + 1e-6)
            })
        })
        for (let i = 1; i < dartStarts.length; i++) expect(dartStarts[i] - dartStarts[i - 1]).toBeGreaterThanOrEqual(2 - 1e-9)
      }),
      { numRuns: 100 },
    )
  })

  it('a far event does not scatter, and a near one sends hounds away', () => {
    const rng = createRng(3)
    const player = { x: 0, z: 0 }
    const pack = createPack(player, 3, rng)
    expect(stepPack(pack, player, { kind: 'gunshot', distM: 15.1 }, DT, rng).events.some((e) => e.type === 'scatter')).toBe(false)
    const r = stepPack(pack, player, { kind: 'flare', distM: 15 }, DT, rng)
    expect(r.events.some((e) => e.type === 'scatter')).toBe(true)
    expect(r.pack.hounds.every((h) => h.mode === 'away')).toBe(true)
  })

  it('bites a still player for 10 within a few seconds', () => {
    const rng = createRng(5)
    const player = { x: 0, z: 0 }
    let pack = createPack(player, 3, rng)
    let total = 0
    for (let i = 0; i < 60 * 10; i++) {
      const r = stepPack(pack, player, null, DT, rng)
      pack = r.pack
      total += r.damage
    }
    expect(total).toBeGreaterThanOrEqual(10)
  })
})
