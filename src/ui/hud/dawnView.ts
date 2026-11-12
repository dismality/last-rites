// Pure view-models for the dawn card and picker, so they test without a DOM.
import type { DawnUpgradeId } from '../../game/types'
import { upgradeCard, type UpgradeCard } from '../../game/systems/dawnUpgrades'
import type { NightSummary } from '../../game/systems/progressionSave'
import { pickUpgrade } from '../../game/state/progressionActions'
import type { Ranks } from '../../game/state/progressionStore'

export interface PickerInput {
  ranks: Ranks
  pendingPick: readonly DawnUpgradeId[] | null
  /** True from a major scare's announcement to 2 s after its beat. */
  majorScareActive: boolean
}

export interface PickerView {
  open: boolean
  cards: UpgradeCard[]
}

/**
 * The offer lives in the store (and the save), so a reloaded pending pick yields the same
 * cards. The dialog waits out a major scare so a modal never steals focus mid-beat.
 */
export function dawnPickerView(i: PickerInput): PickerView {
  const ids = i.pendingPick ?? []
  if (ids.length === 0) return { open: false, cards: [] }
  const cards = ids.map((id) => upgradeCard(i.ranks, id))
  return { open: !i.majorScareActive, cards }
}

/** Arrow keys move between cards and wrap; other keys return null. */
export function nextCardIndex(index: number, key: string, count: number): number | null {
  if (count <= 0) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/** Digit1 to Digit3 (or the numpad) pick card 0 to 2; null for other keys or a card that isn't offered. */
export function cardIndexForKey(code: string, count: number): number | null {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code)
  if (!m) return null
  const i = Number(m[1]) - 1
  return i < count ? i : null
}

/** The single path from a card to the action; `pick` is injectable for tests. */
export function pickCard(id: DawnUpgradeId, pick: (id: DawnUpgradeId) => boolean = pickUpgrade): boolean {
  return pick(id)
}

export interface DawnRow {
  label: string
  value: string
}

export interface DawnCardView {
  rows: DawnRow[]
  scoreParts: DawnRow[]
}

const num = (n: number): string => Math.max(0, Math.round(n)).toLocaleString('en-US')

export function dawnCardView(s: NightSummary): DawnCardView {
  return {
    rows: [
      { label: 'Zombies banished', value: num(s.zombiesBanished) },
      { label: 'Items found', value: num(s.itemsFound) },
      { label: 'New recipe', value: s.recipeUnlocked ?? 'none' },
      { label: 'Journal page', value: s.journalPageAvailable ? 'available' : 'none' },
    ],
    scoreParts: [
      { label: 'Kills', value: num(s.killPoints) },
      { label: 'Night cleared', value: `+${num(s.clearBonus)}` },
      { label: 'Unhurt', value: `+${num(s.noDamageBonus)}` },
      { label: 'Night score', value: num(s.nightScore) },
    ],
  }
}
