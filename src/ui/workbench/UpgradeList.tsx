/*
  UpgradeList — weapon upgrades the player can buy at the workbench (Req 11.1–11.5).

  Only upgrades for owned weapons are listed. Each card shows every changed stat as
  "old → new", the cost, and either a buy button, the missing materials, or a
  "Bought ᚱ" mark. The rune keeps the bought state from relying on colour alone.
*/

import { ITEM_MAP } from '../../data/items'
import { buyUpgrade } from '../../game/state/combatActions'
import { useCombatStore } from '../../game/state/combatStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { canBuyUpgrade, listableUpgrades, missingReason, upgradeLines } from '../../game/systems/upgrades'
import { UPGRADE_MAP } from '../../data/upgrades'
import type { UpgradeId } from '../../game/types'
import './RecipeBook.css'

function UpgradeCard({ id }: { id: UpgradeId }) {
  const inventory = useInventoryStore((s) => s.inventory)
  const bought = useCombatStore((s) => s.upgrades)
  const def = UPGRADE_MAP[id]
  const owned = bought.includes(id)
  const check = canBuyUpgrade(inventory, bought, id)
  const weaponName = ITEM_MAP[def.weapon]?.name ?? def.weapon
  const cost = def.cost.map((c) => `${c.qty} ${ITEM_MAP[c.item]?.name.toLowerCase() ?? c.item}`).join(', ')
  const canBuy = check.ok

  return (
    <li className={['recipe-entry', canBuy ? 'recipe-entry--craftable' : ''].join(' ')}>
      <div className="recipe-entry__output">
        <span className="recipe-entry__output-name">{def.name}</span>
        <span className="recipe-entry__output-qty"> · {weaponName}</span>
      </div>
      <ul className="recipe-entry__ingredients" aria-label="Changes">
        {upgradeLines(id).map((line) => (
          <li key={line} className="recipe-entry__ingredient">{line}</li>
        ))}
      </ul>
      <div className="recipe-entry__ingredient">Cost: {cost}</div>
      {owned ? (
        <div className="recipe-entry__output" aria-label="Bought">Bought ᚱ</div>
      ) : (
        <>
          {!check.ok && check.reason === 'missing' && (
            <div className="recipe-entry__ingredient recipe-entry__ingredient--missing" aria-live="polite">
              {missingReason(check.missing ?? [])}
            </div>
          )}
          <div className="recipe-entry__craft-row">
            <button
              type="button"
              className="craft-btn"
              disabled={!canBuy}
              onClick={() => buyUpgrade(id)}
              aria-label={`Buy ${def.name} for ${weaponName}`}
            >
              ✦ Buy
            </button>
          </div>
        </>
      )}
    </li>
  )
}

export function UpgradeList() {
  const inventory = useInventoryStore((s) => s.inventory)
  const ids = listableUpgrades(inventory)

  if (ids.length === 0) {
    return <p className="recipe-book__empty">No weapons to upgrade yet.</p>
  }
  return (
    <ul className="recipe-book__list" aria-label="Upgrade list">
      {ids.map((id) => (
        <UpgradeCard key={id} id={id} />
      ))}
    </ul>
  )
}
