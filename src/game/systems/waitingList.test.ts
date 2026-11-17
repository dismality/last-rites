import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { emptyWaiting, list, missingFiles, register } from './waitingList'

const arbPath = fc.constantFrom(
  '/assets/scares/face-zombie-1.webp',
  '/assets/models/enemies/crawler.glb',
  '/assets/models/items/brisk-draught.glb',
  '/assets/textures/lantern-cookie.png',
  '/assets/models/viewmodel/hands.glb',
)

describe('waitingList', () => {
  // Feature: 11-horror-pass, Property 30: Waiting list is idempotent and complete
  it('lists exactly the registered paths, unique and sorted, and a repeat changes nothing', () => {
    fc.assert(
      fc.property(fc.array(arbPath, { maxLength: 30 }), (calls) => {
        let s = emptyWaiting()
        for (const p of calls) {
          const next = register(s, p)
          if (s.paths.includes(p)) expect(next).toBe(s)
          s = next
        }
        const out = list(s)
        expect(out).toEqual([...new Set(calls)].sort())
        expect(new Set(out).size).toBe(out.length)
        for (const p of calls) expect(register(s, p)).toBe(s)
      }),
      { numRuns: 200 },
    )
  })

  // Feature: 11-horror-pass, Property 30: Waiting list is idempotent and complete
  it('reports exactly the declared files missing from disk', () => {
    fc.assert(
      fc.property(fc.uniqueArray(arbPath, { maxLength: 5 }), fc.uniqueArray(arbPath, { maxLength: 5 }), (declared, onDisk) => {
        const present = new Set(onDisk)
        expect(missingFiles(declared, present)).toEqual(declared.filter((p) => !present.has(p)).sort())
      }),
      { numRuns: 200 },
    )
  })

  it('ignores a blank path', () => {
    const s = emptyWaiting()
    expect(register(s, '  ')).toBe(s)
  })
})
