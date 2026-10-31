# Design: Crafting and Chapel Repairs

## Data
```ts
// recipes.ts
interface RecipeDef {
  id: RecipeId
  inputs: { item: ItemId; qty: number }[]
  output: { item: ItemId; qty: number }
  consumesTool?: ItemId            // e.g. rusty-shovel
  unlock: { type: 'start' } | { type: 'night'; night: 1 | 2 | 3 | 4 } | { type: 'journal'; page: number }
  craftTime: number                // seconds, default 1.5
}
// repairs.ts
interface RepairStage { stage: 1 | 2 | 3; cost: ItemStack[]; effect: 'barDoor' | 'altarSave' | 'bellWarning' }
// weapons.ts
interface WeaponDef { id: ItemId; kind: 'melee' | 'thrown' | 'placed'; damage: number; cooldown: number; durability: number | null; radius?: number }
```

## Systems
| System | Key functions |
|---|---|
| `crafting.ts` | `canCraft(inv, recipe) → {ok, missing[]}`, `craft(inv, recipe) → {inv} \| {error}`, `unlockRecipes(state, event)` |
| `durability.ts` | `applyHit(weaponState) → {weaponState, broke}` |
| `repairs.ts` | `canRepair(inv, chapel)`, `repair(inv, chapel) → {inv, chapel}` |
| `consumables.ts` | timed use with cancel on hit |

`craft` is atomic: it checks capacity on a simulated inventory *before* committing, so a failed craft never consumes anything.

## Workbench scene
- `scene/world/Workbench.tsx`: when active, a camera rig lerps (400 ms, or a fade with reduce motion) to a fixed viewpoint above the bench.
- Materials on the bench are instanced small models per material type, count shown by pile size (1–10 mapped to 1–5 meshes) plus a numeric label.
- Glow: emissive ember pulse via a shared material uniform; bloom catches it. A rune sprite floats above craftable piles.
- Recipe book: HTML overlay styled as a parchment ledger on the right; hovering an entry sends `highlight(itemIds)` to the bench.

## Unlocks
`crafting.unlockRecipes` listens for `dawnStarted` and `journalRead` events and returns newly unlocked ids for the dawn card and recipe-book animation.

## Testing
- Unit: start recipes unlocked; night unlock mapping; salt circle on page 3; tool replacement keeps hotbar slot.
- Property (fast-check):
  - `craft` never produces negative counts
  - if `canCraft` is false, `craft` returns an error and the inventory is unchanged
  - if `canCraft` is true and capacity allows, item totals change by exactly `-inputs + output`
  - durability never goes below 0, and a weapon breaks exactly once
  - `repair` stages always complete in order
