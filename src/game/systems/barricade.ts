// Pure chapel door barricade rules (Req 16): board state, damage and attacker counts.
import { DOORS } from '../../data/barricades'
import type { EnemyId } from '../../data/enemies'
import type { DoorId, Inventory } from '../types'
import { countItem, hasItems, removeItem } from './inventory'

export interface BarricadeState {
  built: boolean
  /** Board health per door, 0..DOORS.slots entries. */
  doors: Record<DoorId, readonly number[]>
}

/** Stage 1 built: startBoards full-health boards on every door. */
export const buildBarricades = (boardHp: number): BarricadeState => {
  const boards = Array.from({ length: DOORS.startBoards }, () => boardHp)
  return { built: true, doors: { front: boards, vestry: [...boards] } }
}

/** ×2 Brute, ×2 final rite, ×4 both. */
export const boardDamageFor = (hit: number, enemy: EnemyId, riteActive: boolean): number =>
  hit * (enemy === 'brute' ? DOORS.bruteMult : 1) * (riteActive ? DOORS.riteMult : 1)

/** Hits the lowest-health board only; damage beyond its health is dropped, not carried over. */
export function damageDoor(
  s: BarricadeState,
  id: DoorId,
  dmg: number,
): { state: BarricadeState; applied: number; removed: boolean } {
  const boards = s.doors[id]
  if (!s.built || boards.length === 0 || !(dmg > 0)) return { state: s, applied: 0, removed: false }
  let low = 0
  for (let i = 1; i < boards.length; i++) if (boards[i] < boards[low]) low = i
  const applied = Math.min(dmg, boards[low])
  const left = boards[low] - applied
  const removed = left <= 0
  const next = removed
    ? boards.filter((_, i) => i !== low)
    : boards.map((hp, i) => (i === low ? left : hp))
  return { state: { ...s, doors: { ...s.doors, [id]: next } }, applied, removed }
}

/** max(floor(N / 3), 1 from night 2 on). */
export const doorAttackerCount = (waveSize: number, night: number): number =>
  Math.max(Math.floor(Math.max(0, waveSize) / 3), night >= 2 ? 1 : 0)

export const canBeDoorAttacker = (type: EnemyId): boolean => type === 'shambler' || type === 'brute'

const DOOR_NAME: Readonly<Record<DoorId, string>> = { front: 'Front door', vestry: 'Vestry' }

/** HUD text, e.g. "Front door 2/3 (60, 41)". */
export const doorLine = (id: DoorId, boards: readonly number[]): string => {
  const base = `${DOOR_NAME[id]} ${boards.length}/${DOORS.slots}`
  return boards.length === 0 ? base : `${base} (${boards.map((b) => Math.round(b)).join(', ')})`
}

export type NailRefusal = 'not-built' | 'door-full' | 'missing-materials'

export type NailResult =
  | { ok: true; state: BarricadeState; inv: Inventory }
  | { ok: false; reason: NailRefusal; state: BarricadeState; inv: Inventory }

const NAIL_NAMES: Readonly<Record<string, readonly [string, string]>> = {
  'wood-plank': ['wood plank', 'wood planks'],
  'iron-nail': ['iron nail', 'iron nails'],
}

/** Why a nail cannot start, or null when it can. Any phase is fine: only the build and the door matter. */
const nailRefusal = (s: BarricadeState, inv: Inventory, id: DoorId): NailRefusal | null => {
  if (!s.built) return 'not-built'
  if (s.doors[id].length >= DOORS.slots) return 'door-full'
  return hasItems(inv, DOORS.nailCost) ? null : 'missing-materials'
}

/**
 * Spends exactly the nail cost and adds one board at `boardHp` (a later Hardened Boards rank only
 * affects boards nailed afterwards). A refusal returns the same state and satchel objects.
 */
export function nailBoard(s: BarricadeState, inv: Inventory, id: DoorId, boardHp: number): NailResult {
  const reason = nailRefusal(s, inv, id)
  if (reason) return { ok: false, reason, state: s, inv }
  let next = inv
  for (const c of DOORS.nailCost) next = removeItem(next, c.item, c.qty).inv
  const doors = { ...s.doors, [id]: [...s.doors[id], boardHp] }
  return { ok: true, state: { ...s, doors }, inv: next }
}

/** Prompt state for the nail action: "Door is full" or the first missing material. */
export const nailPrompt = (
  s: BarricadeState,
  inv: Inventory,
  id: DoorId,
): { canStart: boolean; text: string } => {
  const reason = nailRefusal(s, inv, id)
  if (reason === null) return { canStart: true, text: 'Board up' }
  if (reason === 'not-built') return { canStart: false, text: 'The door is not barred yet' }
  if (reason === 'door-full') return { canStart: false, text: 'Door is full' }
  for (const c of DOORS.nailCost) {
    const missing = c.qty - countItem(inv, c.item)
    if (missing > 0) {
      const [one, many] = NAIL_NAMES[c.item] ?? [c.item, c.item]
      return { canStart: false, text: `Need ${missing} ${missing === 1 ? one : many}` }
    }
  }
  return { canStart: false, text: 'Missing materials' }
}

export interface NailProgress {
  door: DoorId
  elapsedS: number
}

/** True once the player has travelled more than the epsilon since the nail began. */
export const movedWhileNailing = (travelM: number): boolean => travelM > DOORS.nailMoveEpsM

/** Hold-to-nail timer. Release, travel past the epsilon, damage or leaving range cancels with no spend. */
export function tickNailing(
  n: NailProgress | null,
  dt: number,
  c: { held: boolean; moved: boolean; damaged: boolean; inRange: boolean },
): { nail: NailProgress | null; done: boolean } {
  if (!n || !c.held || c.moved || c.damaged || !c.inRange) return { nail: null, done: false }
  const elapsedS = n.elapsedS + Math.max(0, dt)
  if (elapsedS >= DOORS.nailTimeS) return { nail: null, done: true }
  return { nail: { ...n, elapsedS }, done: false }
}
