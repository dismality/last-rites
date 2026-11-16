import { describe, expect, it } from 'vitest'
import {
  CASES,
  CASE_1_BELLS,
  CASE_1_LEDGER,
  CASE_1_REWARD,
  CASE_1_RIGHT_FLAGS,
  CASE_1_STONES,
  CASE_2_BOOTS,
  CASE_2_BOOT_MATCH,
  CASE_2_CASTS,
  CASE_2_CREST_LOCK,
  CASE_2_SUSPECTS,
  CASE_2_WATCH_GAP,
  CASE_2_WATCH_LOG,
  CASE_2_WATCH_ORDER,
  CASE_2_WATCH_SHELF,
  CASE_3_EVIDENCE,
  CASE_3_HYMN_BOARD,
  CASE_3_TIMELINE_ORDER,
  CASE_3_VANE_PAPERS,
  CASE_MAP,
  HINT_COSTS,
  caseOfStage,
  type CaseDef,
  type ClueDef,
} from './cases'
import { ITEM_MAP } from './items'
import { CAPTIONS } from './captions'
import { HYMN_BOARD_NUMBERS } from './chapelScenery'
import { JOURNAL_PAGE_MAP } from './journal'
import { RELIC_MAP, RITE_ORDER, RITE_STEP_LINES } from './relics'
import { TOMBSTONE_MAP, type TombstoneId } from './tombstones'
import { CLOSED_CASE_PAGES } from './caseText'
import { STAGES, type StageNumber } from './stages'
import { FIXED_SPAWNS, type ZoneId } from './zones'
import { avenueCrypts } from './cemeteryLayout'
import { zoneAt } from '../game/systems/zoneAt'

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

describe('case 3 data', () => {
  const c3 = CASE_MAP['sealed-catacombs']
  it('has a 60-hymn index whose first letters at the board numbers spell BELOW', () => {
    expect(CASE_3_HYMN_BOARD.index).toHaveLength(60)
    expect([...CASE_3_HYMN_BOARD.numbers]).toEqual([...HYMN_BOARD_NUMBERS])
    const word = CASE_3_HYMN_BOARD.numbers.map((n) => CASE_3_HYMN_BOARD.index[n - 1][0]).join('')
    expect(word).toBe(CASE_3_HYMN_BOARD.letters)
    expect(CASE_3_HYMN_BOARD.confession).toBe('What I hid, I hid beneath the Word.')
  })
  it('has six evidence cards and one right order covering each exactly once', () => {
    expect(CASE_3_EVIDENCE).toHaveLength(6)
    expect([...CASE_3_TIMELINE_ORDER].sort()).toEqual(CASE_3_EVIDENCE.map((e) => e.id).sort())
    const times = CASE_3_TIMELINE_ORDER.map((id) => CASE_3_EVIDENCE.find((e) => e.id === id)!)
    expect(times[0].time).toBe('Midnight')
    expect(times[5].time).toBe('Before dawn')
    for (const e of CASE_3_EVIDENCE) {
      expect(e.beat.length).toBeGreaterThan(0)
      if (e.clueId) expect(c3.clues.some((k) => k.id === e.clueId)).toBe(true)
    }
  })
  it("takes the relics in the confession's order and names them in the final answer", () => {
    expect(RITE_ORDER).toHaveLength(5)
    expect(new Set(RITE_ORDER).size).toBe(5)
    expect(c3.final.answer).toEqual(RITE_ORDER.map((id) => RELIC_MAP[id].name))
    for (const id of RITE_ORDER) expect(RITE_STEP_LINES[id].length).toBeGreaterThan(0)
    const page4 = JOURNAL_PAGE_MAP[4].text
    const at = RITE_ORDER.map((id) =>
      page4.indexOf(RELIC_MAP[id].name.split(' ').pop()!.toLowerCase()),
    )
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
  it('links the Vane hand across letter, flyleaf and receipt, and has the two red herrings', () => {
    expect(CASE_3_VANE_PAPERS.letter).toContain("undertaker's family")
    expect(CASE_3_VANE_PAPERS.flyleaf).toContain('Josiah Vane')
    expect(CASE_3_VANE_PAPERS.receipt).toContain('Vane & Sons')
    expect(c3.accusation?.answer).toEqual([
      'Silas Vane',
      'the handwriting',
      'the hearse-pin',
      'the cart ruts',
    ])
    expect(c3.clues.filter((k) => k.redHerring).map((k) => k.id)).toEqual([
      'oil-other-crypt',
      'old-bishops-seal',
    ])
  })
  it('captions the stage 3 sounds', () => {
    for (const id of ['hymn-tiles-wrong', 'hymn-stair-open', 'crypt-pin-pulled', 'relic-placed']) {
      expect(CAPTIONS.some((c) => c.id === id)).toBe(true)
    }
  })
})

describe('case 2 data', () => {
  const c = CASE_MAP['resurrection-men']

  it('has four suspects, and the Who options are exactly them', () => {
    expect(Object.values(CASE_2_SUSPECTS)).toEqual(c.final.slots[0].options)
  })

  it('puts six tablets on the six avenue crypts, with four founders on the dials', () => {
    const t = CASE_2_CREST_LOCK.tablets
    expect(t).toHaveLength(6)
    expect(new Set(t.map((x) => x.crypt)).size).toBe(6)
    expect(Math.max(...t.map((x) => x.crypt))).toBeLessThan(avenueCrypts().length)
    expect(new Set(t.map((x) => x.crest)).size).toBe(6)
    expect(new Set(t.map((x) => x.year)).size).toBe(6)
    expect(CASE_2_CREST_LOCK.dialCrests).toHaveLength(4)
    for (const d of CASE_2_CREST_LOCK.dialCrests) expect(t.some((x) => x.crest === d)).toBe(true)
    expect(CASE_2_CREST_LOCK.note).toBe('Turn them in the order the founders were laid down')
  })

  it('has 8 watch entries, one right order, a scrambled shelf and the gap on the lodge keeper', () => {
    expect(CASE_2_WATCH_LOG).toHaveLength(8)
    expect([...CASE_2_WATCH_ORDER].sort()).toEqual(CASE_2_WATCH_LOG.map((e) => e.id).sort())
    expect([...CASE_2_WATCH_SHELF].sort()).toEqual([...CASE_2_WATCH_ORDER].sort())
    expect(CASE_2_WATCH_SHELF).not.toEqual(CASE_2_WATCH_ORDER)
    const at = (id: string) => CASE_2_WATCH_ORDER.indexOf(id as never)
    expect(at(CASE_2_WATCH_GAP.before)).toBe(at(CASE_2_WATCH_GAP.after) + 1)
    expect(CASE_2_WATCH_LOG.find((e) => e.id === CASE_2_WATCH_GAP.after)!.watchman).toBe(CASE_2_WATCH_GAP.keeper)
    expect(CASE_2_SUSPECTS[CASE_2_WATCH_GAP.keeper]).toBe(c.final.answer[0])
  })

  it('has 3 casts and 4 boots; the one match is the answer and its twin differs only in hobnails', () => {
    expect(CASE_2_CASTS).toHaveLength(3)
    expect(CASE_2_BOOTS).toHaveLength(4)
    expect(CASE_2_SUSPECTS[CASE_2_BOOT_MATCH.boot]).toBe(c.final.answer[0])
    const cast = CASE_2_CASTS.find((x) => x.id === CASE_2_BOOT_MATCH.cast)!
    const boot = CASE_2_BOOTS.find((x) => x.owner === CASE_2_BOOT_MATCH.boot)!
    expect([cast.tread, cast.size, cast.hobnails]).toEqual([boot.tread, boot.size, boot.hobnails])
  })

  it('gives the whistle at the niche once 2a is solved, and keeps the spade and school letter as red herrings', () => {
    const w = FIXED_SPAWNS.find((s) => s.item === 'bone-whistle')!
    expect(w.revealedBy).toBe('2a')
    expect(Math.hypot(w.position[0] - CASE_2_CREST_LOCK.niche[0], w.position[2] - CASE_2_CREST_LOCK.niche[2])).toBeLessThan(1)
    const rh = c.clues.filter((k) => k.redHerring).map((k) => k.id)
    expect(rh).toEqual(['spade-fresh-clay', 'doctor-school-letter'])
  })
})

describe('walk clue positions', () => {
  it('every walk clue lies inside its own zone', () => {
    for (const c of CASES) {
      for (const k of c.clues) {
        if (k.found.kind !== 'walk') continue
        expect(zoneAt(k.found.position[0], k.found.position[2]), k.id).toBe(k.found.spot)
      }
    }
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
