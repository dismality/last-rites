# Design Document

Spec 09: Playtest Fixes

## Overview
Most of this spec is small, targeted fixes. The two larger pieces are developer mode (A1) and the browser passes (A2, D1 to D9), which build on the existing dev-only Debug_Hook (`window.__lastRites`) rather than replacing it.

## B1: Sensor filter
`FirstPersonController` takes `{ world, rapier }` from `useRapier()` and calls:

```ts
kcc.computeColliderMovement(collider, delta, rapier.QueryFilterFlags.EXCLUDE_SENSORS)
```

This matches `wallProbe.ts` and `shotOcclusion.ts`. The signature was checked against the installed `@dimforge/rapier3d-compat` types (`filterFlags` is the third argument). Sensor intersection events still fire, because filter flags only affect the controller's shape casts, not the narrow phase.

Tests:
- Unit: `FirstPersonController.sensorFilter.test.ts` reads the source and fails if the call has no `EXCLUDE_SENSORS`.
- Browser: `e2e/scare-zones.spec.ts`. For each `SCARE_ZONES` entry the test teleports to a clear spot outside the zone and holds a movement key until the Rapier body is inside the bounds. The Debug_Hook gains `scareZones()`, which returns `scareRuntime.inside` and `scareRuntime.entered` (every zone entered since the run started, cleared by `resetScareRuntime`). An entry means the sensor's intersection event fired, and the same handler queues the zone for the scare director, so the test can assert entry without depending on the random roll.

## A1: Developer mode
- `src/dev/devFlag.ts`: `isDevEnabled(search, envDev)`, a pure function.
- `main.tsx`: `if (import.meta.env.DEV || new URLSearchParams(location.search).get('dev') === '1') void import('./dev/installDev')`. The dynamic import keeps the panel in its own chunk. A production build still has the chunk file, but it is only fetched with `?dev=1`. The existing `__lastRites` Debug_Hook stays DEV-only and is not exposed in production.
- `src/dev/DevPanel.tsx` is mounted in its own React root, so `App.tsx` is not changed for it.
- Cheats live in `src/dev/devCheats.ts` as a runtime object (`god`, `infiniteOil`, `infiniteStamina`, `noclip`, `timeScale`). The game reads them through one tiny module, `src/game/state/devCheats.ts`, whose defaults are off. Production code paths only read booleans that stay false unless dev code sets them.
- The noclip, god mode and time scale hooks are the only edits outside `src/dev/`.

## B2: Retry loadout
`retryNight()` clamps after restore: `fuel = max(fuel, RETRY_MIN_FUEL)` (60) and health = max HP. `RETRY_MIN_FUEL` goes in `balance.ts` and the bible. "Retry from morning" uses the day-start save (`installNewDaySave`) that already exists.

## B3: Day drain
To be decided in task 4 after reading `lantern.ts` and the bible. The default plan is half rate by day (12 s per 1%), because zero drain removes the day-time oil decision. The choice is recorded here when it is made.

## Commit and log policy
One commit per task with a message of the form `spec 09 task N: <title>`. No push. Each task appends a `docs/kiro-log.md` entry with the real date (2026-11-10 for work done today).

## Not verifiable here
Headless Chrome uses SwiftShader, so its fps is not a real GPU frame rate (D8). Look and feel (B8 glare, B14 readability) can be checked with screenshots, but not judged as a player would. The live Vercel build is not touched.
