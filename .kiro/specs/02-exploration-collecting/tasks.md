# Implementation Plan: Exploration and Collecting

- [x] 1. Item, zone and loot data
  - `src/data/items.ts`, `zones.ts`, `lootTables.ts` from the design bible
  - Seeded RNG `src/game/rng.ts`
  - _Requirements: 7.1, 7.2_

- [x] 2. Inventory system with property tests
  - `addItem`, `removeItem`, `hasItems`, `assignHotbar`; key items outside slots
  - Property tests: stack and slot limits, add/remove inverse, quantity conservation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.4, 5.4_

- [x] 3. Loot rolling and daily respawn
  - `loot.ts`, `spawns.ts`; once-only spawns for keys, relics and pages; night-only locket
  - Property test: loot quantities within bounds
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. Interaction raycast and Interactable wrapper
  - Pulse within lantern radius, outline and rune icon on hover, prompt text
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Pickups and toasts
  - Material pickup flow with full-satchel refusal messages
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. Grave digging
  - `dig.ts` with hold-to-dig, cancel on move or hit, once per day
  - Emit `digCompleted` for the scare director (hook up in spec 05)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Examine mode
  - Overlay canvas, rotate and zoom, hidden-mark clue reveal, pauses simulation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8. Satchel overlay and hotbar
  - 12-slot leather UI, drop to world, hotbar 1–4, keyboard-navigable
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Self-drawing journal map
  - `mapReveal.ts` with idempotence property test; ink animation; landmarks; quill marker
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 10. Checkpoint
  - Explore by day, collect, dig, examine the crypt key, see the map fill in; all tests pass

- [x] 11. Replace greybox with real models
  - Read `docs/world-models.md`, `docs/hero-items.md` and `docs/CREDITS.md` first; do not edit any `.glb` file
  - World: in `Cemetery.tsx` swap primitive graves, fences, walls, crypts, trees and lamps for the `.glb` files in `public/assets/models/world/`; keep existing colliders and layout positions; use `<Instances>` for repeated graves and fences; use crooked pines and trunks where the design mentions dead oaks; crypts are built from `crypt-large`, `crypt-large-door` and `crypt-large-roof` (raised 2.4 m)
  - Hero items: show the 8 relics and keys from `public/assets/models/items/` in the world and in examine mode, using the file names already in `src/data/items.ts`; clue normal is `[0, 0, -1]`
  - Draco: copy `node_modules/three/examples/jsm/libs/draco/gltf/` to `public/draco/` and load with `/draco/` so nothing comes from a CDN
  - Preload models during the loading screen
  - Run test, build and lint, and log the change in `docs/kiro-log.md`
  - _Requirements: 1.1, 4.1, 4.2_
