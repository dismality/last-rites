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
