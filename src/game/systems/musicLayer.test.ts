import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { musicLayer, type MusicLayerInput } from './musicLayer'

function reference(i: MusicLayerInput): number {
  if (i.bossOnField || i.nearestZombieM <= 6) return 3
  if (i.waveRunning || i.nearestZombieM <= 15) return 2
  if (i.phase === 'dusk' || i.nearestZombieM <= 30) return 1
  return 0
}

const distance = fc.oneof(
  fc.double({ min: 0, max: 100, noNaN: true }),
  fc.constantFrom(6, 15, 30, Infinity),
)
const input = fc.record({
  phase: fc.constantFrom('day', 'dusk', 'night', 'dawn' as const),
  waveRunning: fc.boolean(),
  nearestZombieM: distance,
  bossOnField: fc.boolean(),
}) as fc.Arbitrary<MusicLayerInput>

describe('musicLayer', () => {
  it('uses inclusive limits', () => {
    const base = { phase: 'day', waveRunning: false, bossOnField: false } as const
    expect(musicLayer({ ...base, nearestZombieM: 6 })).toBe(3)
    expect(musicLayer({ ...base, nearestZombieM: 15 })).toBe(2)
    expect(musicLayer({ ...base, nearestZombieM: 30 })).toBe(1)
    expect(musicLayer({ ...base, nearestZombieM: 30.01 })).toBe(0)
    expect(musicLayer({ ...base, nearestZombieM: Infinity })).toBe(0)
  })

  // **Validates: Requirements 9.1, 9.10, 9.11, 9.12**
  it('Property 25: the music layer is a monotone pure function', () => {
    fc.assert(
      fc.property(input, distance, (i, other) => {
        const layer = musicLayer(i)
        expect(layer).toBe(reference(i))
        expect(musicLayer(i)).toBe(layer)
        const [a, b] = i.nearestZombieM <= other ? [i.nearestZombieM, other] : [other, i.nearestZombieM]
        expect(musicLayer({ ...i, nearestZombieM: a })).toBeGreaterThanOrEqual(
          musicLayer({ ...i, nearestZombieM: b }),
        )
      }),
    )
  })
})
