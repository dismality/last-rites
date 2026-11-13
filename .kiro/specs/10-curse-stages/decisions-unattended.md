# Unattended decisions: spec 10 (curse stages)

Choices made without asking the user while running sub-tasks unattended. Each can be reversed.

## 1.1 Stage data

1. `LAST_NIGHT` and `NIGHT_FOG_DENSITY` stay in `balance.ts`, now derived from the stage data. Tasks 1.2 and 1.4 replace their remaining uses with stage numbers.
2. The five `NIGHTS` rows in `waves.ts` stay as the difficulty ladder (the bible says so). Endless Survival still plays them as nights.
3. The curse and altar-locked objective lines were added as new exports. They replace rule 1 of the objective tracker in 1.5.
4. `CaseId` lives in `stages.ts` for now. Task 2.1 can move it to `cases.ts`.
5. Altar captions are silent caption events. The wording is "[the altar is silent]" and "[a clear note from the altar]".
6. Max stamina is stored per stage in the stage data. The difficulty drain multiplier is not part of 1.1.

## 1.2 Pure stage system and endless waves

1. **Story nights are a new entry point, not a change to `startNight`.** `startStageNight(stage, doubt)` makes a `WaveState` with `stage` set; `tickWaves` hands such a state to a stage branch that never reaches `done` until `ctx.caseSolved`. `startNight`, `nightPlan` and `startRiteAssault` keep the finite five-night behaviour, because the live game (`WaveDirector`, `waveDirection`, the rite, about 20 test files) still depends on it. Task 1.4 switches the callers over and retires the finite story path.
2. **`dayNight.ts` gets an optional `caseSolved` input.** When it is set it replaces `wavesCleared`, and `lastNight` defaults to `STAGE_COUNT` (3). The old input stays the default so the running game is unchanged until 1.4. `stageDayNightInput(stageState)` builds that input.
3. **Wave composition is the running maximum of the ladder.** `stageWaveComposition` takes the per-type maximum of every earlier wave, so a wave is never smaller in total, strength or any type. Side effect: a Bloater or Brute that appears once in a stage stays in every later wave of that night.
4. **Ladder use inside a row clamps to the row's last wave.** Stage 1 waves 1-3 use row 1 (2 waves, so the last is repeated); wave 4 onward uses row 2. Escalation (+1 Shambler a wave, +1 Wailer then Lurker every third further wave) starts only past the last row's own waves, and stages with a later row start that row at wave 4.
5. **Pacing is inside the stage branch with no `gap` phase.** The next wave begins when `nextWaveDelay` reaches 0. Any queue left over from the previous wave is kept and the new wave is appended. `waveStarted` events from a Story night carry `total: 0`, meaning "no last wave". The initial wave 1 emits no `waveStarted`, as before.
6. **Elites and door attackers** in a Story night use a "feature night" of 1 for stage 1 waves 1-3 (none possible) and 2 otherwise, so the existing `rollElite` and `doorAttackerCount` rules apply unchanged.
7. **Day spawns nothing** through an optional `ctx.phase`; the stage branch returns early when it is `'day'`. A solved case sets the state to `done` and clears the queue in the same tick, with no `wavesCleared` event (the case-solved flag is what ends the night).
8. **Scare director:** `dayAdjusted` swaps `lurker-lunge` for `door-slam` when the phase is `day` (not dawn or dusk, which the bible does not mention).
9. **Added data constants** to `stages.ts`: pacing delays (20 / 60 s), the escalation interval, `DOUBT_MAX` 3, wave strength weights, and `STUCK_DESPAWN_S` 20. `shouldDespawnStuck` is the pure rule for the 20 s stuck despawn; the scene hookup is left for 1.4.
10. **Added `queueWaveNow(state)`** for the wrong-answer instant wave (Req 3.2), for 1.3/1.4 to call. The bell ringing 20 s before each wave (Req 2.9) is scene work and is not part of 1.2.
11. **`stageFog(stage, waveIndex)`** follows the ladder row a wave draws from (0.02 then 0.03 in stage 1), so fog is by stage row, not by wave count.

## 1.3 Pure altar answer rules

1. Dusk and dawn also refuse answers with `day`, since only night accepts them.
2. A new `wrong-accusation` verdict was added because the design had none.
3. The link rule applies only to case answers, but the lock also rejects accusations.
4. `ALTAR_LOCK_S` lives in `altarAnswer.ts`.
5. After 2 wrong answers even a correct answer needs a new link beyond the count at the last wrong answer.

## 1.4 Stores, loop wiring and persistence

1. **`worldStore.nightNumber` stays the source of the stage number.** `stageStore` follows it: a module-level subscription starts a fresh stage (unsolved, clock 0, altar forgets) when the night number maps to another stage (dawn to day). Night numbers clamp to 1..3 (`stageOfNight`). Loads and Retry restore the stage store after the world store, so the saved block wins over that sync.
2. **The altar lock runs on `nightElapsed`**, a per-night clock in `stageStore` (ticked by `tickStageClock` in `GameLoop`, only at night, stopped once solved). `beginNight` (from WaveDirector's `nightStarted`) and `resetNight` (inside `clearNightState`) zero the clock and the lock but keep `wrong` and `linksAtLastWrong`. Retry Night restores those two from the snapshot.
3. **`stageStore.giveAltarAnswer(correct, links, kind)`** applies the `giveAnswer` verdict: solved sets the case flag, wrong queues an instant wave (`queueWaveNow`) and stores the lock. The verdict stays injected until task 2.
4. **Day/night input.** `deriveTickInput` adds `caseSolved` and `waveIndex` in story modes (and `lastNight` is `STAGE_COUNT`); `TickInput`/`DayNightInput` carry them. In stage mode fog is `stageFog(stage, waveIndex)` at night and the stage's first row otherwise. Endless is unchanged.
5. **Story nights use `startStageNight`** through `planNight` (total waves 0, so the wave tally hides). `startNight`/`nightPlan` remain for Endless and a few legacy tests. `clearedRoute` and `survivedCap` use `STAGE_COUNT` for story modes; `runStats` uses `STAGE_COUNT` for "nights survived of N" and the finalised ending.
6. **Rite stays reachable on stage 3 (until task 4).** `riteAvailability` takes `finalNight` (default `STAGE_COUNT`); story passes 3, Endless passes `Infinity` (it used to offer the rite on Endless night 5, a quirk). Because story waves never end, the objective's `rite.available` no longer waits for `nightFiveCleared` in story modes. The `taken` ending only fires from the legacy `wavesCleared` flag, which story never sets, so a stage 3 night cannot end in Taken by clearing.
7. **Dev hooks.** `skipToNight` clamps to a stage in story modes; "spawn wave" uses `stageWaveComposition`; "Clear night" calls `solveCase` for stages 1 and 2 and keeps the old `setNightFiveCleared` for stage 3; `setTime('dawn')` and the debug hook's `skipToDawn` also call `solveCase`.
8. **Saves.** New `stage` block (`StageSave`) in the save file, always written. `migrateSave` (new `systems/stageSave.ts`) maps old story night 1..5 to stage 1, 1, 2, 2, 3 when the block is missing; Endless saves are not touched. `SAVE_VERSION` stays 1. Snapshots (`SNAPSHOT_STORES.stage`) and `resetRun` (replaced store) include the stage store.
9. **Not done here:** the 20 s stuck-zombie despawn (`shouldDespawnStuck`) has no scene hookup because nothing tracks "out of reach" time yet; the bell 20 s before each wave; Doubt in the first wave (`planNight` takes a `doubt` argument that defaults to 0; task 2.3 wires it). Collapse-to-dust and the sunrise effect for a solved case are task 1.5.
10. **Tests.** Old tests that encoded five story nights were updated (final rite uses night 3, runStats "of 3", `deriveTickInput` expects `STAGE_COUNT`, the wave-cleared test uses Endless). The legacy five-night checkpoint test passes `finalNight` 5 explicitly.
11. **Tooling note.** PowerShell `Set-Content` rewrote one BOM file (`runStats.ts`) in the wrong encoding; it was rebuilt from HEAD and checked with a UTF-8 round trip.

## 1.5 Solved sequence, objective, compass and HUD

1. **Solve sequence is three small parts, all hooked to the `stageStore.caseSolved` false-to-true edge at night** (so loads and retries that restore a solved flag do not replay it). `caseSolvedWatcher.ts` (installed in `main.tsx`) raises the "[a clear note from the altar]" caption, updates run stats and emits `nightCleared`, so the night score and Case bonuses run for story stages (before this nothing emitted it, because a solved stage never produced a `wavesCleared` event). `scene/enemies/CaseCollapse.tsx` applies the pure `collapseLiving` (`systems/caseCollapse.ts`) to the enemy store and queues dust puffs on the existing `meleeRuntime.dustQueue` that `DustBurst` draws. Dawn itself is still `tickDayNight` seeing `caseSolved` (1.2/1.4); the dawn summary is built by the existing `dawnStarted` handler.
2. **Collapse:** living zombies (dormant Lurkers included) go straight to `dying` with no `enemyCollapsed` event, so they score nothing and drop nothing. Father Crane is skipped: the rite ends him. Dust is soft grey and steady; with Camera shake or Flashing lights off, or `prefers-reduced-motion`, each zombie gets 1 puff instead of 3 (constants in `stages.ts`).
3. **Dawn unlocks:** nothing called the dawn recipe unlock before (the old `dawnStarted` unlock event was never dispatched), so `unlockStageRecipes` now adds the ending stage's `dawnUnlocks` on `dawnStarted` in story runs. The dawn card's "New recipe" lists those recipe outputs, joined with commas, in story modes; Endless keeps the old per-night lookup. The bible's "blessed-rounds survive night 2" and tier E4 are not changed.
4. **Objective:** `ObjectiveInput.stage` is optional, so Endless and the older property tests are untouched. With it, a story night is rule 1 with the curse line (never a wave count), the altar as the marker/compass target, `curse` ({value, max}) on the result, and the second line `""` (the HUD draws the meter there) or "The altar is silent: m:ss" while locked. The rite rules 2 and 3 come before it and apply on stage 3 only (not night number 5). Rule 11 by day reads "Solve the case: <title>" (", clues N/M" once the case board supplies counts).
5. **Not done in 1.5:** the per-stage day rules 5-10 from `STAGE_DAY_RULES` (their minigames do not exist until tasks 3-5; the older key/whistle/relic day rules still run), the live curse links (`curseLinks` is 0 until the case board in task 2 counts correct links), and the clue counts. Curse meter max is `CURSE_MAX` = 10 in `stages.ts`.
6. **Compass:** no code change was needed; the objective marker already follows the rule's `place`, so at night it points at the altar with its distance (new test). The merchant marker is unchanged.
7. **Altar captions:** `giveAltarAnswer` now raises "[a sour note from the altar]" on a wrong answer and "[the altar is silent]" on a locked one. There is no audio voice for these yet (the listener ignores ids it has no recipe for), so the caption is the only cue; a sound can be added with the audio work later.
8. **Still open from 1.4** (neither is in 1.5's text): the bell 20 s before each wave (Req 2.9) and the 20 s stuck-zombie despawn (`shouldDespawnStuck`). Both are scene work; suggest doing them with 1.7 (stage loop e2e) or as a small follow-up.
9. **HUD:** new `CurseMeter.tsx` (number "Curse 7 / 10" plus bar, `role="meter"`, no animation beyond a 300 ms width ease that reduced motion drops).

## 1.6 Dev hooks for stages

1. **Skip to stage N goes to the start of that stage's day**, not to the night (the old "Night N" buttons still reach the night). It sets the night number, starts the stage explicitly (the world subscription does nothing when the number is unchanged), resets the fight and emits `phaseChanged`.
2. **Key items and pages held at stage start** are a table in `devData.ts`: stage 2 holds the Rusted Crypt Key and pages 1-2; stage 3 adds the Bone Whistle and page 3 (which teaches the Salt Circle). The Iron Ossuary Key is not granted (it is stage 3 content). Recipes are the `dawnUnlocks` of every earlier stage, read from the stage data. Skipping backwards never removes items.
3. **"Solve current case"** calls `stageStore.solveCase()`, the real action. The Case store does not exist yet (task 2), so "Give all clues" and "Solve current minigame" (Req 5.3) and `caseState()` (Req 5.5) are left for the tasks that add them.
4. **Debug hook:** added `stageState()`, `skipToStage(n)` and `solveCurrentCase()`; every earlier call is unchanged. `debugHook.ts` imports `devActions` statically; it is dev-only code already.
5. **Tests:** `src/dev/devStages.test.ts` (stage start, recipes, key items, solve once). The existing `devMode.test.ts` was left alone.

## 1.7 Stage loop e2e

1. **Two tests in `e2e/stage-loop.spec.ts`.** (a) Stage 1: no zombies by day, wave 1 spawns at night, `killAll` loops until wave index 1 (the night does not end by clearing), then `solveCurrentCase` ends spawning (wave state `done`), the world goes to dawn, every zombie fades out, and the event log holds `nightCleared` and `dawnStarted`. (b) Stage 2: `skipToStage(2)` has an empty day, die and Retry Night return to dusk in stage 2 unsolved, and Continue restores stage 2.
2. **Waits** are polled state or rendered-frame counts; no fixed sleeps. The next wave is reached by killing each spawn (the 20 s gap runs on sim time), so the run takes about 50 s a test.
3. **Continue test uses `setClock({ night: 3 })` to change stage after the save.** `skipToStage` goes through `phaseChanged` to `day`, which fires the new-day autosave and would overwrite the manual save. That autosave is by design, not a bug.
4. **No game bug found**, so no game code changed. The "collapse" is checked by the end state (all zombies removed, wave state `done`), not by the dust puffs, which are not readable from the hook.
5. **Not covered:** the bell 20 s before waves and the 20 s stuck despawn (still open from 1.4).
6. Results: the spec passes (2 tests), `npm run lint` clean, `npm run build` passes (chunk-size warning only), `npx vitest run` 2016 tests pass.

## 1.8 Finish

1. **The two items open since 1.4 were already built and committed in da3d609**, so they are closed here, not moved to a later task: the bell rings once, 20 s before each wave, when bell repair stage 3 is built (`bellDue` in `stageWaves.ts`, called from `WaveDirector.tsx`, sound `toll`), and a chasing zombie more than 4 m from the player that stays within 1 m of one spot for 20 s is despawned and counted as banished (`updateStuck` and `shouldDespawnStuck`, with the constants in `stages.ts`). Both have unit tests in `stageWaves.test.ts`. The notes in 1.2 item 10, 1.4 item 9, 1.5 item 8 and 1.7 item 5 that call them open are out of date.
2. **The bible got one clarification** in §8 (what "stuck" means). No number changed, so nothing else needed fixing.
3. Doubt in the first wave stays with task 2.3 (`planNight` takes a `doubt` argument that defaults to 0).
4. Gate: lint, build, 2043 unit tests, and `stage-loop`, `smoke`, `dev-panel` (5 Playwright tests, main project) all pass.

## 2.1 Case types and data shells

1. **`CaseId` stays defined in `stages.ts`** (avoids an import cycle, since `cases.ts` imports `StageNumber`); `cases.ts` re-exports it.
2. **Types follow the design's Data Models**, with `ClueId` as a union of three per-case unions (`Case1ClueId` and so on). `ClueDef.icon` is `InteractRuneId | MarkId` (the design's `RuneId` does not exist). `ClueSourceDef` is `minigame | walk | purchase | item`; no clue uses `item` yet.
3. **Clue counts:** case 1 has 7 clues (2 red herrings), case 2 has 6 (2), case 3 has 8 (2). Case 2's fallback clues for 2a and 2c (design "Cuts are safe") are not added; they belong with the cut plan in tasks 3 to 5.
4. **The Vane & Sons receipt is a case 3 clue with a `purchase` source**, not a stage 1 clue. The merchant first opens at the dawn ending stage 1, so the reachability test allows purchases from stage 2 on. The bible says the receipt comes with the first purchase in stage 1; the case 3 clue set is what the board shows once stage 3 starts.
5. **Case 3's `final` is the rite** (five slots of relic names, answer in the bible's relic order as a placeholder); the optional Silas accusation is `accusation` with `optional: true`. Task 4 sets the real rite order from Crane's confession. Case 2's final uses four slots (who, motive, means, opportunity).
6. **Walk clue positions are first guesses** (grounds, Mausoleum Row, chapel, catacombs); the props in tasks 3 to 5 set the real ones. Minigame internals (ledger rows, bell posts, hymn board and so on) are not in this shell.
7. **Curse steps** are `DEFAULT_CURSE_STEPS` = 10 per case, matching `CURSE_MAX`; hint prices are 5, 10 and 20 (`HINT_COSTS`).
8. **Closed-case pages** (4 sentences each) are in `caseText.ts`, one sentence per entry.
9. **Tests** in `cases.test.ts` cover Property 17 (6 to 8 clues, 2+ red herrings, reachable sources by stage, every needed clue linked, every minigame yields a clue) and Property 18 (unique ids, notes reference clues, answers within options, slot counts). They are plain table checks, not fast-check, because the data is fixed.
10. Gate: lint clean, build passes (chunk-size warning only), `npx vitest run` 2061 tests pass. Not committed (2.8).

## 2.2 Pure case systems

1. **Four modules, as the design lists:** `caseBoard.ts`, `caseAnswer.ts`, `caseHints.ts`, `caseScore.ts` in `src/game/systems/`, each with a matching test. `checkMinigame` from the design's `caseAnswer.ts` is not built: minigame verdicts belong to `caseMinigames.ts` in tasks 3 to 5.
2. **Board state is a list of unique sorted `linkKey` strings.** Wrong pairs are kept on the board (the string is drawn, no note, no cost). A self link or an unknown clue id returns the same board object. The Curse meter is `curseSteps` minus the count of links that match a note, so with the current data (3 or 4 notes, 10 steps) it cannot reach 0 by links alone. The altar answer, not the meter, ends the night; changing the step count or adding notes is a data call for a later task.
3. **Extras beyond the design:** `correctLinkCount`, `earnedNotes`, `visibleClues(stage, found)` (the per-stage clue set), and in `caseAnswer.ts` `checkAccusation`, `fillSlot` and `isAnswerComplete` for the board and altar slots. `checkFinalAnswer` takes `(string | null)[]`; a wrong length or any empty slot is rejected.
4. **Hints:** `HintState` is `{ revealed: 0..3 }`. `nextHint` returns `revealed` with `tier` and `cost` (the caller subtracts the coins) or `refused` with `no-coins` or `all-revealed`. A free tier 3 (Story, night time at least 180 s, `FREE_TIER3_AFTER_S`) still counts as a hint used for Sharp Eye (Req 9.9). Outside Story it costs 20.
5. **Doubt:** `DoubtState` is `{ nightId, doubt }`; `applyDoubt` restarts at 1 when the night id changes, otherwise adds 1 up to `DOUBT_MAX`. `doubtForNight` gives the value for the night that starts (0 for another night id), to feed `addDoubt` in 2.3. The 50-point penalty is the constant `DOUBT_SCORE_PENALTY`; applying it to the score is store work (2.3). `Case_Closed` (Req 9.7) is not here.
6. **Properties 8, 12, 13, 14, 15, 16** (final answer and accusation) are fast-check tests in the four test files. Property 8 is covered at the pure level (`visibleClues`); the store half stays with 2.3.
7. Gate: lint clean, build passes (chunk-size warning only), `npx vitest run` 2081 tests pass. Not committed (2.8).

## 2.3 Case store and persistence

1. **`caseStore.ts`** holds `cases` (per case: found clues, links, solved minigames, slots, hints, wrong answers), `doubt` and `closed`. Actions: `findClue`, `link` (only found clues of the active case), `fillSlot`, `submitMinigame` (right: solved and yields its clues; wrong: wrong answer, and by day one Doubt and -50 score), `giveAnswer`, `useHint` (coins), `closeCase`, `doubtForStage`. Rules stay in the pure `case*.ts` systems.
2. **`economyPort.ts`** lets the case store read coins, add coins and score and ask for Story mode without importing `progressionStore` (import cycle). `progressionStore` registers it.
3. **Altar:** `giveAnswer` runs `checkFinalAnswer` on the filled slots and passes the result to `stageStore.giveAltarAnswer(correct, links, 'case')`. An empty slot returns `incomplete` and changes nothing. Only a `wrong` verdict counts as a wrong answer for Sharp Eye (a locked answer was never judged). The altar UI that calls it is task 2.5.
4. **Doubt:** `WaveDirector` passes `doubtForStage(night)` to `planNight` in story modes. Doubt applies only to the night id it was earned for. A Doubt at its cap adds no further -50.
5. **Scoring:** the -50 is taken when Doubt is earned. Sharp Eye (+300, story only, times the mode multiplier) is added to the night's clear bonus in `onNightCleared`, so the dawn card total includes it. `caseSolvedWatcher` closes the case after the score event. The progression checkpoint test now expects 400 clear bonus for night 1.
6. **Curse meter:** `guidanceTick` feeds `selectCorrectLinks` into the objective, so `CurseMeter` falls one per correct link (it was fixed at 10/10). `CurseMeter.tsx` is unchanged; the max is still `CURSE_MAX` (10), which equals every case's `curseSteps`. If a case's steps ever differ, the objective input must carry the max.
7. **Persistence:** new `caseSave.ts` (`freshCaseSave`, `sanitizeCaseSave` drops stale ids, `mergeRetry`). `gameSave`/`saveGame` write a `case` block (old saves load a fresh one). Snapshots use `caseSnapshot`: on Retry Night and Retry from morning, found clues, links and solved minigames are the union of the snapshot and now; Doubt, wrong answers, hints, slots and the closed list come from the snapshot. `resetRun` replaces the store (New Game).
8. **Properties 8, 9, 10** are covered at pure level in `caseSave.test.ts` and `cases`/`caseBoard` tests, and at store level in `caseStore.test.ts` (Property 8 swap, save and Continue round trip, retry union, New Game reset).

## 2.4

- Files: `src/ui/journal/` gained `CaseBoard.tsx`, `ClueCard.tsx`, `RedString.tsx`, `caseBoardView.ts` (+ `caseBoardView.test.ts`) and a Case section at the end of `journal.css`. `Journal.tsx` has a "Case" tab after Clues.
- Right vs wrong link: right is a thick solid string with a round ✓ tag; wrong is a thin dashed string with a square ✗ tag. The live region also says "Right link: ..." or "Dashed string: ...". This does tell the player which pairs are true, but a right pair already shows its note, so no new information is given.
- Linking: pointer drag (6 px threshold, `elementFromPoint` on `data-clue-id`) or select a card and activate a second one (Enter/Space on the real `<button>`). Picking the same card again clears the selection. Esc is left to the journal (it closes it), so there is no Esc-to-deselect.
- Final question: inline native `<select>` slots (keyboard and screen reader friendly), filled through `fillSlot`. No submit here; a line says it is answered at the altar. The stage 3 accusation slots are not shown (not in 2.4's text, not in the store).
- Hints: three rows. Revealed tiers show text; the next tier has a button with its price in the label; later tiers are disabled with "Reveal hint N first". Tier 3 shows "free" via `nextHintCost` once the Story night has run long enough. A refusal shows a text reason.
- Plain-font setting: none exists in the project, so card text uses `--font-body` (not the Homemade Apple handwriting), min 16 px.
- Reduced motion: pin-in animation and the curse bar transition are off under `prefers-reduced-motion`; the theme tokens already zero the shared transitions.
- Captions: the board makes no sound, so none are needed.
- `useHint` is called through an alias (`buy`) so the hooks lint rule does not mistake it for a hook.
- Card layout is a fixed 4-column grid by clue index, so a card never moves when another is found. Up to 8 clues fit in 2 rows.
- Not done (later tasks): journal pause rule, Closed cases tab, altar panel (2.5); screenshots and real-mouse e2e (2.7). No visual screenshot was taken, so layout at small sizes is unchecked by eye.
- Verification: `npm run lint` clean, `npm run build` clean, `npx vitest run` 262 files / 2104 tests pass, `playwright test smoke --project=main` 2 passed.

## 2.5

1. **`pausesSim(phase, open)`** is in `systems/journalPause.ts` (true only by day). `isSimFrozen` uses it for both the journal and the big map, so at dusk, night and dawn neither stops the world. `isMenuOpen` now lists `journalOpen` and `mapOpen` on their own, so they still hold the cursor (11h hook) and still make the scare director drop rolls (`ScareStager` passes `isMenuOpen()` as `uiBlocking`; a beat already queued waits while it is true). Scene systems that read `journalOpen || mapOpen` directly for simulation (`LanternTraps`, `SaltCircles`, `ThrownItems`, `Viewmodel`) now ask `isSimFrozen()`. Input-side readers (`MeleeAttack`, `ThrowControls`, `Satchel`, `BigMap` key guard) keep the raw flags on purpose: the player is reading, not fighting.
2. **Esc at night opens the pause menu over the journal or map** (Req 10.6). By day Esc still closes them. `handlePauseKey` asks `escClosesOverlay(phase, open)`; the Journal and BigMap Esc handlers use the same call. The pointer-lock-loss path still treats them as owners (opening one releases the cursor on purpose), so it never pauses by itself. After resume the page is still open.
3. **Night look:** journal gets `journal--running` (translucent dim backdrop) and a dashed-frame line "The world is still moving. Esc pauses." The big map is an opaque sheet, so it only gets that line in its help panel. No new sound, so no new caption.
4. **Tutorial step 8** "Open the Case tab in the journal to pin clues together" (action `openCaseTab`, event `caseTabOpened` emitted when the Case tab shows). `TutorialStepId` and `parseTutorial` now go to 8; the tests that fixed 7 were updated. Old saves with steps 1 to 7 done will show step 8 on day 1 only, as the prompt is a first-day one.
5. **Closed cases tab** (`ClosedCases.tsx`) lists `caseStore.closed` in case order with the `caseText.ts` page, read-only. `closed` is already saved by 2.3, so it survives Continue. The tab sits after Case.
6. **Altar panel** (`ui/hud/AltarPanel.tsx`, `altarPanelView.ts`, `altarPanel.css`) is opened by a new `case-altar` interactable (action `open`, so the prompt is "E: Open" with the existing rune; repeatable, idle prompt "The curse does not stir by day" by day, dusk and dawn). The panel shows the question with native selects bound to `caseStore.fillSlot`, the lock countdown ("The altar is silent: 0:24"), the link-needed text, wrong-answer count, and an Answer button that calls `caseStore.giveAnswer`. `altarStatus` reuses `giveAnswer` from `altarAnswer.ts` (answer assumed right) so the panel and the store cannot disagree. A solved case closes it and the task 1 sequence runs. It opens by day too and then only explains why it is silent (Req 3.5).
7. **State flag:** `overlayStore.altarPanelOpen`. It counts in `isOverlayOpen` (cursor free, scares blocked, no pause on lock loss), does not freeze the world, owns Esc (capture handler, same as the workbench), and is cleared by `resetRun`, by being taken and by leaving the game screen.
8. **Altar spot sharing.** The whistle hotspot used to be the only interactable at the altar. It now mounts by day only, and `CaseAltar` steps aside while (whistle held, stair sealed, day). So at night the stair cannot be opened until the next day; stage 3's catacombs are a day task, so this should not block anything, but it is a behaviour change. `CaseAltar.onInteract` does nothing while `readRiteStatus().availability === 'ready'`, so the stage 3 rite hold still works until task 4 replaces it; the stage 3 case answer is not reachable through the panel while the rite is ready. The altar heal tap (Chapel.tsx) is unchanged and can fire on the same press as the panel.
9. **Not done:** no sound for the panel (the wrong and locked captions come from task 1), the Accusation block (task 4.6), screenshots and the real-mouse e2e (2.7). Layout of the panel and the night journal was not looked at by eye.
10. Gate: `npm run lint` clean, `npm run build` passes (chunk-size warning only), `npx vitest run` 2120 tests pass, Playwright `stage-loop smoke big-map --project=main` 9 passed. Not committed.

## 2.6

- Dev actions live in `src/dev/devActions.ts` and use only real store actions: `giveAllClues` (`findClue` per clue), `giveClue`, `solveCurrentMinigame` (`submitMinigame(id, true)`, first unsolved minigame of the active case, so it works now even though the overlays arrive in tasks 3 to 5), `linkClues` (`link`), `setAltarPanel` (overlayStore), `unsolvedMinigames`.
- Dev_Panel "Time" section gets a row with "Give all clues" and "Solve current minigame".
- Debug hook additions: `caseState()`, `minigameState()` (`{all, solved, unsolved}`), `giveAllClues()`, `giveClue(id)`, `solveCurrentMinigame()`, `linkClues(a, b)`, `setAltarPanel(open)`. Existing hook calls are unchanged.
- No hook opens the Case tab: the journal tab is local React state, so the 2.7 e2e should press J and click or arrow to the Case tab, as a player does (this also exercises `caseTabOpened`).
- Tests: `src/dev/devCase.test.ts`. Verified: lint, build, vitest (265 files, 2125 tests) and `dev-panel stage-loop` e2e (3 passed).

## 2.7

1. **`e2e/case-board.spec.ts`, four tests.** (a) Mouse: drag a right pair (Pell rope and tag), which shows the ✓ tag, the "Right link" note, a Deductions entry and Curse 9 / 10. Then drag a wrong pair (flowers and toppled stone), which shows a ✗ square tag, a dashed string, "Dashed string" text and no meter change. A computed-style check confirms the wrong string has a different dash pattern and is thinner. Then a keyboard link (focus, Enter, focus, Enter) brings it to Curse 8 / 10, re-linking says "already joined", both slots are filled through the `<select>`s, and hint 1 is bought (disabled with "Needs 5 Grave Coins" at 0 coins, revealed at 12 coins leaving 7, and tier 2 then disabled at 10). (b) Keyboard only: J, arrows to the Case tab, Tab to cards, Enter links two right pairs, Tab to a slot, ArrowDown fills it, Esc closes. (c) The day journal freezes `phaseTime`; the night journal keeps it moving, shows "The world is still moving", and Esc opens pause. (d) Altar at night: a wrong answer gives "A sour note", the "silent: 0:2x" countdown going down, wrong count 1, and zombies on a field that was empty. Answering while locked is refused. After the lock, the right answer solves the case and dawn plays. Digit1 picks the boon. Next day, the Closed cases tab shows "1 of 3" and the case 1 page, stage 2 has begun, and `closed` holds case 1.
2. **Dev-hook setup only:** `giveAllClues`, the clock skips, `killAll` (so the instant wave can be seen on an empty field), `setAltarPanel(true)` (instead of walking to the altar), and a new **`setCoins(n)`** in `debugHook.ts` (real `progressionStore.setCoins`) for the hint price check.
3. **Fake pointer lock vs Tab:** `input.ts` swallows Tab while the canvas counts as locked, and the hook's `lockless` makes it look locked always. A real player's cursor is free with the journal open, so the keyboard-only test calls `lockless(false)` first. This is harness behaviour, not a game bug. Same for the dawn picker, which is now picked with its own Digit1 shortcut (`dawn-picker.spec.ts` covers its mouse path).
4. **Game bug fixed (CaseBoard.tsx):** after a drag that ended on the cork or on another card, the browser fires no click. But `suppressClick` stayed true and swallowed the player's next real click on a card. It is now cleared on the next tick. This lives in the component's pointer handling with no pure logic to pull out, so there is no unit test; the e2e drags and then clicks.
5. **Layout fix (journal.css):** at 800x600 the cork was `min(46vh, 26rem)` = 276 px → 18rem (288 px) tall, so the second row of cards was cut off at the bottom. The cork is now 27rem (min 24rem), and the journal panel scrolls. Checked by eye at 1280x720 and 800x600.
6. **Screenshots:** `e2e/screenshots/case-board-*`, `case-altar-*`, `case-closed-*` at 1280x720 and 800x600. The board shot has 7 cards, 3 strings (2 right, 1 wrong) and the note. The Closed cases shot is taken by day, because the dawn summary card sits over the journal during the 10 s of dawn.
7. **Seen but not fixed (outside 2.7):** the compass draws the "Chapel" and "Hut" labels on top of each other when their bearings are close (visible in the altar shots). Captions draw over the journal (by design, subtitles stay on top).
8. Results: `case-board` 4 passed (about 48 s). `npm run lint` clean. `npm run build` passes (chunk-size warning only). `npx vitest run`: 2124 pass, 1 fails, `tests/progressionRules.test.ts` "no binary assets". That failure comes from untracked `public/assets/models/props/*.glb` and `scene/*` files that are not part of this task and were left alone.
