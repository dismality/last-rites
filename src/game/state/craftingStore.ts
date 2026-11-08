// Crafting state store — tracks which recipes are unlocked, what the
// recipe-book hover is highlighting on the bench, and any in-progress craft.
//
// Unlocked recipe IDs accumulate over the course of a game session.
// The highlight set is transient UI state: it mirrors whichever recipe entry
// the player is hovering in the RecipeBook overlay, so the bench can pulse the
// matching material piles.
//
// craftingProgress tracks the 1.5 s timed craft (Req 3.1, 3.3).
// The tick loop lives in the scene layer; this store is the pure-TS half.

import { create } from 'zustand'
import type { RecipeId, ItemId } from '../types'
import { unlockRecipes, craft } from '../systems/crafting'
import type { UnlockEvent, CraftResult } from '../systems/crafting'
import { RECIPE_MAP } from '../../data/recipes'
import { useInventoryStore } from '../state/inventoryStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CraftingProgress {
  recipeId: RecipeId
  /** Seconds elapsed since crafting started (0 → duration). */
  elapsed: number
  /** Total duration in seconds for this recipe (from RecipeDef.craftTime). */
  duration: number
}

export interface CraftingState {
  /** Recipe IDs that have been unlocked so far. */
  unlockedRecipes: RecipeId[]

  /**
   * Item IDs currently highlighted by the recipe-book hover.
   * Empty set means nothing is highlighted.
   * The bench reads this to pulse matching material piles.
   */
  highlightedItems: ReadonlySet<ItemId>

  /**
   * The currently in-progress timed craft, or null when idle.
   * Set by `startCrafting`, advanced by `tickCrafting`, cleared by
   * `cancelCrafting` or after the caller calls `commitCraft`.
   */
  craftingProgress: CraftingProgress | null

  // ── Unlock actions ────────────────────────────────────────────────────

  /** Apply an unlock event (gameStart / dawnStarted / journalRead). */
  applyUnlockEvent: (event: UnlockEvent) => void

  // ── Highlight actions ──────────────────────────────────────────────────

  /** Replace the highlighted items (called by RecipeBook on mouse enter/leave). */
  setHighlight: (items: ItemId[]) => void

  /** Clear all highlights. */
  clearHighlight: () => void

  // ── Crafting-progress actions ──────────────────────────────────────────

  /**
   * Begin a timed craft for `recipeId`.
   * If another craft is already in progress it is silently replaced (the
   * caller should prevent double-clicking, but we guard here for safety).
   */
  startCrafting: (recipeId: RecipeId) => void

  /**
   * Advance the craft timer by `dt` seconds (called each fixed-timestep tick).
   *
   * Returns `{ completed: true, recipeId }` the single tick that pushes
   * elapsed ≥ duration.  The caller (scene layer) MUST then call
   * `commitCraft(recipeId)` to consume inputs and add the output.
   *
   * Returns `{ completed: false, recipeId: null }` while the timer runs.
   *
   * This deliberately does NOT auto-commit so the commit step is explicit
   * and independently testable.
   */
  tickCrafting: (dt: number) => { completed: boolean; recipeId: RecipeId | null }

  /**
   * Cancel an in-progress craft without consuming any inputs (Req 3.3).
   * Called when the player takes damage during crafting.
   */
  cancelCrafting: () => void

  /**
   * Atomically consume inputs and add the output for `recipeId`.
   * Reads current inventory from inventoryStore and writes back on success.
   *
   * Returns the same CraftResult as `craft()`:
   *   - `{ ok: true, inv }` — success; inventory updated
   *   - `{ ok: false, error: 'missing-inputs' }` — inputs vanished (unlikely but guarded)
   *   - `{ ok: false, error: 'no-capacity' }` — satchel full
   */
  commitCraft: (recipeId: RecipeId) => CraftResult
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCraftingStore = create<CraftingState>((set, get) => ({
  // Start with no unlocked recipes; TitleScreen dispatches 'gameStart' on New Game / Continue.
  unlockedRecipes: [],

  highlightedItems: new Set<ItemId>(),

  craftingProgress: null,

  // ── Unlock ─────────────────────────────────────────────────────────────

  applyUnlockEvent: (event) =>
    set((state) => {
      const newIds = unlockRecipes(event)
      if (newIds.length === 0) return state
      // Merge without duplicates.
      const merged = Array.from(new Set([...state.unlockedRecipes, ...newIds]))
      return { unlockedRecipes: merged as RecipeId[] }
    }),

  // ── Highlight ──────────────────────────────────────────────────────────

  setHighlight: (items) =>
    set({ highlightedItems: new Set(items) }),

  clearHighlight: () =>
    set({ highlightedItems: new Set<ItemId>() }),

  // ── Crafting progress ──────────────────────────────────────────────────

  startCrafting: (recipeId) => {
    const recipe = RECIPE_MAP[recipeId]
    if (!recipe) return
    set({
      craftingProgress: {
        recipeId,
        elapsed: 0,
        duration: recipe.craftTime,
      },
    })
  },

  tickCrafting: (dt) => {
    const { craftingProgress } = get()
    if (!craftingProgress) {
      return { completed: false, recipeId: null }
    }

    const newElapsed = Math.min(
      craftingProgress.elapsed + dt,
      craftingProgress.duration,
    )
    const completed = newElapsed >= craftingProgress.duration
    const { recipeId } = craftingProgress

    set({
      craftingProgress: completed
        ? null // caller must commitCraft; clear progress now so it can't fire twice
        : { ...craftingProgress, elapsed: newElapsed },
    })

    return completed
      ? { completed: true, recipeId }
      : { completed: false, recipeId: null }
  },

  cancelCrafting: () => {
    // Discard in-progress state — no inventory change (Req 3.3).
    set({ craftingProgress: null })
  },

  commitCraft: (recipeId) => {
    const recipe = RECIPE_MAP[recipeId]
    if (!recipe) {
      return { ok: false, error: 'missing-inputs' } as CraftResult
    }

    const { inventory, setInventory } = useInventoryStore.getState()
    const result = craft(inventory, recipe)
    if (result.ok) {
      setInventory(result.inv)
    }
    return result
  },
}))
