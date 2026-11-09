import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CONTRACTS } from '../../data/contracts'
import { DAWN_UPGRADES } from '../../data/dawnUpgrades'
import { ENEMIES } from '../../data/enemies'
import { MERCHANT_ROWS } from '../../data/merchant'
import { MODE_IDS } from '../../data/modes'
import { createInventory } from './inventory'
import {
  DEFAULT_SEED,
  defaultProgressionSave,
  sanitizeProgression,
  type NightSummary,
  type ProgressionSave,
} from './progressionSave'
import { createRunStats, type RunStats } from './runStats'

const ctx = { inventory: createInventory(), takenPickups: [] as string[] }
const roundTrip = (s: unknown): ProgressionSave => sanitizeProgression(JSON.parse(JSON.stringify(s)), ctx)

const count = fc.integer({ min: 0, max: 100000 })
const quarter = fc.integer({ min: 0, max: 4000 }).map((n) => n / 4)

const stats: fc.Arbitrary<RunStats> = fc
  .record({
    kills: fc.tuple(...ENEMIES.map(() => count)),
    nights: fc.integer({ min: 0, max: 5 }),
    banished: count,
    melee: count,
    fired: count,
    hitFrac: fc.double({ min: 0, max: 1, noNaN: true }),
    combo: quarter,
    time: quarter,
    earned: count,
    spent: count,
    digs: count,
    boards: count,
  })
  .map((r) => {
    const base = createRunStats()
    ENEMIES.forEach((e, i) => (base.kills[e.id] = r.kills[i]))
    return {
      ...base,
      nightsSurvived: r.nights,
      zombiesBanished: r.banished,
      meleeHits: r.melee,
      shotsFired: r.fired,
      shotsHit: Math.floor(r.fired * r.hitFrac),
      bestCombo: r.combo,
      timeS: r.time,
      coinsEarned: r.earned,
      coinsSpent: r.spent,
      digs: r.digs,
      boardsNailed: r.boards,
    }
  })

const summary: fc.Arbitrary<NightSummary> = fc.record({
  night: fc.integer({ min: 1, max: 12 }),
  zombiesBanished: count,
  itemsFound: count,
  recipeUnlocked: fc.option(fc.constantFrom('r-bone-club', 'r-nail-bomb'), { nil: null }),
  journalPageAvailable: fc.boolean(),
  killPoints: count,
  clearBonus: count,
  noDamageBonus: count,
  nightScore: count,
})

const ranksArb = fc
  .tuple(...DAWN_UPGRADES.map((d) => fc.integer({ min: 0, max: d.maxRank })))
  .map((rs) => {
    const out: Record<string, number> = {}
    DAWN_UPGRADES.forEach((d, i) => {
      if (rs[i] > 0) out[d.id] = rs[i]
    })
    return out
  })

const contractsArb = fc
  .uniqueArray(fc.constantFrom(...CONTRACTS), { maxLength: 2, selector: (c) => c.id })
  .chain((defs) =>
    fc.tuple(...defs.map((d) => fc.integer({ min: 0, max: d.goal }))).map((ps) =>
      defs.map((d, i) => ({ id: d.id, progress: ps[i], done: ps[i] === d.goal })),
    ),
  )

const stockArb = fc.option(
  fc
    .uniqueArray(fc.constantFrom(...MERCHANT_ROWS), { minLength: 5, maxLength: 5, selector: (r) => r.id })
    .chain((rows) =>
      fc.tuple(...rows.map((r) => fc.integer({ min: 0, max: r.dailyQty }))).map((qs) => ({
        rows: rows.map((r, i) => ({ id: r.id, qty: qs[i] })),
      })),
    ),
  { nil: null },
)

const validSave: fc.Arbitrary<ProgressionSave> = fc
  .record({
    mode: fc.constantFrom(...MODE_IDS),
    seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
    ranks: ranksArb,
    summary: fc.option(summary, { nil: null }),
    score: count,
    bossScored: fc.boolean(),
    coins: count,
    contracts: contractsArb,
    stock: stockArb,
    stats,
    storm: fc.boolean(),
    pickSeed: fc.integer({ min: 0, max: 1000 }),
  })
  .map((r) => {
    // An open pick offers up to three upgrades that are still below max rank.
    const open = DAWN_UPGRADES.filter((d) => (r.ranks[d.id] ?? 0) < d.maxRank).map((d) => d.id)
    const start = open.length === 0 ? 0 : r.pickSeed % open.length
    const offer = [...open.slice(start), ...open.slice(0, start)].slice(0, 3)
    return {
      mode: r.mode,
      seed: r.seed,
      ranks: r.ranks,
      pendingPick: offer.length === 0 ? null : offer,
      dawnSummary: r.summary,
      score: r.score,
      bossScored: r.bossScored,
      coins: r.coins,
      contracts: r.contracts,
      stock: r.stock,
      stats: r.stats,
      storm: { active: r.storm },
    }
  })

describe('sanitizeProgression', () => {
  /** Property 33: Persistent state round trips and sanitises per field. Validates: Requirements 1.11, 6.5, 11.1, 11.4, 11.5, 11.8, 11.9, 11.10, 11.11, 11.13 */
  it('round-trips any valid progression state through JSON', () => {
    fc.assert(fc.property(validSave, (s) => {
        expect(roundTrip(s)).toEqual(s)
      }),
    )
  })

  it('replaces only the invalid field and keeps every other field', () => {
    const junk: Record<keyof ProgressionSave, unknown[]> = {
      mode: ['hardcore', 7, null],
      seed: [-1, 1.5, 'x', null],
      ranks: [{ 'iron-constitution': 99, bogus: 1 }, 'x', []],
      pendingPick: ['x', { a: 1 }, 5],
      dawnSummary: ['x', { night: -1 }, 5],
      score: [-5, 2.5, 'x', null],
      bossScored: ['yes', 1, null],
      coins: [-1, 1.5, 'x', null],
      contracts: ['x', [{ id: 'nope', progress: 0, done: false }], 5],
      stock: ['x', { rows: [] }, { rows: 5 }],
      stats: ['x', null, 5],
      storm: ['x', { active: 'yes' }, 5],
    }
    const keys = Object.keys(junk) as (keyof ProgressionSave)[]
    fc.assert(
      fc.property(validSave, fc.constantFrom(...keys), fc.nat(10), (s, key, i) => {
        const bad = junk[key][i % junk[key].length]
        const back = sanitizeProgression({ ...s, [key]: bad }, ctx)
        const def = defaultProgressionSave()
        for (const k of keys) {
          if (k === key) expect(back[k]).toEqual(def[k])
          else expect(back[k]).toEqual(s[k])
        }
      }),
    )
  })

  it('gives all defaults for a missing or non-object block', () => {
    for (const raw of [undefined, null, 'x', 5, []]) {
      expect(sanitizeProgression(raw, ctx)).toEqual(defaultProgressionSave())
    }
    expect(defaultProgressionSave().seed).toBe(DEFAULT_SEED)
    expect(defaultProgressionSave().mode).toBe('normal')
  })

  it('drops unknown ranks, maxed pick entries, duplicates and extra contracts', () => {
    const back = sanitizeProgression(
      {
        ranks: { 'deep-pockets': 1, 'long-wick': 3, bogus: 1 },
        pendingPick: ['deep-pockets', 'long-wick', 'long-wick', 'bogus', 'steady-hands', 'marksman', 'second-wind'],
        contracts: [
          { id: 'c-dig-3', progress: 3, done: false },
          { id: 'c-dig-3', progress: 1, done: false },
          { id: 'c-melee-10', progress: 99, done: true },
          { id: 'c-unhurt', progress: 0, done: false },
        ],
      },
      ctx,
    )
    expect(back.ranks).toEqual({ 'deep-pockets': 1 })
    expect(back.pendingPick).toEqual(['long-wick', 'steady-hands', 'marksman'])
    expect(back.contracts).toEqual([
      { id: 'c-dig-3', progress: 3, done: true },
      { id: 'c-melee-10', progress: 0, done: true },
    ])
  })

  it('keeps earlier fields of a pre-08 save and defaults the new ones', () => {
    const back = sanitizeProgression({ stats: { digs: 4 }, somethingOld: true }, ctx)
    expect(back.stats.digs).toBe(4)
    expect({ ...back, stats: undefined }).toEqual({ ...defaultProgressionSave(), stats: undefined })
  })
})
