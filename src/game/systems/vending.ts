// The hut's vending machine (spec 11 H6) — pure TypeScript, no React / three.js / Howler.
//
// Stock is per day and reset at dawn. A purchase checks sold out, then coins, then satchel space
// (the merchant's order), and either changes everything at once or nothing at all, so the Grave
// Coins counter can never go below zero (Req 6.6 to 6.13). Satchel fit uses inventory.addItem,
// the same rule as every other pickup.

import { ITEM_MAP } from '../../data/items'
import {
  VENDING_FORBIDDEN,
  VENDING_FORBIDDEN_KINDS,
  VENDING_FORBIDDEN_PREFIXES,
  VENDING_HANDLE_BACK_S,
  VENDING_HANDLE_HOLD_S,
  VENDING_HANDLE_OUT_S,
  VENDING_HANDLE_PULL_M,
  VENDING_RANGE_M,
  VENDING_ROWS,
  type VendingRow,
  type VendingRowId,
} from '../../data/vending'
import type { Inventory } from '../types'
import type { OwnedGuns } from './elites'
import { addItem } from './inventory'

export interface VendingState {
  stockLeft: Record<VendingRowId, number>
}

export function vendingRow(id: VendingRowId): VendingRow {
  const row = VENDING_ROWS.find((r) => r.id === id)
  if (!row) throw new Error(`Unknown vending row: ${id}`)
  return row
}

/** Every row at its per-day stock. */
export function freshStock(): VendingState {
  return { stockLeft: Object.fromEntries(VENDING_ROWS.map((r) => [r.id, r.perDay])) as Record<VendingRowId, number> }
}

/** Dawn: every row back to its per-day value (idempotent). */
export function resetAtDawn(v: VendingState): VendingState {
  return { stockLeft: { ...v.stockLeft, ...freshStock().stockLeft } }
}

/** True for an item the machine must never sell (relics, keys, pages, recipes, clues, holy water, silver). */
export function isForbidden(item: string): boolean {
  if (VENDING_FORBIDDEN.includes(item)) return true
  if (VENDING_FORBIDDEN_PREFIXES.some((p) => item.startsWith(p))) return true
  const def = (ITEM_MAP as Readonly<Record<string, { kind: string } | undefined>>)[item]
  return def !== undefined && (VENDING_FORBIDDEN_KINDS as readonly string[]).includes(def.kind)
}

/** The rows shown now: a gun's ammo row only while that gun is owned (the elite-drop rule). */
export function visibleRows(owned: OwnedGuns): VendingRow[] {
  return VENDING_ROWS.filter((r) => !r.requiresWeapon || owned[r.requiresWeapon])
}

export type Refusal = { ok: false; reason: 'sold-out' | 'coins' | 'full'; shortfall?: number; text: string }
export type CanBuy = { ok: true } | Refusal

/** Sold out, then coins, then space (addItem on a copy). Never mutates. */
export function canBuy(id: VendingRowId, v: VendingState, coins: number, inv: Inventory, slotLimit: number): CanBuy {
  const row = vendingRow(id)
  if ((v.stockLeft[id] ?? 0) <= 0) return { ok: false, reason: 'sold-out', text: 'Sold out' }
  const have = Math.max(0, coins)
  if (have < row.price) {
    const shortfall = row.price - have
    return {
      ok: false,
      reason: 'coins',
      shortfall,
      text: `Need ${row.price} coins, you have ${have} (${shortfall} short)`,
    }
  }
  if (addItem(inv, row.item, row.qty, slotLimit).added < row.qty) {
    return { ok: false, reason: 'full', text: 'Your satchel is full' }
  }
  return { ok: true }
}

export interface BuyResult {
  state: VendingState
  coins: number
  inv: Inventory
  result: { ok: true; row: VendingRow } | Refusal
}

/** A purchase: price paid, stock −1, goods added; on a refusal everything comes back unchanged. */
export function buy(id: VendingRowId, v: VendingState, coins: number, inv: Inventory, slotLimit: number): BuyResult {
  const check = canBuy(id, v, coins, inv, slotLimit)
  if (!check.ok) return { state: v, coins, inv, result: check }
  const row = vendingRow(id)
  return {
    state: { stockLeft: { ...v.stockLeft, [id]: v.stockLeft[id] - 1 } },
    coins: Math.max(0, coins - row.price),
    inv: addItem(inv, row.item, row.qty, slotLimit).inv,
    result: { ok: true, row },
  }
}

/** Within interact range of the machine (horizontal distance). */
export function withinVendingRange(player: { x: number; z: number }, machine: readonly [number, number, number]): boolean {
  return Math.hypot(player.x - machine[0], player.z - machine[2]) <= VENDING_RANGE_M
}

/** Shape of the handle's spring-back (not tunables: they only keep the overshoot under 3 mm). */
const SPRING_DAMPING = 5
const SPRING_HALF_TURNS = 1.5

/**
 * The handle's pull-out offset (m) at `t` seconds into a purchase: eases out over the out time,
 * holds, springs back with a small overshoot damped to rest, and is 0 before and after.
 */
export function purchaseAnimation(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0
  const out = VENDING_HANDLE_OUT_S
  const hold = out + VENDING_HANDLE_HOLD_S
  const end = hold + VENDING_HANDLE_BACK_S
  if (t < out) {
    const u = t / out
    return VENDING_HANDLE_PULL_M * (1 - (1 - u) * (1 - u))
  }
  if (t < hold) return VENDING_HANDLE_PULL_M
  if (t < end) {
    const u = (t - hold) / VENDING_HANDLE_BACK_S
    // Critically damped return with a light overshoot that stays inside the 1 cm tolerance.
    const back = Math.exp(-SPRING_DAMPING * u) * Math.cos(Math.PI * SPRING_HALF_TURNS * u)
    return VENDING_HANDLE_PULL_M * back * (1 - u)
  }
  return 0
}

/** Sanitises a saved stock block: unknown rows dropped, values clamped to 0..perDay, missing rows fresh. */
export function sanitizeVending(raw: unknown): VendingState {
  const fresh = freshStock()
  if (!raw || typeof raw !== 'object') return fresh
  const left = (raw as { stockLeft?: unknown }).stockLeft
  if (!left || typeof left !== 'object') return fresh
  const out = { ...fresh.stockLeft }
  for (const r of VENDING_ROWS) {
    const n = (left as Record<string, unknown>)[r.id]
    if (typeof n === 'number' && Number.isFinite(n)) out[r.id] = Math.min(r.perDay, Math.max(0, Math.floor(n)))
  }
  return { stockLeft: out }
}
