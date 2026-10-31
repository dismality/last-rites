# Design: Combat, Zombies and Night Waves

## Data
```ts
// enemies.ts
interface EnemyDef { id: 'shambler' | 'lurker' | 'wailer'; hp: number; speed: number; damage: number; attackRange: number; attackCooldown: number; audio: AudioCueId }
// waves.ts
interface NightDef { night: 1|2|3|4|5; fog: number; waves: { shambler: number; wailer: number; lurker: number }[]; finalRite?: boolean }
```

## Systems (pure)
| System | Key functions |
|---|---|
| `combat.ts` | `meleeHits(origin, dir, arc, range, enemies) → EnemyId[]`, `applyDamage(enemy, dmg, ctx) → enemy`, `aoe(center, radius, enemies)` |
| `enemyAI.ts` | `tickEnemy(enemy, dt, ctx) → {enemy, events}` as a small state machine per type |
| `waves.ts` | `tickWaves(state, dt, ctx) → {state, spawns[], events}` |
| `projectiles.ts` | ballistic arc preview `arcPoints(origin, velocity, g, steps)` and fuse timers |
| `playerHealth.ts` | `damagePlayer(p, dmg, blocking)`, death detection |

### Enemy state machines
- **Shambler:** `rise → chase → attack → (stagger) → chase … → dying`
- **Lurker:** `dormant → (trigger) → lunge → attack → chase → dying`; the trigger is checked against `ctx.playerFacing` and `ctx.lanternFuel`
- **Wailer:** `rise → keepDistance ↔ scream → dying`; scream emits `wailerScream(pos)`, which sets nearby enemies' target to the player and applies a speed boost for 3 s

### Navigation
No navmesh for the jam. Enemies steer toward the player with simple steering (seek + separation + wall avoidance raycasts via Rapier) on a hand-placed waypoint graph inside the alleys and catacombs. Chapel door collider blocks them once stage 1 is repaired.

## Rendering
- Viewmodel: a second scene rendered after the main pass with depth cleared (R3F `createPortal` + `useFrame` render priority), so weapons never clip.
- Swing and throw animations driven by code (spring curves), not skeletal animation, to save time.
- Zombies: one rigged CC0 humanoid with Mixamo-style clips (walk, attack, scream, idle); tint and scale differ per type. Instanced dust particles on death.
- Arc preview: drei `Line` with dashed material.

## Saving for Retry Night
At the start of dusk, serialize all stores (excluding settings) into `sessionStorage` key `lastrites:dusk`, wrapped in try/catch; if storage fails, Retry restarts the night with current inventory.

## Testing
- Unit: each enemy state transition; lurker trigger conditions; wailer scream radius; wave sequencing with 15 s gaps; `wavesCleared` emitted once.
- Property (fast-check):
  - `applyDamage` never raises HP and never goes below 0
  - `meleeHits` only returns enemies within range and arc
  - for any night definition, total spawned == sum of wave compositions, and live count never exceeds 14
  - `damagePlayer` with blocking always deals ≤ non-blocking damage
