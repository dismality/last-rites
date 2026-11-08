// Tombstone reading and the parish-ledger cross-check. Pure TypeScript.

import { CLUE_MAP } from '../../data/clues'
import { LEDGER_1849_DATES, type TombstoneDef } from '../../data/tombstones'
import type { ItemId } from '../types'

type Held = { readonly keyItems: readonly ItemId[] }

/** A stone is a wrong grave when its date is a ledger burial and the player holds the ledger. */
export function isWrongGrave(stone: Pick<TombstoneDef, 'date'>, inv: Held): boolean {
  return inv.keyItems.includes('parish-ledger') && LEDGER_1849_DATES.includes(stone.date)
}

export interface TombstoneReading {
  /** Show the "wrong grave" stamp on the rubbing. */
  wrongGrave: boolean
  /** Clue ids the reading records (the mystery state ignores repeats). */
  clueIds: string[]
}

export function readTombstone(stone: TombstoneDef, inv: Held): TombstoneReading {
  const wrongGrave = isWrongGrave(stone, inv)
  const clueIds: string[] = []
  if (stone.clueId) clueIds.push(stone.clueId)
  if (wrongGrave && stone.wrongGraveClueId) clueIds.push(stone.wrongGraveClueId)
  return { wrongGrave, clueIds }
}

/** True when the player may record this clue (ledger clues need the ledger in hand). */
export function canDiscoverClue(clueId: string, inv: Held): boolean {
  const req = CLUE_MAP[clueId]?.requires
  return !req || inv.keyItems.includes(req)
}
