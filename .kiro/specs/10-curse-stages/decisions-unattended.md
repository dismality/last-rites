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
