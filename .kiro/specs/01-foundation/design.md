# Design: Foundation

## Overview
A Vite + React app hosting a single R3F `<Canvas>` with HTML overlays above it. Gameplay rules live in pure TypeScript systems under `src/game/systems/`, ticked by a fixed-timestep loop. R3F components render state and forward input.

**Stack versions (checked November 2026):**
React 19, R3F `^9.0`, drei `^10.0`, rapier `^2.0`, postprocessing `^3.0`, three `^0.178`.
R3F 9 requires React 19 (R3F 8 = React 18 — do not mix).

## Architecture

```
App
├── ContentWarning → Loading → Title → Game → Ending   (screen state machine in App.tsx)
└── Game
    ├── <Canvas>
    │   ├── <Suspense>
    │   │   └── <Physics> (Rapier — must be inside Suspense, it lazy-inits WASM)
    │   │       ├── FirstPersonController  (kinematic character controller + camera)
    │   │       ├── Lantern                (spotlight + point light on camera)
    │   │       └── Cemetery               (zones, colliders, instanced props)
    │   ├── SkyAndFog                  (driven by world.phase)
    │   ├── <EffectComposer>           (@react-three/postprocessing ^3)
    │   │   ├── <Noise />
    │   │   ├── <Bloom /> (lantern + holy only — use luminanceThreshold)
    │   │   └── <Vignette />
    │   └── GameLoop                   (fixed-step tick of all systems)
    └── UI overlay (HUD, PauseMenu, Settings, Subtitles, DawnCard)
```

> **Note — no `<Fog>` inside postprocessing:** Three.js scene fog (`FogExp2`) is set on
> `scene.fog` directly and is separate from the postprocessing chain. Do not attempt to
> add a custom fog pass inside `<EffectComposer>` — use `useThree(s => s.scene)` and set
> `scene.fog` from `SkyAndFog.tsx`.

## Fixed-timestep loop
`GameLoop.tsx` uses `useFrame` and an accumulator:
```ts
acc += min(delta, 0.25)            // clamp spiral-of-death
while (acc >= STEP) { tickSystems(STEP); acc -= STEP }   // STEP = 1/60
```
`tickSystems` calls each system in a fixed order: input → player → lantern → dayNight → (later specs: waves, enemies, combat, scares, mystery). While paused, the loop does not tick.

> **R3F 9 `useFrame` note:** the callback signature is unchanged (`(state, delta) => void`),
> but `state.clock` is now relative to the canvas mount, not the page. Do not use
> `performance.now()` for dt; use the provided `delta`.

## Systems (pure)
| System | Signature | Notes |
|---|---|---|
| `dayNight.ts` | `tickDayNight(s: WorldState, dt, ev: {wavesCleared: boolean}) → {state: WorldState, events: GameEvent[]}` | Emits `nightStarted`, `dawnStarted`, `phaseChanged` |
| `lantern.ts` | `tickLantern(s: LanternState, dt, phase: Phase) → LanternState`; `lanternRadius(fuel: number) → number` | Linear radius 2–8 m, floor ember glow 1.5 m at fuel=0 |
| `stamina.ts` | `tickStamina(s: StaminaState, dt, sprinting: boolean) → StaminaState` | Regen delay 1 s; drain 20/s, regen 15/s |
| `settings.ts` | `loadSettings(storage?: Storage) → Settings`; `saveSettings(s: Settings, storage?: Storage) → void` | Wraps localStorage in try/catch; falls back to defaults |

All systems receive plain serialisable state and return new state. No imports of React, three.js or Howler in `src/game/`.

## Stores (zustand)
- `usePlayerStore`: `{ position, yaw, pitch, health, stamina }`
- `useWorldStore`: `{ phase, phaseTime, nightNumber, fogDensity }`
- `useLanternStore`: `{ on, fuel }`
- `useSettingsStore`: all accessibility settings + key bindings
- `useGameStore`: `{ screen, paused }`

Systems receive plain state extracted from stores; the loop writes results back. UI subscribes with selectors to avoid re-rendering the canvas.

```ts
// Example selector pattern — reads only what it needs
const health = usePlayerStore(s => s.health)
```

## Events
`src/game/events.ts` — a tiny typed event bus. Systems return `GameEvent[]`; the loop publishes them after the tick. Cross-system coupling flows through events, not direct store reads.

```ts
type GameEvent =
  | { type: 'nightStarted';  nightNumber: number }
  | { type: 'dawnStarted';   nightNumber: number }
  | { type: 'phaseChanged';  phase: Phase }
  | { type: 'playerDamaged'; amount: number }
  | { type: 'itemCollected'; itemId: ItemId }
  // … extended by later specs
```

## Input
`src/scene/player/input.ts` maps `KeyboardEvent.code` → action through `settings.bindings`. Mouse look reads `movementX/Y` while pointer lock is active. A single `InputSnapshot` is captured at the top of each tick.

## Rendering notes

### Character controller
Rapier `KinematicCharacterController` with a capsule collider (radius 0.35 m, half-height 0.5 m, total height 1.7 m). Eye level at 1.6 m. The capsule is a `RigidBody type="kinematic-position-based"` — move it by setting `nextTranslation` each frame, not by applying forces.

> `<Physics>` **must be inside `<Suspense>`** in rapier v2. WASM loads asynchronously; rendering before it resolves throws.

### Lights and shadows
- **Lantern:** `SpotLight` (angle 0.9 rad, penumbra 0.6, `castShadow: true`, decay 2). A weak fill `PointLight` (no shadow) for spill. Both parented to the camera.
- **Moonlight:** `DirectionalLight` (intensity ~0.15, cool blue-grey tint `#9fb3c8`). No `castShadow` — one shadowmap budget slot saved for enemies.
- **Shadow budget:** maximum 4 shadow-casting lights total (lantern spot + 3 reserved for later specs). Enforce with a comment in `Lantern.tsx`.
- **Ember fallback:** at fuel 0 the SpotLight is replaced by a `PointLight` (radius 1.5 m, intensity low) — still casts no shadow.

### Fog
`THREE.FogExp2` set on `scene.fog`. Density driven by `useWorldStore(s => s.fogDensity)` interpolated over 5 s on phase change. Night densities from the design bible (0.02–0.06).

### Postprocessing (v3 API)
```tsx
<EffectComposer>
  <Noise premultiplied />
  <Bloom luminanceThreshold={0.9} intensity={0.4} mipmapBlur />
  <Vignette offset={0.3} darkness={0.6} />
</EffectComposer>
```
`mipmapBlur` is new in postprocessing 3 — use it instead of `kernelSize`. `luminanceThreshold` keeps bloom selective (lantern and holy effects only). **Do not** use the `<SSR>` or `<DepthOfField>` passes — too expensive for the performance budget.

### Instancing
Use `<Instances>` from drei 10 for headstones, fences and debris. Each category is one draw call with per-instance transform. Three.js performs frustum culling automatically on each `InstancedMesh` — no extra wrapper is needed. Set `frustumCulled={true}` (the default) on each `<Instances>` group and ensure a tight `boundingSphere` by calling `geometry.computeBoundingSphere()` after setting instance transforms.

## Screen state machine
```
ContentWarning → Loading → Title → Game → Ending
                                  ↑              |
                                  └──────────────┘  (new game / continue)
```
`useGameStore.screen` drives which component renders. `paused` is orthogonal — it overlays `PauseMenu` without changing `screen`. The `Game` screen is never unmounted while paused so R3F state (physics, audio) is preserved.

## Error handling
- **WebGL context lost:** listen to `webglcontextlost` on the canvas; show "The lantern went out — reload" overlay with a reload button.
- **Asset load failure:** `useProgress` from drei reports failed assets; loading screen lists them with a Retry button.
- **Settings parse failure:** `loadSettings` catches any exception and returns defaults, logging a warning to console.
- **Rapier WASM timeout:** if `<Suspense>` fallback shows for more than 5 s, show a loading spinner with message "Summoning the dead…".

## Testing
### Unit tests
- `dayNight`: phase order and durations; `Night` doesn't end until `wavesCleared`; `Dawn` lasts exactly 10 s.
- `lantern`: drain rate by phase, ember floor at fuel=0, F-toggle halts drain.
- `stamina`: regen delay, drain rate, clamp to [0, 100].
- `settings`: `loadSettings` returns defaults when `localStorage` throws; all setting ranges are clamped.

### Property tests (fast-check)
- **Step independence:** for any array of `dt` values summing to `T` (all > 0, sum ≤ 600), the final `dayNight` state equals a single tick of `T`. (Tests the accumulator loop logic.)
- **Radius bounds:** `lanternRadius(f)` ∈ [1.5, 8] for all `f` ∈ [0, 100], monotone non-decreasing.
- **Fuel bounds:** after any sequence of `tickLantern` calls, fuel ∈ [0, 100].
- **Settings round-trip:** `loadSettings(saveSettings(s))` equals `s` for any valid `Settings` object.

## Scope guard (hackathon)
This spec deliberately excludes:
- Real 3D models (replaced by greybox primitives — swapped in spec 02).
- Audio (no Howler in this spec — added in spec 02).
- Save/load game state (localStorage is for settings only here; full save is spec 03+).
- Enemy AI, combat, waves, crafting, scares — those are specs 02–05.

Task 12 (checkpoint) is the exit criterion: walk the greybox at night, use the lantern, pause, change a setting. Keep task 12 small — it should take < 1 hour.
