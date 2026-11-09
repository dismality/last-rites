// Player-facing progression actions: start a run, pick a dawn upgrade, trade with the merchant.
// Each one changes every affected store in one go so no UI sees a half-applied state.
// Pure zustand glue, no React / three.js imports.
import { DAWN_AFTER_PICK_S, DAWN_DURATION_S } from '../../data/balance'
import { UPGRADE_PER_RANK } from '../../data/dawnUpgrades'
import { createRng, deriveSeed } from '../rng'
import { dealContracts } from '../systems/contracts'
import { pickUpgrade as raiseRank } from '../systems/dawnUpgrades'
import { tryBuy, type BuyResult } from '../systems/merchant'
import { nightPlan } from '../systems/waves'
import { recordCoins } from '../systems/runStats'
import type { DawnUpgradeId, ModeId, MerchantRowId } from '../types'
import { currentModifiers, syncDerivedStats } from './derivedStats'
import { useInventoryStore } from './inventoryStore'
import { useOverlayStore } from './overlayStore'
import { usePlayerStore } from './playerStore'
import { initialProgression, useProgressionStore } from './progressionStore'
import { resetRun } from './resetRun'
import { updateRunStats } from './statsPort'
import { useWorldStore } from './worldStore'

const FIRST_NIGHT = 1
const SEED_RANGE = 0x100000000

/** Every stream in the run derives from this seed, so only New Game ever draws from Math.random. */
export function startRun(mode: ModeId): void {
  resetRun()
  const seed = Math.floor(Math.random() * SEED_RANGE)
  const wailersNextNight = nightPlan(mode, FIRST_NIGHT).reduce((n, w) => n + w.wailer, 0)
  const contracts = dealContracts(createRng(deriveSeed(seed, 'contracts', 0)), {
    owns: { revolver: false, shotgun: false },
    barricadeBuilt: false,
    wailersNextNight,
  })
  // achievementStore and the Endless best live under their own storage keys and are not touched.
  useProgressionStore.setState({ ...initialProgression(), mode, seed, contracts })
  useOverlayStore.getState().setMerchantOpen(false)
  syncDerivedStats()
  usePlayerStore.getState().setHealth(usePlayerStore.getState().maxHealth)
}

/** Ignored unless the id is on the open offer. Returns whether the pick was applied. */
export function pickUpgrade(id: DawnUpgradeId): boolean {
  const store = useProgressionStore.getState()
  const pending = store.pendingPick
  if (pending === null || !pending.includes(id)) return false
  const ranks = raiseRank(store.ranks, id)
  if (ranks === store.ranks) return false
  store.patch({ ranks, pendingPick: null })
  syncDerivedStats()
  if (id === 'iron-constitution') {
    const p = usePlayerStore.getState()
    p.setHealth(Math.min(p.maxHealth, p.health + UPGRADE_PER_RANK.maxHealth))
  }
  // The rest of dawn would just be waiting: jump to its last seconds.
  const world = useWorldStore.getState()
  if (world.phase === 'dawn') {
    world.setPhaseTime(Math.max(world.phaseTime, DAWN_DURATION_S - DAWN_AFTER_PICK_S))
  }
  return true
}

/** Coins, stock, satchel and spend stats change together, or not at all. */
export function buyFromMerchant(id: MerchantRowId): BuyResult {
  const store = useProgressionStore.getState()
  const inv = useInventoryStore.getState()
  if (store.stock === null) return { ok: false, reason: 'sold-out', text: 'Sold out' }
  const result = tryBuy(store.stock, id, store.coins, inv.inventory, currentModifiers().satchelSlots)
  if (!result.ok) return result
  inv.setInventory(result.inv)
  store.patch({ stock: result.stock, coins: result.coins })
  updateRunStats((s) => recordCoins(s, 0, result.spent))
  return result
}

export const openMerchant = (): void => useOverlayStore.getState().setMerchantOpen(true)
export const closeMerchant = (): void => useOverlayStore.getState().setMerchantOpen(false)
