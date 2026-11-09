// Dawn upgrades: offer, pick and the one pure map from owned ranks to modifiers (spec 08, Req 1).
import { DAWN_UPGRADES, OFFER_SIZE, UPGRADE_PER_RANK } from '../../data/dawnUpgrades'
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import { SATCHEL_SLOTS } from '../../data/items'
import type { Rng } from '../rng'
import type { DawnUpgradeId } from '../types'

export type Ranks = Readonly<Partial<Record<DawnUpgradeId, number>>>

const DEF_BY_ID = new Map(DAWN_UPGRADES.map((d) => [d.id, d]))

export const rankOf = (r: Ranks, id: DawnUpgradeId): number => r[id] ?? 0

/** Upgrades that can still be raised, in pool order. */
export function belowMax(r: Ranks): DawnUpgradeId[] {
  return DAWN_UPGRADES.filter((d) => rankOf(r, d.id) < d.maxRank).map((d) => d.id)
}

/** Partial Fisher-Yates: only the first OFFER_SIZE slots are shuffled, so one rng draw per card. */
export function offerUpgrades(r: Ranks, rng: Rng): DawnUpgradeId[] {
  const pool = belowMax(r)
  const n = Math.min(OFFER_SIZE, pool.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool.slice(0, n)
}

/** Raises one rank by 1. Unknown or maxed ids return the same object so callers can detect a no-op. */
export function pickUpgrade(r: Ranks, id: DawnUpgradeId): Ranks {
  const def = DEF_BY_ID.get(id)
  if (!def || rankOf(r, id) >= def.maxRank) return r
  return { ...r, [id]: rankOf(r, id) + 1 }
}

export interface Modifiers {
  maxHealthBonus: number
  reloadTimeMult: number
  lanternDrainMult: number
  satchelSlots: number
  staminaRegenMult: number
  digTimeMult: number
  boardHpMult: number
  coinDropMult: number
  headshotMultAdd: number
  flaskRadiusBonusM: number
}

export const IDENTITY_MODIFIERS: Modifiers = {
  maxHealthBonus: 0,
  reloadTimeMult: 1,
  lanternDrainMult: 1,
  satchelSlots: SATCHEL_SLOTS,
  staminaRegenMult: 1,
  digTimeMult: 1,
  boardHpMult: 1,
  coinDropMult: 1,
  headshotMultAdd: 0,
  flaskRadiusBonusM: 0,
}

export function modifiersFromRanks(r: Ranks): Modifiers {
  const k = UPGRADE_PER_RANK
  const rk = (id: DawnUpgradeId) => rankOf(r, id)
  const base = IDENTITY_MODIFIERS
  return {
    maxHealthBonus: base.maxHealthBonus + k.maxHealth * rk('iron-constitution'),
    reloadTimeMult: base.reloadTimeMult - k.reload * rk('steady-hands'),
    lanternDrainMult: base.lanternDrainMult - k.lanternDrain * rk('long-wick'),
    satchelSlots: base.satchelSlots + k.satchelSlots * rk('deep-pockets'),
    staminaRegenMult: base.staminaRegenMult + k.staminaRegen * rk('second-wind'),
    digTimeMult: base.digTimeMult - k.digTime * rk('gravedigger'),
    boardHpMult: base.boardHpMult + k.boardHp * rk('hardened-boards'),
    coinDropMult: base.coinDropMult + k.coinDrop * rk('grim-harvest'),
    headshotMultAdd: base.headshotMultAdd + k.headshot * rk('marksman'),
    flaskRadiusBonusM: base.flaskRadiusBonusM + k.flaskRadiusM * rk('blessed-reach'),
  }
}

export interface UpgradeCard {
  id: DawnUpgradeId
  name: string
  rune: string
  /** "Rank 1/2": the rank the pick would give, out of the max. */
  rankText: string
  /** One "Stat old → new" line per changed stat. */
  lines: string[]
}

const PCT = 100
const trim = (n: number): string => String(Math.round(n * PCT) / PCT)
const pct = (n: number): string => `${Math.round(n * PCT)}%`

const STAT_LINES: readonly {
  key: keyof Modifiers
  label: string
  fmt: (n: number) => string
}[] = [
  { key: 'maxHealthBonus', label: 'Max health', fmt: (n) => String(PLAYER_MAX_HEALTH + n) },
  { key: 'reloadTimeMult', label: 'Reload time', fmt: pct },
  { key: 'lanternDrainMult', label: 'Lantern fuel drain', fmt: pct },
  { key: 'satchelSlots', label: 'Satchel slots', fmt: String },
  { key: 'staminaRegenMult', label: 'Stamina regeneration', fmt: pct },
  { key: 'digTimeMult', label: 'Dig time', fmt: pct },
  { key: 'boardHpMult', label: 'Board health', fmt: pct },
  { key: 'coinDropMult', label: 'Grave Coin drops', fmt: pct },
  { key: 'headshotMultAdd', label: 'Headshot bonus', fmt: (n) => `+${trim(n)}` },
  { key: 'flaskRadiusBonusM', label: 'Flask radius bonus', fmt: (n) => `+${trim(n)} m` },
]

/** Built from the modifiers before and after the pick, so it cannot disagree with modifiersFromRanks. */
export function upgradeCard(r: Ranks, id: DawnUpgradeId): UpgradeCard {
  const def = DEF_BY_ID.get(id)
  if (!def) throw new Error(`Unknown dawn upgrade: ${id}`)
  const before = modifiersFromRanks(r)
  const after = modifiersFromRanks(pickUpgrade(r, id))
  const lines = STAT_LINES.filter((s) => before[s.key] !== after[s.key]).map(
    (s) => `${s.label} ${s.fmt(before[s.key])} → ${s.fmt(after[s.key])}`,
  )
  const next = Math.min(rankOf(r, id) + 1, def.maxRank)
  return { id, name: def.name, rune: def.rune, rankText: `Rank ${next}/${def.maxRank}`, lines }
}
