# Requirements Document

Spec 08: Progression and Atmosphere

## Introduction
This spec gives Last Rites a reason to come back to each dawn and a stronger mood at night. Each dawn offers a choice of one of three upgrades. Kills build a combo and a score, and a stats screen sums up the run. Zombies drop Grave Coins that the travelling undertaker Silas Vane sells goods for. Side contracts add optional daily goals. Easy, Normal and Hard modes and Endless Survival widen the play, with a saved best score. Achievements are saved in localStorage. Procedural music reacts to the danger nearby and goes silent before a major scare. Storms add rain, thunder and lightning.

All numbers, tables and texts are defined in `docs/game-design.md` §12 (Progression and atmosphere), with related rows in §3 (Currency) and §8 (Dawn). That file is the source of truth. This spec references those values and does not restate different ones. Balance values live in `src/data/`, and rules are pure functions in `src/game/` covered by fast-check property tests. This spec relies on spec 06 (HUD, compass, objective tracker) and spec 07 (combat events, `playerStore.maxHealth`, the Hardened Boards hook in the barricade system, the procedural synth on `Howler.ctx`).

## Glossary
- **Progression_System**: The pure-logic modules in `src/game/systems/` for upgrades, score, coins, merchant, contracts, modes and achievements.
- **Upgrade_Picker**: The dawn overlay that offers 3 upgrades and waits for one pick.
- **Upgrade_Pool**: The 10 dawn upgrades in §12, each with an effect per rank and a max rank.
- **Score_System**: The pure-logic module that turns kill events into points, combo and night score.
- **Combo**: The kill multiplier in §12, from ×1.0 to ×3.0.
- **Night_Score**: The points of one night, as defined in §12.
- **Run_Stats**: The counters in §12 (score, kills by type, accuracy, melee hits, best combo, nights survived, time survived, relics, Grave Coins earned).
- **Stats_Screen**: The end-of-run overlay that shows Run_Stats.
- **Grave_Coins**: The currency counter in §12. It uses no satchel slot.
- **Coin_Pile**: A world pickup of Grave_Coins dropped by a zombie.
- **Merchant**: Silas Vane, the undertaker at the cemetery gate with his hearse cart.
- **Merchant_Stock**: The 2 fixed rows plus 3 drawn pool rows, each with a daily quantity.
- **Contract**: A side goal from the §12 table. Two are dealt each dawn.
- **Mode**: Easy, Normal, Hard or Endless, chosen on New Game.
- **Endless_Survival**: The story-less mode in §12 with its own wave formula.
- **Achievement**: One of the 12 goals in §12, saved under `lastrites:achievements`.
- **Achievement_Toast**: The parchment toast shown on an unlock.
- **Music_Director**: The module that picks a music layer (0 to 3) and drives the procedural music.
- **Storm_System**: The module that rolls storms and times rain, lightning and thunder.
- **Lightning_Flash**: The 0.15 s cold-white light of a strike, or its slow alternative.
- **Synth**: The procedural Web Audio layer from spec 07, running on `Howler.ctx`.
- **Flashing_Lights**: The accessibility setting that turns flashes and pulses into steady or slow changes.
- **Camera_Shake**: The accessibility setting that turns camera shake on or off.
- **Scare_Intensity**: The setting with Full, Reduced and Off.
- **Save**: The localStorage record under `lastrites:save`.
- **Retry_Snapshot**: The dusk snapshot restored by Retry Night.
- **Night_State**: State that lasts one night: Combo, Night_Score in progress, Coin_Piles, Contract progress made during the night, lightning timers and the music layer.
- **Persistent_State**: Mode, upgrades with ranks, score so far, Grave_Coins, Contracts with progress, Merchant_Stock left, Run_Stats, storm state for the current phase and a pending dawn pick.

## Requirements

### Requirement 1: Dawn upgrades
**User Story:** As a player, I want to pick one of three upgrades each dawn, so that my build grows over the five nights.

#### Acceptance Criteria
1. THE Upgrade_Pool SHALL contain exactly the 10 upgrades of §12 (Iron Constitution, Steady Hands, Long Wick, Deep Pockets, Second Wind, Gravedigger, Hardened Boards, Grim Harvest, Marksman, Blessed Reach), each with its id, effect per rank and max rank, defined in `src/data/`.
2. WHEN dawn starts, THE Upgrade_Picker SHALL offer min(3, number of upgrades below max rank) distinct upgrades drawn from the Upgrade_Pool, using a seedable random source so that the same seed and owned ranks give the same offer.
3. THE Upgrade_Picker SHALL exclude every upgrade whose owned rank equals its max rank from the offer.
4. IF 1 or 2 upgrades are below max rank, THEN THE Upgrade_Picker SHALL offer only those, and IF 0 are below max rank, THEN THE Upgrade_Picker SHALL not be shown and THE Dawn_Controller SHALL run dawn without waiting for a pick.
5. WHILE a dawn pick is pending, THE Dawn_Controller SHALL hold the dawn phase indefinitely and SHALL NOT start the day, and the pause menu SHALL remain available.
6. WHEN the player picks an upgrade, THE Progression_System SHALL raise that upgrade's rank by exactly 1 and the Dawn_Controller SHALL release the dawn; any further pick input for the same dawn SHALL be ignored.
7. WHEN Iron Constitution is picked, THE Progression_System SHALL raise `playerStore.maxHealth` by 15 and raise current HP by 15, capped at the new max HP.
8. THE Progression_System SHALL apply Steady Hands, Long Wick, Deep Pockets, Second Wind, Gravedigger, Hardened Boards, Grim Harvest, Marksman and Blessed Reach through one pure function from owned ranks to modifiers, with the per-rank values of §12 and with identity modifiers (no change) at rank 0.
9. WHERE Hardened Boards is owned, THE barricade system SHALL give every board nailed afterwards a health of 75 (60 raised by 25%) through the hook from spec 07.
10. THE Upgrade_Picker SHALL show each card with the upgrade name, the current rank out of the max rank (for example "Rank 1/2"), and each changed stat in the form "old → new", and every card SHALL be selectable with the keyboard and show a visible focus state.
11. WHEN a run is saved and later continued, THE Progression_System SHALL restore all owned ranks unchanged, and WHEN a New Game starts, THE Progression_System SHALL reset all ranks to 0.
12. FOR ALL owned-rank maps and random seeds, THE offer function SHALL return distinct upgrades, each below max rank, and at most 3 of them (invariant property).
13. FOR ALL owned-rank maps, applying a pick SHALL never raise any rank above its max rank and SHALL leave every other upgrade's rank unchanged (invariant property).

### Requirement 2: Score and combo
**User Story:** As a player, I want kills to build a combo and a score, so that skilled play feels rewarded.

#### Acceptance Criteria
1. WHEN an `enemyKilled` event with a new uid and a known enemy type is received, THE Score_System SHALL first update the Combo per criterion 2, then add to the score the value (type points from §12, doubled if the enemy is an elite, plus 5 if the kill was a headshot) × the updated Combo × the Mode score multiplier, rounded to the nearest whole point.
2. WHEN an `enemyKilled` event is received 4 s or less after the previous counted kill, THE Score_System SHALL raise the Combo by 0.25, capped at ×3.0; WHEN it is received with no previous kill or more than 4 s after it, THE Score_System SHALL set the Combo to ×1.0 before scoring.
3. WHILE the Combo is above ×1.0, WHEN more than 4 s of simulation time pass without a counted kill, THE Score_System SHALL reset the Combo to ×1.0; the 4 s timer SHALL NOT advance while the game is paused.
4. WHEN a night is cleared, THE Score_System SHALL set the Night_Score to the night's kill points (as scored by criterion 1) plus 100 × the night number, plus 200 if the player took 0 damage during that night, with the Mode score multiplier applied to the 100 × night and 200 bonuses.
5. WHEN `bossDefeated` is received for the first time in a run, THE Score_System SHALL add 1000 points from §12 using the same Combo and Mode score multiplier calculation as criterion 1; later `bossDefeated` events in the same run SHALL add 0.
6. WHILE a run is active, THE HUD SHALL show the score as a whole number; WHILE the Combo is above ×1.0, THE HUD SHALL show the Combo multiplier as text (for example "×1.25") and a bar that shrinks from full to empty over the 4 s window; WHILE the Combo is ×1.0, THE HUD SHALL hide the Combo text and bar.
7. WHEN the Combo rises and Flashing_Lights is On, THE HUD SHALL pulse the Combo text for 0.2 s; WHEN the Combo rises and Flashing_Lights is Off, THE HUD SHALL change the Combo text without a pulse.
8. IF an `enemyKilled` event repeats a uid already counted, or has an enemy type not defined in `src/data/`, THEN THE Score_System SHALL ignore it, leaving the score, Combo and Combo timer unchanged.
9. THE point values, combo step, combo cap, combo window and bonus values SHALL be defined in `src/data/`.
10. FOR ALL kill sequences, THE Combo SHALL stay between ×1.0 and ×3.0 and the score SHALL never decrease (invariant property).
11. FOR ALL kill sequences, replaying the same events SHALL produce the same score and Combo (determinism property).
12. FOR ALL kill sequences with kills spaced more than 4 s apart, each kill SHALL score its base points at ×1.0 before the Mode score multiplier (metamorphic property).

### Requirement 3: Run stats and the stats screen
**User Story:** As a player, I want an end-of-run summary, so that I can see how I did.

#### Acceptance Criteria
1. WHEN a kill, melee hit, Combo change, relic pickup or Grave_Coins gain event occurs, THE Run_Stats tracker SHALL update kills by type, melee hits, best Combo, relics and Grave_Coins earned in the same simulation tick, and best Combo SHALL only ever increase during a run.
2. WHEN a `firearmFired` event is received, THE Run_Stats tracker SHALL raise shots fired by 1 and, if `hit` is true, raise shots hit by 1.
3. THE Run_Stats tracker SHALL compute accuracy as shots hit divided by shots fired, rounded down to a whole-number percentage, and as 0% when no shots were fired.
4. WHILE the game is paused, THE Run_Stats tracker SHALL not add to time survived.
5. WHEN the run ends in an ending, or in death without Retry Night, THE Stats_Screen SHALL show score, kills by type, accuracy, melee hits, best Combo, nights survived, time survived, relics and Grave_Coins earned, and SHALL show a value of 0 for any stat with no recorded events.
6. THE Stats_Screen SHALL show time survived in the form "m:ss" with seconds zero-padded to 2 digits and minutes unbounded, and accuracy in the form "N%".
7. WHEN the player closes the Stats_Screen, THE game SHALL return to the title screen.
8. WHEN the Stats_Screen is shown, THE Stats_Screen SHALL be operable by keyboard alone, with a visible focus state on the close control.
9. IF an event carries a missing or unknown field, such as an unrecognised enemy type, THEN THE Run_Stats tracker SHALL ignore that event, leave all stats unchanged and not throw.
10. FOR ALL event sequences, accuracy SHALL be between 0 and 100 and shots hit SHALL never exceed shots fired (invariant property).
11. FOR ALL Run_Stats values, serializing then parsing SHALL produce an equal value (round-trip property).

### Requirement 4: Grave Coins
**User Story:** As a player, I want zombies to drop coins, so that fights feed what I can buy.

#### Acceptance Criteria
1. WHEN an `enemyKilled` event is received, THE Coin_System SHALL compute the base coins from §12 for the enemy type: Shambler 1 coin with a 50% chance (otherwise 0), Wailer 2, Lurker 2, Bloater 2, Brute 5, plus 5 if the enemy is an elite.
2. WHERE Grim Harvest is owned at rank R (1 or 2), THE Coin_System SHALL set the drop to floor(base × (1 + 0.25 × R)), applied after the elite bonus, so a 1-coin Shambler drop stays 1 at both ranks.
3. THE Coin_System SHALL take its random rolls from a seeded generator, so the same seed and the same sequence of kills always produce the same drops.
4. IF the computed drop is 0 coins, THEN THE Coin_System SHALL create no Coin_Pile and show no subtitle.
5. WHEN a drop of 1 or more coins is computed, THE world SHALL create one Coin_Pile holding that amount at the kill position, shown as a small pile.
6. WHEN the player comes within 1.5 m of a Coin_Pile, THE Coin_System SHALL add the pile's coins to Grave_Coins once, remove the pile, and show the subtitle "[+N grave coins]" with N the pile's amount, only while subtitles are enabled.
7. WHEN 60 s of simulated game time have passed since a Coin_Pile dropped without being collected, THE Coin_System SHALL fade the pile out and remove it, and the coins in it SHALL be lost.
8. THE HUD SHALL show the Grave_Coins count as a whole number with a coin glyph and the text "coins", and SHALL update it within the same frame the count changes.
9. THE Grave_Coins counter SHALL use no satchel slot.
10. FOR ALL drop rolls, THE coins dropped SHALL be a whole number of 0 or more, and the Grave_Coins total SHALL never be negative (invariant property).
11. THE coin values, drop chances, elite bonus, Grim Harvest rate, collect radius (1.5 m) and fade time (60 s) SHALL be defined in `src/data/`.

### Requirement 5: The dawn merchant
**User Story:** As a player, I want a travelling undertaker to sell me ammo and medicine, so that coins turn into survival.

#### Acceptance Criteria
1. WHEN dawn is released and the day starts, THE Merchant SHALL appear at the cemetery gate with his hearse cart, built from primitive meshes with no model file. Day 1 has no preceding dawn, so the Merchant first appears on day 2.
2. WHEN the Merchant appears, THE game SHALL show the subtitle "[a hearse cart creaks to the gate]" for as long as other subtitles are shown, IF subtitles are enabled.
3. WHILE the Merchant is present, THE Compass SHALL show a marker for him as a glyph with text.
4. WHEN 90 s of day sim time have passed since the day started, THE Merchant SHALL leave and THE Compass marker SHALL be removed.
5. WHILE the phase is dusk or night, THE Merchant SHALL be absent.
6. WHEN dawn is released, THE Merchant_Stock SHALL be dealt as 2 fixed rows (Bandage, Lamp Oil) and 3 rows drawn without repeats from the pool, with the prices and daily quantities of §12. Stock SHALL stay unchanged for the rest of that day, including when the game is paused, saved or loaded.
7. THE Merchant_Stock dealer SHALL exclude Revolver Cartridges until the revolver is owned and Shotgun Shells until the shotgun is owned.
8. WHEN the player presses Interact within 2.5 m of the Merchant, THE Merchant_Menu SHALL open.
9. WHEN the player buys a row and has at least the row price in Grave_Coins, free satchel space for the item (or a non-full stack of the same item) and quantity left of at least 1, THE Merchant SHALL subtract the price, reduce the quantity by 1 and add the row's item count to the satchel.
10. IF the player lacks coins, satchel space or the row is sold out, THEN THE Merchant_Menu SHALL refuse the purchase, show the reason as text naming which of the three failed, and leave coins, quantity and satchel unchanged.
11. WHEN the Merchant leaves, THE Merchant_Menu SHALL close if open, and any purchase not yet completed SHALL be cancelled with no coins spent.
12. WHILE the Merchant_Menu is open, THE Merchant_Menu SHALL show each row with item name, price, quantity left and the player's coin count, and SHALL be operable with the keyboard with a visible focus state.
13. WHILE the Merchant_Menu is open and the player is more than 2.5 m from the Merchant, THE Merchant_Menu SHALL close.
14. FOR ALL seeds and owned weapons, THE dealt stock SHALL have exactly 5 rows with no repeated item (invariant property).
15. FOR ALL purchase sequences, Grave_Coins SHALL never go below 0 and no quantity SHALL go below 0 (invariant property).
16. FOR ALL valid purchases, coins spent SHALL equal the row price and the item count gained SHALL equal the row's item count (metamorphic property).

### Requirement 6: Side contracts
**User Story:** As a player, I want optional daily goals, so that I have small reasons to try different weapons and actions.

#### Acceptance Criteria
1. WHEN dawn starts, THE Contract_System SHALL discard the previous Contracts and deal 2 different Contracts from the §12 table, and WHEN a new run starts, THE Contract_System SHALL deal the first 2 Contracts the same way, so day 1 has Contracts.
2. THE Contract_System SHALL deal only Contracts the player can complete now: it SHALL exclude a Contract that needs a weapon the player does not own (`c-shotgun-5` needs the shotgun, `c-revolver-head-3` needs the revolver), `c-boards-3` while the barricades are not built, and `c-wailer-2` while the coming night has fewer than 2 Wailers.
3. IF fewer than 2 possible Contracts exist, THEN THE Contract_System SHALL deal as many as exist, down to 0, and the journal SHALL show no entry for the missing slots.
4. WHEN an `enemyKilled`, `digCompleted`, `boardNailed` or `itemCollected` event occurs, THE Contract_System SHALL advance the progress of each dealt Contract that matches it by 1, counting only events that satisfy that Contract's goal text (for `itemCollected`, only materials; for `enemyKilled`, only the stated weapon, enemy type or headshot condition).
5. THE Contract_System SHALL keep each Contract's progress from the moment of the deal until the next dawn, including across pause and save/load.
6. WHEN a Contract's progress reaches its goal, THE Contract_System SHALL add its reward to Grave_Coins exactly once and show a toast reading "Contract done: NAME, +N coins" for 3 s.
7. WHEN a night ends, THE Contract_System SHALL complete `c-unhurt`, if it is dealt, IF the player took 50 damage or less during that night; otherwise it SHALL leave `c-unhurt` incomplete with no reward.
8. THE journal SHALL list each dealt Contract with its goal text, progress as "n/goal", its reward in coins, and a "Done" tag once complete.
9. THE Contract goals, rewards and weapon requirements SHALL be defined in `src/data/`.
10. THE Contract_System SHALL pay a Contract's reward at most once per deal, and events arriving after completion SHALL NOT change progress or pay again.
11. FOR ALL event sequences, a Contract's progress SHALL never exceed its goal and never decrease (invariant property).
12. FOR ALL seeds, owned-weapon sets, barricade states and coming-night Wailer counts, the dealt Contracts SHALL be at most 2, distinct from each other, and each possible under the rules of criterion 2 (invariant property).

### Requirement 7: Modes
**User Story:** As a player, I want a difficulty choice and an endless mode, so that the game fits my skill and my appetite.

#### Acceptance Criteria
1. WHEN New Game is chosen, THE mode select screen SHALL offer exactly four options (Easy, Normal, Hard and Endless Survival), with Normal selected by default, and every option SHALL be selectable by keyboard with a visible focus state.
2. THE Mode modifiers SHALL use these values and be defined in `src/data/`: zombie HP ×0.75 / ×1 / ×1.25, zombie damage ×0.6 / ×1 / ×1.4, lantern drain ×0.75 / ×1 / ×1, elite chance 4% / 6% / 10%, and score multiplier ×0.75 / ×1 / ×1.5 for Easy / Normal / Hard.
3. WHEN a zombie spawns, THE wave system SHALL set its HP to base HP × the Mode zombie HP value and its hit damage to base damage × the Mode zombie damage value.
4. THE lantern system SHALL multiply fuel drain by the Mode lantern drain value.
5. WHEN the elite roll is made for a spawning zombie, THE wave system SHALL use the Mode elite chance as its probability.
6. WHEN a kill awards points, THE score system SHALL multiply those points by the Mode score multiplier, after the combo multiplier.
7. WHILE Endless_Survival is active, THE game SHALL use the Normal modifiers, a 120 s day, no relics, no rite and no Retry Night, and the player's death SHALL end the run.
8. WHILE Endless_Survival is active, THE wave generator SHALL build night `n` as `min(2 + floor(n / 2), 6)` waves, each with `4 + n` shamblers, `floor(n / 2)` wailers, `floor((n − 1) / 2)` lurkers, `floor((n − 2) / 2)` bloaters and `floor((n − 3) / 3)` brutes, with each count floored at 0.
9. WHILE Endless_Survival is active and night `n` is above 5, THE wave system SHALL multiply zombie HP by 1.08 for each night after night 5 (1.08^(n − 5)), and SHALL apply no such scaling on nights 1 to 5.
10. WHEN an Endless_Survival run ends, THE game SHALL store the run's score in `lastrites:endless-best` only if it is greater than the stored best, and SHALL leave the stored best unchanged otherwise.
11. IF `lastrites:endless-best` is missing, is not a number, or holds a value that is not finite or is below 0, THEN THE game SHALL treat the best score as 0 and SHALL not raise an error.
12. IF writing `lastrites:endless-best` fails, THEN THE game SHALL keep running, SHALL show the higher of the run score and the earlier best on the Stats_Screen for the current session, and SHALL not crash.
13. WHEN an Endless_Survival run ends, THE Stats_Screen SHALL show the Endless best score after the update in criterion 10.
14. THE mode select screen SHALL show each Mode's modifiers (zombie HP, zombie damage, lantern drain, elite chance, score multiplier) as text, and for Endless Survival SHALL show the 120 s day, no relics or rite, and no Retry Night.
15. FOR ALL n from 1 to 50, THE Endless wave generator SHALL return a wave count between 2 and 6 and integer counts of 0 or more for every zombie type (invariant property).
16. FOR ALL n from 1 to 49, THE Endless shambler count per wave SHALL equal 4 + n and SHALL be strictly greater than the count for n − 1 (metamorphic property).

### Requirement 8: Achievements
**User Story:** As a player, I want achievements that are remembered, so that I have long-term goals.

#### Acceptance Criteria
1. THE Achievement_System SHALL define the 12 Achievements of §12 in `src/data/`, each with a unique ID, a name and a goal text, and each goal text non-empty.
2. WHEN an Achievement's goal is met and the Achievement is not yet unlocked, THE Achievement_System SHALL unlock it, write the full unlocked set to `lastrites:achievements` and show one Achievement_Toast with its name within 1 s.
3. WHEN an Achievement unlocks, WHERE Subtitles are on, THE game SHALL show the subtitle "[achievement: NAME]" for the same duration as other subtitles.
4. WHEN several Achievements unlock in the same simulation tick, THE Achievement_System SHALL unlock all of them and show their Achievement_Toasts one after another, with at most 3 visible at once and the rest queued in unlock order.
5. WHERE Flashing_Lights is Off, THE Achievement_Toast SHALL fade in and out over at least 0.5 s each way, with no flash or pulse.
6. THE Achievements menu SHALL be reachable from the title screen and the pause screen, and SHALL be operable with the keyboard alone, with a visible focus state on every focusable control.
7. WHEN the Achievements menu opens, THE game SHALL list unlocked Achievements with name and goal, and locked ones as dim outlines with their goal text and a "Locked" tag, so that locked state is never shown by dimming alone.
8. WHEN New Game is chosen, THE game SHALL keep all unlocked Achievements and the `lastrites:endless-best` score, and SHALL reset the per-run counters used by the goals "in one run" and "in one night".
9. IF `lastrites:achievements` is missing, holds unparseable data, or holds entries that are not one of the 12 known IDs, THEN THE Achievement_System SHALL start from the valid entries only (an empty set when none), ignore the bad entries and continue without an error shown to the player.
10. IF writing to `lastrites:achievements` fails (storage full, blocked or unavailable), THEN THE Achievement_System SHALL still unlock the Achievement for the current session, show its toast and keep running without an error shown to the player.
11. FOR ALL sets of unlocked Achievements, serializing then parsing SHALL produce an equal set (round-trip property).
12. FOR ALL event sequences, re-evaluating an already unlocked Achievement SHALL not unlock it again nor show another toast (idempotence property).
13. FOR ALL event sequences, the unlocked set SHALL never shrink (invariant property).

### Requirement 9: Reactive music
**User Story:** As a player, I want the music to follow the danger, so that tension builds and then drops before a scare.

#### Acceptance Criteria
1. THE Music_Director SHALL select exactly one layer from §12 by the first matching rule: layer 3 if the nearest zombie is at 6 m or less or Father Crane is on the field; else layer 2 if a wave is running or the nearest zombie is at 15 m or less; else layer 1 if the phase is dusk or the nearest zombie is at 30 m or less; else layer 0. Distance limits are inclusive, and when no zombie exists the nearest distance SHALL be treated as infinite.
2. WHEN the selected layer changes, THE Music_Director SHALL crossfade from the current gains to the new layer over 2 s. IF the layer changes again during a crossfade, THEN THE Music_Director SHALL start a new 2 s crossfade from the current gains without an audible jump.
3. THE Synth SHALL generate all music procedurally on `Howler.ctx`, with no audio files.
4. THE Music_Director SHALL scale the music output by the music volume setting and the master volume setting (each 0 to 100), and a volume change SHALL apply to music already playing without restarting it.
5. WHEN a major scare is within 1.5 s of its beat, THE Music_Director SHALL fade the music to 0 over 0.3 s and hold silence until 2 s after the beat. IF the scare is announced with less than 1.5 s remaining, THEN THE Music_Director SHALL start the 0.3 s fade immediately.
6. IF a second major scare's silence window begins while silence is held, THEN THE Music_Director SHALL extend the silence until 2 s after the later beat.
7. WHILE the scare silence is held, THE Music_Director SHALL keep tracking the layer, and WHEN the silence ends, THE Music_Director SHALL fade in the current layer, not the layer from before the silence.
8. IF the audio context is suspended or missing, THEN THE Music_Director SHALL stay silent and throw no error, and WHEN the context becomes running, THE Music_Director SHALL start the current layer.
9. WHILE the game is paused, THE Music_Director SHALL freeze crossfade and silence timers, and WHEN the game resumes, THE Music_Director SHALL continue them from where they stopped.
10. THE layer function SHALL be a pure function of phase, wave state, nearest zombie distance and boss presence.
11. FOR ALL inputs, THE layer function SHALL return an integer from 0 to 3 (invariant property).
12. FOR ALL pairs of nearest-zombie distances a ≤ b with other inputs equal, layer(a) SHALL be greater than or equal to layer(b) (metamorphic property).

### Requirement 10: Storms
**User Story:** As a player, I want storms with rain and lightning, so that some nights feel wilder.

#### Acceptance Criteria
1. WHEN a night starts, THE Storm_System SHALL roll once for a storm using the chance for that night number (night 1: 0%, night 2: 25%, night 3: 40%, night 4: 50%, night 5: 100%).
2. WHEN a day starts, THE Storm_System SHALL roll once for a storm with a 15% chance.
3. THE Storm_System SHALL draw all storm randomness (storm roll, lightning gaps, thunder delays) from a seeded random generator, so that the same seed produces the same storm sequence.
4. IF a night number has no configured storm chance, THEN THE Storm_System SHALL treat the chance as 0% and SHALL NOT start a storm.
5. WHILE a storm is active, THE scene SHALL show rain as instanced streaks around the camera, THE Synth SHALL play procedural rain noise, THE Fog_System SHALL add 0.01 to fog density, and THE Lantern_System SHALL multiply lantern fuel drain by 1.2.
6. WHILE a storm is active, THE Storm_System SHALL strike lightning at intervals of 20 to 45 s, with the first strike also 20 to 45 s after the storm starts.
7. WHEN lightning strikes and Flashing_Lights is On, THE scene SHALL show a Lightning_Flash of 0.15 s that lights the whole cemetery.
8. WHEN lightning strikes and Flashing_Lights is Off, THE scene SHALL brighten the cemetery slowly over 1.5 s to 30% brightness and SHALL NOT show a flash.
9. WHEN lightning strikes, THE Synth SHALL play procedural thunder 1 to 4 s later and, WHERE Subtitles is On, THE HUD SHALL show the subtitle "[thunder]" for the duration of the thunder.
10. WHEN thunder is close and Camera_Shake is On and Scare_Intensity is Full, THE camera SHALL shake; WHEN Camera_Shake is Off or Scare_Intensity is Reduced or Off, THE camera SHALL NOT shake.
11. WHEN a storm ends, THE Storm_System SHALL fade out rain and rain noise, cancel pending lightning strikes, and remove the fog and lantern drain modifiers. IF thunder is already scheduled when the storm ends, THEN THE Synth SHALL still play it.
12. WHEN the game is paused, THE Storm_System SHALL pause lightning and thunder timers and rain noise, and WHEN the game resumes THE Storm_System SHALL continue them from where they stopped.
13. THE Synth SHALL play thunder and rain noise at the SFX volume (scaled by the master volume).
14. THE storm chances, lightning interval, flash length, slow-brighten values and thunder delay SHALL be defined in `src/data/`.
15. THE rain SHALL use one instanced mesh and add no more than 1 draw call.
16. FOR ALL seeds, lightning gaps SHALL be between 20 and 45 s and thunder delays between 1 and 4 s (invariant property).
17. FOR ALL nights, WHEN the chance is 0% no storm SHALL roll and WHEN it is 100% a storm SHALL always roll (boundary property).
18. FOR ALL seeds, running the Storm_System twice with the same seed and the same night sequence SHALL produce identical storm rolls and lightning timings (determinism property).

### Requirement 11: Saving, loading and Retry Night
**User Story:** As a player, I want progress saved and a failed night reset cleanly, so that nothing is lost or duplicated.

#### Acceptance Criteria
1. THE Save SHALL include Persistent_State.
2. THE game SHALL store Achievements under `lastrites:achievements` and the Endless best score under `lastrites:endless-best`, each separately from the Save.
3. WHEN New Game is chosen, THE game SHALL clear the Save's Persistent_State and SHALL leave the stored Achievements and Endless best score unchanged.
4. WHEN a Save is loaded, THE game SHALL restore Persistent_State.
5. WHEN a Save that has a pending dawn pick is loaded, THE game SHALL show the Upgrade_Picker again with the same 3 offers and SHALL NOT draw new offers.
6. WHEN Retry Night is used, THE game SHALL reset Night_State: Combo, the Night_Score in progress, Coin_Piles, Contract progress made during the failed night, lightning timers and the music layer.
7. WHEN Retry Night is used, THE game SHALL return Persistent_State to its Retry_Snapshot values from dusk.
8. IF a Save lacks fields added by this spec, THEN THE loader SHALL fill each missing field with its default (Normal mode, no upgrades, 0 coins, no Contracts, empty stats) and SHALL load without error.
9. IF a Save holds an invalid value in a field added by this spec (wrong type, out of range, unknown ID, or an upgrade rank above its maximum), THEN THE loader SHALL replace only that value with its default, keep every other field, and load without error.
10. THE loader SHALL treat every field added by this spec as optional on read and SHALL sanitise each field separately, as specs 06 and 07 do.
11. THE game SHALL keep SAVE_VERSION unchanged, and a Save written before this spec SHALL load with the defaults from criterion 8 and with all its earlier fields intact.
12. IF the stored Achievements or Endless best score is missing or unparseable, THEN THE game SHALL use no unlocked Achievements or a best score of 0 respectively, SHALL show no error to the player, and SHALL NOT alter the Save.
13. FOR ALL valid Persistent_State values, serializing then parsing SHALL produce an equal value (round-trip property).
14. FOR ALL Persistent_State values, taking a Retry_Snapshot at dusk and restoring it SHALL return the same Persistent_State (idempotence property).

### Requirement 12: Accessibility and keyboard use
**User Story:** As a player with access needs, I want every new screen and effect to follow my settings, so that I can play comfortably.

#### Acceptance Criteria
1. THE Upgrade_Picker, Merchant_Menu, Achievements menu, mode select screen and Stats_Screen SHALL allow every control to be reached and activated using only the keyboard (Tab, Shift+Tab, Enter, Space, arrow keys), with a visible focus state on the focused control.
2. WHEN the Upgrade_Picker, Merchant_Menu, Achievements menu, mode select screen or Stats_Screen opens, THE game SHALL move keyboard focus to a control inside it within 100 ms.
3. WHEN one of those overlays closes, THE game SHALL return keyboard focus to the control that had focus before it opened, or to the first control of the underlying screen if that control no longer exists.
4. WHILE one of those overlays is open, THE game SHALL keep Tab focus cycling inside it.
5. THE new UI SHALL convey state with text or a glyph in addition to colour, including Contract "Done" tags, Achievement locks, rank counts (such as "1/2") and Combo values (such as "×1.75").
6. WHERE Flashing_Lights is off, THE Combo flash, Lightning_Flash and Achievement_Toast SHALL replace any flash or pulse with a steady or slow change that lasts at least 300 ms, and Lightning_Flash SHALL be a 1.5 s brightening to 30% with no flash.
7. WHERE Camera_Shake is off, or Scare_Intensity is Reduced or Off, THE game SHALL apply no camera shake from thunder.
8. WHILE subtitles are on, THE game SHALL show a subtitle for each of: thunder, the Merchant's arrival, a coin pickup, Contract completion and Achievement unlock.
9. WHILE subtitles are off, THE game SHALL still show the toast text for Contract completion and Achievement unlock, each for at least 3 s.
10. IF a major scare is active when the player tries to open the Merchant_Menu, Achievements menu or Stats_Screen, THEN THE game SHALL keep it closed until the scare ends.
11. IF the Upgrade_Picker is due while a major scare is active, THEN THE game SHALL open it once the scare ends and SHALL hold dawn until the player picks an upgrade.
12. WHILE any of the new menus is open, THE Pause key (Esc) SHALL open the pause screen, including during a major scare, and closing the pause screen SHALL return focus to the control that had it.

### Requirement 13: Pacing and horror rules
**User Story:** As a designer, I want the new systems to respect the tension curve, so that they add to the horror.

#### Acceptance Criteria
1. WHILE the game phase is day and fewer than 90 s of sim time have elapsed since dawn release, THE Merchant SHALL be present at the cemetery gate.
2. WHEN 90 s of sim time have elapsed since dawn release, THE Merchant SHALL leave, and any open Merchant menu SHALL close with the player's Grave Coins and satchel unchanged by the closing.
3. WHILE the game phase is dusk or night, THE Contract and Merchant menus SHALL NOT open, and an attempt to open either SHALL be ignored with no change to Grave Coins, stock or contracts.
4. WHEN the phase changes to dusk while a Contract or Merchant menu is open, THE System SHALL close that menu within 1 frame.
5. WHEN a major scare fires, THE Music_Director SHALL fade music to 0 over 0.3 s starting 1.5 s before the scare's beat and hold it silent until 2 s after the beat, for every Scare_Intensity setting (Full, Reduced and Off).
6. THE storm system SHALL NOT start a Lightning_Flash within 1.5 s before a major scare's beat.
7. IF a Lightning_Flash is due within 1.5 s before a major scare's beat, THEN THE storm system SHALL delay it until after the beat and keep the next thunder 1 to 4 s after the delayed flash.
8. WHERE Flashing lights is Off, THE 1.5 s slow brightening that replaces the Lightning_Flash SHALL also NOT start within 1.5 s before a major scare's beat.
9. THE scare director's cooldowns, chances and event rules from spec 05 SHALL remain unchanged: 45 s between major scares and 15 s between minor scares.

### Requirement 14: Assets, data and testing
**User Story:** As a developer, I want clean data and tests, so that the systems stay reliable and shippable.

#### Acceptance Criteria
1. THE game SHALL load 0 new audio files and 0 new model files for this spec, and THE Merchant and his hearse cart SHALL be built only from primitive meshes.
2. THE Progression_System SHALL contain 0 imports of React, three.js or Howler.
3. THE balance values of this spec (upgrades, score and combo, Grave Coins, merchant stock and prices, contracts, modes, achievements, music layers, storm chances) SHALL be defined in `src/data/` with values equal to §12 of `docs/game-design.md`, and no system SHALL contain a numeric literal for them.
4. IF a value in `src/data/` differs from §12 of `docs/game-design.md`, THEN THE test suite SHALL fail with a test naming the mismatched value.
5. EACH new system in `src/game/systems/` SHALL have a matching `*.test.ts` file containing the fast-check property tests stated in this spec, and `npm run test` SHALL pass with 0 failures.
6. WHEN a task of this spec is completed, THE developer SHALL add an entry to `docs/kiro-log.md` dated with the real calendar date of completion.
7. THE final checkpoint of this spec SHALL be marked done only after the game has been played in a real browser (Chrome, Edge or Firefox) through at least one full night, and `npm run build` and `npm run lint` finish with 0 errors.
8. WHILE a storm is active, THE game SHALL render at a 60 fps target, SHALL stay at or above 45 fps in normal play, and SHALL use fewer than 150 draw calls on a mid-range laptop at 1080p.
