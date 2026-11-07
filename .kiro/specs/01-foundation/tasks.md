# Implementation Plan: Foundation

- [x] 1. Scaffold the project
  - Vite React-TS template; install the cohesive stack: `react@^19`, `react-dom@^19`, `three@^0.178`, `@react-three/fiber@^9.0`, `@react-three/drei@^10.0`, `@react-three/rapier@^2.0`, `@react-three/postprocessing@^3.0`, `zustand`, `howler`
  - Dev deps: `vitest`, `@vitest/coverage-v8`, `fast-check`, `eslint`, `prettier`, `@types/three`, `typescript` (strict mode)
  - Add npm scripts `dev`, `build`, `test`, `test:watch`, `lint`
  - Create the folder skeleton from the structure steering doc (`src/game/`, `src/scene/`, `src/ui/`, `src/data/`, `src/audio/`, `tests/`, `public/assets/`)
  - Confirm `npm run build` passes with zero type errors before moving on
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Shared types, event bus and stores
  - `src/game/types.ts` — `Phase`, `ItemId`, `Settings`, `PlayerState`, `WorldState`, `LanternState`, `StaminaState`, `GameEvent` union
  - `src/game/events.ts` — typed emit/subscribe helpers; events are value objects, not DOM events
  - zustand stores: `usePlayerStore`, `useWorldStore`, `useLanternStore`, `useSettingsStore`, `useGameStore`
  - All stores use plain setter functions; no mutable state outside stores
  - _Requirements: 5.6, 6.2_

- [x] 3. Settings system with persistence
  - `src/game/systems/settings.ts`: `loadSettings(storage?)` / `saveSettings(s, storage?)`
  - Defaults and ranges from the accessibility steering doc (all 11 settings)
  - `prefers-reduced-motion` check on first load — sets `cameraShake` and `headBob` to `false`
  - Property test: `loadSettings(saveSettings(s))` round-trips any valid `Settings` (use `fast-check` arbitraries for each field's range)
  - Test: storage throws → returns defaults without throwing
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 4. Pure day/night, lantern and stamina systems with tests
  - `src/game/systems/dayNight.ts`: `tickDayNight(s, dt, {wavesCleared}) → {state, events[]}`
    - Phases: Day 360 s → Dusk 30 s → Night (until wavesCleared) → Dawn 10 s → next Day
    - Emits `nightStarted`, `dawnStarted`, `phaseChanged`
    - Night fog density from design bible per night number
  - `src/game/systems/lantern.ts`: `tickLantern(s, dt, phase) → LanternState`; `lanternRadius(fuel) → number`
    - Drain: 1%/6 s day, 1%/3 s night; no drain while off; floor glow 1.5 m at fuel=0
    - Flicker flag set when fuel < 20%
  - `src/game/systems/stamina.ts`: `tickStamina(s, dt, sprinting) → StaminaState`
    - Drain 20/s sprinting; regen 15/s after 1 s without sprinting; clamp [0, 100]
  - Unit tests for each system; property tests: step independence, radius bounds [1.5, 8], fuel bounds [0, 100]
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 2.4, 2.5, 5.1, 5.3, 5.4, 5.5, 5.6_

- [x] 5. Fixed-timestep GameLoop and pause
  - `src/scene/GameLoop.tsx`: `useFrame` accumulator, STEP = 1/60 s, max delta clamp 0.25 s
  - System call order: input → stamina → player → lantern → dayNight
  - Events collected per tick and published to the event bus after all systems run
  - Reads `useGameStore(s => s.paused)` — if true, skip tick entirely
  - `useGameStore` action `setPaused(bool)` called by pointer-lock-lost and Esc handler
  - _Requirements: 7.4_

- [x] 6. First-person controller with input bindings
  - `src/scene/player/input.ts`: maps `KeyboardEvent.code` → action via `useSettingsStore(s => s.bindings)`; exports `InputSnapshot` sampled once per tick
  - Pointer-lock request on canvas click; `pointerlockchange` → calls `setPaused(true)` on loss
  - `src/scene/player/FirstPersonController.tsx`: Rapier `RigidBody type="kinematic-position-based"`, capsule collider (radius 0.35, halfHeight 0.5)
  - Mouse look: `movementX/Y` → yaw/pitch; pitch clamped ±85°; sensitivity and invertY from settings
  - Walk 3.0 m/s, sprint 5.5 m/s (while stamina > 0)
  - Head bob: sinusoidal Y offset on camera, amplitude ~0.04 m, frequency ~2 Hz, gated by `settings.headBob`
  - `<Physics>` must be wrapped in `<Suspense>` — include this at the `GameLoop` level
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.5_

- [x] 7. Lantern rendering
  - `src/scene/player/Lantern.tsx`: camera-attached `SpotLight` (angle 0.9, penumbra 0.6, castShadow, decay 2) + fill `PointLight` (no shadow)
  - `intensity` driven by `lanternRadius(fuel)` mapped to a 0–1 intensity range
  - At fuel = 0: swap SpotLight for a dim `PointLight` (radius 1.5 m) — ember glow, no shadow
  - Low-fuel flicker: when `lanternState.flicker`, oscillate intensity with `Math.sin(Date.now() * 0.01)` inside `useFrame`
  - F key toggles `useLanternStore.on`; no drain while off
  - Add comment: "Shadow budget: this SpotLight is slot 1 of 4 maximum"
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. Greybox cemetery
  - `src/scene/world/Cemetery.tsx`: four zones with primitive geometry standing in for final models
  - Grounds: flat plane, scattered box headstones (instanced), chapel exterior box
  - Mausoleum Row: narrow corridor of box walls; locked gate collider (static CuboidCollider) until key obtained
  - Chapel: box shell with a door opening (two CuboidColliders for the frame)
  - Catacombs: low-ceiling tunnel primitives; locked entrance collider
  - Boundary: invisible CuboidCollider walls around the full playable area
  - Headstones and fences: `<Instances>` from drei 10 — one draw call each; three.js built-in frustum culling handles visibility (no `<Frustum>` wrapper — drei has no such component)
  - All zone geometry is `RigidBody type="fixed"` with `colliders="trimesh"` or explicit `CuboidCollider`
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Sky, fog and phase transitions
  - `src/scene/world/SkyAndFog.tsx`: reads `useWorldStore(s => s.phase)` and `fogDensity`
  - On phase change, lerp sky colour (background color), ambient light intensity/colour, directional moonlight intensity, and `scene.fog.density` over 5 s using a local timer in `useFrame`
  - Sky palette: day `#6a7d8f`, dusk `#8b3a1f`, night `#0a0c12`, dawn `#4a5560` (approximate — visual tuning expected)
  - `scene.fog` is `THREE.FogExp2`; set via `useThree(s => s.scene)` — do not add a `<fog>` JSX element as that creates scene-level fog outside the phase lerp
  - Postprocessing: `<EffectComposer>` with `<Noise premultiplied />`, `<Bloom luminanceThreshold={0.9} intensity={0.4} mipmapBlur />`, `<Vignette offset={0.3} darkness={0.6} />`. Use `mipmapBlur` (v3 API) not `kernelSize`.
  - _Requirements: 5.2, 5.5_

- [x] 10. Screens: content warning, loading, title, pause, settings
  - `src/ui/menus/ContentWarning.tsx`: warns about jumpscares and flashing lights; buttons "Continue" (→ Loading) and "Settings" (opens Settings panel); must be keyboard-navigable with visible focus ring
  - `src/ui/menus/LoadingScreen.tsx`: uses `useProgress()` from drei 10 for real asset progress; themed with `--parchment` and `--ink` tokens; shows a flickering lantern SVG
  - `src/ui/menus/TitleScreen.tsx`: buttons New Game / Continue (greyed if no save) / Settings / Credits; IM Fell English SC heading
  - `src/ui/menus/PauseMenu.tsx`: overlays Game screen; calls `setPaused(false)` on Resume; includes Settings inline; triggered by Esc and pointer-lock loss
  - `src/ui/menus/Settings.tsx`: renders all 11 settings from the accessibility steering doc; saves on every change via `saveSettings`
  - All menus: `role="dialog"`, `aria-modal="true"`, `tabIndex` chain, `onKeyDown` Escape handler, visible `:focus-visible` outline
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 6.1_

- [x] 11. Baseline HUD and subtitles
  - `src/ui/hud/LanternHealth.tsx`: SVG lantern-flame icon; flame height proportional to `health/100`; tinted red below 30 HP; numeric overlay when `settings.accessibleHUD`
  - `src/ui/hud/FuelReservoir.tsx`: glass tube SVG; fill level proportional to `fuel/100`; numeric overlay when `settings.accessibleHUD`
  - `src/ui/hud/Crosshair.tsx`: 4×4 px dot; switches to hand SVG icon when `usePlayerStore` exposes an `interactTarget` within 2.5 m
  - `src/ui/hud/Subtitles.tsx`: subscribes to captioned events on the event bus; shows text in `--parchment` on `rgba(0,0,0,0.6)` backing; 20 px minimum; auto-hides after the event duration
  - `src/ui/hud/DawnCard.tsx`: stub component — receives `{zombiesBanished, itemsFound, recipeUnlocked, journalPageAvailable}` props and renders a parchment card; populated by later specs
  - Stamina bar: shown only when draining or recently drained (fades out 1 s after sprint stops); numeric when `accessibleHUD`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 5.4_

- [x] 12. Checkpoint: first playable
  - Manual smoke-test checklist (run before marking done):
    1. `npm run test` passes with zero failures
    2. `npm run build` passes with zero TypeScript errors
    3. Walk all four zones (gates block Mausoleum Row and Catacombs)
    4. Lantern toggles with F; fuel drains; flicker appears below 20%; ember glow at 0%
    5. Sprint drains stamina; regen kicks in after 1 s pause
    6. Esc opens pause, Resume closes it; pointer-lock loss also pauses
    7. Day → Dusk → Night transition visible (sky, fog, ambient change)
    8. Settings menu: change mouse sensitivity and head bob; values persist after page reload
    9. Content warning appears on first load; Settings accessible from it
    10. Deploy a preview build to Vercel and confirm it loads in Chrome, Edge and Firefox
  - _Requirements: 1.1, 1.2, 1.3, all of 2–8_
