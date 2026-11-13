# Implementation Plan: Curse Stages and Cases

## Overview

This plan builds spec 10 in the build order of `docs/case-design.md` §6: the stage loop, the case board, Stage 1, Stage 3, Stage 2, the win cutscene, help and Short Vigil, the kill-cam, stamina, tiered crafting, Name the Dead, and a final full automated playthrough.

Every top-level task ends with a **Finish** sub-task:

- **Finish:** run `npm run lint`, `npm run build` and `npm test -- --run`, plus the task's own Playwright specs; fix every failure; append a `docs/kiro-log.md` entry with the real date; then make a local commit with the message `<what changed> (spec 10 task N)`. Do not push.

Common rules for all tasks:

- `docs/game-design.md` (§13 and the (10) rows) is the source of truth for content and numbers. `docs/case-design.md` wins where they differ. Change the bible and `src/data/` together.
- Game logic stays in `src/game/` with no React, three.js or Howler imports; every system has a matching `*.test.ts`.
- Dev code stays in `src/dev/` and reaches the game only through the existing stores and `devCheats` paths.
- Each Minigame task saves a screenshot pair (1280x720 and 800x600) into `e2e/screenshots/`, and each Playwright spec solves its Minigame with `page.mouse` and `page.keyboard`, plus a keyboard-only run.
- Property tests use fast-check with at least 100 runs and a comment `Feature: 10-curse-stages, Property N: <title>`.
- Cuttable tasks are marked `(cuttable, cut order N)`. If time runs short, cut in that order: 1 Name the Dead, 2 E4, 3 minigame 2c, 4 minigame 2a (keep the whistle where it is now), 5 E9. The case board, Stages 1 and 3, the Rite, E1 and E5 are never cut.
- Stretch items E6 (new enemies), E8 (extra scares) and E10 (sanctuary health) are stretch, not scheduled.
- Feature freeze is 2026-11-26: after that date start no new feature task of this spec.

## Tasks

- [x] 1. E1: The stage loop
  - [x] 1.1 Stage data
    - Create `src/data/stages.ts` (`StageDef` for 3 Stages: Case id, ladder rows, fog, alive cap 12 / 16 / 20, max stamina, dawn recipe unlocks)
    - Replace `LAST_NIGHT` and `NIGHT_FOG_DENSITY` use in `src/data/balance.ts` and `src/data/waves.ts` with the Stage data; keep Endless data
    - Update `src/data/objectiveRules.ts` text for the curse line, the altar-locked line and the per-Stage day rules; add captions for the altar sounds
    - Update `docs/game-design.md` only where the data forces a change
    - _Requirements: 1.1, 1.6, 1.7, 2.3, 2.6, 2.10, 6.4, 6.5_
  - [x] 1.2 Pure stage system and endless waves
    - Create `src/game/systems/stage.ts` and `stageWaves.ts` (`stageWaveComposition`, `waveStrength`, `aliveCap`, `nextWaveDelay`, `addDoubt`)
    - Change `waves.ts` so Story nights never reach `done` and `dayNight.ts` takes `wavesCleared` from the case-solved flag with `lastNight` 3
    - Make the day phase spawn nothing and make `scareDirector.ts` turn a day `lurker-lunge` into `door-slam`
    - Write `stage.test.ts`, `stageWaves.test.ts`, and extend `waves.test.ts`, `dayNight.test.ts`, `scareDirector.test.ts`
    - **Property 1: Waves run exactly while the case is unsolved**; **Property 2: Wave difficulty never decreases**; **Property 3: Alive cap holds**; **Property 4: Wave pacing**; **Property 5: No zombie and no lurker lunge by day**
    - _Requirements: 1.1, 1.2, 2.1-2.11, 6.1, 6.9_
  - [x] 1.3 Pure altar answer rules
    - Create `src/game/systems/altarAnswer.ts` (`giveAnswer` with the 30 s lock, the instant wave, the extra link after 2 wrong answers, day refusal, accusation kind) taking the correctness verdict as input
    - Write `altarAnswer.test.ts`
    - **Property 6: Altar answers obey the lock and the link rule**; **Property 7: A wrong accusation costs nothing**
    - _Requirements: 3.1-3.8_
  - [x] 1.4 Stores, loop wiring and persistence
    - Create `stageStore.ts`; compose it in `src/game/state/index.ts`; wire `GameLoop.tsx`, `worldStore.ts`, `waveStore.ts` and `nightState.ts` to the Stage system
    - Add `stage` and `altar` fields to `gameSave.ts`, `retryNight.ts`, `duskSnapshot` data and `resetRun.ts`; write `migrateSave` for old night numbers
    - Write `stageStore.test.ts` and extend `gameSave.test.ts`, `resetRun.test.ts`, `retryProgression.test.ts`
    - **Property 11: Old saves migrate monotonically**
    - _Requirements: 1.3, 1.4, 1.5, 1.8, 4.1-4.4, 4.7_
  - [x] 1.5 Solved sequence, objective, compass and HUD
    - On a solved case collapse living zombies to dust (particle effect), play the sunrise and start the dawn screen; add the dawn unlocks
    - Update `objective.ts`, `compass.ts` and the HUD for the curse line, `CurseMeter.tsx` (number and bar) and the "The altar is silent: 0:24" line
    - Write `objective.test.ts` additions and `compass.test.ts` additions
    - **Property 26: Objective follows the rule table**
    - _Requirements: 1.3, 2.12, 3.3, 6.2-6.7_
  - [x] 1.6 Dev hooks for stages
    - Add "Skip to stage 1/2/3", "Solve current case" to the Dev_Panel through `devActions.ts` (real store actions, key items and recipes granted per Stage)
    - Add `stageState()` to the Debug_Hook; extend `devMode.test.ts`
    - _Requirements: 5.1-5.6_
  - [x] 1.7 Stage loop e2e
    - Create `e2e/stage-loop.spec.ts`: a night keeps spawning waves, the dev "solve current case" ends it, zombies collapse and dawn plays; day has no zombies; Retry Night and Continue keep the Stage
    - _Requirements: 1.2, 2.1, 2.2, 2.12, 4.1, 4.3_
  - [x] 1.8 Finish
    - Run the Finish steps for task 1; commit `stage loop with endless nights (spec 10 task 1)`

- [x] 2. The case board
  - [x] 2.1 Case types and data shells
    - Create `src/data/cases.ts` with the types of the design and the three Case shells (ids, titles, Stage, curse steps, hint prices); create `src/data/caseText.ts` for Closed-case pages
    - Write `cases.test.ts` (unique ids, notes reference real clues, answer within options, 6-8 clues, 2 red herrings, reachability)
    - **Property 17: Every answer's clues are reachable**; **Property 18: Case data is internally consistent**
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_
  - [x] 2.2 Pure case systems
    - Create `caseBoard.ts`, `caseAnswer.ts`, `caseHints.ts`, `caseScore.ts` (links, deduction notes, curse meter, final-answer check, hint tiers, Doubt, Sharp Eye) with tests
    - **Property 12: Linking is idempotent and note-correct**; **Property 13: Hint tiers reveal in order**; **Property 14: Doubt is capped**; **Property 15: Sharp Eye only for a clean case**; **Property 16: Right answers accepted, wrong answers rejected** (final answers)
    - _Requirements: 8.5-8.7, 9.1-9.6, 9.9_
  - [x] 2.3 Case store and persistence
    - Create `caseStore.ts` and compose it; add its data to `gameSave.ts`, the dusk and morning snapshots (union merge on Retry Night), and `resetRun.ts`; wire Doubt into the first wave and the altar verdict into `stageStore`
    - Write `caseStore.test.ts` and extend the save and retry tests
    - **Property 8: Clue sets swap per stage**; **Property 9: Case store round trip**; **Property 10: Retry keeps knowledge, New Game resets**
    - _Requirements: 4.1-4.6, 7.3, 9.4, 9.5_
  - [x] 2.4 Case board UI
    - Create `CaseBoard.tsx`, `ClueCard.tsx`, `RedString.tsx` and CSS in `src/ui/journal/`: cork board, pinned cards, mouse drag and keyboard linking, Deduction_Note live region, Final_Question slots, hint buttons with prices, visible focus, plain-font and reduced-motion support
    - Add the "Case" tab to `Journal.tsx`
    - Write `caseBoardView.test.ts` for the pure view model
    - _Requirements: 8.1-8.4, 8.8-8.10, 9.8_
  - [x] 2.5 Journal pause rule, Closed cases and altar panel
    - Add `pausesSim(phase, journalOpen)` and use it in `menuState.ts`; at night dim the screen and keep sound; no scare begins while the journal is open
    - Create `ClosedCases.tsx` and `AltarPanel.tsx` (answer slots, lock countdown, link-needed message); mark tutorial step "Opening the Case tab on the journal"
    - Write tests for `pausesSim` and the tutorial step
    - **Property 25: The journal pauses only by day**
    - _Requirements: 3.3, 3.4, 3.6, 6.3, 10.1-10.6_
  - [x] 2.6 Dev hooks for the case
    - Add "Give all clues of the current case" and "Solve current minigame" to the Dev_Panel; add `caseState()` and `minigameState()` to the Debug_Hook
    - _Requirements: 5.3, 5.5_
  - [x] 2.7 Case board e2e and screenshots
    - Create `e2e/case-board.spec.ts`: open the board, drag one string with the mouse and make another by keyboard, assert both notes and the curse meter; a keyboard-only run; at night the journal does not pause
    - Save the screenshot pair of the board with 5+ cards, 2 strings and a note
    - _Requirements: 8.11, 8.12, 10.1, 10.2_
  - [x] 2.8 Finish
    - Run the Finish steps for task 2; commit `case board and case systems (spec 10 task 2)`

- [ ] 3. Stage 1: Saved by the Bell
  - [x] 3.1 Case 1 data
    - Fill `cases.ts` for Case 1: ledger of 8 entries, stones (Marsh, Hale, Ames, Pell and 2 more), 6-8 clues with the red herrings (fresh flowers on Hale, toppled Marsh stone), notes, the Final_Question, hints and the Closed-case page
    - Update `clues.ts`, `journal.ts` and the Pell grave key placement; extend `cases.test.ts`
    - _Requirements: 7.1, 7.2, 12.1, 13.3, 14.1, 14.4_
  - [ ] 3.2 Minigame shell
    - Create `src/ui/minigames/MinigameShell.tsx`: overlay frame counting in `isMenuOpen()` via `overlayStore`, focus trap, Esc to close, captions, no timer, partial progress kept
    - Make the Scare_Director skip scares while a Minigame is open
    - Write `minigameShell.test.ts` for the view model and the scare gate
    - _Requirements: 6.2, 11.1-11.5, 11.7_
  - [ ] 3.3 Pure rules for 1a and 1b
    - Add `ledgerFlags` and `bellPosts` verdicts to `caseMinigames.ts` (3 right flags narrow to 3 graves; the cut rope, the rusted bell, the early tag) with tests
    - **Property 16: Right answers accepted, wrong answers rejected** (1a, 1b)
    - _Requirements: 11.6, 11.8, 12.2-12.4, 13.2, 13.4_
  - [ ] 3.4 Minigame 1a overlay and hut ledger
    - Create `LedgerMinigame.tsx` (two-page spread, mouse lines, keyboard arrows/Enter/F, text messages); put the ledger page on the hut shelf in `Hut.tsx`; wire to `caseStore.submitMinigame` and Doubt
    - _Requirements: 12.1, 12.3-12.6, 6.8_
  - [ ] 3.5 Minigame 1b overlay and bell posts
    - Create `BellsMinigame.tsx` and the bell-post props in `CaseProps.tsx` (simple meshes, placed after 1a, clear of anchors, no lights); extend the layout tests with the new anchors
    - _Requirements: 13.1, 13.2, 13.5, 13.6, 11.9_
  - [ ] 3.6 Final answer, reward and receipt
    - Wire the Case 1 Final_Question at the altar; on solve place the Rusted Crypt Key in Pell's grave, mark the dig mound and open the Row gate; make the merchant hand over the Vane & Sons receipt at the first Stage 1 purchase in `merchant.ts`
    - Add tests for the reward and the receipt
    - _Requirements: 14.2-14.6_
  - [ ] 3.7 Dev hooks for Stage 1
    - Add Stage 1 helpers to the Dev_Panel ("Solve 1a", "Solve 1b") through real store actions
    - _Requirements: 5.3_
  - [ ] 3.8 Stage 1 e2e and screenshots
    - Create `e2e/case1.spec.ts`: solve 1a and 1b with mouse and keyboard, a wrong flag and a wrong post, then the right and a wrong altar answer at night (lock and instant wave); a keyboard-only run
    - Save the screenshot pairs for 1a, 1b and the altar panel; log the time to the first Minigame from Begin
    - _Requirements: 12.7, 12.8, 13.7, 13.8, 14.7, 14.8, 6.8_
  - [ ] 3.9 Milestone: run the full e2e suite and fix what broke
    - Run the whole Playwright suite once after Stage 1 and fix every failure that this spec caused
    - _Requirements: 29.5_
  - [ ] 3.10 Finish
    - Run the Finish steps for task 3; commit `stage 1 case and minigames (spec 10 task 3)`

- [ ] 4. Stage 3: The Sealed Catacombs, the Rite and Silas
  - [ ] 4.1 Case 3 data
    - Fill `cases.ts` for Case 3: hymn board numbers and the 60-hymn index spelling BELOW, six evidence cards and order, relic order from the confession and notes, Josiah Vane flyleaf, Vane & Sons receipt, letter, the Accusation question, red herrings (oil at another crypt, old bishop's seal), Closed-case page
    - Update `relics.ts`, `journal.ts` and `captions.ts`; extend `cases.test.ts`
    - _Requirements: 7.1, 7.2, 15.1, 16.1, 17.1, 18.1, 18.2_
  - [ ] 4.2 Pure rules for 3a, 3b, the Rite and the Accusation
    - Add `hymnTiles` and `evidenceTimeline` to `caseMinigames.ts`; create `rite.ts` (`placeRelic`, order, Crane gate); extend `caseAnswer.ts` for the Accusation; write `rite.test.ts` and extend `caseMinigames.test.ts`
    - **Property 16: Right answers accepted, wrong answers rejected** (3a, 3b, Accusation); **Property 19: The rite completes only in order and with Crane fallen**
    - _Requirements: 15.2, 15.3, 16.2, 16.4, 17.3-17.6, 18.3_
  - [ ] 4.3 Minigame 3a overlay and hymn board props
    - Create `HymnMinigame.tsx` (board numbers, psalter index text, five tiles, keyboard arrows/Enter) and the hymn board, letter tiles and vestry psalter props; the whistle opens the stair on success
    - _Requirements: 15.1-15.5, 11.9_
  - [ ] 4.4 Minigame 3b overlay and crypt props
    - Create `TimelineMinigame.tsx` (six cards, drag and keyboard lift/move), the evidence props (boots, bench letter, ruts, oil, nail marks, hasp pin) and the crypt opening with Elias's body and the Iron Ossuary Key
    - _Requirements: 16.1-16.5, 11.9_
  - [ ] 4.5 The Rite: relic placement
    - Create `riteStore.ts` and `AltarRite.tsx`; replace the 45 s hold in `mystery.ts`, `finalRite.ts` and `FinalRite.tsx`; start Crane's 10 s rising clock on the first relic; hold the rite while Crane lives; "[a sour note from the altar]" subtitle; keyboard placement
    - Update `finalRite.test.ts`, `mystery.test.ts`, `bossDirector.test.ts`
    - _Requirements: 17.1-17.7_
  - [ ] 4.6 Silas reveal, Accusation, epilogue and endings
    - Add the Accusation panel to `AltarPanel.tsx`, the epilogue, the achievement *Justice for Elias*, the default line, and retire Uneasy Peace in `endings.ts` and `mystery.chooseEnding`; keep the merchant trading normally until the reveal
    - Update `endings.test.ts`, `achievements.test.ts`
    - _Requirements: 17.8, 18.1-18.6_
  - [ ] 4.7 Dev hooks for Stage 3
    - Add "Solve 3a", "Solve 3b", "Give all relics" in correct order to the Dev_Panel
    - _Requirements: 5.3_
  - [ ] 4.8 Stage 3 e2e and screenshots
    - Create `e2e/case3.spec.ts`: solve 3a and 3b with mouse and keyboard (wrong and right), place the relics in order with Crane rising on the first, give the correct and a wrong Accusation; a keyboard-only run
    - Save the screenshot pairs for 3a, 3b, the Rite and the Accusation panel
    - _Requirements: 15.6, 15.7, 16.6, 16.7, 17.9, 17.10, 18.7, 18.8_
  - [ ] 4.9 Milestone: run the full e2e suite and fix what broke
    - Run the whole Playwright suite once after Stage 3 and fix every failure that this spec caused
    - _Requirements: 29.5_
  - [ ] 4.10 Finish
    - Run the Finish steps for task 4; commit `stage 3 case, rite and Silas (spec 10 task 4)`

- [ ] 5. Stage 2: The Resurrection Men
  - [ ] 5.1 Case 2 data
    - Fill `cases.ts` for Case 2: four suspects, crest years on 6 tablets, 8 watch-log entries with the 2-hour gap, 3 casts and 4 boots, surgeon's receipt, red herrings (spade with fresh clay, doctor's letter), Final_Question, Closed-case page; fallback clues for 2a and 2c
    - Extend `cases.test.ts` (also with 2a and 2c cut)
    - _Requirements: 7.1, 7.2, 19.1, 19.5, 20.1, 21.1, 21.5, 22.1, 22.4_
  - [ ] 5.2 Pure rules for 2a, 2b and 2c
    - Add `crestDials`, `watchOrder`, `bootMatch` to `caseMinigames.ts` with tests
    - **Property 16: Right answers accepted, wrong answers rejected** (2a, 2b, 2c)
    - _Requirements: 19.2, 19.3, 20.2, 20.3, 21.2, 21.3_
  - [ ] 5.3 Minigame 2b overlay and lodge props
    - Create `WatchLogMinigame.tsx` (8 entries, drag and keyboard lift/move, first-wrong marker with glyph and text) and the lodge logbook prop
    - _Requirements: 20.1-20.4, 11.9_
  - [ ] 5.4 Minigame 2a overlay and crest lock (cuttable, cut order 4)
    - Create `CrestLockMinigame.tsx`, the sexton's niche dials at (−21.2, −52.5), the lodge note and the crypt name tablets on the existing tablet faces; solving gives the whistle and the sexton's ledger
    - If cut: keep the whistle where it is and make the sexton's ledger a found item
    - _Requirements: 19.1-19.5, 11.9_
  - [ ] 5.5 Minigame 2c overlay and plaster casts (cuttable, cut order 3)
    - Create `BootPrintsMinigame.tsx` and the three plaster casts at the Ames grave; boots examine views
    - If cut: the boots clue becomes a found item
    - _Requirements: 21.1-21.5, 11.9_
  - [ ] 5.6 Final answer and hand-off to Stage 3
    - Wire the Case 2 Final_Question at the altar; on solve carry the whistle and stair into Stage 3 and move Case 2 to Closed cases
    - _Requirements: 22.1-22.5_
  - [ ] 5.7 Dev hooks for Stage 2
    - Add "Solve 2a/2b/2c" to the Dev_Panel
    - _Requirements: 5.3_
  - [ ] 5.8 Stage 2 e2e and screenshots
    - Create `e2e/case2.spec.ts`: solve 2a, 2b, 2c with mouse and keyboard (wrong and right), then the right and a wrong altar answer; a keyboard-only run; skip the 2a and 2c cases when those tasks are cut
    - Save the screenshot pairs for 2a, 2b, 2c and the Case 2 board
    - _Requirements: 19.6, 19.7, 20.5, 20.6, 21.6, 21.7, 22.6, 22.7_
  - [ ] 5.9 Finish
    - Run the Finish steps for task 5; commit `stage 2 case and minigames (spec 10 task 5)`

- [ ] 6. E5: Win cutscene
  - [ ] 6.1 Pure win sequence
    - Create `src/game/systems/winSequence.ts` (timeline of 15 to 20 s reusing `cameraPath.ts` and `endingSequence.ts`, skip target, reduced-motion variant) and `winSequence.test.ts`
    - _Requirements: 23.1, 23.2, 23.5_
  - [ ] 6.2 Cutscene scene and win card
    - Create `src/scene/effects/WinCutscene.tsx` and `src/ui/menus/WinCard.tsx`: the walk down the main path and out the gates, rising sun, lifting fog, captions, Space/Enter skip, Esc pause, fades only under reduced motion or no camera shake
    - _Requirements: 23.1-23.6_
  - [ ] 6.3 Flow wiring
    - After the Stage 3 sunrise (and the epilogue when earned) start the cutscene, then the ending card and run summary; update `startEnding.ts`, `runFlow.ts`, `endingStats.ts` for stages and cases solved
    - _Requirements: 1.4, 23.3, 23.7_
  - [ ] 6.4 Dev trigger, e2e and screenshots
    - Add a "Play win cutscene" button; create `e2e/win-cutscene.spec.ts` (play to the end, skip with Space, skip with Enter, Esc pauses); save the gate-shot screenshot pair
    - _Requirements: 23.8, 23.9_
  - [ ] 6.5 Finish
    - Run the Finish steps for task 6; commit `win cutscene (spec 10 task 6)`

- [ ] 7. E11: Help and Short Vigil
  - [ ] 7.1 Pure hunch and Short Vigil data
    - Create `keeperHunch.ts` and its test; add Short Vigil (3 Stages, 2-minute days, 100% oil) to `src/data/modes.ts`
    - **Property 20: Keeper's hunch**
    - _Requirements: 24.1, 24.4_
  - [ ] 7.2 Hunch, dawn card, difficulty screen and tutorial
    - Lean the lantern flame toward the nearest unfound clue (shape change, obeys head bob and reduced motion); show "Clues found N/M" on the dawn card; add the Short Vigil option to the difficulty screen; add the Case-tab tutorial step
    - _Requirements: 24.2, 24.3, 24.5, 24.6_
  - [ ] 7.3 Dev hooks, e2e and screenshots
    - Add "Start Short Vigil" and "Skip 2 minutes without a clue" to the Dev_Panel; create `e2e/help.spec.ts` (first Minigame within 3 minutes, logged; hunch lean after 2 minutes; the Short Vigil day length); save the dawn-card screenshot pair
    - _Requirements: 24.7, 24.8_
  - [ ] 7.4 Finish
    - Run the Finish steps for task 7; commit `keeper's hunch and short vigil (spec 10 task 7)`

- [ ] 8. E7: Grab kill-cam
  - [ ] 8.1 Pure kill-cam rules
    - Create `killCam.ts` (trigger by health below 25% or empty stamina and not facing, 1.2 s, 60 s cooldown, intensity table, lethal rule) and `killCam.test.ts`
    - **Property 21: Kill-cam cooldown and intensity**
    - _Requirements: 25.1-25.7_
  - [ ] 8.2 Camera, effects and captions
    - Create `src/scene/effects/KillCam.tsx`; hook the camera in `FirstPersonController.tsx`; add the stinger, the "[something seizes you]" caption and the steady-edge variant; honour Scare intensity, Flashing lights and Camera shake; silhouette and dust only
    - _Requirements: 25.3-25.6, 25.8, 29.1, 29.4_
  - [ ] 8.3 Kill-cam e2e
    - Add a "Trigger grab" button to the Dev_Panel; create `e2e/killcam.spec.ts` for each intensity (camera, subtitle, cooldown)
    - _Requirements: 25.9_
  - [ ] 8.4 Finish
    - Run the Finish steps for task 8; commit `grab kill-cam (spec 10 task 8)`

- [ ] 9. E9: Stamina by stage and difficulty (cuttable, cut order 5)
  - [ ] 9.1 Pure stamina cap
    - Create `staminaCap.ts` and extend `stamina.ts` (caps 100 / 90 / 80, drain ×0.8 / 1 / 1.2, current stamina clamped to the cap); write `staminaCap.test.ts`
    - **Property 22: Stamina never exceeds a cap that never rises**
    - _Requirements: 26.1-26.4_
  - [ ] 9.2 Store, bar and wiring
    - Wire the cap into `staminaRuntime.ts` and the stamina bar (cap shown as number and length)
    - _Requirements: 26.5_
  - [ ] 9.3 Stamina e2e
    - Create `e2e/stamina.spec.ts`: sprint in two Stages and assert the displayed cap
    - _Requirements: 26.6_
  - [ ] 9.4 Finish
    - Run the Finish steps for task 9; commit `stage stamina caps (spec 10 task 9)`

- [ ] 10. E4: Tiered crafting (cuttable, cut order 2)
  - [ ] 10.1 Tier data
    - Add tier, component and blueprint fields to `src/data/recipes.ts` (components such as the Iron Head; blueprints pieced from 2 clues plus a rare material); update `docs/game-design.md` §5
    - _Requirements: 27.1, 27.2_
  - [ ] 10.2 Pure tiered crafting
    - Create `tieredCrafting.ts` and extend `crafting.ts` (component check, blueprint check, missing-component report); write `tieredCrafting.test.ts`
    - **Property 23: Tier damage and cost rise together**
    - _Requirements: 27.2, 27.3, 27.4_
  - [ ] 10.3 Recipe book UI
    - Show the tier and the missing component in the recipe book; keep the flat recipes when tiers are off
    - _Requirements: 27.4, 27.5_
  - [ ] 10.4 Tiered crafting e2e
    - Create `e2e/tiered-crafting.spec.ts`: craft a component then a Tier 2 weapon at the workbench
    - _Requirements: 27.6_
  - [ ] 10.5 Finish
    - Run the Finish steps for task 10; commit `tiered crafting (spec 10 task 10)`

- [ ] 11. Name the Dead (cuttable, cut order 1)
  - [ ] 11.1 Data and pure rules
    - Add the names list from each Case's evidence to `cases.ts`; create `nameTheDead.ts` (hold 3 s, damage cancels, known or unknown name) and `nameTheDead.test.ts`
    - **Property 24: Name the Dead hold**
    - _Requirements: 28.1-28.4_
  - [ ] 11.2 Glowing grave, hold UI and captions
    - Add the glowing grave (rune plus text label), the hold ring, the caption and the +100 score; seal the grave for that wave in `waveStore.ts`
    - _Requirements: 28.1, 28.2, 28.4, 28.5_
  - [ ] 11.3 Name the Dead e2e
    - Create `e2e/name-the-dead.spec.ts`: hold Interact at a glowing grave and assert the seal and the score
    - _Requirements: 28.6_
  - [ ] 11.4 Finish
    - Run the Finish steps for task 11; commit `name the dead (spec 10 task 11)`

- [ ] 12. Final task: full automated playthrough in Short Vigil (moved from spec 09 task 3)
  - [ ] 12.1 Playthrough spec
    - Rewrite `e2e/playthrough.spec.ts`: new game in Short Vigil, play all 3 Stages (Minigames, key items, relics, Crane, Accusation) to the ending card with `page.mouse` and `page.keyboard` only; no Dev_Panel action, no teleport, no skip; god mode only to keep the fight fair
    - Assert the Objective_Tracker text at each step; log the time to the first Minigame and the total run time
    - _Requirements: 30.1-30.4, 5.7_
  - [ ] 12.2 Fix what the playthrough finds
    - Fix every real bug the run exposes; log what is left in `docs/kiro-log.md`
    - _Requirements: 30.1, 30.3_
  - [ ] 12.3 Finish
    - Run the Finish steps for task 12; commit `full playthrough test (spec 10 task 12)`

## Notes

- Property tests are written with the code they check, as sub-task items; Playwright specs sit in their own sub-task so a cut feature drops its spec with it.
- Spec 09 task 3 carries the note "moved to spec 10 final task".
- The case board, Stages 1 and 3, the Rite, E1 and E5 are not cuttable.
- E6, E8 and E10 are stretch, not scheduled.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["1.5"] },
    { "id": 4, "tasks": ["1.6"] },
    { "id": 5, "tasks": ["1.7"] },
    { "id": 6, "tasks": ["1.8"] },
    { "id": 7, "tasks": ["2.1"] },
    { "id": 8, "tasks": ["2.2"] },
    { "id": 9, "tasks": ["2.3"] },
    { "id": 10, "tasks": ["2.4"] },
    { "id": 11, "tasks": ["2.5"] },
    { "id": 12, "tasks": ["2.6"] },
    { "id": 13, "tasks": ["2.7"] },
    { "id": 14, "tasks": ["2.8"] },
    { "id": 15, "tasks": ["3.1"] },
    { "id": 16, "tasks": ["3.2", "3.3"] },
    { "id": 17, "tasks": ["3.4"] },
    { "id": 18, "tasks": ["3.5"] },
    { "id": 19, "tasks": ["3.6"] },
    { "id": 20, "tasks": ["3.7"] },
    { "id": 21, "tasks": ["3.8"] },
    { "id": 22, "tasks": ["3.9"] },
    { "id": 23, "tasks": ["3.10"] },
    { "id": 24, "tasks": ["4.1"] },
    { "id": 25, "tasks": ["4.2"] },
    { "id": 26, "tasks": ["4.3"] },
    { "id": 27, "tasks": ["4.4"] },
    { "id": 28, "tasks": ["4.5"] },
    { "id": 29, "tasks": ["4.6"] },
    { "id": 30, "tasks": ["4.7"] },
    { "id": 31, "tasks": ["4.8"] },
    { "id": 32, "tasks": ["4.9"] },
    { "id": 33, "tasks": ["4.10"] },
    { "id": 34, "tasks": ["5.1"] },
    { "id": 35, "tasks": ["5.2"] },
    { "id": 36, "tasks": ["5.3"] },
    { "id": 37, "tasks": ["5.4"] },
    { "id": 38, "tasks": ["5.5"] },
    { "id": 39, "tasks": ["5.6"] },
    { "id": 40, "tasks": ["5.7"] },
    { "id": 41, "tasks": ["5.8"] },
    { "id": 42, "tasks": ["5.9"] },
    { "id": 43, "tasks": ["6.1"] },
    { "id": 44, "tasks": ["6.2"] },
    { "id": 45, "tasks": ["6.3"] },
    { "id": 46, "tasks": ["6.4"] },
    { "id": 47, "tasks": ["6.5"] },
    { "id": 48, "tasks": ["7.1"] },
    { "id": 49, "tasks": ["7.2"] },
    { "id": 50, "tasks": ["7.3"] },
    { "id": 51, "tasks": ["7.4"] },
    { "id": 52, "tasks": ["8.1"] },
    { "id": 53, "tasks": ["8.2"] },
    { "id": 54, "tasks": ["8.3"] },
    { "id": 55, "tasks": ["8.4"] },
    { "id": 56, "tasks": ["9.1"] },
    { "id": 57, "tasks": ["9.2"] },
    { "id": 58, "tasks": ["9.3"] },
    { "id": 59, "tasks": ["9.4"] },
    { "id": 60, "tasks": ["10.1"] },
    { "id": 61, "tasks": ["10.2"] },
    { "id": 62, "tasks": ["10.3"] },
    { "id": 63, "tasks": ["10.4"] },
    { "id": 64, "tasks": ["10.5"] },
    { "id": 65, "tasks": ["11.1"] },
    { "id": 66, "tasks": ["11.2"] },
    { "id": 67, "tasks": ["11.3"] },
    { "id": 68, "tasks": ["11.4"] },
    { "id": 69, "tasks": ["12.1"] },
    { "id": 70, "tasks": ["12.2"] },
    { "id": 71, "tasks": ["12.3"] }
  ]
}
```
