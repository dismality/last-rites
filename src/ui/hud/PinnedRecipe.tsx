import { useCraftingStore } from '../../game/state/craftingStore'
import { useGameStore } from '../../game/state/gameStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { pinCardView } from '../workbench/recipeView'
import './pinnedRecipe.css'

/**
 * Small card under the objective tracker for the recipe pinned at the workbench. It re-reads
 * the satchel, so the counts update as materials are picked up. Unpin it from the recipe book.
 */
export function PinnedRecipe() {
  const screen = useGameStore((s) => s.screen)
  const pinned = useCraftingStore((s) => s.pinnedRecipe)
  const unlocked = useCraftingStore((s) => s.unlockedRecipes)
  const inventory = useInventoryStore((s) => s.inventory)
  const view = pinCardView(pinned, unlocked, inventory)
  if (screen !== 'game' || view === null) return null
  return (
    <aside className="hud-pin" aria-label={`Pinned recipe: ${view.title}`}>
      <p className="hud-pin__title">
        <span aria-hidden="true">◆ </span>
        {view.title}
        {view.craftable && <span className="hud-pin__ready"> · ready ✦</span>}
      </p>
      <ul className="hud-pin__rows">
        {view.rows.map((r) => (
          <li key={r.item} className={r.lack > 0 ? 'is-missing' : ''}>
            <span aria-hidden="true">{r.mark} </span>
            {r.label}
            {r.lack > 0 ? ` (${r.note})` : ''}
          </li>
        ))}
      </ul>
    </aside>
  )
}