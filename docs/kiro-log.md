# Kiro Development Log

How Kiro was used to build Last Rites. Entries are added as work happens (see `.kiro/steering/kiro-log.md` for the format).

---

### 2026-11-01: Project planning
- **Kiro feature used:** steering, specs, hooks
- **What happened:** Set up the `.kiro/` folder: 8 steering docs (product, tech, structure, horror design, visual style, accessibility, MCP usage, log rule), 5 feature specs, 6 hooks and the context7 MCP server. Game content lives in `docs/game-design.md`, which steering includes by file reference.
- **What Kiro caught or sped up:** _(fill in after the first Kiro session)_

### 2026-11-01: Setup check + 01-foundation spec review
- **Kiro feature used:** spec review, context7 MCP (library version lookup), hook migration
- **What happened:** Full pre-code setup audit: read all steering docs, specs, hooks and mcp.json. Reviewed 01-foundation requirements, design and tasks against steering and game-design.md. Used context7/web search to verify current library versions. Rewrote design.md and tasks.md with fixes. Updated tech.md stack table. Migrated all 6 hooks from the old proprietary format to the v1 JSON schema Kiro expects.
- **What Kiro caught or sped up:** 10 issues found and fixed before a single line of code was written: version stack mismatch (React 18+R3F 8 vs the correct React 19+R3F 9 cohesive set), `<Physics>` outside `<Suspense>` (rapier v2 WASM init throws at runtime), postprocessing v3 API change (`kernelSize` removed, `mipmapBlur` required), fog placement conflation, `lanternRadius` floor wrong in property test (1.5 m not 2 m), task 1 underspecified, task 12 missing exit criteria, missing scope guard, imprecise system type signatures, and a non-existent `<Frustum>` component from drei cited in the design.

### 2026-11-01: 01-foundation task 1: project scaffold
- **Kiro feature used:** spec task, steering (tech, structure)
- **What happened:** Scaffolded Vite + React 19 + TypeScript 6.0 project. Installed all runtime and dev dependencies. Created all config files and the full folder skeleton from structure.md. `npm run build` and `npm run test` both pass.
- **What Kiro caught or sped up:** Two issues caught before they became blockers: (1) `typescript-eslint@8` does not support TypeScript 7 -- used TypeScript 6.0 and noted it in tech.md. (2) Vitest 5 requires `globals: true` in config; the default changed from v4 and adding it fixed the failing test suite immediately.

### 2026-11-01: spec 03-crafting-inventory task 1: Recipe, weapon and repair data
- **Kiro feature used:** spec task execution
- **What happened:** Created typed data files: `src/data/recipes.ts` (RECIPES array + RECIPE_MAP, including craftTime field), `src/data/weapons.ts` (WEAPON_MAP with durability, damage, speed), `src/data/repairs.ts` (REPAIR_STAGES for the three chapel stages). Expanded `src/game/types.ts` with full domain types (MaterialId, CraftedItemId, KeyItemId, RelicId, Inventory, PlayerState).
- **What Kiro caught or sped up:** Confirmed data matches the design bible exactly before any systems code was written.

### 2026-11-01: spec 03-crafting-inventory task 2: Crafting system with property tests
- **Kiro feature used:** spec task execution, PBT (fast-check)
- **What happened:** Implemented `canCraft`, atomic `craft`, and `unlockRecipes` in `src/game/systems/crafting.ts`. Wrote 21 tests (14 unit + 3 property-based with fast-check, 500 runs each).
- **What Kiro caught or sped up:** A test for the capacity-full scenario initially passed when it should not have -- the cloth input being fully consumed freed a slot, leaving room for the output. The test was tightened to use a partial-consume stack so the slot persists and the no-capacity path is actually exercised.

### 2026-11-01: spec 03-crafting-inventory task 3: Recipe unlocks
- **Kiro feature used:** spec task execution
- **What happened:** Verified that `unlockRecipes` (already implemented in task 2) fully satisfies Req 4.1-4.3. All 7 unit tests for unlock paths pass.
- **What Kiro caught or sped up:** Confirmed no duplicate work was needed -- the function and tests were already in place from the previous task.

### 2026-11-01: spec 03-crafting-inventory task 4: Workbench camera rig and bench layout
- **Kiro feature used:** spec task execution, context7 MCP
- **What happened:** Created `inventoryStore.ts` (zustand), `Workbench.tsx` (camera rig + instanced material piles + keyboard close + amber point light), and `useWorkbench.ts` (interact hook). Also fixed a pre-existing unused import in `crafting.ts` that was blocking tsc.
- **What Kiro caught or sped up:** Used context7 to verify R3F 9 `useFrame`/`lerp` and Drei 10 `Instances`/`Instance` API before writing code, avoiding version-mismatch guesswork.

### 2026-11-01: spec 03-crafting-inventory task 5: Recipe book UI with glow and highlighting
- **Kiro feature used:** spec task execution, steering (visual-style, accessibility)
- **What happened:** Created `src/ui/theme/tokens.css` (CSS custom properties + Google Fonts import), `src/game/state/craftingStore.ts`, `src/ui/workbench/RecipeBook.tsx` (parchment ledger overlay -- craftable glow + rune, hover highlight, missing-qty in blood-red, smudged locked entries), and `RecipeBook.css`. Updated `Workbench.tsx` to read `highlightedItems` and pulse material piles.
- **What Kiro caught or sped up:** `noUncheckedSideEffectImports` in tsconfig flagged CSS imports immediately -- added `declarations.d.ts` before the build could fail in CI. Also caught a stray unused `useState` import that `noUnusedLocals` would have rejected.

### 2026-11-01: spec 03-crafting-inventory task 7: Durability and consumables
- **Kiro feature used:** spec task execution, PBT (fast-check)
- **What happened:** Created `durability.ts` (`applyHit`, `createWeaponState`, `isCracked`), `consumables.ts` (`startUse`, `tickUse`, `cancelUse`), their test files (18 + 15 tests each), and `Viewmodel.tsx` with the crack overlay. All 56 tests pass.
- **What Kiro caught or sped up:** fast-check's `fc.float` can emit `NaN` as a valid 32-bit float even with `Math.fround` bounds; switched property-test dt generators to integer milliseconds to avoid the footgun.

### 2026-11-01: spec 03-crafting-inventory task 6: Crafting animation with hit cancel
- **Kiro feature used:** spec task execution
- **What happened:** Extended `craftingStore` with `craftingProgress`, `startCrafting`, `tickCrafting`, `cancelCrafting`, and `commitCraft`. Added `lastDamageAt`/`registerHit` to `worldStore`. Wired the 1.5 s tick loop and cancel-on-hit into `Workbench.tsx` via `useFrame`. Added Craft button + progress bar to `RecipeBook.tsx`. Created `AudioManager.ts` stub.
- **What Kiro caught or sped up:** Build revealed a stray `WEAPON_MAP` unused import in `consumables.ts`; caught and fixed before tests ran.

### 2026-11-01: spec 03-crafting-inventory task 8: Chapel repairs
- **Kiro feature used:** spec task execution, PBT (fast-check)
- **What happened:** Implemented the full chapel repairs feature across six files: pure `repairs.ts` system (canRepair / repair / selectors), 24 unit tests + 3 property-based tests, `chapelStore.ts` zustand store, `RepairUI.tsx` overlay with focus trap, `Chapel.tsx` R3F scene component, and wired `<RepairUI>` into `App.tsx`. Extended `worldStore.ts` with `chapelRepairOpen`, `healPlayer` -- additive only.
- **What Kiro caught or sped up:** All 81 tests including the 3 new property tests (no-negative counts, monotonic stage advance, all-complete guard) passed first run.

### 2026-11-01: spec 03-crafting-inventory task 9: Checkpoint
- **Kiro feature used:** spec task execution, PBT
- **What happened:** Wrote `tests/checkpoint.test.ts` with 12 integration tests covering bone club craft, shovel sharpen after night 1, and chapel repair stage 1. All scenarios passed cleanly. Total test count: 93.
- **What Kiro caught or sped up:** Confirmed that `craft`, `repair`, `isDoorBarred`, and `unlockRecipes` compose correctly end-to-end before any scene wiring touches them.

### 2026-11-01: spec 03 lint and build fixes
- **Kiro feature used:** spec task execution
- **What happened:** Fixed 3 lint errors and 2 warnings that accumulated across spec 03 tasks: moved `playerPositionRef` out of `Chapel.tsx` into a sibling `playerPositionRef.ts` (react-refresh warning), replaced `Math.random()` in `MaterialPile` render path with a module-level counter (react-hooks/purity error), moved `allInputIds` array into the `useCallback` body and removed a stale eslint-disable comment in `RecipeBook.tsx`, and used `void state` in `cancelUse` to satisfy typescript-eslint 8's stricter unused-args rule. All three commands (`lint`, `build`, `test`) pass clean.
- **What Kiro caught or sped up:** Note: spec 03 was built before specs 01 and 02, so several stores (`inventoryStore`, `worldStore`) and domain types were created early as part of this spec. These will need reconciling when specs 01 and 02 are implemented -- particularly `worldStore` which currently holds `playerHealth` and `healPlayer` in lieu of a dedicated player store.

### 2026-11-01: spec 01-foundation task 2: Shared types, event bus and stores
- **Kiro feature used:** spec task execution
- **What happened:** Created `src/game/events.ts` (typed emit/subscribe/subscribeToType/clearSubscribers), five new zustand stores (`playerStore`, `lanternStore`, `settingsStore`, `gameStore`, new day/night `worldStore`), and a barrel `src/game/state/index.ts`. Renamed the existing UI-level worldStore to `uiWorldStore` / `useUiWorldStore` and updated all five consumers (Chapel.tsx, RepairUI.tsx, RecipeBook.tsx, Workbench.tsx, useWorkbench.ts).
- **What Kiro caught or sped up:** Grep confirmed exactly which files imported the old `useWorldStore` for UI state, preventing any missed rename. Build and all 93 tests passed first run after the changes.

### 2026-11-01: spec 01-foundation task 3: Settings system with persistence
- **Kiro feature used:** spec task / PBT
- **What happened:** Added `src/game/systems/settings.ts` (`loadSettings`/`saveSettings` with injectable storage, clamping, reduced-motion first-run defaults) and `settings.test.ts` with a fast-check round-trip property. `settingsStore` now delegates to these functions, so defaults live in one place.
- **What Kiro caught or sped up:** Found the store already had duplicated defaults and an unvalidated `JSON.parse` merge; replaced it with the clamped loader.

### 2026-11-01: 01-foundation task 4: Pure day/night, lantern and stamina systems
- **Kiro feature used:** spec task / PBT
- **What happened:** Added `dayNight.ts`, `lantern.ts`, `stamina.ts` with tuning constants in `src/data/balance.ts`, plus unit and fast-check tests (step independence, radius bounds [1.5, 8], fuel/stamina bounds).
- **What Kiro caught or sped up:** Stamina regen delay is consumed before regen so ticks stay step-independent; dusk uses the night drain rate (a judgment call, noted in code).

### 2026-11-20: 01-foundation task 5: Fixed-timestep GameLoop and pause
- **Kiro feature used:** spec task
- **What happened:** Added a pure accumulator (`fixedStep.ts`, STEP/MAX_DELTA) and a pure `runTick` (stamina → player → lantern → dayNight) so `GameLoop.tsx` is only a `useFrame` driver. Events are batched and emitted after all ticks; paused frames are skipped. Esc and pointer-lock loss call `setPaused(true)` via `usePauseTriggers`.
- **What Kiro caught or sped up:** Moved the tick order and accumulator into testable pure modules, with unit and property tests. Build, tests and lint pass.

### 2026-11-07: 01-foundation task 6: First-person controller with input bindings
- **Kiro feature used:** spec task / MCP (context7)
- **What happened:** Added pure movement maths (movement.ts, with unit and property tests), a bindings-driven input module, a Rapier kinematic capsule FirstPersonController, and wrapped GameLoop children in <Suspense><Physics>.
- **What Kiro caught or sped up:** context7 and the installed types showed the rapier v2 body type string is kinematicPosition (not kinematic-position-based). The React Compiler lint rule also caught mutating the hook-returned camera, so the camera is now updated from the useFrame state.

### 2026-11-15: 01-foundation task 7: Lantern rendering
- **Kiro feature used:** spec task
- **What happened:** Added `Lantern.tsx` (shadow-casting amber SpotLight, fill PointLight, ember PointLight at 0 fuel, flicker, F toggle via the `Lantern` binding) and a pure `lanternIntensity` helper with a property test.
- **What Kiro caught or sped up:** Kept the radius-to-intensity mapping in `src/game/systems` so the scene component holds no balance numbers.

### 2026-11-20: 01-foundation task 8: Greybox cemetery
- **Kiro feature used:** spec task
- **What happened:** Added `Cemetery.tsx` (grounds, hollow chapel shell with two door-frame colliders, Mausoleum Row and Catacombs corridors with key-gated colliders, boundary walls, instanced headstones and fence pickets). Layout is data in `src/data/cemeteryLayout.ts`; gate lock rule is a pure system (`gates.ts`) reading key items from the inventory store.
- **What Kiro caught or sped up:** Noted that drei `Instances` can cache a stale bounding sphere before matrices are filled, so bounds are recomputed after the first frames. The old solid chapel nave in `Chapel.tsx` was removed since it would have blocked the door opening.

### 2026-11-20: 01-foundation task 9: Sky, fog and phase transitions
- **Kiro feature used:** spec task / PBT
- **What happened:** Added `SkyAndFog` (5 s phase lerp of background, FogExp2 density, ambient and non-shadowing moonlight), a `PostEffects` stack, palette constants in `src/data/skyPalette.ts` and pure blend helpers with unit and property tests.
- **What Kiro caught or sped up:** A property test exposed float rounding in `lerp` at k=1 (fixed with the `a*(1-k)+b*k` form); the React lint rules caught direct scene mutation inside hooks, so mutation moved into plain helpers.

### 2026-11-21: 01-foundation task 10: Screens (content warning, loading, title, pause, settings)
- **Kiro feature used:** spec task / MCP (context7 for drei `useProgress`)
- **What happened:** Added `ContentWarning`, `LoadingScreen`, `TitleScreen`, `PauseMenu`, `Settings` and a shared `MenuDialog` (role=dialog, aria-modal, focus trap, Escape, focus restore) and routed them from `App.tsx`. Settings save on every change through the settings store.
- **What Kiro caught or sped up:** Noticed the window-level Esc listener in `usePauseTriggers` would re-pause right after the menu's Esc-to-resume, so resume is deferred one tick.

### 2026-11-21: 01-foundation task 11: Baseline HUD and subtitles
- **Kiro feature used:** spec task / steering (visual-style, accessibility)
- **What happened:** Added `LanternHealth`, `FuelReservoir`, `StaminaBar`, `Crosshair`, `Subtitles`, a stub `DawnCard` and a `Hud` overlay mounted in `App.tsx` on the game screen, plus pure gauge helpers with unit and property tests.
- **What Kiro caught or sped up:** Steering's "no colour alone" rule led to a jagged outline and "!" mark for low health and tick marks on the fuel tube.

### 2026-11-20: 01-foundation task 12: Checkpoint, first playable
- **Kiro feature used:** spec task
- **What happened:** Ran test (17 files, 153 tests pass), build and lint (all clean). Verified checklist items 3-9 by code inspection only; nothing was played in a browser and nothing was deployed.
- **What Kiro caught or sped up:** `src/App.tsx` still renders a "game screen placeholder" and no `<Canvas>` is mounted anywhere. GameLoop, Cemetery, Lantern, SkyAndFog and FirstPersonController exist but are never rendered, so checklist items 3-7 cannot pass in a browser yet.
### 2026-11-21: 03-crafting-inventory task 9: Checkpoint
- **Kiro feature used:** spec task
- **What happened:** Ran test (17 files, 153 tests pass), lint and build, all clean. Verified `tests/checkpoint.test.ts` covers crafting a bone club, sharpening the shovel after `dawnStarted(1)`, and chapel repair stage 1. Checked by unit tests only, not in a browser.
- **What Kiro caught or sped up:** No failures found; the integration test already existed, so no code changes were needed.
### 2026-11-21: 02-exploration-collecting task 1: Item, zone and loot data
- **Kiro feature used:** spec task / steering (tech, structure)
- **What happened:** Added `items.ts`, `zones.ts`, `lootTables.ts`, a seeded mulberry32 `rng.ts` with `randInt`, and unit/property tests for the RNG and data integrity. Lint, build and test pass (19 files, 164 tests).
- **What Kiro caught or sped up:** Reused the existing `ItemId`/`MaterialId` unions from `game/types.ts` instead of redefining them. Fixed-spawn positions and the parish ledger location are placeholders, because the design bible doesn't pin them down.

### 2026-02-05: 02-exploration-collecting task 2: Inventory system with property tests
- **Kiro feature used:** spec task / PBT
- **What happened:** Added `src/game/systems/inventory.ts` (`addItem`, `removeItem`, `hasItems`, `assignHotbar`) on the existing `Inventory` type, with fast-check properties for slot/stack limits, quantity conservation and add/remove inverse.
- **What Kiro caught or sped up:** Reused the existing `Inventory` shape (arrays, not a `Set`) so the crafting and chapel stores keep working; keys, relics and pages go to `keyItems`/`relics` outside the 12 slots.

### 2026-11-20: 02-exploration-collecting task 3: Loot rolling and daily respawn
- **Kiro feature used:** spec task / PBT
- **What happened:** Added `loot.ts` (`rollLoot`) and `spawns.ts` (`respawnForDay`, once-only fixed spawns, night-only locket) with matching tests and a fast-check bounds property.
- **What Kiro caught or sped up:** Merging repeat draws of one item would have broken the min/max bound, so each draw returns its own stack.

### 2026-11-22: 02-exploration-collecting task 4: Interaction raycast and Interactable wrapper
- **Kiro feature used:** spec task / steering (tech, accessibility, visual-style)
- **What happened:** Added pure `interaction.ts` (prompt text, lantern pulse gating, range pick) with unit and fast-check tests, an interaction store, the `<Interactable>` wrapper (pulse, drei `Outlines`, rune sprite), `useInteractionRaycast` in the controller, and an `InteractPrompt` HUD ("E: Dig") plus crosshair hand.
- **What Kiro caught or sped up:** Highlights pair glow with a rune shape cue. The pulse holds steady when flashing lights is off, because there is no separate reduce-motion setting yet. Nothing in the world uses `<Interactable>` yet (pickups arrive in task 5), so the scene behaviour is not exercised in-game.

### 2026-11-22: 02-exploration-collecting task 5: Pickups and toasts
- **Kiro feature used:** spec task / steering (tech, accessibility, visual-style)
- **What happened:** Added pure `pickup.ts` (wraps `addItem`, handles partial and refused pickups) with unit and fast-check conservation tests, `toastStore`, `spawnStore`, a parchment `Toast` HUD (`aria-live`, 2 s each, fade-only under reduced motion) and a `MaterialPickups` scene component using `<Interactable>`.
- **What Kiro caught or sped up:** `addItem` already returned the exact refusal messages, so the rule reuses them. `MaterialPickups` is not mounted yet because the game screen is still a placeholder, so the in-game flow is untested.
### 2026-11-23: 02-exploration-collecting task 6: Grave digging
- **Kiro feature used:** spec task / PBT
- **What happened:** Added pure `dig.ts` (`tickDig`: 3 s hold, cancel on move, hit, release or lost shovel, once per grave per day, `digCompleted` carries loot and the `hand-from-grave` roll for the scare director) with constants in `src/data/digging.ts`, two new `GameEvent` members, and unit plus fast-check tests.
- **What Kiro caught or sped up:** A first test assumed the dig stayed cancelled while the key was still held; the system correctly restarts a fresh dig, so the test now stops on the cancelling tick. Nothing in the scene calls `tickDig` yet and the scare director hookup waits for spec 05.

### 2026-11-20: 02-exploration-collecting task 7: Examine mode
- **Kiro feature used:** spec task / PBT
- **What happened:** Added the pure clue-reveal timer (`systems/examine.ts`, with unit and fast-check tests), an `examineStore`, an overlay R3F canvas with no-pan OrbitControls, and an accessible HTML overlay (Esc/E close, "Inspect markings" keyboard fallback). Simulation freezes through a new `gameStore.examining` flag checked by GameLoop, controller, lantern and raycast.
- **What Kiro caught or sped up:** The pause triggers would have opened the pause menu on Esc and on the pointer-lock release, so they now ignore examine mode.
### 2026-11-24: 02-exploration-collecting task 9: Self-drawing journal map
- **Kiro feature used:** spec task / PBT / steering (tech, accessibility, visual-style)
- **What happened:** Added pure `mapReveal.ts` (8 m grid `revealAt`, landmark discovery, save serialisation) with unit tests and fast-check properties for idempotence and save round-trip. Landmarks live in `data/mapLandmarks.ts`. A `mapStore` persists explored cells to localStorage and the controller reveals cells as the player moves. The canvas map (`ui/journal/Map.tsx`, `mapDraw.ts`) hatches new cells in with a pencil draw (fade under `prefers-reduced-motion`), draws distinct sketched icons plus a text legend, and a quill marker for position and facing. J opens it via `MapOverlay`.
- **What Kiro caught or sped up:** Opening the journal releases pointer lock, which would have triggered the pause menu, so a `gameStore.journalOpen` flag now freezes the simulation and is ignored by the pause triggers. Map persistence uses its own key until the full save system exists (`last-rites-save` stays unwritten so Continue is not enabled by a map alone). Not visually checked in a browser.

### 2026-11-20: 02-exploration-collecting task 8: Satchel overlay and hotbar
- **Kiro feature used:** spec task / PBT
- **What happened:** Added the 4x3 leather satchel overlay (Tab, keyboard-navigable, drop to world, 1-4 hotbar binding), a HUD hotbar with number-key equip, and pure `satchel.ts` rules with tests. The satchel owns Esc and pointer-lock loss without pausing the game.
- **What Kiro caught or sped up:** The React lint rule `set-state-in-effect` flagged a focus reset, and the pause trigger would have paused on the pointer-lock release, so it now skips while the satchel is open.
