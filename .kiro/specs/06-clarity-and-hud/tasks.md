# Implementation Plan: Clarity and HUD

## Overview

Pure data and logic come first, each system with its fast-check property tests in the same task (required, not optional). Stores and wiring follow, then the HUD components, the intro, and save/retry. The last task is a real-browser playtest. Every sub-task ends with the same closing step, called **Finish** below:

- **Finish:** run `npm run test`, `npm run lint` and `npm run build`, fix any failures, then append an entry to `docs/kiro-log.md` headed with the real date the task is actually finished (today is 2026-11-08), in the format from `.kiro/steering/kiro-log.md`.

## Tasks

- [x] 1. Data constants and shared types
  - [x] 1.1 Health bar, objective rule and tutorial data
    - `src/data/healthBar.ts` (`HEALTH_BAR`, low threshold from `balance.ts`), `src/data/objectiveRules.ts` (11 rules in §11 order, `PlaceRef`, `OBJECTIVE_MAX_LINE`), `src/data/tutorialSteps.ts` (7 steps, binding-token templates, `TUTORIAL_WALK_TARGET_M`, `TUTORIAL_GLYPH`)
    - Unit tests: rule order and texts match §11, step ids and texts match §11
    - Finish
    - _Requirements: 1.13, 3.16, 4.1, 4.2, 11.1_

  - [x] 1.2 Compass, zone card, zone bounds and map data
    - `src/data/compass.ts`, `src/data/zoneCards.ts` (exact §11 text, 2.5 s show, 30 s cooldown, fade inside 150–300 ms)
    - `ZONE_BOUNDS` in `src/data/zones.ts` derived from `cemeteryLayout.ts`; `CHAPEL_ALTAR` in `cemeteryLayout.ts`
    - Move `CELL_PX` and `MARGIN_PX` to `MAP_PX` in `src/data/mapLandmarks.ts` and update `mapDraw.toPx` to use it
    - Unit tests: `ZONE_CARDS` strings are exact; every `SPAWN_POINTS` and `FIXED_SPAWNS` position resolves to its declared zone against `ZONE_BOUNDS` (rect check; `zoneAt` is added in 2.7)
    - Finish
    - _Requirements: 5.2, 5.6, 7.2, 7.5, 11.1_

  - [x] 1.3 Intro cutscene data
    - `src/data/introCutscene.ts`: `INTRO_SHOTS` (5 shots, camera control points on real layout points, card text and timing, shot 4 burst), `INTRO_FADE_S`, `INTRO_END_POSE`
    - Unit tests: 5 shots, total 32–38 s, each shot ≥ 4 s, each card hold ≥ 3 s, end-pose eye is (0, 1.65, 0), fade ≥ 0.5 s
    - Comment in the data and in `FirstPersonController` records that the end pose must match the spawn eye
    - Finish
    - _Requirements: 8.3, 8.4, 8.5, 8.13, 8.16_

  - [x] 1.4 Types, settings and events
    - `src/game/types.ts`: `tutorialPrompts` in `Settings`, `Skip` binding (Space), new `GameEvent` members `craftCompleted`, `hotbarBound`, `journalOpened`
    - `settings.ts`: default `tutorialPrompts: true`, `BOOLEAN_KEYS`, `extractSettings`; old stored settings load with the default
    - Unit tests: default true, save/load round trip, old settings object gets the default
    - Finish
    - _Requirements: 4.8, 8.7, 11.2_

- [x] 2. Pure systems with property tests
  - [x] 2.1 Health display system
    - `src/game/systems/healthDisplay.ts`: `initHealthDisplay`, `stepHealthDisplay`, `healthFraction`, `chunkFraction`, `healthText`, `lowFrame`
    - `healthDisplay.test.ts` with fast-check, each tagged `Feature: 06-clarity-and-hud, Property N`
    - **Property 1: Health display invariant** (chunk ≥ fill, both in 0..max)
    - **Property 2: Fill follows HP and max HP**
    - **Property 3: Recent-damage chunk timing**
    - **Property 4: Healing eases up**
    - **Property 5: Flashing lights decides the hit effect and the low frame**
    - **Property 6: Invalid HP input is clamped**
    - **Property 7: Fresh display after Retry Night**
    - Finish
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.14, 1.15, 1.16, 9.6, 10.1_

  - [x] 2.2 Lantern gauge system
    - `src/game/systems/lanternGauge.ts`: `flameSize`, `flameBrightness`, `oilLabel`, `gutterFactor` (fuel is the only input)
    - `lanternGauge.test.ts`
    - **Property 8: Flame depends on fuel only and is monotonic**
    - **Property 9: Oil label rule**
    - **Property 10: Gutter only when allowed**
    - Finish
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.10, 10.1, 10.3_

  - [x] 2.3 Objective selector
    - `src/game/systems/objective.ts`: `ObjectiveInput`, `selectObjective`, `formatClock`, `composeSecondLine`; rule 10 uses only explored relic sites
    - `objective.test.ts` with a reference implementation for first-match
    - **Property 11: Objective selector is total, idempotent and first-match**
    - **Property 12: Objective text shape**
    - **Property 13: Objective position**
    - **Property 14: Collecting an item advances the day objective**
    - **Property 15: Tutorial prompt replaces the countdown**
    - Finish
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.12, 3.13, 3.14, 3.15, 4.11_

  - [x] 2.4 Tutorial director
    - `src/game/systems/tutorial.ts`: `currentTutorialStep`, `tutorialPrompt`, `formatPrompt`, `keyLabel`, `walkStep`, `serializeTutorial`, `parseTutorial`
    - `tutorial.test.ts`
    - **Property 16: Tutorial director invariant**
    - **Property 17: Walking completes the move step**
    - **Property 18: Prompts follow bindings, setting and phase**
    - **Property 19: Tutorial serialization round trip**
    - Finish
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 4.10, 4.14, 4.15, 4.16_

  - [x] 2.5 Compass system
    - `src/game/systems/compass.ts`: `headingDeg`, `bearingDeg`, `relativeAngle`, `compassTicks`, `buildCompassMarkers` (spawn markers merged per 15° bucket)
    - `compass.test.ts`
    - **Property 20: Relative angle range and forward target**
    - **Property 21: Heading is periodic**
    - **Property 22: Compass markers**
    - Finish
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13_

  - [x] 2.6 Map projection
    - `src/game/systems/mapProject.ts`: `worldToMap`, `mapToWorld`, `clampToMap` using `MAP_PX`; point `mapDraw.toPx` at `worldToMap`
    - `mapProject.test.ts`
    - **Property 23: World–map transform**
    - Finish
    - _Requirements: 6.6, 6.7, 6.8, 6.9_

  - [x] 2.7 Zone lookup and zone card trigger
    - `src/game/systems/zoneAt.ts` (total, falls back to `grounds`) and `zoneCardTrigger.ts` (`shouldShowZoneCard`, `recordZoneCard`, `cardOpacity`), both side-effect free
    - `zoneAt.test.ts`, `zoneCardTrigger.test.ts`
    - **Property 24: Zone card cooldown**
    - **Property 25: Zone lookup**
    - **Property 26: Card opacity**
    - Finish
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.9, 7.10, 7.11, 10.8_

  - [x] 2.8 Camera path and intro timeline
    - `src/game/systems/cameraPath.ts` (`samplePath`, uniform Catmull-Rom, clamped `u`) and `introTimeline.ts` (`introDuration`, `introStateAt`, `advanceIntro`)
    - `cameraPath.test.ts`, `introTimeline.test.ts`
    - **Property 27: Intro timeline** (finite output, shot index never decreases, fade rate bounded, paused time does not advance)
    - Finish
    - _Requirements: 8.4, 8.8, 8.13, 8.17_

  - [x] 2.9 Save format extension
    - `src/game/systems/saveGame.ts`: optional `tutorial` and `introSeen` on read, always written; `hasPassedFirstDay`; `SAVE_VERSION` stays 1; junk tutorial/introSeen sanitised field by field
    - Update `saveGame.test.ts`
    - **Property 28: Save round trip with new fields**
    - **Property 29: Old saves load with defaults**
    - **Property 30: Corrupt saves are rejected safely**
    - Finish
    - _Requirements: 4.12, 4.14, 8.15, 9.1, 9.2, 9.4, 9.8, 9.9_

- [x] 3. Stores and wiring
  - [x] 3.1 Player health and flame-dip removal
    - `playerStore.maxHealth` (initial `PLAYER_MAX_HEALTH`, not added to `PlayerState`); `uiWorldStore.healPlayer` writes both health copies and caps at `maxHealth`
    - Remove `flameDipFactor` and `FLAME_DIP_PEAK` from `damageFeedback.ts`; update `damageFeedback.test.ts` and `hudMath.test.ts`
    - Add `retryEpoch` (initial 0) to `gameStore`
    - Unit tests: altar heal updates both copies and respects max; vignette, desaturation and heartbeat unchanged
    - Finish
    - _Requirements: 1.12, 2.2, 2.8, 9.6_

  - [x] 3.2 Emit tutorial events
    - `spawnStore.collect*` emit `itemCollected` on success only; Workbench emits `craftCompleted` after `commitCraft` succeeds; Satchel emits `hotbarBound` on `assignHotbar`; opening the journal emits `journalOpened`
    - Unit tests: `collectMaterial` emits on success and not on failure
    - Finish
    - _Requirements: 4.3, 4.4_

  - [x] 3.3 Guidance store and per-step tick
    - `guidanceStore.ts` (objective, `tutorialDone`, walk state, `card`, `zoneLastShown`, `zoneClock`, `restore()`), `guidanceTick.ts` (`readObjectiveInput`, `tickGuidance(dt)`, `refreshGuidance()`, `installGuidanceWatchers()`)
    - Call `tickGuidance(dt)` in the `GameLoop.tsx` fixed step after `useDigStore.step`; call `installGuidanceWatchers()` in `main.tsx` beside `installDuskSnapshot()`; `resetRun` clears `guidanceStore`
    - Skip a tick on non-finite player position; a new card replaces a showing one; night start removes the prompt
    - Unit tests: card for zone B replaces zone A, cooldown survives re-entry, `resetRun` clears state, events complete the matching tutorial step
    - Finish
    - _Requirements: 3.12, 4.3, 4.9, 7.3, 7.4, 7.8, 11.1_

  - [x] 3.4 Intro store and simulation freeze
    - `introStore.ts` (`playing`, `seen`, `begin`, `skip`, `finish`, `setSeen`; idempotent; `begin` resets `seen`); `isSimFrozen()` in `menuState.ts`; `isMenuOpen()` includes `intro.playing`
    - Replace the inline frozen checks with `isSimFrozen()` in `GameLoop.tsx`, `WaveDirector.tsx`, `EnemyDirector.tsx`, `EnemyModels.tsx`, `ScareStager.tsx`; ignore the F key in `Lantern.tsx` while the intro plays
    - Unit tests: begin/skip/finish flags, `isSimFrozen()` true while playing, `begin()` after `seen` resets it
    - Finish
    - _Requirements: 8.1, 8.7, 8.11, 8.15, 8.18, 10.7_

  - [x] 3.5 Tutorial prompts setting in the store and menu
    - Wire `tutorialPrompts` through `settingsStore` and add the "Tutorial prompts" toggle to `Settings.tsx` `TOGGLES` (native checkbox, visible focus)
    - Unit test: toggling updates the store and persists
    - Finish
    - _Requirements: 4.7, 4.8, 10.4_

- [x] 4. HUD components
  - [x] 4.1 Health bar and lantern gauge
    - `ui/hud/HealthBar.tsx` (rAF loop over `stepHealthDisplay`, keyed on `retryEpoch`, always shows "N / M" and the "Low" tag) and `LanternGauge.tsx` (flame plus "Oil N%" / "Low oil", gutter class only when allowed), each with its own CSS file
    - Frame states carry meaning with text and shape, not colour; all text ≥ 1rem
    - Finish
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 2.8, 2.9, 10.3, 10.5_

  - [x] 4.2 Objective tracker
    - `ui/hud/ObjectiveTracker.tsx`: main line in a polite live region keyed on rule and text, second line outside it with a once-per-second countdown, tutorial prompt via `composeSecondLine` with `TUTORIAL_GLYPH`, 150–300 ms opacity fade
    - Finish
    - _Requirements: 3.1, 3.7, 3.8, 3.9, 3.10, 3.11, 4.11, 10.5, 10.8_

  - [x] 4.3 Compass
    - `ui/hud/Compass.tsx`: strip, ticks, N/E/S/W, markers from `buildCompassMarkers`, pinned arrows, `pointer-events: none`, reads yaw and position per frame
    - Finish
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.14_

  - [x] 4.4 Zone card
    - `ui/hud/ZoneCard.tsx` in IM Fell English SC with `cardOpacity`, polite live region, no subtitle emitted
    - Finish
    - _Requirements: 7.1, 7.5, 7.6, 7.7, 10.5_

  - [x] 4.5 Map arrow and objective marker
    - `ui/journal/Map.tsx` passes the objective into `drawMap`; `mapDraw.ts` draws the ◆ marker with a 16 px text label, then the quill arrow on top, both through `clampToMap`
    - Finish
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 4.6 Assemble the HUD and add structure tests
    - `Hud.tsx` renders `HealthBar`, `LanternGauge`, `ObjectiveTracker`, `Compass` and `ZoneCard`; delete `LanternHealth.tsx` and `FuelReservoir.tsx`; move `WaveTally` and `RiteMeter` below the compass with a `--hud-compass-h` token
    - Structure tests: no `react`, `three` or `howler` imports under `src/game/**`; no `font-size` under `1rem` in the HUD CSS; no timing or text literals for these features in `src/scene/` or `src/ui/`
    - Finish
    - _Requirements: 2.8, 2.9, 10.5, 11.1, 11.2, 11.3_

- [x] 5. Intro cutscene
  - [x] 5.1 Intro camera
    - `scene/effects/IntroCamera.tsx` and `introCameraRuntime.ts` (pattern of `EndingCamera`): advance with `advanceIntro` (delta capped at 0.1 s, frozen while paused), apply `introStateAt`, queue the shot 4 `graveBurstRuntime` burst once, call `finish()` when done, leave the camera on `INTRO_END_POSE`; mount inside `<GameLoop>` after the controller
    - No shake or head bob at any setting; add no audio
    - Finish
    - _Requirements: 8.4, 8.5, 8.8, 8.11, 8.12, 8.13_

  - [x] 5.2 Intro overlay and skip
    - `ui/hud/IntroOverlay.tsx`: ink fade layer, handwritten card (≥ 20 px, dark backing), "Space to skip" hint, autofocused Skip button with visible focus; `Skip` binding and Enter call `skip()`; `Hud` shows only `IntroOverlay`, `Subtitles` and `Toast` while `intro.playing`; `skip`/`finish` call `refreshGuidance()` so the first objective is there on the first frame
    - Finish
    - _Requirements: 8.6, 8.7, 8.9, 8.10, 10.4, 10.7_

  - [x] 5.3 Title and ending flow
    - `TitleScreen`: split into `newGame()` (`resetRun()`, `introStore.begin()`, start) and `continueGame()` (`loadGame()`, start, never `begin()`); `EndingScreen.newGame` also calls `begin()`
    - Unit tests: New Game begins the intro even when `seen` was true; Continue never does
    - Finish
    - _Requirements: 8.1, 8.2, 8.18, 9.3_

- [x] 6. Save and Retry Night
  - [x] 6.1 Save and load wiring
    - `captureSave` fills `tutorial` from `guidanceStore.tutorialDone` and `introSeen` from `introStore.seen`; `loadGame` calls `guidanceStore.restore(save.tutorial)` and `introStore.setSeen(save.introSeen)`; zone last-shown times and clock are not saved
    - Unit tests: save then load restores steps and flag; old save loads with defaults; corrupt save hides Continue and leaves other storage untouched
    - Finish
    - _Requirements: 4.12, 4.14, 7.8, 8.15, 9.1, 9.2, 9.4_

  - [x] 6.2 Retry Night additions
    - `retryNight()` bumps `gameStore.retryEpoch` and clears `guidanceStore.card`; `guidanceStore` stays out of `SNAPSHOT_STORES` and `tutorialDone` is untouched
    - Unit tests: epoch increments, completed steps and `introSeen` survive, no prompt shows for a completed step
    - Finish
    - _Requirements: 4.13, 9.5, 9.6, 9.7_

- [x] 7. Checkpoint: playtest in a real browser
  - This task is only marked done after a human, or a real headless or headed Chrome session driven against the dev server, has played the game in a real browser and observed each item below working. Unit tests, lint and build passing are not enough.
  - Observe and confirm:
    - Health bar: numbers always visible, fill drops at once, pale damage chunk lingers then drains, hit flash, Low tag and pulse below 30 HP, flashing-lights-off variants (thickened frame on hit, thick still frame when low), altar heal eases up
    - Lantern gauge: flame ignores hits, "Oil N%" label, "Low oil" below 20%, steady flame with flashing lights off
    - Objective tracker: the day chain (page, crypt key, whistle, stair, ossuary key, relics), dusk countdown, night "Survive: Wave N of M" with zombies left
    - Tutorial: all 7 steps appear one at a time and advance on each action; the Tutorial prompts setting Off hides them; none after night 1 starts
    - Compass: ◆ with metres, ✝, ⌂, ☠ at night once the bell is built, markers pin at the edges as the player turns
    - Map: arrow points the way the player faces; objective marker with its label
    - Zone cards: all four zones show their card and none repeats within 30 s
    - Intro: plays on New Game only (not on Continue), Space or Enter skips it, Esc pauses and the clock holds until resume, camera hands over without a jump, no zombie, scare, lantern or day-timer change during it
    - Continue and Retry Night: Continue restores tutorial progress and skips the intro; Retry Night shows restored HP with no drain animation and keeps completed tutorial steps
    - Keyboard-only pass through the Skip button and the Settings toggle, reduced-motion behaviour, computed font sizes ≥ 16 px, frame rate ≥ 45 fps and fewer than 150 draw calls
  - Run `npm run test`, `npm run lint` and `npm run build`, then append the `docs/kiro-log.md` entry with the real completion date.
  - **STOP after this checkpoint and tell the user spec 06 is ready for a playtest. Do not start spec 07.**
  - _Requirements: 11.7, 11.8, 11.9, 10.1, 10.2, 10.4, 10.5, 10.7, 10.8_

## Notes

- All tasks are required. Property tests are part of their system's task and are not optional.
- Each property test file carries the tag `Feature: 06-clarity-and-hud, Property N: <text>` and runs at least 100 cases.
- Each task references granular requirement numbers for traceability.
- Unit tests live next to their file; structure tests sit in 4.6.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.4", "3.5"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 5, "tasks": ["4.6", "5.1", "5.3", "6.1", "6.2"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
