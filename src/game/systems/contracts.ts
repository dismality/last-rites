// Side contracts: deal, advance and settle (spec 08, Req 6). Pure rules, no stores.
import { CONTRACTS, CONTRACTS_PER_DAWN, MELEE_SOURCES, UNHURT_MAX_DAMAGE } from '../../data/contracts'
import type { ContractDef } from '../../data/contracts'
import type { Rng } from '../rng'
import type { ContractId, DamageSource } from '../types'

export interface DealtContract {
  id: ContractId
  progress: number
  done: boolean
}

export interface ContractContext {
  owns: { revolver: boolean; shotgun: boolean }
  barricadeBuilt: boolean
  wailersNextNight: number
}

export type ContractEvent =
  | { type: 'kill'; enemy: string; source: DamageSource; headshot: boolean }
  | { type: 'dig' }
  | { type: 'board' }
  | { type: 'material' }

export interface ContractCompletion {
  id: ContractId
  reward: number
}

export interface ContractResult {
  list: DealtContract[]
  completed: ContractCompletion[]
}

const DEF_BY_ID = new Map<ContractId, ContractDef>(CONTRACTS.map((c) => [c.id, c]))

function isPossible(def: ContractDef, c: ContractContext): boolean {
  const req = def.req
  if (!req) return true
  if (req.weapon && !c.owns[req.weapon]) return false
  if (req.barricade && !c.barricadeBuilt) return false
  if (req.minWailersNextNight !== undefined && c.wailersNextNight < req.minWailersNextNight) return false
  return true
}

/** Contracts that can be completed right now, in table order. */
export function possibleContracts(c: ContractContext): ContractId[] {
  return CONTRACTS.filter((d) => isPossible(d, c)).map((d) => d.id)
}

/** Partial Fisher-Yates over the possible ids: up to CONTRACTS_PER_DAWN distinct contracts. */
export function dealContracts(rng: Rng, c: ContractContext): DealtContract[] {
  const pool = possibleContracts(c)
  const n = Math.min(CONTRACTS_PER_DAWN, pool.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool.slice(0, n).map((id) => ({ id, progress: 0, done: false }))
}

function matches(id: ContractId, e: ContractEvent): boolean {
  switch (id) {
    case 'c-dig-3':
      return e.type === 'dig'
    case 'c-shotgun-5':
      return e.type === 'kill' && e.source === 'shotgun'
    case 'c-revolver-head-3':
      return e.type === 'kill' && e.source === 'revolver' && e.headshot
    case 'c-melee-10':
      return e.type === 'kill' && MELEE_SOURCES.includes(e.source)
    case 'c-wailer-2':
      return e.type === 'kill' && e.enemy === 'wailer'
    case 'c-boards-3':
      return e.type === 'board'
    case 'c-gather-8':
      return e.type === 'material'
    case 'c-unhurt':
      return false // settled only by finishNight
  }
}

/** Progress counts matching events, is capped at the goal, and a done contract ignores events. */
export function advanceContracts(list: readonly DealtContract[], e: ContractEvent): ContractResult {
  const completed: ContractCompletion[] = []
  const next = list.map((c) => {
    const def = DEF_BY_ID.get(c.id)
    if (!def || c.done || !matches(c.id, e)) return c
    const progress = Math.min(def.goal, c.progress + 1)
    const done = progress >= def.goal
    if (done) completed.push({ id: c.id, reward: def.reward })
    return { ...c, progress, done }
  })
  return { list: next, completed }
}

/** Night end: `c-unhurt` completes iff damage taken stayed within the limit. */
export function finishNight(list: readonly DealtContract[], damageTaken: number): ContractResult {
  const completed: ContractCompletion[] = []
  const next = list.map((c) => {
    const def = DEF_BY_ID.get(c.id)
    if (!def || c.done || c.id !== 'c-unhurt' || damageTaken > UNHURT_MAX_DAMAGE) return c
    completed.push({ id: c.id, reward: def.reward })
    return { ...c, progress: def.goal, done: true }
  })
  return { list: next, completed }
}
