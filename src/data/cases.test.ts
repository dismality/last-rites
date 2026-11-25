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
  CASE_2_CRESTS,
  CASE_2_FRESH_GRAVES,
  CASE_2_LOCKER_POSITION,
  CASE_2_PEOPLE,
  CASE_2_PRINT,
  CASE_2_VANE_CREST,
  CASE_2_WATCH_ROUNDS,
  CASE_2_RECEIPT,
  CASE_3_CRYPT_PROPS,
  CASE_3_HAND_SAMPLES,
  CASE_3_HYMN_BOARD,
  CASE_3_RUTS,
  CASE_MAP,
  HINT_COSTS,
  caseOfStage,
  type CaseDef,
  type ClueDef,
} from './cases'
import { ITEM_MAP } from './items'
import { checkTypedAnswer } from '../game/systems/caseAnswer'
import { CAPTIONS } from './captions'
import { HYMN_BOARD_NUMBERS } from './chapelScenery'
import { JOURNAL_PAGE_MAP } from './journal'
import { RELIC_MAP, RITE_ORDER, RITE_STEP_LINES } from './relics'
import { TOMBSTONE_MAP, type TombstoneId } from './tombstones'
import { CLOSED_CASE_PAGES } from './caseText'
import { STAGES, type StageNumber } from './stages'
import { FIXED_SPAWNS, type ZoneId } from './zones'
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

  it('has 3 hint tiers at 5, 10 and 20 coins and a 3 to 6 sentence closed page', () => {
    for (const c of CASES) {
      expect(c.hints.map((h) => h.cost)).toEqual([...HINT_COSTS])
      expect(c.closedPage.length).toBeGreaterThanOrEqual(3)
      // Case 1's page is the keeper's write-up, ending on what it proves (playtest story pass).
      expect(c.closedPage.length).toBeLessThanOrEqual(6)
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
        if (q.typed) {
          expect(q.slots).toHaveLength(0)
          expect(q.typed.accept.length).toBeGreaterThan(0)
          continue
        }
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
        s.cause !== undefined && s.cause !== e.cause ? 'cause' : null,
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
    expect(cond).toEqual({ pell: 'rope-cut', ames: 'intact', hale: 'intact' })
    const clueIds = new Set(
      c1.clues.filter((k) => k.found.kind === 'minigame' && k.found.id === '1b').map((k) => k.id),
    )
    for (const b of CASE_1_BELLS) if (b.clueId) expect(clueIds.has(b.clueId)).toBe(true)
    const pell = CASE_1_BELLS.find((b) => b.stone === 'pell')!
    // The tag is signed by J. Vane on the ledger's false date, a day before the stone's.
    expect(pell.tag).toContain('11 March')
    expect(pell.tag).toContain('J. Vane')
    expect(CASE_1_LEDGER.find((e) => e.id === 'l-pell')?.date).toBe('1862-03-11')
    for (const f of CASE_1_RIGHT_FLAGS) {
      const stone = CASE_1_STONES.find((x) => x.id === f.stoneId)!
      expect(CASE_1_LEDGER.find((e) => e.id === stone.ledgerId)?.amendedBy, f.stoneId).toBe('J.V.')
    }
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
  it('asks who silenced Pell, typed, and takes Josiah Vane in any case or spelling', () => {
    expect(c1.final.template).toBe('Who silenced John Pell?')
    expect(c1.final.slots).toHaveLength(0)
    for (const said of ['Josiah Vane', 'josiah vane', 'J. Vane', 'jv', ' JOSIAH  VANE ', 'the undertaker', 'Mr. Vane']) {
      expect(checkTypedAnswer(c1.final, said), said).toBe(true)
    }
    for (const said of ['', 'Pell', 'Silas Vane', 'Elias Thorne', 'the sexton']) {
      expect(checkTypedAnswer(c1.final, said), said).toBe(false)
    }
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
  it('runs the cart ruts down the Row to the Crane crypt step, under the pin', () => {
    expect(CASE_3_RUTS.fromZ).toBeGreaterThan(CASE_3_RUTS.toZ)
    expect(CASE_3_RUTS.start[2]).toBeLessThanOrEqual(CASE_3_RUTS.fromZ)
    expect(CASE_3_RUTS.start[2]).toBeGreaterThan(CASE_3_RUTS.toZ)
    expect(Math.abs(CASE_3_RUTS.toZ - CASE_3_CRYPT_PROPS.doorFaceZ)).toBeLessThan(1)
    expect(Math.abs(CASE_3_CRYPT_PROPS.pin[0] - CASE_3_CRYPT_PROPS.doorX)).toBeLessThan(1)
  })
  it('lays four hands side by side: three careful ones share the Vane loop, Josiah’s is plain', () => {
    expect(CASE_3_HAND_SAMPLES.map((h) => h.id)).toEqual(['ledger', 'receipt', 'note', 'signature'])
    for (const h of CASE_3_HAND_SAMPLES) {
      expect(h.text.includes('{V}')).toBe(h.careful)
      expect(h.text.includes('{v}')).toBe(!h.careful)
      expect(h.feature.length).toBeGreaterThan(0)
    }
    const receipt = CASE_3_HAND_SAMPLES.find((h) => h.id === 'receipt')!
    expect(receipt.text.replace(/\{([Vsv])\}/g, (_m, l: string) => l.toUpperCase() === 'V' ? 'V' : 's')).toBe(CASE_2_RECEIPT)
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
  it('asks who sealed Elias, takes Silas in any short form, and has the two red herrings', () => {
    const q = c3.accusation!
    expect(q.template).toBe('Who sealed Elias Thorne in the Crane crypt?')
    expect(q.typed?.accept).toEqual(expect.arrayContaining(['Silas Vane', 'Silas', 'S Vane', 'SV', 'the son', 'Vanes son']))
    expect(q.typed?.ask?.forms).toContain('Vane')
    expect(q.typed?.ask?.reply).toBe('Which Vane?')
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

  it('has three fresh graves, and only Arthur Finch, buried the 14th, was robbed', () => {
    expect(CASE_2_FRESH_GRAVES).toHaveLength(3)
    expect(CASE_2_FRESH_GRAVES.filter((g) => g.robbed).map((g) => g.id)).toEqual(['finch'])
  })

  it('leaves the midnight and 2 am countersigns empty, and only those', () => {
    expect(CASE_2_WATCH_ROUNDS.filter((r) => r.countersign === null).map((r) => r.time)).toEqual(['12 am', '2 am'])
    for (const r of CASE_2_WATCH_ROUNDS) expect(r.watchman).toBe(CASE_2_PEOPLE.keeper)
  })

  it("has three pairs of boots and only Kerr's match the print", () => {
    expect(CASE_2_BOOTS).toHaveLength(3)
    const same = (b: (typeof CASE_2_BOOTS)[number]) =>
      b.heel === CASE_2_PRINT.heel && b.nails === CASE_2_PRINT.nails && b.sole === CASE_2_PRINT.sole && b.clay === CASE_2_PRINT.clay
    expect(CASE_2_BOOTS.filter(same).map((b) => b.id)).toEqual([CASE_2_BOOT_MATCH])
  })

  it('rings the dial with six different crests, the Vane one not first', () => {
    expect(new Set(CASE_2_CRESTS.map((x) => x.id)).size).toBe(6)
    expect(CASE_2_CRESTS.some((x) => x.id === CASE_2_VANE_CREST)).toBe(true)
    expect(CASE_2_CRESTS[0].id).not.toBe(CASE_2_VANE_CREST)
  })

  it('asks who paid at the altar and takes forms of Vane and Sons', () => {
    for (const a of ['Vane and Sons', 'vane & sons', 'the Vanes']) expect(checkTypedAnswer(c.final, a)).toBe(true)
    expect(checkTypedAnswer(c.final, 'Kerr')).toBe(false)
  })

  it("gives the whistle in Kerr's locker once 2d is solved, and keeps the spade and school letter as red herrings", () => {
    const w = FIXED_SPAWNS.find((s) => s.item === 'bone-whistle')!
    expect(w.revealedBy).toBe('2d')
    expect(Math.hypot(w.position[0] - CASE_2_LOCKER_POSITION[0], w.position[2] - CASE_2_LOCKER_POSITION[2])).toBeLessThan(1.5)
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
    // Case 1 has no board links: its journal asks one question instead.
    for (const c of CASES.filter((x) => x.notes.length > 0)) {
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
