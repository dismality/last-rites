---
inclusion: always
---
# Tech Stack and Rules

## Stack
| Concern | Choice |
|---|---|
| Build | Vite + TypeScript 6.0 (typescript-eslint does not yet support TS 7) |
| UI framework | React 19 |
| 3D | three.js `^0.178` via `@react-three/fiber` `^9.0` and `@react-three/drei` `^10.0` |
| Physics / character controller | `@react-three/rapier` `^2.0` |
| Post-processing | `@react-three/postprocessing` `^3.0` (bloom, vignette, noise) |
| State | `zustand` |
| Audio | `howler` (spatial audio via Howler's 3D API). Music, rain, thunder and other sounds without a file are procedural Web Audio on Howler's shared `AudioContext` (`Howler.ctx`), routed through the same volume settings. |
| Unit tests | `vitest` |
| Property-based tests | `fast-check` with vitest |
| Lint / format | ESLint + Prettier |
| Deploy | Vercel (static build) |

**Version compatibility note (checked November 2026):**
R3F 9 pairs with React 19 only (R3F 8 = React 18). Drei 10, rapier 2, and postprocessing 3 all target R3F 9 / React 19. Do not mix these major versions — install the full cohesive set together.

Do not add other runtime dependencies without asking first and explaining why.

## Commands
- `npm run dev`: start dev server
- `npm run build`: type-check and production build
- `npm run test`: run vitest once
- `npm run test:watch`: vitest watch mode
- `npm run lint`: ESLint

## Architecture rules
1. **Game logic is pure TypeScript** in `src/game/`. It must not import React, three.js or Howler, so it can be unit- and property-tested in Node.
2. **Rendering and input** live in `src/scene/` (R3F components). They read state from stores and call game-logic functions; they never hold game rules themselves.
3. **HTML overlay UI** (HUD, menus, satchel, journal) lives in `src/ui/` and renders above the canvas.
4. **Content is data.** Items, recipes, enemies, scare events and journal text live in `src/data/` as typed constants. No magic numbers in systems.
5. **Fixed-timestep simulation.** Gameplay systems update with a fixed `dt` (1/60 s) from a single loop in `src/scene/GameLoop.tsx`; rendering interpolates.
6. **One zustand store per domain** (`player`, `inventory`, `world`, `settings`, `mystery`), composed in `src/game/state/`.

## Performance budget (mid-range laptop, 1080p)
- 60 fps target, never below 45 fps in normal play.
- Fewer than 150 draw calls; use instancing for graves, fences and debris.
- Maximum 4 shadow-casting lights; the player's lantern is one of them.
- Total initial download under 25 MB; compress models with Draco/meshopt and textures as KTX2 or WebP.
- Show a loading screen with progress while assets load.

## Code style
- Functional React components and hooks only.
- Name files after their main export (`CraftingSystem.ts`, `Workbench.tsx`).
- Prefer small, pure functions with explicit input and output types.
- Every system in `src/game/systems/` has a matching test file `*.test.ts`.
- Comments explain *why*, not *what*.
