/*
  RecipeBook — parchment ledger overlay shown while the workbench is open.

  Layout: fixed panel on the right side of the screen, scrollable list of
  recipe entries. Unlocked recipes show full detail; locked recipes are smudged.
  Each ingredient shows its name, have/need and a check or cross (never colour alone).
  Undiscovered recipes read "???" until one of each ingredient was held.

  Visual language (Req 2.1–2.4):
  - Craftable entry:  ember-coloured heading + rune icon (✦) + ember glow pulse.
  - Hovering an entry: highlights matching material IDs on the bench via
    craftingStore.setHighlight; shows missing quantities in blood red.
  - Locked entries:   blurred text, sepia, with a small unlock hint.

  Accessibility:
  - Reduced-motion: keyframe animation removed via CSS media query.
  - Focus styles: keyboard-navigable entries with visible ring.
  - Aria-labels on locked/craftable states.
  - Missing quantities are announced via aria-live on the entry.
*/

import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { ItemIcon } from '../satchel/ItemIcon'
import { displayTitle, isDiscovered, recipeCard, recipeItems, tooltipTarget } from './recipeView'
import { useCraftingStore } from '../../game/state/craftingStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { canCraft } from '../../game/systems/crafting'
import { RECIPES } from '../../data/recipes'
import { ITEM_MAP } from '../../data/items'
import { UpgradeList } from './UpgradeList'
import { NamedItemIcon } from '../satchel/NamedItemIcon'
import type { RecipeDef } from '../../data/recipes'
import type { ItemId, RecipeId } from '../../game/types'
import './RecipeBook.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function itemName(id: ItemId): string {
  return ITEM_MAP[id]?.name ?? id
}

/** Human-readable hint text for locked recipe unlock conditions. */
function unlockHint(recipe: RecipeDef): string {
  switch (recipe.unlock.type) {
    case 'start':
      return 'Available from the start'
    case 'night':
      return `Unlocks after surviving Night ${recipe.unlock.night}`
    case 'pickup':
      return `Unlocks when you find the ${itemName(recipe.unlock.weapon)}`
    case 'journal':
      return `Unlocks upon reading Journal Page ${recipe.unlock.page}`
  }
}

// ---------------------------------------------------------------------------
// LockedEntry
// ---------------------------------------------------------------------------

/**
 * A locked recipe row — smudged text, blurred, with a faint unlock hint
 * visible on hover so curious players know how to unlock it.
 */
function LockedEntry({ recipe }: { recipe: RecipeDef }) {
  const hint = unlockHint(recipe)

  return (
    <li
      className="recipe-entry recipe-entry--locked"
      aria-label={`Locked recipe. ${hint}`}
      tabIndex={0}
    >
      {/* Smudged output name — deliberately illegible */}
      <div className="recipe-entry__output recipe-entry__output--smudged" aria-hidden="true">
        ▓▓▓▓▓▓▓▓▓
      </div>
      {/* Smudged ingredient list */}
      <div className="recipe-entry__ingredients recipe-entry__ingredients--smudged" aria-hidden="true">
        ▒▒▒▒ × ▒ · ▒▒▒▒▒ × ▒
      </div>
      {/* Unlock hint — visible at low opacity, stronger on focus/hover */}
      <div className="recipe-entry__unlock-hint">
        <span className="recipe-entry__lock-icon" aria-hidden="true">⚿</span>
        {hint}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// UnlockedEntry
// ---------------------------------------------------------------------------

interface UnlockedEntryProps {
  recipe: RecipeDef
  craftable: boolean
  missing: { item: ItemId; qty: number }[]
  highlighted: boolean
  /** True when this recipe is the one currently being crafted. */
  isCrafting: boolean
  /** Craft progress 0–1 (only meaningful when isCrafting is true). */
  craftProgress: number
  discovered: boolean
  collected: readonly ItemId[]
  pinned: boolean
  onCraft: (recipeId: RecipeId) => void
  onPin: (recipeId: RecipeId) => void
  onTip: (recipeId: RecipeId | null, rect?: DOMRect) => void
}

/**
 * A visible, unlocked recipe row.
 * - Names the recipe and each ingredient with have/need counts and a ✓ / ✗ mark.
 * - Undiscovered recipes read "???" with a silhouette until one of each ingredient was held.
 * - Hover or focus: highlights the bench piles, selects the recipe for the ghost preview and
 *   shows the tooltip beside the row.
 * - Keyboard: Enter crafts, P pins.
 */
function UnlockedEntry({
  recipe, craftable, missing, highlighted, isCrafting, craftProgress,
  discovered, collected, pinned, onCraft, onPin, onTip,
}: UnlockedEntryProps) {
  const setHighlight = useCraftingStore((s) => s.setHighlight)
  const clearHighlight = useCraftingStore((s) => s.clearHighlight)
  const selectRecipe = useCraftingStore((s) => s.selectRecipe)
  const pinId = useId()

  const enter = useCallback((el: HTMLElement) => {
    setHighlight(recipeItems(recipe))
    selectRecipe(recipe.id)
    onTip(recipe.id, el.getBoundingClientRect())
  }, [recipe, setHighlight, selectRecipe, onTip])

  const leave = useCallback(() => {
    clearHighlight()
    selectRecipe(null)
    onTip(null)
  }, [clearHighlight, selectRecipe, onTip])

  const card = recipeCard(recipe, missing)
  const title = displayTitle(recipe, collected, card)
  const seen = new Set(collected)

  const ariaLabel = !discovered
    ? 'Unknown recipe. Collect one of each ingredient to learn it.'
    : [
        craftable ? 'Craftable.' : 'Cannot craft.',
        `Makes ${card.title}.`,
        card.ingredients.map((i) => `${i.label}, ${i.note}`).join('; '),
        pinned ? 'Pinned.' : '',
        craftable ? 'Enter to craft.' : '',
        'P to pin.',
      ].filter(Boolean).join(' ')

  return (
    <li
      className={[
        'recipe-entry',
        craftable ? 'recipe-entry--craftable' : '',
        highlighted ? 'recipe-entry--hover-active' : '',
        discovered ? '' : 'recipe-entry--unknown',
      ].join(' ')}
      onMouseEnter={(e) => enter(e.currentTarget)}
      onMouseLeave={leave}
      onFocus={(e) => { if (e.target === e.currentTarget) enter(e.currentTarget) }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave() }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.code === 'KeyP') {
          e.preventDefault()
          onPin(recipe.id)
        } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && craftable && discovered && !isCrafting) {
          e.preventDefault()
          onCraft(recipe.id)
        }
      }}
      tabIndex={0}
      aria-label={ariaLabel}
    >
      {/* Output row */}
      <div className="recipe-entry__output">
        {craftable && discovered && (
          <span className="recipe-entry__rune" aria-hidden="true" title="Craftable">✦</span>
        )}
        {discovered ? (
          <NamedItemIcon id={recipe.output.item} announce={false} />
        ) : (
          <span className="recipe-entry__silhouette" aria-hidden="true">
            <ItemIcon id={recipe.output.item} size={64} />
          </span>
        )}
        <h3 className="recipe-entry__name">{title}</h3>
        {discovered && recipe.consumesTool && (
          <span className="recipe-entry__upgrade-tag" title="Upgrades an existing tool">
            ⟳ upgrade
          </span>
        )}
        {discovered && (
          <button
            type="button"
            className="pin-btn"
            id={pinId}
            aria-pressed={pinned}
            aria-label={`${pinned ? 'Unpin' : 'Pin'} ${card.title}`}
            onClick={(e) => { e.stopPropagation(); onPin(recipe.id) }}
          >
            {pinned ? '◆ Pinned' : '◇ Pin'}
          </button>
        )}
      </div>

      {/* Ingredients list: name, have/need, and a mark so colour is never the only cue. */}
      <ul className="recipe-entry__ingredients" aria-label="Required ingredients">
        {card.ingredients.map((row) => {
          const known = discovered || seen.has(row.item)
          return (
            <li
              key={row.item}
              className={[
                'recipe-entry__ingredient',
                row.tool ? 'recipe-entry__ingredient--tool' : '',
                known && row.lack > 0 ? 'recipe-entry__ingredient--missing' : '',
              ].join(' ')}
            >
              {known ? <NamedItemIcon id={row.item} announce={false} /> : <span className="recipe-entry__silhouette" aria-hidden="true"><ItemIcon id={row.item} size={64} /></span>}
              {known ? (
                <>
                  <span className="ingredient-name">{row.label}</span>
                  <span className="ingredient-mark" aria-hidden="true">{row.mark}</span>
                  {row.lack > 0 && <span className="ingredient-missing-label">{row.note}</span>}
                </>
              ) : (
                <span className="ingredient-name">???</span>
              )}
            </li>
          )
        })}
      </ul>
      {/* Craft button + progress bar (Req 3.1) */}
      {craftable && (
        <div className="recipe-entry__craft-row">
          {isCrafting ? (
            /* Progress bar while crafting is in progress */
            <div
              className="craft-progress"
              role="progressbar"
              aria-valuenow={Math.round(craftProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Crafting in progress"
            >
              <div
                className="craft-progress__fill"
                style={{ width: `${craftProgress * 100}%` }}
              />
              <span className="craft-progress__label" aria-hidden="true">
                Crafting…
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="craft-btn"
              onClick={(e) => {
                // Prevent the li's mouse handlers from firing
                e.stopPropagation()
                onCraft(recipe.id)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={`Craft ${itemName(recipe.output.item)}`}
            >
              ✦ Craft
            </button>
          )}
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// RecipeBook
// ---------------------------------------------------------------------------

/**
 * Main parchment overlay. Renders whenever the workbench is open.
 * Mounts above the R3F canvas via a portal-like fixed-position div.
 */
export function RecipeBook() {
  const workbenchOpen = useUiWorldStore((s) => s.workbenchOpen)
  const unlockedRecipes = useCraftingStore((s) => s.unlockedRecipes)
  const highlightedItems = useCraftingStore((s) => s.highlightedItems)
  const craftingProgress = useCraftingStore((s) => s.craftingProgress)
  const startCrafting = useCraftingStore((s) => s.startCrafting)
  const inventory = useInventoryStore((s) => s.inventory)
  const collected = useCraftingStore((s) => s.collectedItems)
  const pinnedRecipe = useCraftingStore((s) => s.pinnedRecipe)
  const togglePin = useCraftingStore((s) => s.togglePin)
  const selectRecipe = useCraftingStore((s) => s.selectRecipe)
  const [tip, setTip] = useState<{ id: RecipeId; top: number; right: number } | null>(null)
  const onTip = useCallback((id: RecipeId | null, rect?: DOMRect) => {
    setTip(id && rect ? { id, top: rect.top, right: window.innerWidth - rect.left + 8 } : null)
  }, [])
  // Clear highlight when workbench closes.
  const clearHighlight = useCraftingStore((s) => s.clearHighlight)
  const titleId = useId()
  const [tab, setTab] = useState<'recipes' | 'upgrades'>('recipes')

  // A tooltip left over from a closed bench must not come back on reopening (adjust during render).
  if (!workbenchOpen && tip !== null) setTip(null)

  useEffect(() => {
    if (!workbenchOpen) {
      clearHighlight()
      selectRecipe(null)
    }
  }, [workbenchOpen, clearHighlight, selectRecipe])

  // Stable callback so UnlockedEntry children don't re-render on every tick.
  const handleCraft = useCallback(
    (recipeId: RecipeId) => {
      // Only start if nothing is currently crafting.
      if (craftingProgress === null) {
        startCrafting(recipeId)
      }
    },
    [craftingProgress, startCrafting],
  )

  // Visible only when workbench is open.
  if (!workbenchOpen) return null

  // Partition recipes: unlocked (in order from RECIPES) + locked remainder.
  const unlockedSet = new Set(unlockedRecipes)
  const orderedUnlocked = RECIPES.filter((r) => unlockedSet.has(r.id))
  const locked = RECIPES.filter((r) => !unlockedSet.has(r.id))

  // Pre-compute craftability for every unlocked recipe.
  const craftability = new Map(
    orderedUnlocked.map((r) => {
      const result = canCraft(inventory, r)
      return [r.id, result]
    }),
  )

  const tipId = tooltipTarget(workbenchOpen, tip?.id ?? null)
  const tooltipShown = tipId !== null
  const tipRecipe = tipId ? RECIPES.find((r) => r.id === tipId) : undefined
  const tipCard = tipRecipe ? recipeCard(tipRecipe, craftability.get(tipRecipe.id)?.missing ?? []) : undefined

  return (
    <div
      className="recipe-book"
      role="complementary"
      aria-labelledby={titleId}
      // Prevent keyboard events from leaking to the game world
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Parchment paper edge decoration */}
      <div className="recipe-book__spine" aria-hidden="true" />

      <div className="recipe-book__inner">
        <h2 id={titleId} className="recipe-book__title">
          Workbench Formulae
        </h2>
        <div className="recipe-book__divider" aria-hidden="true">
          ✦ · · ✦ · · ✦
        </div>

        <div role="group" aria-label="Workbench sections" className="recipe-book__tabs">
          <button type="button" className="craft-btn" aria-pressed={tab === 'recipes'} onClick={() => setTab('recipes')}>Recipes</button>
          <button type="button" className="craft-btn" aria-pressed={tab === 'upgrades'} onClick={() => setTab('upgrades')}>Upgrades</button>
        </div>

        {tab === 'upgrades' && <UpgradeList />}

        {tab === 'recipes' && RECIPES.length === 0 && (
          <p className="recipe-book__empty">No recipes known yet.</p>
        )}

        {tab === 'recipes' && (<ul className="recipe-book__list" aria-label="Recipe list">
          {/* Unlocked recipes first */}
          {orderedUnlocked.map((recipe) => {
            const result = craftability.get(recipe.id)!
            const isHighlighted = recipe.inputs.some((i) => highlightedItems.has(i.item)) ||
              (recipe.consumesTool ? highlightedItems.has(recipe.consumesTool) : false)
            const isCrafting = craftingProgress?.recipeId === recipe.id
            const craftProgress = isCrafting
              ? craftingProgress!.elapsed / craftingProgress!.duration
              : 0
            return (
              <UnlockedEntry
                key={recipe.id}
                recipe={recipe}
                craftable={result.ok}
                missing={result.missing}
                highlighted={isHighlighted}
                isCrafting={isCrafting}
                craftProgress={craftProgress}
                discovered={isDiscovered(recipe, collected)}
                collected={collected}
                pinned={pinnedRecipe === recipe.id}
                onCraft={handleCraft}
                onPin={togglePin}
                onTip={onTip}
              />
            )
          })}

          {/* Separator between unlocked and locked sections */}
          {locked.length > 0 && orderedUnlocked.length > 0 && (
            <li className="recipe-book__section-sep" aria-hidden="true" role="presentation">
              <span>· · ·</span>
            </li>
          )}

          {/* Locked recipes */}
          {locked.map((recipe) => (
            <LockedEntry key={recipe.id} recipe={recipe} />
          ))}
        </ul>)}

        <p className="recipe-book__footer">
          Craft at the bench — 1.5 s — world runs. Enter crafts, P pins.
        </p>
      </div>
      {tooltipShown && tipRecipe && createPortal(
        <div className="recipe-tip" role="tooltip" style={{ top: tip!.top, right: tip!.right }}>
          <strong>{displayTitle(tipRecipe, collected, tipCard!)}</strong>
          {isDiscovered(tipRecipe, collected) ? (
            <ul>
              {tipCard!.ingredients.map((i) => (
                <li key={i.item} className={i.lack > 0 ? 'is-missing' : ''}>
                  {i.mark} {i.label}{i.lack > 0 ? ` (${i.note})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>Pick up one of each ingredient to learn this recipe.</p>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
