# Implementation Plan: Combat and Enemies

## Overview

**Do not start until spec 06's checkpoint is done and the user has said to begin spec 07.**

Data comes first (every **(07)** row from `docs/game-design.md` goes into `src/data/`, with data tests against the bible and referential integrity). Pure systems follow, each with its fast-check property tests in the same task (required, not optional). Then stores and glue (`combatTick`, `combatActions`, `nightState`, `combatPersistence`, `staminaRuntime`), scene drivers and meshes, HUD and workbench UI, procedural audio and captions, and save and Retry Night. The last task is a real-browser playtest. The firearms, the barricades and the boss are each split over several tasks so one run stays small. Every sub-task ends with the same closing step, called **Finish** below:

- **Finish:** run `npm run test`, `npm run lint` and `npm run build`, fix any failures, then append an entry to `docs/kiro-log.md` headed with the real date the task is actually finished, in the format from `.kiro/steering/kiro-log.md`.

## Tasks

- [x] 1. Combat data and data tests
  - [x] 1.1 Types, settings and bindings
    - `src/game/types.ts`: new id unions (`AmmoId`, `FirearmId`, `HeavyMeleeId`, `DoorId`, `EffectId`, `UpgradeId`, `DamageSource`), the four new `MaterialId`s, new `CraftedItemId`s and `RecipeId`s, new `GameEvent` members (`enemyKilled`, `firearmFired`, `boardNailed`, `boardBroken`, `bossRisen`, `bossDefeated`), `damageNumbers` in `Settings`
    - Default bindings `Reload` (R), `Kick` (Q), `Dodge` (C), `HeavyAttack` (V); `Block` stays right mouse
    - `settings.ts`: default `damageNumbers: true`, `BOOLEAN_KEYS`, `extractSettings`; old stored settings and stored bindings load with the new defaults
    - Unit tests: defaults, save/load round trip, a missing or invalid stored `damageNumbers` becomes On, old stored bindings gain the four new keys
    - Finish
    - _Requirements: 1.9, 10.8, 10.9, 21.7_

  - [x] 1.2 Items, ammunition, weapons, consumables, recipes and loot
    - `items.ts`: `wood-plank`, `black-powder`, `lead-shot`, `silver-filings` (stack 10); `ammo` kind for `revolver-cartridge` (36) and `shotgun-shell` (20), each using one slot; crafted `revolver`, `shotgun`, `wood-axe`, `silver-sabre`, `blessed-rounds`, `kola-tonic`; update every exhaustive switch over `ItemKind`
    - `weapons.ts`: `kind` gains `firearm | heavy`; stats from §4 (damage, speed, durability); consumables carry an `effect`
    - `recipes.ts`: `r-revolver-cartridge`, `r-shotgun-shell`, `r-blessed-rounds`; `unlock` gains `{ type: 'pickup'; weapon }`; ammo recipes carry `outputCap: 'partial'`
    - `lootTables.ts`: `LootItemId`, `woodpile`, one-time `powder-tin` (`SpawnPoint.once`), additions to broken coffin, crypt shelves and catacomb walls
    - `combatItemsData.test.ts`: every value equals the bible rows (stack limits, slots, damage, speed, durability, recipe inputs, output quantities, unlocks), and a failing entry names the id and field
    - Finish
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.11, 1.12_

  - [x] 1.3 Firearm, heavy melee, move, effect and upgrade data
    - New `firearms.ts` (capacity, reload, interval, pellets, spread hip/aimed, headshot multiplier, range, falloff, recoil, noise, start magazine and ammo, `HEAD_ZONE_M`), `heavyMelee.ts`, `combatMoves.ts` (`KICK`, `DODGE`, `KNOCKDOWN_DAMAGE_MULT`), `effects.ts` (three effects with duration, glyph and mods), `upgrades.ts` (all ten `up-*` rows with cost and `from → to` changes)
    - `combatWeaponData.test.ts`: values equal the §4 tables; no two upgrades change the same stat of the same weapon; every upgrade weapon is a firearm or heavy weapon
    - Finish
    - _Requirements: 1.3, 1.7, 1.8, 1.12, 3.5, 5.5, 8.1, 8.2, 9.1, 9.4, 11.8, 12.1, 12.2, 12.3_

  - [x] 1.4 Enemy, elite, wave, boss and barricade data
    - `enemies.ts`: `EnemyId` gains `bloater`, `brute`, `father-crane`; `WaveEnemyId`; `BLOATER`, `ENEMY_CAPSULE`, `ENEMY_MODEL_HEIGHT`, `ENEMY_LOOKS` (scale may be a `[x, y, z]` tuple), new audio cues
    - New `elites.ts` (`ELITE`, `ELITE_DROPS` weights 30/25/20/15/10), `boss.ts` (`BOSS` phases, telegraphs, timers), `barricades.ts` (`DOORS`)
    - `waves.ts`: `WaveComposition` over `WaveEnemyId`, `WAVE_ADDITIONS`, `waveAdditions(night)` (empty outside 1..5), `NIGHTS` built as base plus additions
    - `repairs.ts`: stage 1 label and description from the design
    - `combatEnemyData.test.ts` and `waves.test.ts` additions: HP, speed, damage, elite modifiers, drop weights sum to 100, boss and door values equal §2 and §7, base columns of §8 are unchanged, additions match the §8 "Added in spec 07" column
    - Finish
    - _Requirements: 1.5, 1.6, 1.8, 1.12, 13.2, 14.2, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 1.5 Feedback, caption and sound data
    - New `combatFeedback.ts` (`HIT_MARKER`, `DAMAGE_NUMBER`, `MUZZLE`, `AIM`), `captions.ts` (one entry per sound in the Req 22.1 list, with text and minimum seconds), `sounds.ts` (`SoundId` and recipes for every sound in the design table, with spatial flag and max distance)
    - `combatFeedbackData.test.ts`: values equal the bible; every caption maps to a sound event and every captioned sound has a caption; every `SoundId` has a recipe; Crane texts contain no joke words
    - Finish
    - _Requirements: 5.8, 10.5, 10.10, 21.6, 22.1, 22.6, 23.3, 23.7_

  - [x] 1.6 Layout, placements, doors, waypoints and weapon pickups
    - `cemeteryLayout.ts`: `CHAPEL_DOORS` (front and vestry with world points, outward vectors and stand points), lodge, woodpile, cupboard, crypt step, powder tin and bell tower store, Crane spawn points, Congregation points
    - New `weaponPickups.ts` (four pickups with slots needed, ammo, magazine, recipe and position); `waypoints.ts`: `chapel-vestry` node with edges to `hut` and `grounds-south`; `zones.ts` if the pickups or doors need zone ids
    - `combatLayout.test.ts`: positions equal the bible placements; the lodge does not overlap `avenueCrypts()`; the vestry opening clears the buttresses and windows; both stand points are reachable from every spawn grave in the waypoint graph; `navigation.test.ts` still passes
    - Finish
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 16.1, 16.7, 1.8_

  - [x] 1.7 Bible equality and referential integrity tests
    - `combatData.test.ts`: a literal copy of the §3 to §8 (07) tables compared to `FIREARMS`, `HEAVY_MELEE`, `WEAPONS`, `ENEMIES`, `ELITE`, `WAVE_ADDITIONS`, `BOSS`, `DOORS`, `EFFECTS`, `WEAPON_UPGRADES`, recipes and items; a mismatch fails with the id and field
    - `combatIntegrity.test.ts` with fast-check, tagged `Feature: 07-combat-and-enemies, Property 1`
    - **Property 1: Referential integrity of combat data**
    - A deliberately broken entry in a test helper proves the failure names the entry and the missing id
    - Finish
    - _Requirements: 1.10, 1.11, 1.12, 24.8_

- [x] 2. Pure systems with property tests
  - [x] 2.1 Knockdown, stagger and melee rules
    - New `src/game/systems/knockdown.ts` (`applyKnockdown`, `applyStagger`, `knockdownDamageMult`, `shotKnocksDown`); `combat.ts`: `CombatEnemy.knockdown`, new `DamageSource` values, ×1.25 on a knocked-down target, Sabre vs Wailer ×1.5; `melee.ts`: stagger through `applyStagger`, `{ knockdownS }` option
    - `knockdown.test.ts`, updates to `combat.test.ts` and `melee.test.ts`
    - **Property 16: Knockdown resets, never extends, and disarms** (timer, Crane, Brute stagger, ×1.25, Sabre bonus, shotgun 3 m rule)
    - Finish
    - _Requirements: 8.6, 8.7, 8.8, 8.9, 9.2, 9.3, 14.3, 14.4, 14.5, 14.6, 17.11_

  - [x] 2.2 Enemy AI: down, swell, noise and door targets
    - `enemyAI.ts`: `down` and `swell` states, `maxHp`, `elite`, `speedMult`, `damageMult`, `knockdown`, `investigate`, `target`, `doorAttacker`, `createEnemy` options, `ctx.doors`, `ctx.speedOverride`, `bloaterSwell`, `bloaterBurst` and door-aware `enemyAttack` and `enemyCollapsed` events; Crane never emits `enemyAttack`
    - Updates to `enemyAI.test.ts`: knocked-down zombie does not move or attack until the timer ends (the disarm half of **Property 16**), swell lasts 0.8 s then bursts once, a dormant Lurker that is knocked down wakes, `investigate` steers and clears within 1.2 m, a door target changes the attack goal
    - Finish
    - _Requirements: 8.7, 13.3, 13.5, 14.2, 14.6, 15.5, 16.10, 6.3_

  - [x] 2.3 Ballistics
    - New `ballistics.ts`: `capsuleFor`, `rayVsCapsule`, `spreadDirection`, `rayDamage`, `resolveShot` with an injected `WallDistance`; zero or non-finite aim fires nothing
    - `ballistics.test.ts` with fast-check
    - **Property 3: Spread stays inside the cone**
    - **Property 4: Damage is non-negative, bounded by range, and monotone in distance**
    - **Property 5: Headshots never deal less than body hits; Blessed doubles**
    - **Property 6: The head zone is the top 0.3 m of the capsule**
    - **Property 7: A shot spends exactly one round and merges hits per zombie** (the ray count and merged-hit half: 1 or 8 rays, unique zombie ids, summed damage)
    - Finish
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.11, 3.12, 3.13, 3.14, 3.15, 10.4_

  - [x] 2.4 Firearm magazine and reload
    - New `firearm.ts`: `pullTrigger`, `canReload`, `startReload`, `tickFirearm`, `reloadReady`, `completeReload`, `cancelReload`
    - `firearm.test.ts` with fast-check
    - **Property 7: A shot spends exactly one round and merges hits per zombie** (the magazine half: one round spent only when the shot is allowed)
    - **Property 8: Refused trigger pulls change nothing**
    - **Property 9: Reload conserves rounds, stays in range and is idempotent**
    - Finish
    - _Requirements: 3.1, 3.8, 3.9, 3.10, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.10, 4.11, 4.12, 5.10_

  - [x] 2.5 Recoil, aim and muzzle flash
    - New `recoil.ts` (`recoilKickDeg`, `addKick`, `tickRecoil`, `recoilOffsetRad`, `aimBlend`, `aimFovDeg`, `aimMoveMult`, `spreadDeg`, `impactShakeAllowed`) and `muzzleFlash.ts` (`muzzleProfile`, `muzzleOpacity`)
    - `recoil.test.ts`, `muzzleFlash.test.ts`
    - **Property 11: Recoil, aim and spread follow the settings**
    - **Property 12: Muzzle flash obeys Flashing lights**
    - Finish
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 21.1, 21.2, 21.3, 21.4_

  - [x] 2.6 Gunfire noise
    - New `noise.ts`: `noiseAffects`, `applyNoise` (investigate destination, Lurker wake within 15 m, attackers keep their target)
    - `noise.test.ts` with fast-check
    - **Property 13: Noise affects a zombie if and only if it is in range**
    - Finish
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 2.7 Heavy attack and durability
    - New `heavyAttack.ts` (`startCharge`, `tickCharge`, `resolveRelease`, `meleeDamageFor`); `durability.ts`: `spendSwing(ws, hits)`, maxima that honour upgrades
    - `heavyAttack.test.ts`, updates to `durability.test.ts`
    - **Property 15: Heavy release rules never overspend stamina**
    - **Property 17: Durability is spent once per swing that hits**
    - Finish
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.10, 8.11, 8.13, 8.14_

  - [x] 2.8 Kick, dodge and stamina
    - New `kick.ts` and `dodge.ts`; `stamina.ts`: `spendStamina(s, cost)`, `tickStamina(s, dt, sprinting, drainMult)`
    - `kick.test.ts`, `dodge.test.ts`, updates to `stamina.test.ts`
    - **Property 18: Kick and Dodge are gated, bounded and invulnerable only at the start**
    - Finish
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 17.9_

  - [x] 2.9 Hit markers and damage numbers
    - New `hitMarker.ts` and `damageNumbers.ts`
    - `hitMarker.test.ts`, `damageNumbers.test.ts`
    - **Property 19: Hit markers and damage numbers**
    - Finish
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.10, 10.12_

  - [x] 2.10 Timed effects and consumables
    - New `effects.ts` (`applyEffect`, `tickEffects`, `effectMods`, `withSaltEffect`, `effectIcons`); `consumables.ts`: `blessed-rounds` and `kola-tonic` with duration 0 and an effect id
    - `effects.test.ts`, updates to `consumables.test.ts`
    - **Property 21: Timed effects are unique, idempotent and non-increasing**
    - Finish
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13_

  - [x] 2.11 Weapon upgrades
    - New `upgrades.ts`: `canBuyUpgrade`, `buyUpgrade`, `deriveStats`, `firearmStats`, `upgradeLines`, `missingReason`, `StatMods` hook; shotgun aimed spread is `min(aimed, hip)`
    - `upgrades.test.ts` with fast-check
    - **Property 20: Upgrades are all-or-nothing, once, and order-independent**
    - Finish
    - _Requirements: 8.13, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

  - [x] 2.12 Ammunition crafting
    - `crafting.ts`: stack limits from `ITEM_MAP[id].stackLimit`, `addCapped`, `outputCap: 'partial'` (refused only when nothing fits, inputs consumed once), `unlockRecipes` handles `{ type: 'pickup'; weapon }`
    - Updates to `crafting.test.ts`
    - **Property 10: Ammunition crafting never exceeds the stack limit**
    - Finish
    - _Requirements: 4.8, 4.9, 2.7_

  - [x] 2.13 Weapon pickup rule
    - New `weaponPickups.ts`: `canTakePickup`, `takePickup` (slots checked first, weapon plus ammo plus state recorded together, taken pickups refused, recipe unlock without duplicates)
    - `weaponPickups.test.ts` with fast-check
    - **Property 2: Weapon pickups are atomic and happen once**
    - Finish
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.14 Bloater burst
    - New `bloater.ts`: `resolveBurst` (25 to every other living zombie and to the player within 3 m, never the source, player health never below 0)
    - `bloater.test.ts` with fast-check
    - **Property 22: The Bloater bursts once and only inside 3 m**
    - Finish
    - _Requirements: 13.3, 13.5, 13.8, 13.9, 13.10_

  - [x] 2.15 Elite rules and drops
    - New `elites.ts`: `canBeElite`, `rollElite` (consumes the rng only when eligible), `eliteStats`, `rollEliteDrop`
    - `elites.test.ts` with fast-check, including 10,000 rolls within 3 percentage points of each weight
    - **Property 24: Elite drops follow the table and are never lost** (table entries, frequencies, satchel-or-ground placement helper)
    - Finish
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.9, 15.10, 15.13_

  - [x] 2.16 Wave additions, elite rolls and Door_Attacker assignment
    - `waves.ts` (system): `WaveState.eliteSpawned` and `attackersLeft` reset at every wave start (including `startNight` and `startRiteAssault`), `WaveSpawn.elite` and `doorAttacker`, optional `eliteRng`, `expandWave` order, `nightTotal` and `waveSize` count the new types
    - Updates to `waves.test.ts` (system): existing seeds unchanged when no `eliteRng` is given
    - **Property 23: Elite rolls respect night, type and the one-per-wave limit**
    - **Property 29: Wave additions match the design bible**
    - Finish
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.11, 15.12, 16.9, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9_

  - [x] 2.17 Barricade boards and damage
    - New `barricade.ts`: `BarricadeState`, `buildBarricades`, `boardDamageFor`, `damageDoor` (lowest board only, excess not carried), `doorAttackerCount`, `canBeDoorAttacker`, `doorLine`
    - `barricade.test.ts` with fast-check
    - **Property 25: Barricade state stays valid and conserves health and materials** (state bounds, damage conservation, Brute and rite multipliers)
    - Finish
    - _Requirements: 14.9, 16.1, 16.10, 16.11, 16.12, 16.13, 16.14, 16.15_

  - [x] 2.18 Barricade nailing
    - `barricade.ts`: `nailBoard` (1 wood plank and 2 iron nails, full-health board, any phase), `nailPrompt` ("Door is full" or the missing material), `tickNailing` (2 s hold, cancelled by more than 0.05 m of travel, damage or release)
    - `barricadeNailing.test.ts` with fast-check
    - **Property 25: Barricade state stays valid and conserves health and materials** (the nailing half: exact cost, refused and cancelled nails change nothing, Hardened Boards only raise boards nailed afterwards)
    - Finish
    - _Requirements: 16.2, 16.3, 16.4, 16.13, 16.14_

  - [x] 2.19 Chapel doors, safe zone and targeting
    - New `chapelDoors.ts`: `CHAPEL_DOOR_GEOM`, `insideChapel`, `doorClosed`, `chapelSafe`, `closedDoorBlocks`, `ejectFromClosedDoors`, `chooseTarget`
    - `chapelDoors.test.ts` with fast-check, including the wave-size Door_Attacker count through `tickWaves`
    - **Property 26: Doors are closed iff built and holding; targets follow the rules**
    - Finish
    - _Requirements: 16.5, 16.6, 16.7, 16.8, 16.9, 16.16_

  - [x] 2.20 Boss director: rising, phases and speed
    - New `bossDirector.ts`: `BossState`, `initialBoss`, `bossPhase`, `bossSpeed`, `tickBoss` rise sequence (rite clock, 1.5 s telegraph event, spawn event, 3 s name card), phase transitions that set the Toll and Congregation timers, `craneFighting`, `riteBlocked`, `riteCapS`
    - `bossDirector.test.ts` with fast-check
    - **Property 27: The boss only moves forward, waits for the rite, and always telegraphs** (phase is monotonic, no events before the rise, speed per phase, halved in a Salt Circle)
    - Finish
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.10, 17.17, 17.19_

  - [x] 2.21 Boss director: Censer Swing, The Toll and the Congregation
    - `bossDirector.ts`: one attack at a time, order Toll then Congregation then Swing, aim locked at wind-up start, phase 3 double swing with a 0.3 s gap, 2.0 s swing cooldown, `swingHits` (3 m, 120°), `tollHits` (8 m), damage never above 30, 20 and 25
    - `bossAttacks.test.ts` with fast-check
    - **Property 27: The boss only moves forward, waits for the rite, and always telegraphs** (intervals 12 s, 25 s and 18 s, telegraph at least 1.0 s, 1.2 s and 1.0 s before damage or spawn, hit tests, damage bounds)
    - Finish
    - _Requirements: 17.6, 17.7, 17.8, 17.19, 23.1, 23.2, 23.5_

  - [x] 2.22 Boss director: death and a dead player
    - `bossDirector.ts`: HP 0 enters `dying`, cancels the pending attack and all timers, emits `deathStart`, holds 4 s of quiet, emits `quietEnded` and becomes `dead`; `playerDead` freezes the state with no events; `crane: null` holds state
    - `bossDeath.test.ts` with fast-check
    - **Property 27: The boss only moves forward, waits for the rite, and always telegraphs** (cancel at 0 HP, a dead player stops all events)
    - Finish
    - _Requirements: 17.12, 17.13, 17.15, 17.18_

  - [x] 2.23 Final rite cap
    - `finalRite.ts`: `stepRite(mystery, dt, holding, relicCount, capS = RITE_DURATION)` clamps at the cap without lowering earned progress
    - Updates to `finalRite.test.ts`
    - **Property 28: The rite cannot finish while Crane lives**
    - Finish
    - _Requirements: 17.5, 17.18_

  - [x] 2.24 Captions queue
    - New `captions.ts` (system): queue of at most 3, each visible for at least `max(duration, 1.5 s)`, only the oldest dropped and only to make room, nothing produced when Subtitles is Off
    - `captions.test.ts` with fast-check
    - **Property 33: Every important sound has a caption, and the queue obeys its limits**
    - Finish
    - _Requirements: 21.6, 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 23.3_

  - [x] 2.25 Rebinding rule
    - New `bindings.ts`: `rebind(bindings, action, key)` rejects a key used by another action and rejects Escape, naming the conflicting action
    - `bindings.test.ts` with fast-check
    - **Property 32: Rebinding rejects conflicts and changes nothing**
    - Finish
    - _Requirements: 21.7, 21.8, 21.9_

  - [x] 2.26 Combat save sanitising
    - New `combatSave.ts`: `CombatSave`, `sanitizeCombat(raw, ctx)` field by field (unknown ids, magazine above capacity-with-upgrades, durability, upgrades without their weapon, taken pickups, door boards 0..3 each 1..`BOARD_HP_MAX_SAVE`); pre-07 save with stage 1 built gets 2 boards per door; per-entry inventory slot sanitising helper
    - `combatSave.test.ts` with fast-check
    - **Property 30: Combat saves round-trip and sanitise per field**
    - Finish
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_

  - [x] 2.27 Ammunition readout text
    - New `ammoReadout.ts`: `ammoReadout()` returns the "M / S" text and the Reloading, Empty and No ammo labels with their glyphs; nothing without a firearm; reload seconds quantised to 0.1 s
    - `ammoReadout.test.ts` with fast-check
    - **Property 14: The ammunition readout is complete and not colour-only**
    - Finish
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 2.28 Barricade-built repair rule
    - `repairs.ts`: rename `isDoorBarred` to `isBarricadeBuilt` (stage 1 done, no rite exception) with `semantic_rename` so every caller updates
    - Updates to `repairs.test.ts`: before stage 1 the chapel is not safe and no frames exist; after stage 1 `isBarricadeBuilt` is true
    - Finish
    - _Requirements: 16.5, 16.7_

- [x] 3. Stores and glue
  - [x] 3.1 Stamina runtime
    - New `staminaRuntime.ts` holding the regen delay ref that `TickDriver` owns today; `spendStamina()` writes the store and resets the delay; `TickInput` gains `sprintDrainMult`; `TickDriver` in `GameLoop.tsx` reads the runtime
    - Unit tests: a spend is not undone on the next tick, stamina stays in 0..100, drain multiplier halves sprint drain
    - Finish
    - _Requirements: 9.1, 9.4, 9.10, 12.2_

  - [x] 3.2 Combat store and persistence list
    - New `combatStore.ts` (persisted `firearms`, `durability`, `upgrades`, `takenPickups`; `live` state; `reconcile`, `setMagazine`, `spendDurability`, `takePickup`, `buyUpgrade`) and `combatPersistence.ts` (`COMBAT_PERSISTED`, `captureCombatSave`)
    - Unit tests: `reconcile` creates state the first time a weapon is held, keeps it while the item is on the ground, deletes it when a weapon breaks, cancels reload and charge when the held item changes
    - Finish
    - _Requirements: 2.6, 8.10, 8.11, 19.1, 19.2, 20.3_

  - [x] 3.3 Door, boss, effect and feedback stores
    - New `doorStore.ts` (`built`, boards, `nail`, `build()`), `bossStore.ts` (`BossState`, `riteClock`, `reset()`), `effectStore.ts`, `feedbackStore.ts` (marker, numbers, `tooTired`)
    - Unit tests: `build()` fits 2 boards per door, each store resets to its initial state, feedback store keeps at most 24 numbers
    - Finish
    - _Requirements: 10.5, 12.9, 16.1, 17.1_

  - [x] 3.4 Combat sound emitter
    - New `combatSounds.ts` in `src/game/state/`: `emitCombatSound(id, at?)` raises the matching `subtitleShown` event from the caption table and calls a registered listener, so `src/game/` never imports Howler; a silent device still shows captions
    - Unit tests: every captioned sound raises its caption, a sound without a caption raises none, a missing listener does nothing
    - Finish
    - _Requirements: 6.8, 21.6, 22.1, 22.5_

  - [x] 3.5 Night state clear
    - New `nightState.ts` `clearNightState()` clearing effects, gas, dust and grave-burst queues, live zombies, boss state, feedback, `combat.live`, nailing, projectiles, wave progress and rite flags; add `projectileStore.reset()`; call it from `resetRun` and `startEnding` and when the player is taken
    - Unit tests: each cleared item from the design table is empty afterwards, persisted combat fields are untouched
    - Finish
    - _Requirements: 12.8, 20.2, 20.6_

  - [x] 3.6 Combat actions: firearms
    - New `combatActions.ts`: `fireHeld()` (pull trigger, build the shot from the camera snapshot, `resolveShot`, apply damage and knockdown, one `NoiseEvent`, one `enemyKilled` per kill through the `applyDamage` funnel, feedback, sound and caption, recoil kick returned) and `reloadHeld()`; dry pulls raise no noise and start no reload
    - Unit tests: one round and one noise event per pull even for the shotgun, kill emitted once, Brute knockdown at 3 m or less, Blessed Rounds doubles firearm damage only
    - Finish
    - _Requirements: 3.1, 3.2, 3.3, 3.9, 4.1, 4.6, 6.1, 6.2, 6.8, 10.3, 10.4_

  - [x] 3.7 Combat actions: heavy attack, kick, dodge and consumables
    - `combatActions.ts`: `releaseHeavy(kind)`, `kick()`, `dodge()`, `useHeld()` (Bandage and Lantern Refill timed, Blessed Rounds and Kola Tonic instant)
    - Unit tests: stamina spent only on success, a kick with no target still costs stamina and cooldown, Blessed Rounds and Kola Tonic consume one item and apply their effect, a failed press changes nothing
    - Finish
    - _Requirements: 8.2, 8.5, 9.1, 9.4, 9.7, 9.8, 12.1, 12.2_

  - [x] 3.8 Combat actions: pickups, upgrades and nailing
    - `combatActions.ts`: `takeWeaponPickup(id)` (binds to the first empty hotbar slot, toasts "Satchel full" or "Took the …"), `buyUpgrade(id)`, `startNail(door)`
    - Unit tests: a pickup with too few free slots adds nothing and leaves the pickup, an upgrade purchase is atomic, nailing refused with the prompt text when full or short of material
    - Finish
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 11.2, 11.5, 16.4_

  - [x] 3.9 Combat tick: weapons and effects
    - New `combatTick.ts` `tickCombat(dt, input)` steps 1 to 6 of the design (reconcile, firearm and reload completion, heavy charge, kick/dodge/too-tired timers, consumable use, effects and salt entry); returns at once when `gameStore.taken`; HUD-visible timers written only when the displayed value changes; call it from `TickDriver` in `GameLoop.tsx` after `useDigStore.step`
    - Unit tests: reload completes and moves rounds out of the satchel, pause (`isSimFrozen()`) stops every timer, one 0.1 s step equals ten 0.01 s steps for the timers
    - Finish
    - _Requirements: 4.2, 8.1, 12.5, 12.7, 20.2_

  - [x] 3.10 Combat tick: nailing and feedback
    - `combatTick.ts`: nailing step (`tickNailing`, `nailBoard`, `boardNailed`, nail sound and toast), hit marker and damage number ticks
    - Unit tests: a nail completes after 2 s and spends exactly the cost, moving or taking damage cancels it with no spend, numbers expire by 0.8 s
    - Finish
    - _Requirements: 10.5, 10.12, 16.2, 16.3_

  - [x] 3.11 Combat tick: boss world effects
    - `combatTick.ts`: `tickBoss` with Crane read from `enemyStore`; `spawn` creates `father-crane` (1500 HP, stair point if the catacomb gate is open, else floor break), `swingHit` and `tollRing` call `hurtPlayer` (30, and 20 with a 3 m push), `congregationRise` adds three Shamblers in `rise` state, `quietEnded` emits `bossDefeated` and records `mystery.craneRested`; boss events raise their sounds and captions
    - Unit tests: spawn point choice, dodge invulnerability ignores the Toll, the rite clock counts while not holding, a dead player stops the boss
    - Finish
    - _Requirements: 17.1, 17.2, 17.9, 17.12, 17.13, 17.15, 22.1_

  - [x] 3.12 Player damage, watchers and wiring
    - `retryNight.ts`: `hurtPlayer(dmg, blocking, source?)` returns `false` during dodge invulnerability or when taken, clears timed effects on death; `combatWatchers.ts` `installCombatWatchers()` (`playerDamaged` cancels nailing and consumable use) called from `main.tsx`; `chapelStore.applyRepair` calls `useDoorStore.build()` when stage 1 completes; `settingsStore` exposes `damageNumbers`
    - Unit tests: invulnerable first 0.2 s of a dodge ignores zombie blows, the burst and the Toll; blocking passes through; a Brute blow cancels a reload
    - Finish
    - _Requirements: 4.5, 9.5, 9.6, 12.8, 13.7, 16.1, 16.3, 17.9_

- [x] 4. Scene drivers and meshes
  - [x] 4.1 Shot occlusion
    - New `scene/player/shotOcclusion.ts` `makeWallDistance(world, rapier)` excluding sensors and kinematic bodies, returning `Infinity` on failure
    - `shotOcclusion.test.ts` in the style of `wallProbe.test.ts`: a ray stops at a real box and ignores a sensor and the kinematic player
    - Finish
    - _Requirements: 3.1_

  - [x] 4.2 Input actions and weapon runtime
    - `input.ts`: `InputSnapshot` gains `reload`, `kick`, `dodge`, `heavy` read from the bindings; new `weaponRuntime.ts` (aim flag, recoil state, camera snapshot, muzzle events)
    - Unit tests: rebound keys are read, held buttons are released on pause so a charge does not auto-fire
    - Finish
    - _Requirements: 21.7, 21.11_

  - [x] 4.3 Weapon controller
    - New `WeaponController.tsx`: edge-detects attack, reload, kick and dodge, calls `fireHeld`, `reloadHeld`, `kick`, `dodge`, sets aim when a firearm is in hand, builds the shot origin and direction from the camera plus the recoil offset, cancels reload on weapon switch
    - Finish
    - _Requirements: 3.1, 4.1, 4.4, 5.1, 9.1, 9.4_

  - [x] 4.4 Melee attack: heavy weapons, durability and block
    - `MeleeAttack.tsx`: heavy charge on press or V, release through `resolveRelease`, `knockdownS` and the Sabre Wailer bonus, 1 durability per hitting swing, axe break (remove, caption, equip next hotbar item), cancel on weapon switch, dodge or pause; block is aim held with a melee weapon and feeds `hurtPlayer` and `blockMoveMultiplier`; the Bone Club and Sharpened Shovel now spend durability too
    - Finish
    - _Requirements: 5.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.10, 8.11, 8.12_

  - [x] 4.5 Use controller
    - New `UseController.tsx`: attack press with a consumable in hand starts the timed use (Bandage 2 s, Lantern Refill 1 s), instant for Blessed Rounds and Kola Tonic, "too tired" and hit cancel rules
    - Finish
    - _Requirements: 12.1, 12.2_

  - [x] 4.6 First-person controller: dash, speed, recoil and FOV
    - `FirstPersonController.tsx`: speed `= moveSpeed × slow × effectMods.moveSpeed × aimMoveMult × blockMoveMultiplier`, dash velocity replaces walking while a dodge runs (Rapier stops it at walls), recoil offset added to pitch, `camera.fov = settings.fov − 10 × aimBlend`, impact shake joins the shake maximum and obeys `impactShakeAllowed`
    - Finish
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 9.4, 9.9, 12.2, 21.3, 21.4_

  - [x] 4.7 Weapon poses and meshes
    - New pure `viewmodel.ts` poses (reload, firing kick, heavy charge, aim) with `viewmodel.test.ts`; new `viewmodelWeapons.tsx` building revolver, shotgun, axe and sabre from merged primitives, two draw calls each, cached
    - Finish
    - _Requirements: 2.8, 23.8, 23.9, 23.10_

  - [x] 4.8 Viewmodel wiring and muzzle flash
    - `Viewmodel.tsx` uses the new meshes and poses and feeds durability from `combatStore`; additive muzzle quad from `muzzleOpacity`; new `MuzzleLight.tsx` (one pooled `pointLight`, `castShadow={false}`, skipped when Flashing lights is off)
    - Finish
    - _Requirements: 5.7, 5.8, 5.9, 21.2, 23.10_

  - [x] 4.9 Chapel vestry opening
    - `ChapelBuilding.tsx`: west wall split into two slabs and a lintel at the vestry opening with a frame like the front; `Chapel.tsx`: remove `DoorMesh`
    - Finish
    - _Requirements: 16.1, 16.7_

  - [x] 4.10 Chapel door frames, boards and plaques
    - New `ChapelDoors.tsx`: frames and boards as instanced meshes (colour darkens as health falls, cracked inset under 25%), a canvas plaque per door ("▮▮▯ 2/3"), new `InteractAction` `'nail'` with hold-E nailing via `startNail`; nothing is drawn before stage 1
    - Finish
    - _Requirements: 16.1, 16.2, 16.7, 16.12, 21.5, 23.10_

  - [x] 4.11 Weapon pickups and props
    - New `WeaponPickups.tsx`: vestry cupboard, gatekeeper's lodge, instanced woodpile, Crane crypt step, each an `Interactable` calling `takeWeaponPickup` unless taken
    - Finish
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 23.8_

  - [x] 4.12 Enemy director: targets, doors and door attacks
    - `EnemyDirector.tsx`: `chooseTarget` per zombie, `ctx.doors`, `blocked = wallProbe OR closedDoorBlocks`, `ejectFromClosedDoors` after the tick, `enemyAttack` on a door calls `damageDoor(boardDamageFor(...))`, `boardBroken` with the splinter sound and caption, `enemyAttack` on the player calls `hurtPlayer(damage, blocking)`
    - Finish
    - _Requirements: 14.9, 16.5, 16.6, 16.8, 16.10, 16.11_

  - [x] 4.13 Enemy director: Bloater, Brute, elites and noise
    - `EnemyDirector.tsx`: `bloaterSwell` hiss and caption, `bloaterBurst` with `resolveBurst`, `hurtPlayer(25)` and gas, Brute blow cancels reload, Brute arrival grunt and caption, elite arrival caption (3 s), elite death drop through `rollEliteDrop` placed in the satchel or as a ground drop, Crane suppressed from `enemyAttack`
    - Finish
    - _Requirements: 4.5, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 14.7, 14.10, 15.8, 15.9, 15.10_

  - [x] 4.14 Enemy models: looks, swell and knockdown
    - `EnemyModels.tsx`: Bloater (`zombie.glb` scaled [1.35, 1.1, 1.35], tint `#9aa58a`), Brute (`zombie-brute.glb`, tint `#b5a99a`), Father Crane (scale 1.2, tint `#3a3440`), elite ×1.05, cloned materials, swell scale growth of up to 35% over 0.8 s, a lying pose while knocked down, Crane death clip held on the last frame with a 3 s fade
    - Finish
    - _Requirements: 13.1, 14.1, 15.6, 17.16_

  - [x] 4.15 Elite marks and Crane props
    - New `EliteMarks.tsx` (instanced ember aura and Sigil_Ring pools of 4, steady aura with Flashing lights off) and `CraneProps.tsx` (censer pendulum and stole, merged primitives); mount both from `EnemyModels.tsx`
    - Finish
    - _Requirements: 15.6, 15.7, 17.16, 21.1, 21.5, 23.8_

  - [x] 4.16 Wave director: elites and door attackers
    - `WaveDirector.tsx`: pass `eliteRng`, build enemies with `createEnemy(..., { elite, ...eliteStats })`, copy `doorAttacker`, arrival sound and caption for elites and Brutes
    - Finish
    - _Requirements: 14.7, 15.1, 15.5, 15.8, 16.9_

  - [x] 4.17 Final rite and salt circles
    - `FinalRite.tsx`: set the rite running in `bossStore` when `riteStarted` flips, pass `riteCapS(boss)` into `stepRite`, stop on `dead`; `SaltCircles.tsx`: skip `father-crane` in `constrainToSalt` and compute his `inSalt`
    - Finish
    - _Requirements: 17.1, 17.5, 17.10, 17.12_

  - [x] 4.18 Damage numbers and grave gas
    - New `DamageNumbers.tsx` (one `InstancedMesh` of glyph quads from a canvas atlas, billboarded on the CPU, parchment for body hits, ember with "!" for headshots) and `GraveGas.tsx` with a `gasRuntime` queue (96 instanced quads, 1.2 s life, dust only); dust puff on kills
    - Finish
    - _Requirements: 10.3, 10.5, 10.6, 10.11, 13.6, 23.4, 23.10_

  - [x] 4.19 Mount new scene components
    - `App.tsx`: mount `WeaponController`, `UseController`, `ChapelDoors`, `WeaponPickups`, `DamageNumbers`, `GraveGas` and `MuzzleLight` in the right order relative to `EnemyDirector` and `SaltCircles`
    - Unit test that `App` renders the new components in the scene tree
    - Finish
    - _Requirements: 23.10_

- [x] 5. HUD and workbench UI
  - [x] 5.1 Ammo readout and effect icons
    - New `ui/hud/AmmoReadout.tsx` (bottom right above the hotbar, "M / S", ⟳ Reloading, ○ Empty, ✕ No ammo) and `EffectIcons.tsx` (glyph, SVG countdown ring, seconds text, at most 6, steady ring with Flashing lights off), each with CSS
    - Finish
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 12.9, 12.10_

  - [x] 5.2 Hit marker, crosshair and charge meter
    - New `HitMarker.tsx` inside `Crosshair.tsx` (cross, headshot dot and ring, kill ×1.5, 0.3 s steady with Flashing lights off), new `ChargeMeter.tsx` (bar with text, "Too tired" with a ✕ glyph for 1 s)
    - Finish
    - _Requirements: 8.1, 8.5, 10.1, 10.2, 10.3, 10.10, 21.1_

  - [x] 5.3 Door status and nail prompt
    - New `DoorStatus.tsx` ("Front door 2/3 (60, 41)", only while built); `InteractPrompt.tsx`: "E: Board up" with rune ᚾ and the full or missing-material text; `RepairUI.tsx` shows the stage 1 text
    - Finish
    - _Requirements: 16.4, 16.12, 21.5_

  - [x] 5.4 Boss bar and name card
    - New `BossBar.tsx` (wide, top centre, name, phase marks at 60% and 25% with labels, "1210 / 1500") and `BossNameCard.tsx` ("Father Aldous Crane", "He sealed the doors", 3 s, never takes control)
    - Finish
    - _Requirements: 17.3, 17.4, 17.14, 23.3_

  - [x] 5.5 Upgrade list in the workbench
    - New `workbench/UpgradeList.tsx` (owned weapons only, "old → new" lines, cost, "Bought ᚱ" mark, missing-material text, native focusable buttons); `RecipeBook.tsx` gets an "Upgrades" tab and reads item names from `ITEM_MAP`
    - Finish
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 21.10_

  - [x] 5.6 Settings: damage numbers and controls
    - `Settings.tsx`: "Damage numbers" toggle; new `Controls.tsx` listing every binding, capture of the next key or mouse button, Esc cancels, conflicts shown in a `role="alert"` line using `rebind`, Esc never assignable, "Block / Aim" label
    - Finish
    - _Requirements: 10.8, 21.7, 21.8, 21.9, 21.10_

  - [x] 5.7 Assemble the new HUD
    - `Hud.tsx`: render `AmmoReadout`, `EffectIcons`, `ChargeMeter`, `DoorStatus`, `BossBar`, `BossNameCard` with the `.hud-top-stack` wrapper under the compass using `--hud-compass-h`
    - Structure test: no `font-size` under `1rem` in the new HUD CSS
    - Finish
    - _Requirements: 7.1, 17.4, 21.5_

- [x] 6. Procedural audio and captions
  - [x] 6.1 Synth core and volumes
    - New `src/audio/synth.ts` (`unlockAudio` building a silent non-preloaded primer `Howl` so Howler creates `Howler.ctx`, `sfx` and `music` buses into `Howler.masterGain`, `playSound` from `SOUND_RECIPES` with HRTF panner, 16-voice cap oldest first, shared noise buffer, every call wrapped in try/catch) and `volumes.ts` (settings subscription for master, music and SFX)
    - Unit tests for voice-cap and recipe lookup with a fake context
    - Finish
    - _Requirements: 6.8, 23.7, 23.9_

  - [x] 6.2 Audio manager integration
    - `AudioManager.ts` keeps its export names: `setListener` calls `Howler.pos` and `Howler.orientation`; `playMeleeHit`, `playEnemyCue` and new `playCombatSound` call `playSound`; `syncEnemyLoops` schedules repeating one-shots (Brute step 0.9 s, Bloater gurgle 2.5 s, Crane chains 1.4 s)
    - Unit tests: loops stop when the enemy is gone, a missing `AudioContext` does nothing
    - Finish
    - _Requirements: 14.7, 14.8, 23.7_

  - [x] 6.3 Subtitles queue
    - `Subtitles.tsx` uses the captions queue (max 3 visible, minimum 1.5 s, oldest dropped to make room); combat captions show at every Scare intensity and none when Subtitles is Off
    - Component test: the fourth caption removes the oldest, a short caption stays 1.5 s
    - Finish
    - _Requirements: 22.2, 22.3, 22.4, 22.5_

  - [x] 6.4 Register sounds and unlock audio
    - `main.tsx` registers the `combatSounds` listener to `playCombatSound`; the Title screen's first click calls `unlockAudio()`
    - Unit test: a combat sound reaches the listener and its caption is shown with the listener missing
    - Finish
    - _Requirements: 6.8, 22.1, 23.7_

  - [x] 6.5 Spatial loops and arrival sounds in the enemy director
    - `EnemyDirector.tsx` calls `syncEnemyLoops` each frame for Brute steps, Bloater gurgle and Crane chains, and plays the arrival cues
    - Finish
    - _Requirements: 14.7, 14.8_

- [x] 7. Save, Retry Night and verification tests
  - [x] 7.1 Save and load wiring
    - `saveGame.ts`: `combat` optional on read and always written, `SAVE_VERSION` stays 1; `gameSave.ts`: `captureSave` fills it from `captureCombatSave`, `loadGame` applies `sanitizeCombat`; the `craneRested` flag defaults to false
    - Unit tests: save then load restores weapons, magazines, ammo, upgrades, durability and boards; a pre-07 save loads with defaults; corrupt data hides Continue and leaves storage untouched
    - Finish
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [x] 7.2 Retry Night snapshot and reset
    - `retryNight.ts`: snapshot list built from `COMBAT_PERSISTED` plus the `riteProgress` adapter store, `clearNightState()` called in every path (including the no-snapshot fallback), restores Dusk with the full 30 s, `projectileStore` reset, `retryEpoch` bumped
    - `retryCombat.test.ts` with fast-check
    - **Property 31: Retry Night restores the dusk state and clears the night**
    - Finish
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.8, 20.9_

  - [x] 7.3 Process and integration tests
    - `tests/processRules.test.ts`: every file in `src/game/systems/` has a `*.test.ts`, nothing under `src/game/` imports React, three.js or Howler, no numeric balance literals in `systems/` that equal a `src/data/` value
    - `tests/combatCheckpoint.test.ts`: seeded night 3 and night 5 flows (revolver headshot and reload, axe knockdown of a Brute, nail a board and let a Door_Attacker break it, Bloater chain, elite drop, rite until Crane rises and falls, finish the rite, save, load, retry and compare)
    - Finish
    - _Requirements: 24.1, 24.2, 24.6, 24.7_

- [x] 8. Checkpoint: playtest in a real browser
  - This task is only marked done after a human, or a real Chrome session driven against the dev server, has played the game in a real browser and observed each item below working. Unit tests, lint and build passing are not enough.
  - Observe and confirm:
    - Firearms: a revolver shot and a shotgun shot with the headshot marker (dot and ring), damage numbers ("!" on headshots), recoil, muzzle flash with Flashing lights on and off, ammo HUD ("M / S"), reload with its countdown, and the dry click with "[click]"
    - Gunfire pulling zombies toward the shot (Lurker wake within 15 m, destination replaced)
    - Heavy melee and moves: an axe heavy attack that knocks a zombie down, a sabre hit, a kick and a dodge
    - An upgrade bought at the workbench showing "old → new"
    - Blessed Rounds and Adrenaline icons counting down with glyph, ring and seconds
    - A Bloater burst (0.8 s hiss, grey-green gas, 25 damage, a chain), a Brute, and an elite with its ring and drop
    - Barricades: a door attacked, a board nailed, and a board broken with its subtitle
    - The Father Crane fight through all three phases (name card, bar with phase marks, Toll dodge, Congregation), with the rite held at 44 s and completing after his death ("Forgive them. Not me.")
    - Continue restoring weapons, ammo, upgrades and boards; Retry Night clearing night state
    - Keyboard-only pass through the Upgrades tab and the Controls screen, Camera shake Off and Scare intensity Off removing shakes, frame rate at least 45 fps and fewer than 150 draw calls during the Crane fight, sound sliders changing the new sounds
  - Run `npm run test`, `npm run lint` and `npm run build`, then append the `docs/kiro-log.md` entry with the real completion date. If any observed action fails, leave this task open and record the failing action in `docs/kiro-log.md`.
  - **STOP after this checkpoint and tell the user spec 07 is ready for a playtest. Do not start spec 08.**
  - _Requirements: 24.3, 24.4, 24.5, 24.9, 24.10, 21.1, 21.3, 21.4, 23.10_

## Notes

- All tasks are required. Property tests are part of their system's task and are not optional.
- Each property test file carries the tag `Feature: 07-combat-and-enemies, Property N: <title>` and runs at least 100 cases. A property split over several tasks (7, 16, 25, 27) is tagged in each file with the half it covers.
- Each task references granular requirement numbers for traceability.
- Unit tests live next to their file; process and integration tests sit in `tests/`.
- The design's "Values chosen here" and its proposed bible fixes (Brute stagger wording, Bloater chain, the Toll radius, the rising clock, the chapel being unsafe before stage 1) are already in `docs/game-design.md` (§2 and §7 "Placements and tuning (07)"). Data task 1.x reads them from there. If code and bible disagree, the bible wins and the code changes.
- This spec adds no model, texture or audio file, so `docs/CREDITS.md` does not change.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["1.7", "2.1", "2.3", "2.4", "2.5", "2.7", "2.9", "2.10", "2.11", "2.12", "2.15", "2.17", "2.20", "2.24", "2.25", "2.27", "2.28"] },
    { "id": 3, "tasks": ["2.2", "2.8", "2.13", "2.16", "2.18", "2.21", "2.23", "2.26"] },
    { "id": 4, "tasks": ["2.6", "2.14", "2.19", "2.22"] },
    { "id": 5, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 6, "tasks": ["3.5", "3.6", "3.9", "3.12"] },
    { "id": 7, "tasks": ["3.7", "3.10"] },
    { "id": 8, "tasks": ["3.8", "3.11"] },
    { "id": 9, "tasks": ["4.1", "4.2", "4.7", "4.9", "6.1", "6.3", "7.1"] },
    { "id": 10, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.8", "4.10", "4.11", "4.12", "4.14", "4.16", "4.17", "4.18", "5.1", "5.2", "5.4", "5.5", "5.6", "6.2", "7.2"] },
    { "id": 11, "tasks": ["4.13", "4.15", "5.3", "6.4"] },
    { "id": 12, "tasks": ["4.19", "5.7", "6.5"] },
    { "id": 13, "tasks": ["7.3"] }
  ]
}
```
