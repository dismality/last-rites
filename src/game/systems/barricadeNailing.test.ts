import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DOORS } from '../../data/barricades'
import type { DoorId, Inventory } from '../types'
import {
  buildBarricades,
  movedWhileNailing,
  nailBoard,
  nailPrompt,
  tickNailing,
  type BarricadeState,
} from './barricade'
import { addItem, countItem, createInventory } from './inventory'

const doorArb = fc.constantFrom<DoorId>('front', 'vestry')
const boardsArb = fc.array(fc.integer({ min: 1, max: 75 }), { maxLength: DOORS.slots })
const stateArb: fc.Arbitrary<BarricadeState> = fc.record({
  built: fc.boolean(),
  doors: fc.record({ front: boardsArb, vestry: boardsArb }),
})
const invArb: fc.Arbitrary<Inventory> = fc
  .record({ planks: fc.integer({ min: 0, max: 10 }), nails: fc.integer({ min: 0, max: 10 }) })
  .map(({ planks, nails }) =>
    addItem(addItem(createInventory(), 'wood-plank', planks).inv, 'iron-nail', nails).inv,
  )

const inv = (planks: number, nails: number): Inventory =>
  addItem(addItem(createInventory(), 'wood-plank', planks).inv, 'iron-nail', nails).inv

describe('nailBoard', () => {
  it('spends 1 plank and 2 nails and adds a full-health board', () => {
    const r = nailBoard(buildBarricades(60), inv(2, 5), 'front', 60)
    expect(r.ok).toBe(true)
    expect(r.state.doors.front).toEqual([60, 60, 60])
    expect(countItem(r.inv, 'wood-plank')).toBe(1)
    expect(countItem(r.inv, 'iron-nail')).toBe(3)
  })

  it('refuses a full door, a missing material and an unbuilt barricade', () => {
    const s = buildBarricades(60)
    const full = { ...s, doors: { ...s.doors, front: [60, 60, 60] } }
    expect(nailBoard(full, inv(1, 2), 'front', 60).ok).toBe(false)
    expect(nailBoard(s, inv(0, 9), 'front', 60).ok).toBe(false)
    expect(nailBoard(s, inv(1, 1), 'front', 60).ok).toBe(false)
    expect(nailBoard({ ...s, built: false }, inv(1, 2), 'front', 60).ok).toBe(false)
  })

  it('words the prompt', () => {
    const s = buildBarricades(60)
    const full = { ...s, doors: { ...s.doors, vestry: [60, 60, 60] } }
    expect(nailPrompt(full, inv(5, 5), 'vestry')).toEqual({ canStart: false, text: 'Door is full' })
    expect(nailPrompt(s, inv(0, 5), 'front').text).toBe('Need 1 wood plank')
    expect(nailPrompt(s, inv(1, 1), 'front').text).toBe('Need 1 iron nail')
    expect(nailPrompt(s, inv(1, 0), 'front').text).toBe('Need 2 iron nails')
    expect(nailPrompt(s, inv(1, 2), 'front').canStart).toBe(true)
  })
})

describe('tickNailing', () => {
  const held = { held: true, moved: false, damaged: false, inRange: true }

  it('completes after 2 s of holding', () => {
    let n: ReturnType<typeof tickNailing> = { nail: { door: 'front', elapsedS: 0 }, done: false }
    // Quarter-second steps are exact in binary, so the boundary is not blurred by float drift.
    for (let i = 0; i < 7; i++) n = tickNailing(n.nail, 0.25, held)
    expect(n.done).toBe(false)
    n = tickNailing(n.nail, 0.25, held)
    expect(n.done).toBe(true)
    expect(n.nail).toBeNull()
  })

  it('cancels on release, damage or travel past 0.05 m', () => {
    const n = { door: 'front' as DoorId, elapsedS: 1 }
    expect(tickNailing(n, 0.1, { ...held, held: false })).toEqual({ nail: null, done: false })
    expect(tickNailing(n, 0.1, { ...held, damaged: true })).toEqual({ nail: null, done: false })
    expect(tickNailing(n, 0.1, { ...held, moved: movedWhileNailing(0.06) }).nail).toBeNull()
    expect(movedWhileNailing(0.05)).toBe(false)
  })
})

describe('Property 25: nailing half', () => {
  it('a nail costs exactly 1 plank and 2 nails, or changes nothing', () => {
    // **Validates: Requirements 16.2, 16.3, 16.4**
    fc.assert(
      fc.property(stateArb, invArb, doorArb, (s, i, id) => {
        const r = nailBoard(s, i, id, 60)
        if (r.ok) {
          expect(r.state.doors[id]).toEqual([...s.doors[id], 60])
          expect(r.state.doors[id].length).toBeLessThanOrEqual(DOORS.slots)
          expect(countItem(r.inv, 'wood-plank')).toBe(countItem(i, 'wood-plank') - 1)
          expect(countItem(r.inv, 'iron-nail')).toBe(countItem(i, 'iron-nail') - 2)
          const other: DoorId = id === 'front' ? 'vestry' : 'front'
          expect(r.state.doors[other]).toBe(s.doors[other])
        } else {
          expect(r.state).toBe(s)
          expect(r.inv).toBe(i)
          expect(nailPrompt(s, i, id).canStart).toBe(false)
        }
        expect(r.ok).toBe(nailPrompt(s, i, id).canStart)
      }),
    )
  })

  it('a cancelled nail never completes', () => {
    // **Validates: Requirements 16.3, 16.4**
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1.99, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.constantFrom('held', 'moved', 'damaged', 'range'),
        (elapsedS, dt, cause) => {
          const c = {
            held: cause !== 'held',
            moved: cause === 'moved',
            damaged: cause === 'damaged',
            inRange: cause !== 'range',
          }
          expect(tickNailing({ door: 'front', elapsedS }, dt, c)).toEqual({ nail: null, done: false })
        },
      ),
    )
  })

  it('boards nailed later take the new health; existing boards keep theirs', () => {
    // **Validates: Requirements 16.13, 16.14**
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), (hp1, hp2) => {
        const s0 = buildBarricades(60)
        const a = nailBoard(s0, inv(2, 4), 'front', hp1)
        expect(a.ok).toBe(true)
        const b = nailBoard(a.state, a.inv, 'vestry', hp2)
        expect(b.state.doors.front).toEqual([60, 60, hp1])
        expect(b.state.doors.vestry).toEqual([60, 60, hp2])
      }),
    )
  })
})
