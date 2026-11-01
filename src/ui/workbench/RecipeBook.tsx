/*
  RecipeBook â€” parchment ledger overlay shown while the workbench is open.

  Layout: fixed panel on the right side of the screen, scrollable list of
  recipe entries. Unlocked recipes show full detail; locked recipes are smudged.

  Visual language (Req 2.1â€“2.4):
  - Craftable entry:  ember-coloured heading + rune icon (âœ¦) + ember glow pulse.
  - Hovering an entry: highlights matching material IDs on the bench via
    craftingStore.setHighlight; shows missing quantities in blood red.
  - Locked entries:   blurred text, sepia, with a small unlock hint.

  Accessibility:
  - Reduced-motion: keyframe animation removed via CSS media query.
  - Focus styles: keyboard-navigable entries with visible ring.
  - Aria-labels on locked/craftable states.
  - Missing quantities are announced via aria-live on the entry.
*/

import { useCallback, useEffect, useId } from 'react'
import { useCraftingStore } from '../../game/state/craftingStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useWorldStore } from '../../game/state/worldStore'
import { canCraft } from '../../game/systems/crafting'
import { RECIPES } from '../../data/recipes'
import type { RecipeDef } from '../../data/recipes'
import type { ItemId, RecipeId } from '../../game/types'
import './RecipeBook.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable item names. Keep in sync with types.ts. */
const ITEM_NAMES: Record<ItemId, string> = {
  'bone':               'Bone',
  'iron-nail':          'Iron Nails',
  'candle-wax':         'Candle Wax',
  'holy-water':         'Holy Water',
  'cloth':              'Cloth',
  'lamp-oil':           'Lamp Oil',
  'grave-salt':         'Grave Salt',
  'rusty-shovel':       'Rusty Shovel',
  'bone-club':          'Bone Club',
  'sharpened-shovel':   'Sharpened Shovel',
  'holy-water-flask':   'Holy Water Flask',
  'lantern-trap':       'Lantern Trap',
  'nail-bomb':          'Consecrated Nail Bomb',
  'salt-circle':        'Salt Circle',
  'bandage':            'Bandage',
  'tallow-candle':      'Tallow Candle',
  'lantern-refill':     'Lantern Refill',
  // Key items & relics (not craftable but appear as consumesTool inputs)
  'rusted-crypt-key':      'Rusted Crypt Key',
  'bone-whistle':          'Bone Whistle',
  'iron-ossuary-key':      'Iron Ossuary Key',
  'parish-ledger':         'Parish Ledger',
  'journal-page-1':        'Journal Page I',
  'journal-page-2':        'Journal Page II',
  'journal-page-3':        'Journal Page III',
  'journal-page-4':        'Journal Page IV',
  'journal-page-5':        'Journal Page V',
  'crane-rosary':          "Crane's Rosary",
  'sextons-bell-clapper':  "Sexton's Bell Clapper",
  'childs-locket':         "Child's Locket",
  'burial-shroud':         'Burial Shroud',
  'reliquary-heart':       'Reliquary Heart',
}

function itemName(id: ItemId): string {
  return ITEM_NAMES[id] ?? id
}

/** Human-readable hint text for locked recipe unlock conditions. */
function unlockHint(recipe: RecipeDef): string {
  switch (recipe.unlock.type) {
    case 'start':
      return 'Available from the start'
    case 'night':
      return `Unlocks after surviving Night ${recipe.unlock.night}`
    case 'journal':
      return `Unlocks upon reading Journal Page ${recipe.unlock.page}`
  }
}

// ---------------------------------------------------------------------------
// LockedEntry
// ---------------------------------------------------------------------------

/**
 * A locked recipe row â€” smudged text, blurred, with a faint unlock hint
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
      {/* Smudged output name â€” deliberately illegible */}
      <div className="recipe-entry__output recipe-entry__output--smudged" aria-hidden="true">
        â–“â–“â–“â–“â–“â–“â–“â–“â–“
      </div>
      {/* Smudged ingredient list */}
      <div className="recipe-entry__ingredients recipe-entry__ingredients--smudged" aria-hidden="true">
        â–’â–’â–’â–’ Ã— â–’ Â· â–’â–’â–’â–’â–’ Ã— â–’
      </div>
      {/* Unlock hint â€” visible at low opacity, stronger on focus/hover */}
      <div className="recipe-entry__unlock-hint">
        <span className="recipe-entry__lock-icon" aria-hidden="true">âš¿</span>
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
  /** Craft progress 0â€“1 (only meaningful when isCrafting is true). */
  craftProgress: number
  onCraft: (recipeId: RecipeId) => void
}

/**
 * A visible, unlocked recipe row.
 * - Craftable: ember glow pulse + rune icon (âœ¦).
 * - Hover: calls setHighlight / clearHighlight on the crafting store.
 * - Missing items shown in blood red with "missing" label.
 * - "Craft" button fires `startCrafting` and shows a progress bar.
 */
function UnlockedEntry({ recipe, craftable, missing, highlighted, isCrafting, craftProgress, onCraft }: UnlockedEntryProps) {
  const setHighlight = useCraftingStore((s) => s.setHighlight)
  const clearHighlight = useCraftingStore((s) => s.clearHighlight)

  const handleMouseEnter = useCallback(() => {
    // Build inline so the array reference is stable within the callback.
    const ids: ItemId[] = [
      ...recipe.inputs.map((i) => i.item),
      ...(recipe.consumesTool ? [recipe.consumesTool] : []),
    ]
    setHighlight(ids)
  }, [recipe.inputs, recipe.consumesTool, setHighlight])

  const handleMouseLeave = useCallback(() => {
    clearHighlight()
  }, [clearHighlight])

  const handleFocus = handleMouseEnter
  const handleBlur = handleMouseLeave

  // Build a map of missing items for quick lookup.
  const missingMap = new Map(missing.map((m) => [m.item, m.qty]))

  const ariaLabel = [
    craftable ? 'Craftable.' : 'Cannot craft â€” missing ingredients.',
    `Output: ${itemName(recipe.output.item)}`,
    recipe.output.qty > 1 ? `(Ã—${recipe.output.qty})` : '',
    'Requires:',
    recipe.inputs.map((i) => `${i.qty} ${itemName(i.item)}`).join(', '),
    recipe.consumesTool ? `and ${itemName(recipe.consumesTool)}` : '',
  ].filter(Boolean).join(' ')

  return (
    <li
      className={[
        'recipe-entry',
        craftable ? 'recipe-entry--craftable' : '',
        highlighted ? 'recipe-entry--hover-active' : '',
      ].join(' ')}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      aria-label={ariaLabel}
      // aria-live so screen readers announce missing-ingredient changes
      aria-live="polite"
    >
      {/* Output row */}
      <div className="recipe-entry__output">
        {craftable && (
          <span className="recipe-entry__rune" aria-hidden="true" title="Craftable">âœ¦</span>
        )}
        <span className="recipe-entry__output-name">
          {itemName(recipe.output.item)}
          {recipe.output.qty > 1 && (
            <span className="recipe-entry__output-qty"> Ã—{recipe.output.qty}</span>
          )}
        </span>
        {recipe.consumesTool && (
          <span className="recipe-entry__upgrade-tag" title="Upgrades an existing tool">
            âŸ³ upgrade
          </span>
        )}
      </div>

      {/* Ingredients list */}
      <ul className="recipe-entry__ingredients" aria-label="Required ingredients">
        {recipe.inputs.map((input) => {
          const lack = missingMap.get(input.item) ?? 0
          const hasMissing = lack > 0
          return (
            <li
              key={input.item}
              className={[
                'recipe-entry__ingredient',
                hasMissing ? 'recipe-entry__ingredient--missing' : '',
              ].join(' ')}
            >
              <span className="ingredient-qty">{input.qty}</span>
              <span className="ingredient-name">{itemName(input.item)}</span>
              {hasMissing && (
                <span className="ingredient-missing-label" aria-label={`Missing ${lack}`}>
                  missing {lack}
                </span>
              )}
            </li>
          )
        })}
        {/* consumesTool row */}
        {recipe.consumesTool && (() => {
          const lack = missingMap.get(recipe.consumesTool) ?? 0
          const hasMissing = lack > 0
          return (
            <li
              key={recipe.consumesTool}
              className={[
                'recipe-entry__ingredient',
                'recipe-entry__ingredient--tool',
                hasMissing ? 'recipe-entry__ingredient--missing' : '',
              ].join(' ')}
            >
              <span className="ingredient-qty">1</span>
              <span className="ingredient-name">{itemName(recipe.consumesTool)}</span>
              {hasMissing && (
                <span className="ingredient-missing-label" aria-label="Missing">
                  missing 1
                </span>
              )}
            </li>
          )
        })()}
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
                Craftingâ€¦
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
              âœ¦ Craft
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
  const workbenchOpen = useWorldStore((s) => s.workbenchOpen)
  const unlockedRecipes = useCraftingStore((s) => s.unlockedRecipes)
  const highlightedItems = useCraftingStore((s) => s.highlightedItems)
  const craftingProgress = useCraftingStore((s) => s.craftingProgress)
  const startCrafting = useCraftingStore((s) => s.startCrafting)
  const inventory = useInventoryStore((s) => s.inventory)
  // Clear highlight when workbench closes.
  const clearHighlight = useCraftingStore((s) => s.clearHighlight)
  const titleId = useId()

  useEffect(() => {
    if (!workbenchOpen) clearHighlight()
  }, [workbenchOpen, clearHighlight])

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
          âœ¦ Â· Â· âœ¦ Â· Â· âœ¦
        </div>

        {RECIPES.length === 0 && (
          <p className="recipe-book__empty">No recipes known yet.</p>
        )}

        <ul className="recipe-book__list" aria-label="Recipe list">
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
                onCraft={handleCraft}
              />
            )
          })}

          {/* Separator between unlocked and locked sections */}
          {locked.length > 0 && orderedUnlocked.length > 0 && (
            <li className="recipe-book__section-sep" aria-hidden="true" role="presentation">
              <span>Â· Â· Â·</span>
            </li>
          )}

          {/* Locked recipes */}
          {locked.map((recipe) => (
            <LockedEntry key={recipe.id} recipe={recipe} />
          ))}
        </ul>

        <p className="recipe-book__footer">
          Craft at the bench â€” 1.5 s â€” world runs.
        </p>
      </div>
    </div>
  )
}
