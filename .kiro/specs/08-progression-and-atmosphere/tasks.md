# Implementation Plan: Progression and Atmosphere

## Overview

**Do not start until spec 07's checkpoint is done and the user has said to begin spec 08.**

Data comes first (every **(08)** row of `docs/game-design.md` §12 and its "Placements and tuning (08)" table goes into `src/data/`, with data tests against the bible). Pure systems follow, each with its fast-check property tests in the same task (required, not optional). Then stores and glue (`progressionStore`, `scoreStore`, `coinStore`, `achievementStore`, `overlayStore`, `simClock`, `progressionTick`, `progressionEvents`, `progressionActions`, `progressionPersistence`, `derivedStats`, `endlessBest`), the dawn hold and the Endless wave plan, scene components, UI screens, procedural music, rain and thunder on the 07 synth, save, Retry Night and New Game, and a real-browser playtest. Every sub-task ends with the same closing step, called **Finish** below:

- **Finish:** run `npm run test`, `npm run lint` and `npm run build`, fix any failures, then append an entry to `docs/kiro-log.md` headed with the real date the task is actually finished, in the format from `.kiro/steering/kiro-log.md`.

## Tasks

- [x] 1. Progression data and data tests
  - [x] 1.1 Types, events, seeds and shared constants
    - `src/game/types.ts`: `ModeId`, `DawnUpgradeId`, `ContractId`, `AchievementId`, `MerchantRowId`; `GameEvent` gains `meleeHit`, `nightCleared` and `thunderRolled`
    - `balance.ts`: `DAWN_AFTER_PICK_S`; `items.ts`: `SATCHEL_SLOTS_MAX` (14)
    - `rng.ts`: `deriveSeed(seed, tag, n)` (FNV-1a over the tag mixed with seed and n, `>>> 0`)
    - Unit tests: `deriveSeed` is deterministic, differs for different tags and `n`, and returns an unsigned 32-bit integer
    - Finish
    - _Requirements: 1.2, 4.3, 7.1, 10.3, 14.3_

  - [x] 1.2 Upgrade and score data
    - New `dawnUpgrades.ts` (`DAWN_UPGRADES` in §12 order with max ranks 2,2,2,1,2,1,1,2,1,1 and a rune each, `UPGRADE_PER_RANK`, `OFFER_SIZE`) and `scoring.ts` (`KILL_POINTS`, `BOSS_POINTS`, `ELITE_POINTS_MULT`, `HEADSHOT_BONUS`, `COMBO`, `NIGHT_SCORE`)
    - `dawnUpgradesData.test.ts`, `scoringData.test.ts`: every value equals the §12 tables, and a failing test names the id and field
    - Finish
    - _Requirements: 1.1, 2.9, 14.3, 14.4_

  - [x] 1.3 Coin, merchant and contract data
    - New `graveCoins.ts` (`COIN_DROPS`, `ELITE_COIN_BONUS`, `COIN_PILE`), `merchant.ts` (`MERCHANT_ROWS` with the 10 rows, fixed or pool and weapon needs, `MERCHANT_STAY_S`, `MERCHANT_RANGE_M`, `FIXED_ROWS`, `POOL_ROWS`, `MERCHANT_SPOT`) and `contracts.ts` (`CONTRACTS` with 8 rows and their requirements, `CONTRACTS_PER_DAWN`, `UNHURT_MAX_DAMAGE`, `MELEE_SOURCES`)
    - `graveCoinsData.test.ts`, `merchantData.test.ts`, `contractsData.test.ts`: values equal §12 and the Placements table (cart at (−9, 0, 37), Silas at (−7.2, 0, 36.2))
    - Finish
    - _Requirements: 4.11, 5.6, 6.9, 14.3, 14.4_

  - [x] 1.4 Mode and achievement data
    - New `modes.ts` (`MODES` for easy, normal, hard and endless, `DEFAULT_MODE` normal, `ENDLESS`, `ENDLESS_BEST_KEY`) and `achievements.ts` (`ACHIEVEMENTS` with 12 rows, `ACHIEVEMENTS_KEY`, `TOAST`, `ACHIEVEMENT_THRESHOLDS`)
    - `modesData.test.ts`, `achievementsData.test.ts`: values equal §12, ids are unique, every goal text is non-empty, Normal is the default, Endless equals Normal modifiers with a 120 s day and no Retry Night
    - Finish
    - _Requirements: 7.1, 7.2, 7.7, 8.1, 14.3, 14.4_

  - [x] 1.5 Storm, music, caption and sound data
    - New `storms.ts` (`STORM_CHANCE_NIGHT`, `STORM_CHANCE_DAY`, `STORM`, `LIGHTNING`, `RAIN`) and `music.ts` (`MUSIC`, `STEM_WEIGHTS`, `SYNTH_MUSIC` tuning)
    - `captions.ts` and `sounds.ts` (07): rows and recipes for `thunder-close`, `thunder-far`, rain noise, and the captions "[thunder]", "[a hearse cart creaks to the gate]", "[the hearse cart rolls away]", "[+N grave coins]", "[contract done: NAME]" and "[achievement: NAME]"
    - `stormsData.test.ts`, `musicData.test.ts`: values equal §12 (chances 0, 25, 40, 50, 100 and 15% for a day, layer distances 6, 15, 30, 600 streaks), every new `SoundId` has a recipe, every new caption maps to a sound or event
    - Finish
    - _Requirements: 9.1, 9.3, 10.1, 10.2, 10.14, 12.8, 14.3, 14.4_

  - [x] 1.6 Layout clearance and bible equality
    - `progressionLayout.test.ts`: `MERCHANT_SPOT` is at least 5 m from every `WAVE_GRAVES` entry, outside the chapel box and inside the south fence; elite multipliers used by the mode data equal 07's `ELITE`
    - `progressionData.test.ts`: a literal copy of the §12 tables compared with every new data file; a mismatch fails with the value's name
    - Finish
    - _Requirements: 5.1, 14.3, 14.4_

- [x] 2. Pure systems with property tests
  - [x] 2.1 Dawn upgrades: offer, pick and modifiers
    - New `src/game/systems/dawnUpgrades.ts`: `rankOf`, `belowMax`, `offerUpgrades` (partial Fisher-Yates over the upgrades below max), `pickUpgrade`, `Modifiers`, `IDENTITY_MODIFIERS`, `modifiersFromRanks`, `upgradeCard` (built from before and after modifiers)
    - `dawnUpgrades.test.ts` with fast-check
    - **Property 1: Upgrade offers are valid and seeded**
    - **Property 2: A pick changes exactly one rank**
    - **Property 3: Modifiers are identity at rank 0, follow §12, and never get worse**
    - **Property 4: Upgrade cards are complete**
    - Finish
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 1.12, 1.13_

  - [x] 2.2 Dawn hold, day length and last night
    - `dayNight.ts`: `DayNightInput` gains `holdDawn`, `dayLengthS` and `lastNight`; dawn freezes `phaseTime` and emits no event while held; the night number is capped at `lastNight`
    - Updates to `dayNight.test.ts` with fast-check
    - **Property 5: A pending pick holds dawn and nothing else**
    - Finish
    - _Requirements: 1.5, 7.7, 12.11_

  - [x] 2.3 Mode multipliers and lantern drain
    - New `modes.ts` system: `spawnMultipliers`, `endlessHpScale`, `lanternDrainMultiplier`; `lantern.ts`: `tickLantern(s, dt, phase, drainMult = 1)`
    - `modes.test.ts` with fast-check, updates to `lantern.test.ts`
    - **Property 20: Mode multipliers match the table**
    - Finish
    - _Requirements: 7.3, 7.4, 7.5, 7.9, 10.5_

  - [x] 2.4 Endless wave generator, plan and best score
    - New `endless.ts` (`endlessNight`, `parseBest`, `updateBest`); `waves.ts` system: `WaveState.plan` and `night: number`, `tickWaves` reads the plan instead of `NIGHT_MAP`, `nightPlan(mode, night)`
    - `endless.test.ts` with fast-check, updates to `waves.test.ts` (existing seeds give the same story waves)
    - **Property 21: The Endless generator is well formed**
    - **Property 22: The Endless best only goes up and survives bad storage**
    - Finish
    - _Requirements: 7.8, 7.10, 7.11, 7.12, 7.13, 7.15, 7.16_

  - [x] 2.5 Score and combo
    - New `score.ts`: `applyKill`, `applyBoss`, `tickCombo`, `nightScore`, `comboView`; unknown enemy ids, repeated uids and `father-crane` kills change nothing
    - `score.test.ts` with fast-check
    - **Property 6: Kill points follow the formula**
    - **Property 7: Combo window and decay**
    - **Property 8: Score and combo invariants, determinism and spaced kills**
    - **Property 9: Repeated and unknown events are ignored** (the score half)
    - **Property 10: Night score and the boss bonus**
    - Finish
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.10, 2.11, 2.12, 7.6_

  - [x] 2.6 Run stats
    - `runStats.ts`: extended `RunStats`, `recordKill`, `recordMeleeHit`, `recordShot`, `recordCombo`, `recordTime`, `recordCoins`, `recordDig`, `recordBoard`, `accuracyPercent`, `formatTime`, `formatAccuracy`, `statRows`, `serializeStats`, `parseStats`, `recordNightSurvived(s, night, cap)`
    - Updates to `runStats.test.ts` with fast-check
    - **Property 9: Repeated and unknown events are ignored** (the stats half)
    - **Property 11: Run stats are consistent**
    - **Property 12: Stats formatting and round trip**
    - Finish
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10, 3.11_

  - [x] 2.7 Grave coins
    - New `coins.ts`: `coinDrop`, `addPile` (merge within 1 m, the oldest pile returned as overflow at the cap), `stepPiles`, `pileScale`
    - `coins.test.ts` with fast-check
    - **Property 13: Coin drops follow the table and the seed**
    - **Property 14: Coin piles collect once, expire and never lose coins to the cap**
    - Finish
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.10_

  - [x] 2.8 Merchant stock and purchases
    - New `merchant.ts` system: `dealStock`, `merchantPresent`, `withinTradeRange`, `tryBuy` (sold out, then coins, then space, on a copy), `canOpenMerchant`
    - `merchant.test.ts` with fast-check
    - **Property 15: Merchant presence and menu gates**
    - **Property 16: Dealt stock is valid**
    - **Property 17: Purchases are atomic and conserve value**
    - Finish
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.9, 5.10, 5.13, 5.14, 5.15, 5.16, 12.10, 13.1, 13.2, 13.3, 13.4_

  - [x] 2.9 Side contracts
    - New `contracts.ts` system: `possibleContracts`, `dealContracts`, `advanceContracts`, `finishNight`; `c-boards-3` needs a built barricade and `c-wailer-2` needs at least 2 Wailers in the coming night
    - `contracts.test.ts` with fast-check
    - **Property 18: Contracts are dealt validly**
    - **Property 19: Contract progress is monotone, capped and paid once**
    - Finish
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.10, 6.11, 6.12_

  - [x] 2.10 Achievements
    - New `achievements.ts` system: `evaluateAchievements`, `parseUnlocked`, `serializeUnlocked`, `queueToasts`
    - `achievements.test.ts` with fast-check
    - **Property 23: Achievement storage round trip and sanitising**
    - **Property 24: Achievements unlock once and never shrink**
    - Finish
    - _Requirements: 8.2, 8.4, 8.9, 8.11, 8.12, 8.13_

  - [x] 2.11 Music layer
    - New `musicLayer.ts`: `musicLayer` as the first-match rule with inclusive limits, infinite distance when no zombie exists
    - `musicLayer.test.ts` with fast-check against a reference implementation
    - **Property 25: The music layer is a monotone pure function**
    - Finish
    - _Requirements: 9.1, 9.10, 9.11, 9.12_

  - [x] 2.12 Music mixer
    - New `musicMixer.ts`: `initMixer`, `stepMixer`, `currentWeights`; retargeting mid-fade starts from the current weights; master falls over 0.3 s while silent and rises over 2 s afterwards, and the fade keeps tracking the layer while silent
    - `musicMixer.test.ts` with fast-check
    - **Property 26: Crossfades are continuous and frozen by pause**
    - **Property 27: Scare silence covers the window and tracks the layer** (the mixer half: master timings and tracking while silent)
    - Finish
    - _Requirements: 9.2, 9.5, 9.7, 9.9_

  - [x] 2.13 Scare silence schedule
    - New `scareSilence.ts`: `emptySilence`, `announce`, `fired`, `isSilent`, `majorScareActive`, `beatImminent`
    - `scareSilence.test.ts` with fast-check, including the mixer integration at every Scare intensity
    - **Property 27: Scare silence covers the window and tracks the layer** (the schedule half: on from announcement to 2 s after the later beat, a pending beat keeps it on)
    - Finish
    - _Requirements: 9.5, 9.6, 9.7, 13.5_

  - [x] 2.14 Storm rolls and lightning schedule
    - New `storm.ts`: `StormState`, `stormChance`, `rollStorm`, `startStorm`, `tickStorm` (strike gaps 20 to 45 s, thunder delays 1 to 4 s, a strike waits while a beat is pending and keeps its thunder delay)
    - `storm.test.ts` with fast-check
    - **Property 28: Storm rolls follow the table**
    - **Property 29: Lightning and thunder timing is seeded and bounded**
    - **Property 30: Lightning never starts within 1.5 s before a beat**
    - Finish
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.16, 10.17, 10.18, 13.6, 13.7, 13.8_

  - [x] 2.15 Lightning envelope, storm end and modifiers
    - `storm.ts`: `lightningLevel` (fast and slow variants), `endStorm` (cancels strikes, keeps scheduled thunder), `stormModifiers`, `thunderShakes`
    - Additions to `storm.test.ts` with fast-check
    - **Property 31: Flash envelope and shake follow the settings**
    - **Property 32: Storm end and pause**
    - Finish
    - _Requirements: 10.5, 10.7, 10.8, 10.10, 10.11, 10.12, 12.6, 12.7_

  - [x] 2.16 Satchel slot limit
    - `inventory.ts`: `addItem(inv, id, qty, slotLimit = SATCHEL_SLOTS)`; `crafting.ts`: remove the duplicate `SATCHEL_SLOTS` and pass the limit through
    - Updates to `inventory.test.ts` and `crafting.test.ts`: a larger limit holds more stacks, the default still holds 12
    - Finish
    - _Requirements: 1.8, 5.9_

  - [x] 2.17 Stamina regen, dig time and flask radius hooks
    - `stamina.ts`: `tickStamina(..., regenMult = 1)`; `dig.ts`: `DigInput.durationS?` and `digProgress(state, durationS?)`; `projectiles.ts`: `throwFlask` takes `radiusBonusM`
    - Updates to `stamina.test.ts`, `dig.test.ts`, `projectiles.test.ts`: defaults unchanged, a multiplier of 1.25 raises regen by 25%, a 0.7 dig time shortens the dig, +1 m widens the flask radius
    - Finish
    - _Requirements: 1.8_

  - [x] 2.18 Progression save sanitising
    - New `progressionSave.ts`: `ProgressionSave`, `sanitizeProgression(raw, ctx)` field by field (mode, seed, ranks, pending pick, score, coins, contracts, stock, stats, storm), defaults for a missing object
    - `progressionSave.test.ts` with fast-check
    - **Property 33: Persistent state round trips and sanitises per field**
    - Finish
    - _Requirements: 1.11, 6.5, 11.1, 11.4, 11.5, 11.8, 11.9, 11.10, 11.11, 11.13_

- [x] 3. Stores and glue
  - [x] 3.1 Sim clock, overlay store and toast duration
    - New `simClock.ts` (plain object advanced only by the progression tick), `overlayStore.ts` (`merchantOpen`, `achievementsOpen`, `modeSelectOpen`); `toastStore.ts`: `push(text, durationMs?)` and `ToastMessage.durationMs`; `Toast.tsx` honours it
    - Unit tests: clock advances only when stepped, overlay flags toggle, contract toasts last 3000 ms, the default stays 2000 ms
    - Finish
    - _Requirements: 6.6, 12.9_

  - [x] 3.2 Progression store and persistence list
    - New `progressionStore.ts` (`mode`, `seed`, `ranks`, `pendingPick`, `dawnSummary`, `score`, `bossScored`, `coins`, `contracts`, `stock`, `stats`, `storm`) and `progressionPersistence.ts` (`PROGRESSION_PERSISTED`, `captureProgressionSave`)
    - Unit tests: initial state is the defaults, capture then sanitise returns the same state, coins never go below 0, the persisted list names every store field that is saved
    - Finish
    - _Requirements: 11.1, 11.4, 11.13_

  - [x] 3.3 Score and coin stores
    - New `scoreStore.ts` (combo, last kill time, seen uids, night counters, `resetNight`) and `coinStore.ts` (piles, `clear`)
    - Unit tests: `resetNight` clears the combo and counters, `clear` empties piles, a restored store equals a fresh one
    - Finish
    - _Requirements: 2.3, 4.5, 11.6_

  - [x] 3.4 Achievement store and Endless best
    - New `achievementStore.ts` (`unlocked`, `visible`, `queued`, `unlock`, `resetSession`; own storage key; a failed write keeps the session unlock) and `endlessBest.ts` (`readBest`, `settleEndless` once per run, `sessionBest` fallback)
    - Unit tests: a throwing `localStorage` does not crash and the unlock still shows, the best is stored only when higher, a hostile stored value reads as 0, `settleEndless` runs once per `runId`
    - Finish
    - _Requirements: 7.10, 7.11, 7.12, 8.2, 8.8, 8.9, 8.10, 11.2, 11.12_

  - [x] 3.5 Derived stats
    - New `derivedStats.ts`: `currentModifiers()` memoised by the `ranks` object, `syncDerivedStats()` writing `playerStore.maxHealth = 100 + bonus`; `playerStore` gains `setMaxHealth`
    - Unit tests: Iron Constitution raises max HP by 15 per rank, `healPlayer` caps at the new max, a sync after load restores max HP, the modifiers object is stable between calls
    - Finish
    - _Requirements: 1.7, 1.8, 1.11_

  - [x] 3.6 Progression actions
    - New `progressionActions.ts`: `startRun(mode)` (reset, seed from `Math.random()`, first two contracts, derived stats, score reset, achievements and Endless best kept), `pickUpgrade(id)` (ignored when nothing is pending, Iron Constitution heals 15, jumps dawn to its last 2 s), `buyFromMerchant(id)`, `openMerchant()` and `closeMerchant()`
    - Unit tests: a second pick for the same dawn changes nothing, a pick sets `phaseTime` to at least `DAWN_DURATION_S − 2`, `startRun` resets ranks and coins, a purchase updates coins, stock and satchel together
    - Finish
    - _Requirements: 1.6, 1.7, 1.11, 5.9, 5.10, 6.1, 8.8, 11.3_

  - [x] 3.7 Progression events: kills, shots, digs and pickups
    - New `progressionEvents.ts` `installProgressionWatchers()`, first half: `enemyKilled` runs `applyKill`, `recordKill`, `coinDrop` and `addPile` in that order (the pile at the zombie's position, or at the player's feet if it is gone), `meleeHit`, `firearmFired`, `boardNailed`, `digCompleted`, `itemCollected` and `bossDefeated` update stats and score; events are ignored when `screen !== 'game'` or the player is taken
    - Unit tests: one kill pays score, stats and a pile once, a repeated uid changes nothing, a Crane `enemyKilled` scores 0 while `bossDefeated` scores 1000 once, a kill whose zombie has gone drops the pile at the player's feet
    - Finish
    - _Requirements: 2.1, 2.5, 2.8, 3.1, 3.2, 3.9, 4.5_

  - [x] 3.8 Progression events: contracts, achievements, dawn and storms
    - `progressionEvents.ts`, second half: contracts advance from the same events and pay once with a 3 s toast and caption; `nightStarted` resets night counters and rolls the night storm; `nightCleared` banks the night score, runs `finishNight` and Close Shave facts; `dawnStarted` deals contracts, sets `dawnSummary` and `pendingPick` from the seeded offer (null when nothing is left); `phaseChanged` to day rolls the day storm and deals the stock; any phase change ends the storm; achievements evaluate after each handler and on mystery and inventory changes; the 07 pause, journal and satchel states block nothing here
    - Unit tests: two contracts at run start, a dawn with every upgrade maxed sets no pick, the same seed gives the same offers, stock and storm after a Retry, `c-unhurt` pays at 50 damage or less, an achievement unlocks once with one toast
    - Finish
    - _Requirements: 1.2, 1.4, 5.6, 6.1, 6.4, 6.6, 6.7, 8.2, 10.1, 10.2, 10.11_

  - [x] 3.9 Progression tick and runtime objects
    - New `progressionTick.ts` (`progressionTick(dt)`, `deriveTickInput()`), `musicRuntime.ts` and `stormRuntime.ts` (plain objects with `reset()`); the tick advances `simClock`, `recordTime` (not while a pick is open), `tickCombo`, `stepPiles` with the coin subtitle, `tickStorm` and its events (`thunderRolled`), the music layer, silence and mixer; it returns early when `gameStore.taken`
    - Unit tests: one 0.1 s step equals ten 0.01 s steps, a frozen sim changes nothing, collected piles bank once, `deriveTickInput` carries hold, day length and last night per mode
    - Finish
    - _Requirements: 2.3, 3.4, 4.6, 9.9, 10.12_

  - [x] 3.10 Install order
    - `main.tsx`: call `installProgressionWatchers()` before `installNewDaySave()` and `installRunStats()`
    - Unit test that reads the install order from `main.tsx` and fails if the progression watchers come after the new-day save
    - Finish
    - _Requirements: 5.6, 14.5_

- [x] 4. Dawn hold and Endless wave plan
  - [x] 4.1 Game loop wiring
    - `gameTick.ts` and `GameLoop.tsx`: `TickInput` carries `holdDawn`, `dayLengthS` and `lastNight` from `deriveTickInput()`; the loop passes the lantern drain multiplier, the stamina regen multiplier and the dig duration from `currentModifiers()`, and calls `progressionTick(STEP)` after `tickCombat`
    - Unit tests: a held dawn does not end, Endless has a 120 s day and no last night, Long Wick and storm change lantern drain, Second Wind raises regen
    - Finish
    - _Requirements: 1.5, 1.8, 7.4, 7.7, 10.5_

  - [x] 4.2 Wave director: plan, mode, elites and night cleared
    - `WaveDirector.tsx`: build waves from `nightPlan(mode, night)`, pass `spawnMultipliers` and the mode elite chance to `createEnemy` and `rollElite`, emit `nightCleared` in both branches, run the rite branch only in story modes, record nights survived with the Endless cap
    - Unit tests: Hard zombies have ×1.25 HP and ×1.4 damage, Endless night 6 has the generated plan, `nightCleared` fires once per cleared night
    - Finish
    - _Requirements: 2.4, 7.3, 7.5, 7.7, 7.8, 7.9_

  - [x] 4.3 Stats move and banish removal
    - `endingStore.ts`: keep the flags and drop the `stats` field; `EnemyDirector.tsx`: remove the `banish()` call (kills are counted by the watchers); callers of `finalizeStats` and `summaryRows` read `progressionStore.stats` through `statRows`
    - Unit tests: `zombiesBanished` equals the sum of kills after a run of kills, the ending summary still lists its earlier rows
    - Finish
    - _Requirements: 3.1, 3.5_

- [x] 5. Scene
  - [x] 5.1 Melee hit event and flask radius
    - `MeleeAttack.tsx`: emit `meleeHit { uid }` once per zombie struck by a melee or heavy swing (never for kicks); `ThrownItems.tsx`: read `flaskRadiusBonusM` for the splash and the flash visual
    - Unit tests: one event per zombie per swing, none for a kick, a Blessed Reach flask has a 1 m larger radius
    - Finish
    - _Requirements: 1.8, 3.1, 6.4_

  - [x] 5.2 Scare stager silence wiring
    - `ScareStager.tsx`: `telegraph()` for a major scare calls `announce(eventId, simClock.now + max(0, beat.at − directorTime))`, `beat()` calls `fired`; a beat held by a menu keeps the silence on; the scare director is untouched
    - Unit tests: a door slam announces then fires, a lurker lunge announces inside 1.5 s of its beat, `scareDirector.test.ts` passes unchanged
    - Finish
    - _Requirements: 9.5, 9.6, 13.5, 13.9_

  - [x] 5.3 Merchant, cart and compass marker
    - New `scene/world/Merchant.tsx` (cart and Silas from merged primitives, about 5 draw calls, mounted only while `merchantPresent`, an emissive lantern sphere and no light); `interaction.ts`: `'trade'` action ("Trade", rune ᛗ, prompt "E: Trade") opening the menu through `canOpenMerchant`; `compass.ts`: optional `merchant` position adds the ⚱ "Silas" marker; arrival and leaving captions
    - Unit tests: the prompt reads "E: Trade" within 2.5 m, the marker appears only while he is present, an open menu closes when he leaves
    - Finish
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.8, 5.11, 5.13, 14.1_

  - [x] 5.4 Coin piles
    - New `scene/world/CoinPiles.tsx`: one instanced mesh of small coin heaps read from `coinStore`, shrinking in the last 2 s, up to 32 piles
    - Finish
    - _Requirements: 4.5, 4.7, 4.8_

  - [x] 5.5 Weather: rain and thunder
    - New `scene/world/Weather.tsx`: one instanced mesh of 600 streaks in the 36 × 20 × 36 m box following the camera, falling at 16 m/s with an 8° slant and frozen by `isSimFrozen()`; rain level fades over 3 s; on `thunderRolled` it plays thunder, adds the "[thunder]" caption and shakes when `thunderShakes` allows; new `src/audio/rain.ts` exposes `setRainLevel` (the noise graph arrives in task 7.2)
    - Unit tests: a storm adds exactly one draw call, rain does not move while frozen, thunder shake follows Camera shake and Scare intensity
    - Finish
    - _Requirements: 10.5, 10.9, 10.10, 10.11, 10.12, 10.15_

  - [x] 5.6 Lightning and storm fog
    - `SkyAndFog.tsx`: `stormRuntime.flashLevel` boosts the existing ambient light by 1.4 and the moon by 1.6 and lerps the sky and fog colour toward `#d6e4ff` by 0.5; fog density adds 0.01 while a storm is active without writing it to the world store; no new light
    - Unit tests: level 0 changes nothing, the slow variant never exceeds 30%, the saved fog value is unchanged
    - Finish
    - _Requirements: 10.5, 10.7, 10.8, 12.6_

  - [x] 5.7 Music driver
    - New `scene/audio/MusicDriver.tsx` reading `musicRuntime` per frame and writing stem and master gains with a 0.04 s smoothing; stays silent while the context is not running and starts when it runs; new `src/audio/music.ts` exposes `createMusicGraph` and `setMusicLevels` (the oscillator graph arrives in task 7.1)
    - Unit tests with a fake context: no graph while suspended, the graph starts when the context runs, gain targets follow the runtime
    - Finish
    - _Requirements: 9.3, 9.4, 9.8, 9.9_

  - [x] 5.8 Pause triggers and menu state
    - `usePauseTriggers.ts`: the picker and merchant do not own Esc; pointer-lock loss caused by a deliberate cursor release is ignored while an overlay is open, Esc always pauses; `menuState.ts`: `isMenuOpen()` includes the new overlays
    - Unit tests: Esc pauses with the merchant, picker or achievements open, `PauseMenu.resume` does not request pointer lock while an overlay is open
    - Finish
    - _Requirements: 1.5, 12.12_

  - [x] 5.9 Mount the new scene components
    - `App.tsx`: mount `Merchant`, `CoinPiles`, `Weather` and `MusicDriver` inside the game scene in the right order relative to `SkyAndFog` and `EnemyDirector`
    - Unit test that `App` renders the new components in the scene tree
    - Finish
    - _Requirements: 10.15, 14.1_

- [x] 6. UI
  - [x] 6.1 Menu dialog autofocus
    - `MenuDialog.tsx`: `data-autofocus` support (the first match wins); `onEscape` stays optional so overlays can leave Esc to the pause trigger
    - Unit tests: focus moves to the marked control within 100 ms, falls back to the first control, returns to the previous control on close, Tab stays inside
    - Finish
    - _Requirements: 12.2, 12.3, 12.4_

  - [x] 6.2 Mode select
    - New `ui/menus/ModeSelect.tsx`: native radios for Easy, Normal, Hard and Endless Survival, Normal checked and focused, each option's modifiers as text, Endless lists "120 s day, no relics or rite, no Retry Night", Begin and Back, Esc goes back; CSS with `:focus-visible`
    - Unit tests: Normal is checked by default, arrows move the choice, Begin passes the chosen mode, the option text matches `MODES`
    - Finish
    - _Requirements: 7.1, 7.14, 12.1_

  - [x] 6.3 Dawn picker and dawn card
    - New `ui/hud/DawnPicker.tsx` (modal, three card buttons with rune, name, "Rank r/m" and "old → new" lines; arrows and Tab move, Enter or Space picks; no `onEscape`; waits while a major scare is active); `DawnCard.tsx` becomes the dawn summary with night score parts and hosts the picker; shows alone when there is no offer
    - Unit tests: cards render from `upgradeCard`, a pick calls `pickUpgrade` once, the picker stays closed during a major scare and opens after, a saved pending pick shows the same three cards
    - Finish
    - _Requirements: 1.4, 1.5, 1.6, 1.10, 11.5, 12.1, 12.11_

  - [x] 6.4 Merchant menu
    - New `ui/merchant/MerchantMenu.tsx`: "Silas Vane", coins, rows with item, price, "Left: n" and a Buy button, a `role="alert"` refusal line naming sold out, coins or space, Close; closes when he leaves, at dusk or beyond 2.5 m; no `onEscape`
    - Unit tests: a purchase updates the row and coins, a refusal shows its reason and changes nothing, the menu closes at 2.5 m and at dusk
    - Finish
    - _Requirements: 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 13.3, 13.4_

  - [x] 6.5 Contracts tab
    - New `ui/journal/ContractsTab.tsx` and a "Contracts" tab in `Journal.tsx`: goal text, "n/goal", "◎ N" reward and a "Done ✓" tag; empty slots render nothing
    - Unit tests: two contracts render, one contract renders one entry, a done contract shows its tag
    - Finish
    - _Requirements: 6.3, 6.8, 12.5_

  - [x] 6.6 Score, combo and coins panel
    - New `ui/hud/ScorePanel.tsx` at `top: 88px; right: 24px`: "Score 1,240", the combo "×1.75" with a text-labelled bar (hidden at ×1.0), "◎ 12 coins"; a 0.2 s pulse only with Flashing lights on; `pointer-events: none`; 1rem minimum
    - Unit tests: combo hidden at ×1.0, text changes without a pulse class when Flashing lights is off, the coin count updates within the same render
    - Finish
    - _Requirements: 2.6, 2.7, 4.8, 4.9, 12.5, 12.6_

  - [x] 6.7 Achievement toasts
    - New `ui/hud/AchievementToasts.tsx` under the score panel: up to 3 visible, "★" and the name, 4 s each with 0.5 s fades, queued in unlock order, no pulse; contract and achievement toasts still show with Subtitles off for at least 3 s
    - Unit tests: a batch of 5 shows 3 and queues 2, toasts show with Subtitles off
    - Finish
    - _Requirements: 8.2, 8.4, 8.5, 12.6, 12.9_

  - [x] 6.8 Achievements menu
    - New `ui/menus/AchievementsMenu.tsx`: 12 entries, unlocked with name and goal, locked as dim outlines with the goal and a "Locked" tag; shows "Not now" while a major scare is active; keyboard only
    - Unit tests: 12 entries, locked entries carry the tag, the menu stays closed during a major scare
    - Finish
    - _Requirements: 8.6, 8.7, 12.1, 12.5, 12.10_

  - [x] 6.9 Stats screen, ending and taken screens
    - New `ui/menus/StatsPanel.tsx` (`dl` rows from `statRows`, the Endless best, Close returning to the title); `EndingScreen.tsx` shows it and its New Game opens the mode select; `TakenScreen.tsx` hides Retry in Endless and shows the stats there, and Quit from a story death shows none
    - Unit tests: rows show 0 for empty stats, time reads "m:ss" and accuracy "N%", Retry is not rendered in Endless, Close has focus
    - Finish
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 7.7, 7.13, 12.1_

  - [x] 6.10 Title and pause menu wiring
    - `TitleScreen.tsx`: New Game opens `ModeSelect` then `startRun(mode)` (Endless skips the intro); Achievements button; `PauseMenu.tsx`: Achievements button nested like Settings
    - Unit tests: New Game leads to the mode select, Continue is unchanged, Achievements opens from Title and Pause
    - Finish
    - _Requirements: 7.1, 8.6, 12.12_

  - [x] 6.11 Assemble the new HUD
    - `Hud.tsx`: render `ScorePanel`, `AchievementToasts`, `DawnPicker` and `MerchantMenu` without moving 06 and 07 elements
    - Structure test: no `font-size` under `1rem` in the new CSS
    - Finish
    - _Requirements: 2.6, 12.5, 12.8_

  - [x] 6.12 Satchel grid and dig bar
    - `Satchel.tsx` renders `currentModifiers().satchelSlots` cells; `DigBar.tsx` reads the live dig duration
    - Unit tests: Deep Pockets shows 14 cells, Gravedigger shortens the dig bar's duration by 30%
    - Finish
    - _Requirements: 1.8_

- [x] 7. Procedural music, rain and thunder
  - [x] 7.1 Music graph
    - `src/audio/music.ts`: the drone, unease, tension and danger stems from the design graph on the 07 music bus (no file loaded), a heartbeat scheduler with a 0.25 s look-ahead while the danger stem is above 0.05, stem peaks 0.55, 0.40, 0.35 and 0.60, built once and never torn down; `MusicDriver` starts it
    - Unit tests with a fake `AudioContext`: stems are created once, stem gains follow the levels, the heartbeat schedules two thuds 0.22 s apart
    - Finish
    - _Requirements: 9.3, 9.4, 9.8_

  - [x] 7.2 Rain noise
    - `src/audio/rain.ts`: a looped noise buffer through a band-pass (2.4 kHz, Q 0.5) and a high-pass (500 Hz) at gain 0.22 on the `sfx` bus, faded over 3 s and muted while frozen
    - Unit tests with a fake context: the level fades over 3 s, silent when the context is missing, master and SFX volume apply
    - Finish
    - _Requirements: 10.5, 10.11, 10.12, 10.13_

  - [x] 7.3 Thunder and bus checks
    - Wire `thunder-close` and `thunder-far` through `playSound` from `Weather.tsx` on the `sfx` bus; a thunder already sounding finishes its tail when the game pauses; a missing audio context still produces the caption and the shake decision
    - Unit tests: thunder uses the SFX volume, the caption appears with no audio context, the music master gain target is 0 while silent
    - Finish
    - _Requirements: 9.5, 10.9, 10.13, 12.8_

- [x] 8. Save, Retry Night and New Game
  - [x] 8.1 Save and load wiring
    - `saveGame.ts`: `progression` optional on read and always written, `SAVE_VERSION` stays 1; `gameSave.ts`: `captureSave` fills it from `captureProgressionSave`, `loadGame` applies `sanitizeProgression` and `syncDerivedStats()`; `validInventory` allows up to `SATCHEL_SLOTS_MAX`
    - Unit tests: save then load restores ranks, coins, contracts, stock and a pending pick with the same offers; a pre-08 save loads with the defaults and its earlier fields; corrupt data hides Continue and leaves storage untouched
    - Finish
    - _Requirements: 11.1, 11.4, 11.5, 11.8, 11.9, 11.10, 11.11, 11.12_

  - [x] 8.2 Retry Night snapshot and night clear
    - `retryNight.ts`: the snapshot list gains `progression`, Retry returns early in Endless; `nightState.ts` `clearNightState()` also calls `scoreStore.resetNight()`, `coinStore.clear()`, `stormRuntime.reset()`, `scareSilence` clear and `musicRuntime.reset()`
    - `retryProgression.test.ts` with fast-check
    - **Property 34: Retry Night restores the snapshot and clears the night**
    - Finish
    - _Requirements: 11.6, 11.7, 11.14_

  - [x] 8.3 New Game and run end
    - `resetRun.ts` resets progression, score, coins and storm while keeping achievements and the Endless best; `startEnding.ts` settles the Endless best on death through `settleEndless` and finalises stats once
    - Unit tests: New Game keeps unlocked achievements and the stored best, an Endless death stores a higher score only, `settleEndless` runs once per run
    - Finish
    - _Requirements: 3.5, 7.10, 7.13, 8.8, 11.3_

  - [x] 8.4 Process and structure tests
    - `tests/progressionRules.test.ts`: every new file in `src/game/systems/` has a `*.test.ts`, nothing under `src/game/` imports React, three.js or Howler, no numeric balance literal (other than 0, 1, 2 and indices) in the new systems, no new `.ogg`, `.mp3` or `.glb` file, `PROGRESSION_PERSISTED` and the Retry snapshot list cover the same fields
    - Finish
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

  - [x] 8.5 Integration flows
    - `tests/progressionCheckpoint.test.ts`: a seeded night 1 to dawn flow (kills build combo and coins, night score, pick Iron Constitution, merchant buys, contracts pay), save, load and compare, a failed night and Retry Night compared with the dusk snapshot, and an Endless night 6 plan
    - Finish
    - _Requirements: 11.6, 11.7, 14.5_

- [~] 9. Checkpoint: playtest in a real browser
  - This task is only marked done after a human, or a real Chrome session driven against the dev server, has played at least one full night in a real browser and observed each item below working. Unit tests, lint and build passing are not enough.
  - Observe and confirm:
    - Mode select with each mode's text, Normal by default
    - The dawn picker holding dawn, a pick applied (for example Iron Constitution raising max HP), and "old → new" on the cards
    - Combo and score rising with the HUD and the flashing-lights-off behaviour, coins dropping and being collected with a subtitle
    - The merchant arriving on day 2 with a compass marker, a purchase and a refused purchase with its reason, and him leaving after 90 s
    - Two contracts dealt, progressing and paying with a toast
    - An achievement unlocking with a toast, and the Achievements menu from the title and pause screens
    - Music layers changing as zombies close in, and silence before a major scare
    - A storm with rain, lightning (and the slow variant with Flashing lights off), and thunder with its subtitle
    - The stats screen after an ending or an Endless death, and the Endless best saved
    - Continue restoring progression, and Retry Night resetting combo, piles and night contract progress
  - Run `npm run test`, `npm run lint` and `npm run build`, then append the `docs/kiro-log.md` entry with the real completion date. If any observed action fails, leave this task open and record the failing action in `docs/kiro-log.md`.
  - **STOP after this checkpoint and tell the user spec 08 is ready for a playtest.**
  - _Requirements: 14.7, 14.8, 12.6, 12.8, 9.5, 10.7, 10.8, 11.5, 11.6_

## Notes

- All tasks are required. Property tests are part of their system's task and are not optional.
- Each property test file carries the tag `Feature: 08-progression-and-atmosphere, Property N: <title>` and runs at least 100 cases. A property split over several tasks (9, 27) is tagged in each file with the half it covers.
- Each task references granular requirement numbers for traceability.
- Unit tests live next to their file; process and integration tests sit in `tests/`.
- Values the bible lacked (merchant spot, pile merge and cap, lightning boosts, rain, music tuning, stem weights) are in the design's "Values chosen here" and in `docs/game-design.md` §12 "Placements and tuning (08)". If code and bible disagree, the bible wins and the code changes.
- Tasks 5.5 and 5.7 create `rain.ts` and `music.ts` with a small typed interface that the scene already calls; tasks 7.1 and 7.2 add the audio graphs behind it, so nothing is left unwired between them.
- This spec adds no model, texture or audio file, so `docs/CREDITS.md` does not change.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "2.1", "2.2", "2.4", "2.5", "2.6", "2.7", "2.9", "2.10", "2.11", "2.12", "2.14", "2.16", "2.17", "3.1", "6.1"] },
    { "id": 3, "tasks": ["2.3", "2.8", "2.13", "2.15", "3.3", "3.4", "5.8", "6.2"] },
    { "id": 4, "tasks": ["2.18", "5.4", "6.7"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["3.5", "4.3", "6.5", "6.6"] },
    { "id": 7, "tasks": ["3.6", "3.7", "3.9", "4.2", "5.1", "6.12", "8.1"] },
    { "id": 8, "tasks": ["3.8", "4.1", "5.2", "5.3", "5.5", "5.6", "5.7", "6.3", "6.4", "6.8", "6.9", "8.2", "8.3"] },
    { "id": 9, "tasks": ["3.10", "5.9", "6.10", "6.11", "7.1", "7.2"] },
    { "id": 10, "tasks": ["7.3"] },
    { "id": 11, "tasks": ["8.4", "8.5"] }
  ]
}
```
