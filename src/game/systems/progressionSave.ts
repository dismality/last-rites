// Progression save sanitising — pure TypeScript. Req 1.11, 6.5, 11.1, 11.4, 11.5, 11.8–11.11, 11.13.
//
// Read field by field, like sanitizeCombat: an invalid field is replaced by its default
// and every valid field is kept, so one bad value never wipes the rest.

import { CONTRACTS, CONTRACTS_PER_DAWN } from '../../data/contracts'
import { DAWN_UPGRADES, OFFER_SIZE } from '../../data/dawnUpgrades'
import { FIXED_ROWS, MERCHANT_ROWS, POOL_ROWS } from '../../data/merchant'
import { MODE_IDS } from '../../data/modes'
import type { Inventory, ModeId } from '../types'
import { parseStats, type RunStats } from './runStats'

/** Seed used for a new run's fallback and for saves from before spec 08. */
export const DEFAULT_SEED = 1849

/** What the dawn card shows for the night just survived. Plain values only. */
export interface NightSummary {
  night: number
  zombiesBanished: number
  itemsFound: number
  recipeUnlocked: string | null
  journalPageAvailable: boolean
  killPoints: number
  clearBonus: number
  noDamageBonus: number
  nightScore: number
}

export interface ProgressionSave {
  mode: ModeId
  seed: number
  ranks: Record<string, number>
  pendingPick: string[] | null
  dawnSummary: NightSummary | null
  score: number
  bossScored: boolean
  coins: number
  contracts: { id: string; progress: number; done: boolean }[]
  stock: { rows: { id: string; qty: number }[] } | null
  stats: RunStats
  storm: { active: boolean }
}

export interface ProgressionSaveContext {
  inventory: Inventory
  takenPickups: readonly string[]
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isCount = (v: unknown): v is number => isInt(v) && v >= 0

const MAX_RANK = new Map<string, number>(DAWN_UPGRADES.map((d) => [d.id, d.maxRank]))
const CONTRACT_GOAL = new Map<string, number>(CONTRACTS.map((c) => [c.id, c.goal]))
const ROW_DAILY_QTY = new Map<string, number>(MERCHANT_ROWS.map((r) => [r.id, r.dailyQty]))
const STOCK_ROWS = FIXED_ROWS + POOL_ROWS

export function defaultProgressionSave(): ProgressionSave {
  return {
    mode: 'normal',
    seed: DEFAULT_SEED,
    ranks: {},
    pendingPick: null,
    dawnSummary: null,
    score: 0,
    bossScored: false,
    coins: 0,
    contracts: [],
    stock: null,
    stats: parseStats(undefined),
    storm: { active: false },
  }
}

function sanitizeRanks(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isObj(raw)) return out
  for (const [id, max] of MAX_RANK) {
    const v = Object.prototype.hasOwnProperty.call(raw, id) ? raw[id] : 0
    // An out-of-range rank is treated as 0, which leaves it out of the map.
    if (isInt(v) && v >= 1 && v <= max) out[id] = v
  }
  return out
}

function sanitizePick(raw: unknown, ranks: Record<string, number>): string[] | null {
  if (!Array.isArray(raw)) return null
  const out: string[] = []
  for (const id of raw) {
    if (typeof id !== 'string' || out.includes(id)) continue
    const max = MAX_RANK.get(id)
    if (max === undefined || (ranks[id] ?? 0) >= max) continue
    out.push(id)
  }
  return out.length === 0 ? null : out.slice(0, OFFER_SIZE)
}

function sanitizeSummary(raw: unknown): NightSummary | null {
  if (!isObj(raw)) return null
  const { night, zombiesBanished, itemsFound, recipeUnlocked, journalPageAvailable } = raw
  const { killPoints, clearBonus, noDamageBonus, nightScore } = raw
  if (
    !isCount(night) ||
    !isCount(zombiesBanished) ||
    !isCount(itemsFound) ||
    !(recipeUnlocked === null || typeof recipeUnlocked === 'string') ||
    typeof journalPageAvailable !== 'boolean' ||
    !isCount(killPoints) ||
    !isCount(clearBonus) ||
    !isCount(noDamageBonus) ||
    !isCount(nightScore)
  ) {
    return null
  }
  return {
    night,
    zombiesBanished,
    itemsFound,
    recipeUnlocked,
    journalPageAvailable,
    killPoints,
    clearBonus,
    noDamageBonus,
    nightScore,
  }
}

function sanitizeContracts(raw: unknown): ProgressionSave['contracts'] {
  if (!Array.isArray(raw)) return []
  const out: ProgressionSave['contracts'] = []
  for (const c of raw) {
    if (!isObj(c) || typeof c.id !== 'string') continue
    const id = c.id
    const goal = CONTRACT_GOAL.get(id)
    if (goal === undefined || out.some((o) => o.id === id)) continue
    const progress = isInt(c.progress) && c.progress >= 0 && c.progress <= goal ? c.progress : 0
    out.push({ id, progress, done: progress === goal || c.done === true })
  }
  return out.slice(0, CONTRACTS_PER_DAWN)
}

function sanitizeStock(raw: unknown): ProgressionSave['stock'] {
  if (!isObj(raw) || !Array.isArray(raw.rows)) return null
  const rows: { id: string; qty: number }[] = []
  for (const r of raw.rows) {
    if (!isObj(r) || typeof r.id !== 'string') continue
    const daily = ROW_DAILY_QTY.get(r.id)
    if (daily === undefined || rows.some((o) => o.id === r.id)) continue
    if (!isInt(r.qty) || r.qty < 0 || r.qty > daily) continue
    rows.push({ id: r.id, qty: r.qty })
  }
  return rows.length === STOCK_ROWS ? { rows } : null
}

/** Reads the progression block of a save. Never throws; junk or a missing block gives defaults. */
export function sanitizeProgression(raw: unknown, ctx: ProgressionSaveContext): ProgressionSave {
  // Nothing in the context changes the result yet; it is part of the signature so callers
  // need no change when a field starts depending on the inventory.
  void ctx
  const d = defaultProgressionSave()
  if (!isObj(raw)) return d
  const ranks = sanitizeRanks(raw.ranks)
  return {
    mode: MODE_IDS.includes(raw.mode as ModeId) ? (raw.mode as ModeId) : d.mode,
    seed: isCount(raw.seed) ? raw.seed : d.seed,
    ranks,
    pendingPick: sanitizePick(raw.pendingPick, ranks),
    dawnSummary: sanitizeSummary(raw.dawnSummary),
    score: isCount(raw.score) ? raw.score : 0,
    bossScored: raw.bossScored === true,
    coins: isCount(raw.coins) ? raw.coins : 0,
    contracts: sanitizeContracts(raw.contracts),
    stock: sanitizeStock(raw.stock),
    stats: parseStats(raw.stats),
    storm: { active: isObj(raw.storm) && raw.storm.active === true },
  }
}
