import { describe, expect, it } from 'vitest'
import {
  CASES,
  CASE_1_BELLS,
  CASE_1_LEDGER,
  CASE_1_REWARD,
  CASE_1_RIGHT_FLAGS,
  CASE_1_STONES,
  CASE_MAP,
  HINT_COSTS,
  caseOfStage,
  type CaseDef,
  type ClueDef,
} from './cases'
import { ITEM_MAP } from './items'
import { TOMBSTONE_MAP, type TombstoneId } from './tombstones'
import { CLOSED_CASE_PAGES } from './caseText'
import { STAGES, type StageNumber } from './stages'
import type { ZoneId } from './zones'

/** Zones a player can walk in by stage (Mausoleum Row needs the key from case 1, the
 *  catacombs the whistle from case 2). The chapel is always open. */
const ZONES_BY_STAGE: Record<StageNumber, readonly ZoneId[]> = {
  1: ['grounds', 'chapel'],
  2: ['grounds', 'chapel', 'mausoleum-row'],
  3: ['grounds', 'chapel', 'mausoleum-row', 'catacombs'],
}
/** The merchant first opens at the dawn that ends stage 1, so purchases start in stage 2. */
const PURCHASE_FROM_STAGE = 2

function clueReachable(c: CaseDef, clue: ClueDef): boolean {
  const s = clue.found
  switch (s.kind) {
    case 'minigame':
      return c.minigames.includes(s.id) && s.id.startsWith(String(c.stage))
    case 'walk':
      return ZONES_BY_STAGE[c.stage].includes(s.spot)
    case 'purchase':
      return c.stage >= PURCHASE_FROM_STAGE
    case 'item':
      return true
  }
}

describe('case data', () => {
  it('has one case per stage, matching the stage data', () => {
    expect(CASES.map((c) => c.stage)).toEqual([1, 2, 3])
    for (const s of STAGES) {
      expect(caseOfStage(s.stage).id).toBe(s.caseId)
      expect(caseOfStage(s.stage).title).toBe(s.caseTitle)
      expect(CASE_MAP[s.caseId].stage).toBe(s.stage)
    }
  })

  it('uses unique kebab-case clue ids across all cases', () => {
    const ids = CASES.flatMap((c) => c.clues.map((k) => k.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it('has 3 hint tiers at 5, 10 and 20 coins and a 3 to 5 sentence closed page', () => {
    for (const c of CASES) {
      expect(c.hints.map((h) => h.cost)).toEqual([...HINT_COSTS])
      expect(c.closedPage.length).toBeGreaterThanOrEqual(3)
      expect(c.closedPage.length).toBeLessThanOrEqual(5)
      expect(c.closedPage).toBe(CLOSED_CASE_PAGES[c.id])
      expect(c.curseSteps).toBeGreaterThan(0)
    }
  })
})

describe('Property 18: case data is internally consistent', () => {
  it('every note references two distinct existing clues of the same case', () => {
    for (const c of CASES) {
      const ids = new Set(c.clues.map((k) => k.id))
      const pairs = new Set<string>()
      for (const n of c.notes) {
        expect(ids.has(n.a)).toBe(true)
        expect(ids.has(n.b)).toBe(true)
        expect(n.a).not.toBe(n.b)
        expect(n.text.length).toBeGreaterThan(0)
        const key = [n.a, n.b].sort().join('|')
        expect(pairs.has(key)).toBe(false)
        pairs.add(key)
      }
    }
  })

  it('every answer is among its slot options and matches the slot count', () => {
    for (const c of CASES) {
      for (const q of [c.final, ...(c.accusation ? [c.accusation] : [])]) {
        expect(q.answer.length).toBe(q.slots.length)
        const holes = (q.template.match(/\{\d+\}/g) ?? []).length
        expect(holes).toBe(q.slots.length)
        q.slots.forEach((slot, i) => {
          expect(slot.options).toContain(q.answer[i])
        })
      }
    }
  })

  it('only case 3 has an optional accusation', () => {
    expect(CASES.filter((c) => c.accusation).map((c) => c.id)).toEqual(['sealed-catacombs'])
    expect(CASE_MAP['sealed-catacombs'].accusation?.optional).toBe(true)
  })
})

describe('case 1 minigame data', () => {
  const c1 = CASE_MAP['saved-by-the-bell']
  it('has 8 ledger entries with unique ids and 6 stones that each point at one', () => {
    expect(CASE_1_LEDGER).toHaveLength(8)
    expect(new Set(CASE_1_LEDGER.map((e) => e.id)).size).toBe(8)
    expect(CASE_1_STONES).toHaveLength(6)
    const ids = new Set(CASE_1_LEDGER.map((e) => e.id))
    for (const s of CASE_1_STONES) expect(ids.has(s.ledgerId)).toBe(true)
    expect(new Set(CASE_1_STONES.map((s) => s.ledgerId)).size).toBe(6)
  })
  it('reuses the real tombstone positions and dates for the four old stones', () => {
    for (const s of CASE_1_STONES.filter((x) => x.id in TOMBSTONE_MAP)) {
      const t = TOMBSTONE_MAP[s.id as TombstoneId]
      expect([...s.position]).toEqual([...t.position])
      expect(s.date).toBe(s.id === 'pell' ? '1862-03-12' : t.date)
    }
    expect(
      ['marsh', 'hale', 'ames', 'pell'].every((id) => CASE_1_STONES.some((s) => s.id === id)),
    ).toBe(true)
  })
  it('derives each flagged mismatch from the data and has exactly three right flags', () => {
    const led = Object.fromEntries(CASE_1_LEDGER.map((e) => [e.id, e]))
    for (const s of CASE_1_STONES) {
      const e = led[s.ledgerId]
      const found = [
        e.date !== s.date ? 'date' : null,
        e.plot !== s.plot ? 'plot' : null,
        e.certificate ? null : 'certificate',
      ].filter(Boolean)
      expect(found, s.id).toEqual(s.mismatch ? [s.mismatch] : [])
    }
    expect(CASE_1_RIGHT_FLAGS).toHaveLength(3)
    for (const f of CASE_1_RIGHT_FLAGS) {
      expect(CASE_1_STONES.find((s) => s.id === f.stoneId)?.mismatch).toBe(f.kind)
    }
  })
  it('puts a bell post at each flagged grave and the telling details in the bell clues', () => {
    expect(CASE_1_BELLS.map((b) => b.stone).sort()).toEqual(
      CASE_1_RIGHT_FLAGS.map((f) => f.stoneId).sort(),
    )
    const cond = Object.fromEntries(CASE_1_BELLS.map((b) => [b.stone, b.condition]))
    expect(cond).toEqual({ pell: 'rope-cut', ames: 'rusted-solid', hale: 'intact' })
    const clueIds = new Set(
      c1.clues.filter((k) => k.found.kind === 'minigame' && k.found.id === '1b').map((k) => k.id),
    )
    for (const b of CASE_1_BELLS) if (b.clueId) expect(clueIds.has(b.clueId)).toBe(true)
    const pell = CASE_1_BELLS.find((b) => b.stone === 'pell')!
    expect(pell.tag).toContain('12 March')
    expect(CASE_1_LEDGER.find((e) => e.id === 'l-pell')?.date).toBe('1862-03-13')
  })
  it("hides the key in Pell's grave and the red herrings stand by their stones", () => {
    expect(CASE_1_REWARD.stone).toBe('pell')
    expect(ITEM_MAP[CASE_1_REWARD.item].kind).toBe('key')
    for (const [id, stone] of [
      ['hale-fresh-flowers', 'hale'],
      ['marsh-stone-toppled', 'marsh'],
    ] as const) {
      const clue = c1.clues.find((k) => k.id === id)!
      expect(clue.redHerring).toBe(true)
      expect(clue.found.kind).toBe('walk')
      if (clue.found.kind === 'walk') {
        const [x, , z] = clue.found.position
        const [sx, , sz] = TOMBSTONE_MAP[stone].position
        expect(Math.hypot(x - sx, z - sz)).toBeLessThan(3)
      }
    }
  })
  it('answers Pell with the cut rope and the early certificate', () => {
    expect(c1.final.answer[0]).toBe("Pell's grave")
    expect(c1.final.answer[1]).toContain('rope was cut')
    expect(c1.final.answer[1]).toContain('certificate was signed before')
  })
})

describe("Property 17: every answer's clues are reachable", () => {
  it('each case has 6 to 8 clues, at least 2 red herrings, all from a reachable source', () => {
    for (const c of CASES) {
      expect(c.clues.length).toBeGreaterThanOrEqual(6)
      expect(c.clues.length).toBeLessThanOrEqual(8)
      expect(c.clues.filter((k) => k.redHerring).length).toBeGreaterThanOrEqual(2)
      for (const clue of c.clues) expect(clueReachable(c, clue), `${c.id}/${clue.id}`).toBe(true)
    }
  })

  it('every needed clue is linked by at least one note and every minigame yields a clue', () => {
    for (const c of CASES) {
      const linked = new Set(c.notes.flatMap((n) => [n.a, n.b]))
      for (const clue of c.clues.filter((k) => !k.redHerring)) {
        expect(linked.has(clue.id), `${c.id}/${clue.id}`).toBe(true)
      }
      for (const mg of c.minigames) {
        expect(c.clues.some((k) => k.found.kind === 'minigame' && k.found.id === mg)).toBe(true)
      }
    }
  })

  it('no note links a red herring to a needed clue', () => {
    for (const c of CASES) {
      const rh = new Set(c.clues.filter((k) => k.redHerring).map((k) => k.id))
      for (const n of c.notes) expect(rh.has(n.a) || rh.has(n.b)).toBe(false)
    }
  })
})
