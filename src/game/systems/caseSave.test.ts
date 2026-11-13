import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CASES, type CaseId } from '../../data/cases'
import { fromSaveFile, toSaveFile, type SaveState } from './saveGame'
import { freshCaseSave, mergeRetry, sanitizeCaseSave, type CaseSave } from './caseSave'
import { linkKey } from './caseBoard'

const subset = <T,>(xs: readonly T[]) => fc.subarray([...xs])

const caseSaveArb: fc.Arbitrary<CaseSave> = fc
  .tuple(
    ...CASES.map((c) =>
      fc.record({
        found: subset(c.clues.map((x) => x.id as string)),
        links: subset(
          c.clues.flatMap((a, i) => c.clues.slice(i + 1).map((b) => linkKey(a.id, b.id))),
        ),
        minigames: subset(c.minigames),
        slots: fc.tuple(...c.final.slots.map((s) => fc.constantFrom<string | null>(null, ...s.options))),
        wrongAnswers: fc.nat(9),
        hints: fc.record({ revealed: fc.constantFrom(0, 1, 2, 3) as fc.Arbitrary<0 | 1 | 2 | 3> }),
      }),
    ),
  )
  .chain((ps) =>
    fc.record({
      closed: subset(CASES.map((c) => c.id)),
      doubt: fc.record({ nightId: fc.integer({ min: 0, max: 3 }), doubt: fc.integer({ min: 0, max: 3 }) }),
    }).map(({ closed, doubt }) => ({
      cases: Object.fromEntries(CASES.map((c, i) => [c.id, { ...ps[i], slots: [...ps[i].slots] }])) as CaseSave['cases'],
      closed: closed as CaseId[],
      doubt,
    })),
  )

describe('caseSave', () => {
  it('Feature: 10-curse-stages, Property 9: Case store round trip', () => {
    // **Validates: Requirements 4.3, 4.6**
    fc.assert(
      fc.property(caseSaveArb, (s) => {
        expect(sanitizeCaseSave(JSON.parse(JSON.stringify(s)))).toEqual(s)
      }),
      { numRuns: 100 },
    )
  })

  it('round trips through the save file', () => {
    const s = freshCaseSave()
    s.cases['saved-by-the-bell'].found = [CASES[0].clues[0].id]
    const file = JSON.parse(JSON.stringify(toSaveFile({ ...(minimalState() as unknown as SaveState), case: s })))
    expect(fromSaveFile(file)?.case).toEqual(s)
    delete file.case
    expect(fromSaveFile(file)?.case).toEqual(freshCaseSave())
  })

  it('drops stale ids and junk without throwing', () => {
    const r = sanitizeCaseSave({
      cases: { 'saved-by-the-bell': { found: ['nope', CASES[0].clues[0].id], links: ['x|y'], minigames: ['9z'], slots: [5], hints: { revealed: 99 } } },
      closed: ['bogus', 'saved-by-the-bell'],
      doubt: { nightId: 1, doubt: 50 },
    })
    const p = r.cases['saved-by-the-bell']
    expect(p.found).toEqual([CASES[0].clues[0].id])
    expect(p.links).toEqual([])
    expect(p.minigames).toEqual([])
    expect(p.hints.revealed).toBe(3)
    expect(r.closed).toEqual(['saved-by-the-bell'])
    expect(r.doubt.doubt).toBe(3)
    expect(sanitizeCaseSave(42)).toEqual(freshCaseSave())
  })

  it('Feature: 10-curse-stages, Property 10: Retry keeps knowledge', () => {
    // **Validates: Requirements 4.1, 4.4**
    fc.assert(
      fc.property(caseSaveArb, caseSaveArb, (snap, cur) => {
        const m = mergeRetry(snap, cur)
        for (const c of CASES) {
          const a = snap.cases[c.id]
          const b = cur.cases[c.id]
          const r = m.cases[c.id]
          expect(new Set(r.found)).toEqual(new Set([...a.found, ...b.found]))
          expect(new Set(r.links)).toEqual(new Set([...a.links, ...b.links]))
          expect(new Set(r.minigames)).toEqual(new Set([...a.minigames, ...b.minigames]))
          expect(r.wrongAnswers).toBe(a.wrongAnswers)
          expect(r.hints).toEqual(a.hints)
          expect(r.slots).toEqual(a.slots)
        }
        expect(m.doubt).toEqual(snap.doubt)
        expect(m.closed).toEqual(snap.closed)
      }),
      { numRuns: 100 },
    )
  })
})

function minimalState() {
  return {
    world: { phase: 'day', phaseTime: 0, nightNumber: 1, fogDensity: 0.02, wavesCleared: false },
    player: { position: [0, 0, 0], yaw: 0, pitch: 0, health: 100, stamina: 100, interactTarget: null },
    inventory: { slots: [], keyItems: [], relics: [], hotbar: [null, null, null, null] },
    mystery: {
      pages: new Set(),
      clues: new Set(),
      relics: new Set(),
      gates: { 'mausoleum-row': false, catacombs: false, ossuary: false },
      riteProgress: 0,
    },
    chapel: { completedStages: [], altarHealedToday: false, finalRiteActive: false },
    recipes: [],
  }
}
