# Implementation Plan: Horror Pass

## Overview

This plan builds spec 11 in the priority order of `requirements.md`: the design bible §12 first (committed on its own), then H6 vending machine, H1 screen jumpscares, H4 bats, H5 info dots, H7 hands and lantern light, H2 new creatures, H3 zombie looks, and a final whole-spec check with GPU perf and the list of art still waiting.

Every top-level task ends with a **Finish** sub-task:

- **Finish:** run `npm run lint`, `npm run build` and `npm test -- --run`, plus the task's own Playwright specs; fix every failure; append a `docs/kiro-log.md` entry with the real date that includes a "Decisions made unattended" list (decision, reason, date; write "none" if there were none); then make one local commit with the message `<what changed> (spec 11 task N)`. Do not push.

Common rules for all tasks:

- `docs/game-design.md` §12 is the source of truth for content and numbers once task 1 is done. Change the bible and `src/data/` together; if they differ, the bible wins.
- Game logic stays in `src/game/` with no React, three.js or Howler imports; every system has a matching `*.test.ts` next to it. Tunable values live in `src/data/`.
- Before writing code against `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `howler` or `fast-check`, look up the current API with context7 (steering rule `mcp-usage`).
- Dev code stays in `src/dev/` and reaches the game only through the real stores and the `devCheats` paths.
- Art is made in Blender, outside Kiro, at fixed paths in `src/data/assets.ts`. Where a file is missing, use a marked placeholder: a `// PLACEHOLDER: <path>` comment at the use site and a row in `src/data/placeholders.ts`, registered in the Waiting_List when the load fails. A placeholder is never final art, and the game must build, test and start with every art file absent.
- Each browser spec saves screenshots at 1280x720 and 800x600 into `e2e/screenshots/`.
- Property tests use fast-check with at least 100 runs and a comment `Feature: 11-horror-pass, Property N: <title>`.
- Every new sound gets a caption in `src/data/captions.ts` and, if it comes from a place in the world, plays as 3D audio there. Every new effect obeys Jumpscares, Flashing lights and Camera shake, and every new panel works by keyboard with a visible focus state.
- Each new third-party asset gets a line in `docs/CREDITS.md` in the same change.
- **Feature freeze is 2026-11-26.** After that date start no new feature task of this spec.
- **Cut order** (cut the lowest priority first, and mark the matching part of §12 as "cut" in the same change): 1 H2 and H3 (tasks 7 and 8, together), 2 H7 (task 6), 3 H5 (task 5), 4 H4 (task 4), 5 H1 (task 3), 6 H6 (task 2). Task 1 (the bible and Requirement 8 rules) and the final task 9 are never cut. Tasks that depend on a cut task are adjusted as noted in each task.

## Tasks

- [x] 1. Design bible §12 "Horror pass" (never cut; committed on its own before any code)
  - [x] 1.1 Write §12 and the bible edits
    - Add §12 to `docs/game-design.md` with sections 12.1 to 12.9 of the design (screen jumpscares, new creatures, zombie looks, bats, info dots, vending machine, hands and lantern light, settings and controls, cut list); every table row carries names, IDs, counts, durations, radii, costs and cooldowns
    - Update the existing sections the design lists: §3 (item `brisk-draught`), §4 timed effects (`brisk-draught`: +25% move speed, 60 s), §7 (crawler, bride, hound), §8 waves, §9 scare director (screen scares, 180 s cooldown, 45 s gap), §11 HUD (info dots, Creatures page), §10 controls if any change; add the Waiting_List and Placeholder rules
    - Mark the freeze date and the cut order in §12.9
    - _Requirements: 8.1, 8.2, 8.3_
    - Done outside Kiro. Written as `## 14. Horror pass (11)` with 14.1 to 14.9 (and a "Waiting list and placeholders" part), because the bible's §12 and §13 were already taken and specs 08 and 10 cite them by number; a note at the top of §14 says spec 11 calls it §12. Edits to §3, §4 (consumable and timed effect), §7, §8, §9 and §11; §10 needs no change
  - [x] 1.2 §12 mirror test scaffold
    - Create `tests/designBibleSection12.test.ts`: assert §12 has sections 12.1 to 12.9 and a small parser that reads table rows by section heading and returns typed rows; later feature tasks add their own table-versus-data checks to this file
    - A section marked "cut" is skipped by the parser test
    - _Requirements: 8.2, 8.3_
    - Done outside Kiro. The parser is `tests/helpers/designBible.ts` (`readHorrorPass`, `subsection(h, '12.6')`, `tableOf`, `liveSubsections`); it finds the section by its title, so either numbering works. A subsection is cut when its heading carries "(cut)" or ", cut)"
  - [x] 1.3 Finish
    - Run the Finish steps for task 1 (docs and the new test only); commit `design bible section 12 horror pass (spec 11 task 1)` as its own commit with no code changes
    - Done outside Kiro. Left uncommitted for the user to commit

- [x] 2. H6: The hut vending machine (cuttable, cut order 6)
  - [x] 2.1 Foundation: Waiting_List, placeholders, asset budget and baseline perf
    - Create `src/data/placeholders.ts` (every expected art file of this spec as a typed row: path, kind, owner, feature, use) and add all new paths to `src/data/assets.ts`
    - Create `src/game/systems/waitingList.ts` (`register`, `list`, idempotent) and `src/game/state/waitingList.ts`; create `src/scene/assets/useAssetOrPlaceholder.ts` and `PlaceholderMesh.tsx` (label shown only with `?dev=1`)
    - Create `tests/waitingList.test.ts` (Node `fs`: declared art files missing from `public/assets/` are listed) and `tests/placeholderComments.test.ts` (every `PlaceholderMesh` use has a `// PLACEHOLDER:` comment and a registry row; no `.glb` path literal outside `assets.ts` and tests); extend the asset budget script so the sum of `public/assets` over 25 MB fails
    - Run the existing GPU perf spec (`e2e/d8-perf.spec.ts` style) once on the current build and save `e2e/logs/horror-perf-before.json` (draw calls, frame time, shadow-light count) for task 9
    - **Property 30: Waiting list is idempotent and complete**
    - _Requirements: 8.14, 8.15, 8.16, 8.18, 8.22, 3.1_
    - Done outside Kiro. No asset budget script existed, so `tests/assetBudget.test.ts` (with `tests/helpers/fileSizes.ts`) fails over 25 MB. The perf spec is `e2e/horror-perf.spec.ts` (in the perf project); the baseline already has draw calls over 150 in every scene (hut 191, night wave 362), 2 shadow lights and about 7 ms frames, so it records rather than asserts
  - [x] 2.2 Vending data
    - Create `src/data/vending.ts` (`VendingRowId`, `VENDING_ROWS` with exactly the six rows of Requirement 6.3, handle ids, blurbs, `VENDING_FORBIDDEN`); add the `brisk-draught` item to `src/data/items.ts` and `src/data/effects.ts` (+25% move speed, 60 s, glyph); add the vending sounds and captions to `src/data/sounds.ts` and `captions.ts`; add the §12.6 table check to `tests/designBibleSection12.test.ts`
    - _Requirements: 6.3, 6.4, 6.12, 6.16, 8.2_
    - Done outside Kiro. The brisk-draught icon uses the missing-icon image and is a Waiting_List row
  - [x] 2.3 Pure vending system, Brisk Draught effect and tests
    - Create `src/game/systems/vending.ts` (`freshStock`, `visibleRows` using the shared owned-gun predicate, `canBuy`, `buy`, `resetAtDawn`, `purchaseAnimation`) reusing `coins.ts` and the satchel fit rules; add `'brisk-draught'` to `EffectId` and the speed rule in `movement.ts` (larger multiplier wins over Adrenaline); write `vending.test.ts` and extend `effects.test.ts`, `movement.test.ts`
    - Extract the owned-gun predicate from `elites.ts` into a shared helper if it is not exported yet
    - **Property 21: Vending stock never includes forbidden items**; **Property 22: Vending visibility and purchase deltas**; **Property 23: Vending refusals leave state unchanged and coins never go negative**; **Property 24: Vending dawn reset**; **Property 25: Brisk Draught does not stack**
    - Add `tests/captionCoverage.test.ts` for **Property 10: Sound and caption coverage** over a list of new sound ids that later tasks extend
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.15, 6.16, 8.8_
    - Done outside Kiro. The speed rule (larger multiplier wins) lives in `effectMods` in `src/game/systems/effects.ts`, where Adrenaline's speed is already combined, so `movement.ts` and `movement.test.ts` needed no change. `ownedGuns` was already exported from `elites.ts`
  - [x] 2.4 Vending store, scene and panel
    - Create the vending store (stock per day, saved in `gameSave.ts`, reset at dawn, cleared by New Game); create `src/scene/world/VendingMachine.tsx` at (2.83, 0, 1.85) with rotationY −PI/2, `handle-0` to `handle-4` pull animation (5 cm ±1 cm), emissive marquee, optional shadowless `marquee-light` behind a frame-budget gate; add the colliders to `hut.json` and the machine's JSON
    - Create `src/ui/menus/VendingPanel.tsx` in the merchant's style (name, price, "N left", one-sentence blurb, "Sold out" card, refusal reason text, keyboard operable with visible focus); it does not pause the sim, does not protect the player, and does not block Esc
    - Wire Interact within 2.5 m in every phase, the coin clink, handle, tray and refusal sounds with 3D audio at the machine
    - _Requirements: 6.1, 6.2, 6.6, 6.7, 6.10, 6.14, 6.16, 8.9, 8.10, 8.13_
    - Done outside Kiro. The panel is `src/ui/vending/VendingPanel.tsx`. The hut.json collider was already there. The handles are merged into the model's brass mesh, so five placeholder knobs `handle-0` to `handle-4` stand in. The marquee light is always mounted and its intensity is gated by the frame time and the shadow-light count (lights stay constant). The stock is saved and is part of the Retry snapshot; a sold-out machine stays interactable
  - [x] 2.5 Placeholder assets for H6
    - Plain cabinet primitive (box with the real collider and invisible handle anchors) for `props/vending-machine.glb`, a bottle primitive named "Brisk Draught (placeholder)" for `items/brisk-draught.glb`, procedural Web Audio for missing sounds; each use has a `// PLACEHOLDER:` comment, a `placeholders.ts` row and a Waiting_List registration; extend the load-failure test so the machine stays fully usable
    - _Requirements: 6.17, 8.16, 8.22_
    - Done outside Kiro. The vending sounds are procedural like every other sound, so no audio placeholder was needed
  - [x] 2.6 Dev hooks for the vending machine
    - Add "Give 100 grave coins" and "Reset vending stock" to the Dev_Panel through real store actions; add `vendingState()` to the Debug_Hook; extend `devMode.test.ts`
    - _Requirements: 6.2_
    - Done outside Kiro
  - [x] 2.7 Vending e2e and screenshots
    - Create `e2e/vending.spec.ts`: walk to the machine, open it by day and at night, buy a row (handle pulls, coins drop, stock count drops, Brisk Draught shows its effect ring), refuse for coins and for a full satchel, sold out, dawn reset; a keyboard-only run
    - Save screenshots at 1280x720 and 800x600 of the panel and the machine in the hut
    - _Requirements: 6.2, 6.6, 6.8, 6.9, 6.10, 8.21_
    - Done outside Kiro. Screenshots are in `e2e/screenshots/vending/`
  - [x] 2.8 Finish
    - Run the Finish steps for task 2; commit `hut vending machine (spec 11 task 2)`
    - Done outside Kiro. Left uncommitted for the user to commit

- [x] 3. H1: Screen jumpscares (cuttable, cut order 5)
  - [x] 3.1 Settings and screen scare data
    - Add `jumpscares` (`full | reduced | off`, default `full`, invalid stored value loads as `full`) and its Settings menu control next to Scare intensity (keyboard operable, visible focus) in `types.ts`, `settings.ts` and `Settings.tsx`
    - Create `src/data/screenScares.ts` (cooldown 180 s, in 70 ms, out 250 ms, hold 550 to 800 ms, 85 vh, image sets, `SCRIPTED_MOMENTS` for the coffin on night 2, the hut west window on night 3 and the ossuary grille); add the sting sounds and captions; add the §12.1 check to `tests/designBibleSection12.test.ts`
    - _Requirements: 1.1, 1.2, 1.11, 1.16, 1.17, 8.2_
  - [x] 3.2 Pure screen scare system and tests
    - Create `src/game/systems/screenScares.ts` (`resolveScareFx`, `requestScreenScare` with held, cooldown and started outcomes, `pickImage`, `holdDuration`, `scareTimeline`, `phaseAt`, `shakeAt`, `telegraphLeadMs`, deferred gameplay effects keyed to the out start and the in end) and `screenScares.test.ts`
    - Extend `settings.test.ts`
    - **Property 1: Screen scare cooldown and overlay gating**; **Property 2: Effective scare effects follow the settings**; **Property 3: Scare timeline and telegraph bounds**; **Property 4: Image choice never repeats within a set**; **Property 5: Screen scare never reduces health** (the scare system part; the creature damage clamp part is added in task 7); **Property 20: Settings round trip** (jumpscares field; the info dots field is added in task 5)
    - Extend `tests/captionCoverage.test.ts` with the sting
    - _Requirements: 1.2, 1.3, 1.4, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.18, 1.19, 8.4, 8.5, 8.6, 8.7, 8.12_
  - [x] 3.3 Screen scare overlay, effects and audio
    - Create `src/ui/hud/ScreenScare.tsx` (85 vh image anchored bottom for zombie faces and top for ghost faces, linear 70 ms in, hold with scale jitter 1.00 to 1.04 and chromatic split, 250 ms out with slide and fade, one-frame white flash), the 30% world dim on the post-processing stack, camera shake through the existing channel, and `src/audio/screenScareAudio.ts` (attack, thud and scream layers, 70% master duck restored within 250 ms, 50% gain at Reduced)
    - Subtitle for the whole span at Full and Reduced, a 3 s descriptive subtitle at Off; Esc pauses within one frame and halts the timers and audio; `pointer-events: none`
    - Store the scare state (`lastStartSim`, used moments) in the progression save: kept by Continue, Retry Night and Retry from morning, cleared by New Game
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.12, 1.13, 1.14, 1.15, 1.17, 8.8, 8.11_
  - [x] 3.4 Scripted moments and the trigger queue
    - Wire `requestScreenScare` into `GameLoop.tsx` after the enemy and scare steps; add the three scripted moments (coffin night 2, hut west window night 3, ossuary grille first look) with telegraphs 0.5 to 1.5 s before, held while crafting, satchel, journal, pause or any minigame is open, once per save, and never marked used when skipped
    - Leave an exposed trigger API for the crawler and bride (wired in task 7)
    - Extend `scareDirector` gating tests so no screen scare starts during an overlay
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.10, 1.18, 8.12_
  - [x] 3.5 Placeholder assets for H1
    - Labelled flat rectangle "PLACEHOLDER face-zombie-1" (and the other four faces) when a face image is missing or fails to decode, registered once; procedural Web Audio sting layers when the sound files are missing; `// PLACEHOLDER:` comments and `placeholders.ts` rows
    - Add a test that mounts the overlay with a failing image and expects the same timing and sting
    - _Requirements: 1.20, 8.16, 8.22_
  - [x] 3.6 Dev hooks for screen scares
    - Add "Force screen scare" (zombie face or ghost face, bypassing the cooldown only through a dev flag in `devCheats`) to the Dev_Panel; add `screenScareState()` to the Debug_Hook; extend `devMode.test.ts`
    - _Requirements: 1.1, 8.21_
  - [x] 3.7 Screen scare e2e and screenshots
    - Create `e2e/screen-scares.spec.ts`: each face set at Full and at Reduced (image height 85% ±1 px, correct edge, flash and dim only at Full), Off shows only the subtitle, cooldown skip, held in the journal, Esc pauses mid-scare
    - Save screenshots at 1280x720 and 800x600 for each set at Full and at Reduced
    - _Requirements: 1.1, 1.3, 1.9, 1.10, 1.12, 1.13, 8.11, 8.21_
  - [x] 3.8 Finish
    - Run the Finish steps for task 3; commit `screen jumpscares (spec 11 task 3)`

- [~] 4. H4: Bats that watch you (cuttable, cut order 4)
  - [x] 4.1 Bat data
    - Create `src/data/bats.ts` (`BAT` constants: 8 to 12 perched, box height 0.6 to 1.6 m, watch range 14 m, max yaw 120°, ease 0.4 s, takeoff 3 m, gun range 10 m, flight 6 s, fade 1 s, return 120 s, chitter gap 20 s, 8 flaps per s, belfry flock 15 to 20 for at most 10 s); add the chitter sound and caption; add the §12.4 check to `tests/designBibleSection12.test.ts`
    - _Requirements: 4.1, 4.3, 4.6, 4.7, 4.8, 4.9, 4.12, 8.2_
  - [x] 4.2 Pure bat systems and tests
    - Create `src/game/systems/batPerches.ts` (`qualifyingBoxes`, `choosePerches`) and `bats.ts` (perched, fleeing and gone state machine, `headYaw` with clamp and ease, `chitterAllowed`) with `batPerches.test.ts` and `bats.test.ts`; add the import-boundary test that `bats.ts` imports neither `playerHealth` nor `screenScares`
    - **Property 16: Bat perch selection**; **Property 17: Bat head turn**; **Property 18: Bat state machine**
    - Extend `tests/captionCoverage.test.ts` with the chitter
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 8.18_
  - [x] 4.3 Bats in the scene
    - Create `src/scene/world/Bats.tsx` using instanced meshes (at most 6 draw calls for bats): perch on `graveyard-colliders.json` boxes at night start in every stage, head and eyes turn on Y, emissive eyes and no light, swap to the flying model on the same frame, wing flap at 8 per s, curved flee path, fade out, return after 120 s on a different free box; 3D chitter with caption; no health damage and no screen scare; perched bats beyond 40 m skip updates
    - Wire `stepBats` into `GameLoop.tsx` after the creature step; store state in the world save
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11, 8.13, 8.14_
  - [x] 4.4 Belfry flock (optional on budget)
    - Create `src/scene/world/BelfryFlock.tsx`: one `InstancedMesh` of 15 to 20 bats with the wing flap in the vertex shader, started when the dusk bell rings, gone within 10 s, skipped when the rolling frame-time average is above 22 ms; no camera shake when Camera shake is off, steady emissive when Flashing lights is off
    - _Requirements: 4.12, 4.13, 4.14, 8.6, 8.7_
  - [x] 4.5 Placeholder assets for H4
    - Dark ellipsoid primitives for `props/bat-perched.glb` and `props/bat-flying.glb` (labelled in dev), registered in the Waiting_List with `// PLACEHOLDER:` comments and `placeholders.ts` rows; test that the game runs with both missing
    - _Requirements: 4.15, 8.16, 8.22_
  - [x] 4.6 Dev hooks for bats
    - Add "Teleport next to a bat" and "Fire a shot" to the Dev_Panel through real actions; add `batState()` to the Debug_Hook; extend `devMode.test.ts`
    - _Requirements: 4.7_
  - [x] 4.7 Bats e2e and screenshots
    - Create `e2e/bats.spec.ts`: at night 8 to 12 bats are perched, the head turns within 14 m, a bat takes off within 3 m or on a shot within 10 m and is gone after about 7 s, no health change, the flock at dusk
    - Save screenshots at 1280x720 and 800x600 of a perched bat turning and of the same bat taking off
    - _Requirements: 4.1, 4.3, 4.7, 4.8, 4.11, 4.12, 8.21_
  - [-] 4.8 Finish
    - Run the Finish steps for task 4; commit `watching bats (spec 11 task 4)`

- [~] 5. H5: Info dots (cuttable, cut order 3)
  - [ ] 5.1 Settings and info tip data
    - Add `showInfoDots` (default On, saved) to `types.ts`, `settings.ts` and `Settings.tsx` (keyboard operable, visible focus)
    - Create `src/data/infoTips.ts` (`INFO_TIP_KEYS`, `INFO_TIPS`) for every journal section (list derived from the journal tab data) and the HUD panels: case board, clues, Curse meter, hints, map, recipes, satchel, relics, lantern oil, stamina, Bestiary and coins; write each tip from the current code (check hint prices in `caseHints.ts`, the map key in `data/controls.ts`, the pin limit, and when the case can be answered), at most 2 sentences about how to play, with the coins tip mentioning the vending machine; add the §12.5 check to `tests/designBibleSection12.test.ts`
    - _Requirements: 5.1, 5.7, 5.8, 5.11, 5.12, 8.2_
  - [ ] 5.2 Pure info tip rules and tests
    - Create `src/game/systems/infoTips.ts` (`countSentences`, `tipFor`, `placeTooltip` keeping a tooltip inside the viewport and clear of the health bar, oil gauge and hint panel rects) and `infoTips.test.ts`; extend `settings.test.ts`
    - **Property 19: Info tips completeness**; **Property 20: Settings round trip** (jumpscares and showInfoDots together)
    - _Requirements: 5.2, 5.7, 5.8, 5.9, 5.10, 5.12_
  - [ ] 5.3 InfoDot component and Escape handling
    - Create `src/ui/theme/InfoDot.tsx`: a button with `aria-describedby`, a `role="tooltip"` parchment tooltip shown within 100 ms on hover, focus or tap and closed on leave, blur or outside tap; renders nothing (out of DOM and Tab order) when `showInfoDots` is off
    - Confirm the order of the pause key listener (capture or bubble) and handle Escape: closes the open tooltip and does not open pause; with no tooltip open Esc reaches pause as before (use a small `infoDotState` flag if the listener is in the capture phase)
    - Write the testing-library component test: hover, focus and tap open, leave and blur close, Esc rules, `aria-describedby`, hidden dots absent
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.9, 8.9_
  - [ ] 5.4 Place the dots
    - Add an `InfoDot` next to each journal section heading and each HUD panel of Requirement 5.1 (the Bestiary dot is added with the Creatures page in task 7; the creatures journal key exists in the data now); check no overlap with the health bar, oil gauge or controls hint panel at 800x600 with Plain font for journal on
    - Info dots are DOM only: this task needs no art files and no Waiting_List entries
    - _Requirements: 5.1, 5.10, 8.10_
  - [ ] 5.5 Info dots e2e and screenshots
    - Create `e2e/info-dots.spec.ts`: hover and Tab to each dot in the journal and the HUD, tooltip fully inside the viewport at 800x600 with Plain font on, Esc closes the tooltip without pausing, Esc again pauses, turning the setting off removes every dot and skips them in Tab order
    - Save screenshots at 1280x720 and 800x600 of the journal and the HUD with tooltips open
    - _Requirements: 5.2, 5.4, 5.5, 5.9, 5.10, 8.21_
  - [ ] 5.6 Finish
    - Run the Finish steps for task 5; commit `info dots (spec 11 task 5)`

- [ ] 6. H7: Detailed hands and a realistic lantern light (cuttable, cut order 2)
  - [ ] 6.1 Lantern light data
    - Create `src/data/lanternLight.ts` (`LANTERN_LIGHT` constants: colour `#ffb46b`, low oil colour, shadow map 1024, fill radius 3, breathing, gutter and dip ranges, low oil threshold 15 and multiplier 2, move multiplier 1.5, Flashing-off limits, flare 0.3 s, bride dim 0.3) and the grip table and clip names in `src/data/viewmodel.ts`; add the hook caption "Lantern hooked to your belt"; add the §12.7 check to `tests/designBibleSection12.test.ts`
    - _Requirements: 7.1, 7.2, 7.5, 7.9, 7.11, 7.12, 7.13, 7.14, 8.2_
  - [ ] 6.2 Pure grip, lantern hand and flicker systems with tests
    - Create `src/game/systems/gripClass.ts` (total, exhaustive over weapon ids), `lanternHand.ts` (held, belt and strap states, anchor, caption-once flag, catch within 0.6 s) and `lanternFlicker.ts` (`flickerSignal`, `flickerParams`, `signalToFlame`, `signalToGlass`, last flare, low-pass for Flashing lights off, bride dim with slew limit) with a test file for each
    - **Property 26: Grip class is total and matches the table**; **Property 27: Lantern hand state machine**; **Property 28: Flicker signal bounds**; **Property 29: Flicker parameters respond to oil and movement**; **Property 11: Bride lantern effect** (the flicker part; the distance rule is exercised again in task 7)
    - Add the caption-once flag to the progression save: cleared by New Game, kept by Continue, Retry Night and Retry from morning
    - Extend `tests/captionCoverage.test.ts` with the hook caption
    - _Requirements: 7.2, 7.4, 7.5, 7.6, 7.8, 7.11, 7.12, 7.13, 7.14, 2.16, 8.6_
  - [ ] 6.3 Lantern light rig
    - Rework `src/scene/player/Lantern.tsx`: one shadow-casting spot light (map size 1024 or less, `SpotLight.map` cage cookie) plus one fill point light (no shadow, radius 3 m or less), both `#ffb46b`, driven by `flickerSignal` with the flame mesh scale and glass emissive from the same value in the same frame; light origin from the glass or the belt hook; low oil redder and gutters at least double; out with one 0.3 s flare at 0 oil; Low graphics turns the cookie off and keeps the shadow; bloom limited to the flame and glass with a `Selection`
    - Keep the number of shadow-casting lights at 4 or fewer
    - _Requirements: 7.8, 7.9, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 8.14_
  - [ ] 6.4 Viewmodel hands
    - Extend `src/scene/player/Viewmodel.tsx`: when `viewmodel/hands.glb` and `viewmodel/lantern.glb` load, play the grip clip by `gripFor` (switch within 0.3 s) and Lantern-Hold; lantern hand sway with 80 ms ±20 ms lag, lowered 0.05 to 0.15 m on sprint and steady with Head bob off; shotgun puts the lantern on the belt and the left hand on the fore-end, throws and heavy swings hang the lantern from the strap and catch it again; show the hook caption once per run
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8_
  - [ ] 6.5 Placeholder assets for H7
    - Keep today's weapon-only viewmodel when `hands.glb` or `lantern.glb` is missing, with the light origin at a fixed camera offset; generate a soft round `DataTexture` cookie when `lantern-cookie.png` is missing; register every missing path with `// PLACEHOLDER:` comments and `placeholders.ts` rows; test that the game runs with all three missing
    - _Requirements: 7.7, 7.10, 8.16, 8.22_
  - [ ] 6.6 Hands and lantern e2e, screenshots and perf
    - Add `viewmodelState()` and `lanternLightState()` to the Debug_Hook; create `e2e/hands-lantern.spec.ts`: each Grip_Class, the belt lantern with the shotgun and its caption, cage shadows on the hut wall, low oil and out, Flashing lights off steady light
    - Save screenshots at 1280x720 and 800x600 for each Grip_Class, the belt lantern and the cage shadows; run the GPU perf spec before and after on the same scene and resolution and save `e2e/logs/lantern-perf-before.json` and `lantern-perf-after.json` (frame time, draw calls, shadow-light count of 4 or fewer)
    - _Requirements: 7.2, 7.4, 7.9, 7.14, 7.16, 8.14, 8.21_
  - [ ] 6.7 Finish
    - Run the Finish steps for task 6; commit `hands and realistic lantern light (spec 11 task 6)`

- [ ] 7. H2: New creatures (cuttable, cut order 1, cut together with task 8)
  - [ ] 7.1 Creature data
    - Add `crawler`, `bride` and `hound` to `EnemyId`, `ENEMY_MAP` and `ENEMY_LOOKS` (4 variants each) in `src/data/enemies.ts`; make `WaveEnemyId` exclude `bride`; create `src/data/creatures.ts` (crawler burst 2 m, face range 1.5 m, grab 8 and cooldown 1.5 s, lunge; bride reveal 3 m, drain 20, respawn 30 to 60 s, lantern dim 0.3 within 8 m; hound pack 2 to 3, circle 4 to 6 m, dart 10 and gap 2 s, scatter 15 m for 4 s; tell leads 0.5 to 1.5 s) and `src/data/bestiary.ts` (field note up to 200 characters and a "What works" line each); add the tell and attack sounds and captions; add the §12.2 check to `tests/designBibleSection12.test.ts`
    - _Requirements: 2.1, 2.14, 2.15, 2.18, 3.7, 8.2_
  - [ ] 7.2 Pure creature systems and tests
    - Create `src/game/systems/crawler.ts`, `bride.ts`, `hounds.ts`, `creatureTells.ts`, `hurtGuard.ts` and `bestiary.ts` (as in the design) with a test file each; add `crawler` and `hound` to `src/data/waves.ts` ladder rows (rows only increase) and extend `waves.test.ts`; add the combat attack kind (`melee-horizontal`, `melee-down`, `bullet`, `fire`) used by `crawlerHit`
    - **Property 6: Crawler rules**; **Property 7: Bride rules**; **Property 8: Hound pack rules**; **Property 9: Creature tells precede attacks**; **Property 11: Bride lantern effect** (distance rule and slew limit); **Property 12: Wave and elite tables stay on the curve**; **Property 13: Bestiary hides unseen creatures**; **Property 5: Screen scare never reduces health** (the creature damage clamp part with `clampScriptedDamage`)
    - Extend `tests/captionCoverage.test.ts` with every creature sound
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.20, 8.12, 8.18_
  - [ ] 7.3 Creature stores, scene components and wave wiring
    - Create `Crawler.tsx`, `Bride.tsx` and `Hound.tsx` in `src/scene/enemies/` following the existing zombie component pattern; add `stepCreatures` to `GameLoop.tsx` before the bat step; place crawlers at night 2 on distinct grave mounds and broken coffins and keep them unrendered until they first move; bride at stage 2 only with invisible-until-seen opacity and collider rules; hounds in packs inside the alive caps (12 / 16 / 20); every attack goes through `hurtPlayer` with the clamp; spatial tell and attack sounds with captions
    - Save the creature state and the seen set in the world and progression saves
    - _Requirements: 2.2, 2.3, 2.6, 2.7, 2.9, 2.12, 2.14, 2.15, 2.20, 8.13_
  - [ ] 7.4 Creature wiring: screen scares, lantern and Bestiary
    - Trigger the bottom zombie-face scare when a crawler bursts within 1.5 m in front (grab damage after the out phase starts) and the top ghost-face scare when the bride reaches the player (oil drain after the in phase ends); apply the grab or drain at once if the scare is skipped; wire the bride's lantern bend and 30% dim into the lantern rig
    - Create `src/ui/journal/Bestiary.tsx` (the "Creatures" page: sketch, field note, "What works" for seen creatures only) with its `InfoDot`; extend the Journal tab list and the tip-key test
    - _Requirements: 1.6, 1.7, 2.8, 2.16, 2.18, 5.1_
  - [ ] 7.5 Placeholder assets for H2
    - Use the existing zombie model scaled and tinted for `crawler.glb`, `bride.glb` and `hound.glb` when missing, a hand-drawn-free text card "Sketch not drawn yet" for missing Bestiary sketches, procedural tones for missing sounds; register every path in the Waiting_List with `// PLACEHOLDER:` comments and `placeholders.ts` rows; test the game with all three models missing
    - _Requirements: 2.19, 8.16, 8.22_
  - [ ] 7.6 Dev hooks for creatures
    - Add "Spawn crawler ambush", "Spawn bride" and "Spawn hound pack" to the Dev_Panel through real store actions; add `creatureState()` to the Debug_Hook; extend `devMode.test.ts`
    - _Requirements: 2.2, 2.6, 2.12_
  - [ ] 7.7 Creatures e2e and screenshots
    - Create `e2e/creatures.spec.ts`: crawler ambush with its face scare and 8 damage, a horizontal swing misses and a downward swing hits, the bride seen only in the cone or within 3 m and the oil drain, lead does no damage to her, the hound pack circles and scatters on a gunshot, the Bestiary shows only seen creatures, player never drops below 1 HP from a scripted event
    - Save screenshots at 1280x720 and 800x600 of the crawler ambush, the bride in the lantern cone, the hound pack scatter and the Creatures page
    - _Requirements: 2.2, 2.3, 2.4, 2.7, 2.8, 2.10, 2.13, 2.18, 2.20, 8.21_
  - [ ] 7.8 Finish
    - Run the Finish steps for task 7; log every wave-table tuning change in the kiro-log entry; commit `new creatures (spec 11 task 7)`

- [ ] 8. H3: Horror-game zombie looks (cuttable, cut order 1, cut together with task 7)
  - [ ] 8.1 Look data and asset paths
    - Put the paths for `zombie.glb`, `zombie-brute.glb`, `crawler.glb`, `bride.glb` and `hound.glb` only in `src/data/assets.ts`; define the clip contract (Idle, Walk, Run, Crawl, Attack, Lunge, Threaten, HitReact, Death; the hound and bride use their own movement clip) and per-variant tints in `src/data/enemies.ts`; add the §12.3 check to `tests/designBibleSection12.test.ts`
    - _Requirements: 3.1, 3.2, 3.5, 3.7, 8.2_
  - [ ] 8.2 Pure look and clip rules with tests
    - Create `src/game/systems/lookVariant.ts` (`lookIndex` by FNV-1a hash of the uid modulo 4, `resolveClip` with one warning per model and clip) and `lookVariant.test.ts`
    - **Property 14: Look variant is deterministic and in range**; **Property 15: Clip fallback**
    - _Requirements: 3.3, 3.4_
  - [ ] 8.3 Look variants in the scene
    - Update `src/scene/enemies/EnemyModels.tsx`: show exactly one `look-N` mesh and hide the other three, apply the tint only where the variant defines one, keep file materials otherwise, show the base mesh when the variant mesh is missing, fall back to `Idle` for a missing clip and to `zombie.glb` when a file fails to load; check the models in use stay one skinned mesh and under 15,000 triangles with a script run on delivered files
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.8, 3.9_
  - [ ] 8.4 Placeholder assets for H3
    - Register every missing model or `look-N` mesh in the Waiting_List with `// PLACEHOLDER:` comments and `placeholders.ts` rows; test the scene with missing files, missing meshes and missing clips without a thrown error
    - _Requirements: 3.3, 3.6, 8.16, 8.22_
  - [ ] 8.5 Zombie looks e2e and screenshots
    - Create `e2e/zombie-looks.spec.ts`: spawn zombies with known uids through the Dev_Panel, assert one visible look mesh each, the same uid gives the same look, and all four looks appear in a group
    - Save screenshots at 1280x720 and 800x600 of a group showing different looks
    - _Requirements: 3.4, 3.6, 8.21_
  - [ ] 8.6 Finish
    - Run the Finish steps for task 8; commit `zombie look variants (spec 11 task 8)`

- [ ] 9. Final task: whole-spec browser checks, GPU perf and the art waiting list (never cut)
  - [ ] 9.1 Whole-spec browser checks
    - Create `e2e/horror-pass.spec.ts` that runs one check for each item of Requirement 8.21 that is still in the spec (skip the checks of cut tasks and say so in the report): each Screen_Scare at Full and Reduced, the crawler ambush, the Bride in the lantern cone, the hound pack scatter, the bat turning and taking off, each Info_Dot, a vending purchase, hands per Grip_Class with the belt lantern, and the cage shadows
    - Save one screenshot per check at 1280x720 and 800x600; verify every new panel is keyboard-operable with visible focus
    - _Requirements: 8.9, 8.21_
  - [ ] 9.2 GPU performance before and after
    - Run the GPU perf spec on the same scenes and resolutions as `e2e/logs/horror-perf-before.json` and save `e2e/logs/horror-perf-after.json`; check 60 fps average, never under 45 fps, fewer than 150 draw calls (hut, graveyard with bats, chapel with the flock) and at most 4 shadow-casting lights; if an area goes over, list the number in the kiro-log and fix it or cut the optional piece (belfry flock, `marquee-light`, cookie)
    - Run the asset budget check: total download under 25 MB and every new model compressed
    - _Requirements: 8.14, 8.15, 7.16_
  - [ ] 9.3 Waiting list report and bible check
    - Run `tests/waitingList.test.ts` against `public/assets/` and print the full list of art files still waiting, with their full paths, into the kiro-log entry and the final report; confirm every Placeholder_Asset has a `PLACEHOLDER` comment and a registry row, and every cut part of §12 is marked "cut"
    - Run the §12 mirror test and `docs/CREDITS.md` check for new third-party assets
    - _Requirements: 8.2, 8.3, 8.16, 8.17_
  - [ ] 9.4 Finish
    - Run the Finish steps for task 9, including the "Decisions made unattended" list for the whole spec (copy the 12 decisions of `design.md` and add any new ones); commit `horror pass final checks and waiting list (spec 11 task 9)`

## Notes

- Property tests are written with the code they check, as sub-task items; Playwright specs sit in their own sub-task so a cut feature drops its spec with it.
- Property 5 and Property 11 each have two halves, written in the task that owns that half (3.2 and 7.2, 6.2 and 7.2); Property 20 is extended in 5.2; Property 10 is created in 2.3 and extended by later tasks.
- Task 5 (info dots) has no art files, so it has no placeholder sub-task.
- If H6 is the only task left before the freeze, the Waiting_List foundation in 2.1 still stays, because every other task reuses it.
- If task 3 (H1) is cut, task 7 skips sub-task 7.4's screen scare wiring and the crawler and bride deal their damage and drain directly. If task 5 is cut, 7.4 skips the Bestiary info dot. If task 6 is cut, 7.4 skips the lantern bend.
- Art still owed: models `props/vending-machine.glb`, `items/brisk-draught.glb`, `props/bat-perched.glb`, `props/bat-flying.glb`, `viewmodel/hands.glb`, `viewmodel/lantern.glb`, `enemies/crawler.glb`, `enemies/bride.glb`, `enemies/hound.glb` and the `look-0` to `look-3` meshes in `zombie.glb`; the five face images; `public/assets/textures/lantern-cookie.png`. The exact paths are in `src/data/placeholders.ts` after task 2.1, and the final list is produced by task 9.3.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3"] },
    { "id": 6, "tasks": ["2.4"] },
    { "id": 7, "tasks": ["2.5"] },
    { "id": 8, "tasks": ["2.6"] },
    { "id": 9, "tasks": ["2.7"] },
    { "id": 10, "tasks": ["2.8"] },
    { "id": 11, "tasks": ["3.1"] },
    { "id": 12, "tasks": ["3.2"] },
    { "id": 13, "tasks": ["3.3"] },
    { "id": 14, "tasks": ["3.4"] },
    { "id": 15, "tasks": ["3.5"] },
    { "id": 16, "tasks": ["3.6"] },
    { "id": 17, "tasks": ["3.7"] },
    { "id": 18, "tasks": ["3.8"] },
    { "id": 19, "tasks": ["4.1"] },
    { "id": 20, "tasks": ["4.2"] },
    { "id": 21, "tasks": ["4.3"] },
    { "id": 22, "tasks": ["4.4"] },
    { "id": 23, "tasks": ["4.5"] },
    { "id": 24, "tasks": ["4.6"] },
    { "id": 25, "tasks": ["4.7"] },
    { "id": 26, "tasks": ["4.8"] },
    { "id": 27, "tasks": ["5.1"] },
    { "id": 28, "tasks": ["5.2"] },
    { "id": 29, "tasks": ["5.3"] },
    { "id": 30, "tasks": ["5.4"] },
    { "id": 31, "tasks": ["5.5"] },
    { "id": 32, "tasks": ["5.6"] },
    { "id": 33, "tasks": ["6.1"] },
    { "id": 34, "tasks": ["6.2"] },
    { "id": 35, "tasks": ["6.3"] },
    { "id": 36, "tasks": ["6.4"] },
    { "id": 37, "tasks": ["6.5"] },
    { "id": 38, "tasks": ["6.6"] },
    { "id": 39, "tasks": ["6.7"] },
    { "id": 40, "tasks": ["7.1"] },
    { "id": 41, "tasks": ["7.2"] },
    { "id": 42, "tasks": ["7.3"] },
    { "id": 43, "tasks": ["7.4"] },
    { "id": 44, "tasks": ["7.5"] },
    { "id": 45, "tasks": ["7.6"] },
    { "id": 46, "tasks": ["7.7"] },
    { "id": 47, "tasks": ["7.8"] },
    { "id": 48, "tasks": ["8.1"] },
    { "id": 49, "tasks": ["8.2"] },
    { "id": 50, "tasks": ["8.3"] },
    { "id": 51, "tasks": ["8.4"] },
    { "id": 52, "tasks": ["8.5"] },
    { "id": 53, "tasks": ["8.6"] },
    { "id": 54, "tasks": ["9.1"] },
    { "id": 55, "tasks": ["9.2"] },
    { "id": 56, "tasks": ["9.3"] },
    { "id": 57, "tasks": ["9.4"] }
  ]
}
```
