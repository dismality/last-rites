# Design: Exploration and Collecting

## Data (`src/data/`)
```ts
// items.ts
type MaterialId = 'bone' | 'iron-nail' | 'candle-wax' | 'holy-water' | 'cloth' | 'lamp-oil' | 'grave-salt'
type ItemKind = 'material' | 'weapon' | 'consumable' | 'placeable' | 'key' | 'relic' | 'lore'
interface ItemDef { id: ItemId; name: string; kind: ItemKind; stackLimit: number; icon: string; model?: string; clue?: ClueDef }

// zones.ts
interface SpawnPoint { id: string; zone: ZoneId; position: Vec3; lootTable: LootTableId }
interface LootTable { id: LootTableId; rolls: number; entries: { item: MaterialId; weight: number; min: number; max: number }[] }
```
Loot is rolled with a seeded RNG (`src/game/rng.ts`, mulberry32) so tests are deterministic.

## Systems
| System | Key functions |
|---|---|
| `inventory.ts` | `addItem(inv, id, qty) → {inv, added, rejected, reason}`, `removeItem`, `hasItems(inv, reqs)`, `assignHotbar` |
| `loot.ts` | `rollLoot(table, rng) → ItemStack[]` |
| `dig.ts` | `tickDig(state, dt, input) → {state, events}`; emits `digCompleted`, `digCancelled` |
| `spawns.ts` | `respawnForDay(world, rng)` |
| `mapReveal.ts` | `revealAt(map, position) → {map, newlyRevealed: Cell[]}` |

### Inventory model
```ts
interface Inventory { slots: (ItemStack | null)[12]; keyItems: Set<ItemId>; hotbar: (number | null)[4] }
```
Key items, relics and lore go into `keyItems`, never into slots.

## Interaction (scene)
- `useInteractionRaycast` casts from the camera each frame (max 2.5 m) against objects tagged `userData.interactable`.
- Interactables register through an `<Interactable action="dig" onInteract={…}>` wrapper that also adds the pulse/outline (drei `Outlines`) and a rune icon sprite.
- Pulse visibility is gated by distance ≤ lantern radius.

## Examine mode
Separate small R3F scene rendered in an overlay `<Canvas>` with `OrbitControls` (no pan), the item model and a warm key light. Clues: each `ClueDef` has a local-space normal; the clue reveals when `dot(cameraDir, worldNormal) < -0.9` for 1 s.

## UI
- `ui/satchel/Satchel.tsx`: 4×3 grid on a leather texture, drag to hotbar or press 1–4 on a focused slot, Drop button.
- `ui/hud/Toast.tsx`: parchment toasts queue, 2 s each.
- `ui/journal/Map.tsx`: canvas 2D; explored cells drawn with a pencil stroke texture; the animation is replaced by a fade when reduce motion is on.

## Testing
- Unit: dig cancel on move or hit; locket night-only visibility; once-only spawns.
- Property (fast-check):
  - `addItem` never makes a stack exceed its limit or the inventory exceed 12 slots
  - `addItem` then `removeItem` with the same quantity returns an equivalent inventory
  - total quantity is conserved: `added + rejected == qty`
  - `rollLoot` quantities are always within each entry's min/max
  - `revealAt` is idempotent
