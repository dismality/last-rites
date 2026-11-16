# Requirements Document

## Introduction

Spec 11 is the horror pass for Last Rites. Playtesting showed that the game needs to be scarier and easier to read. This spec adds screen jumpscares (H1), three new creatures (H2), a contract for horror-game zombie looks (H3), watching bats (H4), journal and HUD info dots (H5), a coin-operated vending machine in the hut (H6), and detailed first-person hands with a more realistic lantern light (H7). Requirement 8 adds the design bible §12 "Horror pass" and the cross-cutting rules.

Content source: `docs/kiro-prompt-next.md` Part C and `docs/kiro-prompt-horror-pass.md`. Where those two differ, `docs/kiro-prompt-next.md` wins, because it records that `zombie.glb` is already a realistic gravedigger on the shared skeleton. The spec follows the project steering for horror design, accessibility, tech and structure. It runs after the scenery swap (11n).

Models, rigs, animations and jumpscare images are made by Claude in Blender at fixed paths. Where a file is missing, the code is built against a clearly marked placeholder.

### Priority order if the 26 November freeze cuts scope

Build and finish in this order, and cut from the end:

1. H6 vending machine (Requirement 6)
2. H1 screen jumpscares (Requirement 1)
3. H4 bats (Requirement 4)
4. H5 info dots (Requirement 5)
5. H7 hands and lantern light (Requirement 7)
6. H2 new creatures (Requirement 2) and H3 zombie looks (Requirement 3), which depend on Claude's models

Requirement 8 (design bible, cross-cutting rules) is never cut. The sections of the design bible for cut items are marked as cut.

## Glossary

- **Game**: The Last Rites browser game.
- **Screen_Scare_System**: The pure rules in `src/game/systems/screenScares.ts`, the data in `src/data/screenScares.ts` and the `ScreenScare` overlay.
- **Screen_Scare**: A full-screen face image that slams in from the bottom edge (zombie face) or the top edge (ghost face).
- **Jumpscares_Setting**: The saved setting "Jumpscares" with the values Full, Reduced and Off, default Full.
- **Flashing_Lights_Setting**: The existing setting "Flashing lights" (On or Off).
- **Camera_Shake_Setting**: The existing setting "Camera shake" (On or Off).
- **Scare_Cooldown**: The minimum time between two Screen_Scares, 180 s.
- **Overlay_Context**: Any of menus, pause, journal, satchel, workbench view, big map, examine, cutscenes and endings.
- **Creature_System**: The enemy data in `src/data/enemies.ts` and the enemy rules and components for the Pale_Crawler, Hollow_Bride and Corpse_Hound.
- **Pale_Crawler**: Enemy `crawler`, hidden under grave mounds and broken coffins.
- **Hollow_Bride**: Enemy `bride`, a haunting that drains lantern oil and cannot hurt health.
- **Corpse_Hound**: Enemy `hound`, a pack animal.
- **Bestiary**: The "Creatures" page in the journal.
- **Look_Variant**: A named mesh `look-0` to `look-3` inside `zombie.glb`, shown one at a time.
- **Placeholder_Asset**: Any stand-in model, image, sound or texture, marked as a placeholder in code and in the waiting list.
- **Waiting_List**: The list of art files still owed by Claude, with their paths, kept in the spec's tasks and the final report.
- **Bat_System**: The perched and flying bats and their state machine.
- **Info_Dot**: A small circled "i" that shows a how-to-play tooltip.
- **Info_Tips_Data**: The texts in `src/data/infoTips.ts`, keyed by section.
- **Vending_Machine**: The "Hollowmere Automatic Dispenser" in the hut, with data in `src/data/vending.ts` and rules in `src/game/systems/vending.ts`.
- **Grave_Coins**: The existing currency counter.
- **Viewmodel**: The first-person hands, weapon and lantern.
- **Lantern_Light**: The lantern's spot light, fill light and flicker signal.
- **Grip_Class**: One of pistol, haft or long, picked from the equipped weapon.
- **Design_Bible**: `docs/game-design.md`.
- **Kiro_Log**: `docs/kiro-log.md`.
- **Subtitle_System**: The existing subtitles and captions for sounds.
- **Perf_Budget**: The performance budget in the tech steering (60 fps target, never below 45 fps, fewer than 150 draw calls, at most 4 shadow-casting lights).

## Requirements

### Requirement 1: Screen jumpscares (H1)

**User Story:** As a player, I want a scary face to slam onto the screen at earned moments, so that the horror hits hard without feeling random.

#### Acceptance Criteria

1. WHEN a Screen_Scare triggers, THE Screen_Scare_System SHALL show the `ScreenScare` overlay above the HUD with the image height equal to 85% of the viewport height (tolerance ±1 px), anchored to the bottom edge for zombie faces and to the top edge for ghost faces.
2. WHEN a Screen_Scare plays, THE Screen_Scare_System SHALL run an "in" phase of 70 ms (±1 frame at 60 fps) with no easing, a hold phase with a duration chosen between 550 ms and 800 ms, and an "out" phase of 250 ms that slides the image off its anchored edge and fades its opacity from 100% to 0%.
3. WHILE the hold phase runs and Jumpscares_Setting is Full, THE Screen_Scare_System SHALL dim the world to 30% brightness, apply a camera shake whose amplitude decays to 0 by the end of the hold phase, apply a scale jitter between 1.00 and 1.04, and apply a chromatic split on the image edges.
4. WHEN the in phase starts, Jumpscares_Setting is Full and Flashing_Lights_Setting is on, THE Screen_Scare_System SHALL show a white flash lasting exactly one rendered frame.
5. WHEN a Screen_Scare plays at Full, THE Screen_Scare_System SHALL play a layered sting made of a sharp attack, a low thud and a scream or wail, and SHALL lower the volume of all other audio by 70% for the hold phase and restore it within 250 ms after the hold phase ends.
6. WHEN a Pale_Crawler bursts out within 1.5 m in front of the player, THE Screen_Scare_System SHALL trigger a bottom zombie-face Screen_Scare, and the Pale_Crawler's grab damage SHALL then apply as normal after the out phase starts.
7. WHEN a Hollow_Bride reaches the player, THE Screen_Scare_System SHALL trigger a top ghost-face Screen_Scare, and the lantern oil drain SHALL apply only after the in phase has ended.
8. WHEN the player opens the designated broken coffin at night 2, looks out of the hut's west window at night 3, or looks through the ossuary door's grille for the first time, THE Screen_Scare_System SHALL trigger the scripted Screen_Scare for that moment, once per save for each moment.
9. IF fewer than 180 s of simulation time have passed since the previous Screen_Scare started, THEN THE Screen_Scare_System SHALL skip the new trigger, SHALL NOT mark a scripted moment as used, and SHALL leave the trigger's gameplay effect unchanged.
10. WHILE any Overlay_Context is active, THE Screen_Scare_System SHALL hold back every Screen_Scare and SHALL NOT start the cooldown for a held-back trigger.
11. THE Screen_Scare_System SHALL provide the Jumpscares_Setting with the values Full, Reduced and Off, default Full, saved with the other settings, and operable by keyboard with a visible focus state.
12. WHILE the Jumpscares_Setting is Reduced, THE Screen_Scare_System SHALL show the face with no white flash, no camera shake, no chromatic split and no dimming, and SHALL play the sting at 50% of the Full sting volume.
13. WHILE the Jumpscares_Setting is Off, THE Screen_Scare_System SHALL show no image, flash, shake, sting or dimming, and SHALL show a subtitle that describes the event for 3 s.
14. WHILE Flashing_Lights_Setting is off, THE Screen_Scare_System SHALL remove the white flash and the chromatic split at every Jumpscares_Setting value.
15. WHILE Camera_Shake_Setting is off, THE Screen_Scare_System SHALL apply no camera shake at every Jumpscares_Setting value.
16. WHEN a Screen_Scare picks an image, THE Screen_Scare_System SHALL pick at random from the matching set (`face-zombie-1`, `face-zombie-2`, `face-crawler` from the bottom; `ghost-bride-1`, `ghost-bride-2` from the top) and SHALL never pick the same image twice in a row within a set.
17. WHILE subtitles are on, WHEN a Screen_Scare plays at Full or Reduced, THE Subtitle_System SHALL show a subtitle for the sting from the start of the in phase until the end of the out phase.
18. THE Screen_Scare_System SHALL start each Screen_Scare 0.5 s to 1.5 s after its telegraph (a flicker, creak, breath or music drop) begins, and no Screen_Scare SHALL reduce player health directly.
19. THE Screen_Scare_System SHALL keep definitions in `src/data/screenScares.ts` and the cooldown, trigger and image-choice logic as pure TypeScript in `src/game/systems/screenScares.ts` with a test file next to it.
20. IF a face image fails to load or is missing, THEN THE Screen_Scare_System SHALL show a Placeholder_Asset labelled as a placeholder, add the missing path to the Waiting_List once, and complete the Screen_Scare with the same timing and sting.

### Requirement 2: New creatures (H2)

**User Story:** As a player, I want new creatures that each behave differently and warn me before they attack, so that the cemetery stays frightening and fair.

#### Acceptance Criteria

1. THE Creature_System SHALL define `crawler`, `bride` and `hound` in `src/data/enemies.ts` (`EnemyId`, `ENEMY_MAP`, `ENEMY_LOOKS`) with these starting values: Pale_Crawler 35 HP, 1.2 m/s crawling speed, 6 m/s for a 0.6 s lunge, 8 grab damage; Hollow_Bride 60 HP, 2.2 m/s, 0 health damage; Corpse_Hound 45 HP, 5.5 m/s, 10 damage.
2. WHEN night 2 begins, THE Creature_System SHALL place between 3 and 6 Pale_Crawlers, each hidden at a distinct grave mound or broken coffin and not rendered until it first moves.
3. WHEN the player comes within 2 m of a hidden Pale_Crawler, THE Creature_System SHALL make the Pale_Crawler burst out and grab the player for 8 damage, at most once per 1.5 s per Pale_Crawler.
4. WHEN a horizontal melee swing meets a Pale_Crawler, THE Creature_System SHALL make the swing miss and deal 0 damage.
5. WHEN a downward melee swing, a gunshot or lantern trap fire meets a Pale_Crawler, THE Creature_System SHALL apply that attack's normal damage.
6. WHEN stage 2 begins, THE Creature_System SHALL allow at most 1 living Hollow_Bride at a time, and SHALL NOT draw her from the wave tables or the elites list.
7. WHILE a Hollow_Bride is outside the lantern cone and more than 3 m from the player, THE Creature_System SHALL keep the Hollow_Bride invisible.
8. WHEN a Hollow_Bride touches the player, THE Creature_System SHALL drain 20% of the player's lantern oil (never below 0%), make the Hollow_Bride vanish, and bring her back after a random delay between 30 s and 60 s.
9. THE Creature_System SHALL let the Hollow_Bride pass through fences and gravestones, and SHALL block her at the chapel walls, the hut walls and salt circles.
10. IF lead damage (revolver or shotgun) hits a Hollow_Bride, THEN THE Creature_System SHALL apply 0 damage and show a hit-without-effect cue (a shape or sound, not colour alone).
11. WHEN holy water, the silver sabre or Blessed Rounds hits a Hollow_Bride, THE Creature_System SHALL apply that attack's normal damage.
12. WHEN stage 2 begins, THE Creature_System SHALL spawn Corpse_Hounds in packs of 2 to 3 that circle the player at 4 m to 6 m and send 1 hound at a time to dart in for 10 damage, with at least 2 s between darts.
13. WHEN a lantern flare or a gunshot happens within 15 m of a Corpse_Hound pack, THE Creature_System SHALL scatter the pack away from the player for 4 s, during which its hounds deal no damage.
14. WHEN a creature is about to attack, THE Creature_System SHALL play its tell for at least 0.5 s and at most 1.5 s before damage is dealt: a soil shiver and a wet click for the Pale_Crawler; a cold breath, a bent lantern flame and faint humming for the Hollow_Bride; a growl from the dark for each Corpse_Hound.
15. WHEN a creature plays a tell or an attack sound, THE Subtitle_System SHALL show a caption for it while subtitles are on, and THE Creature_System SHALL play that sound as spatial audio from the creature's position.
16. WHILE a Hollow_Bride is within 8 m of the player, THE Lantern_Light SHALL bend the flame and dim the lantern light by 30%, and WHERE Flashing_Lights_Setting is off, THE Lantern_Light SHALL make the change as a slow fade of at least 1 s with no flicker.
17. THE Creature_System SHALL add `crawler` and `hound` to the wave tables and may add them to the elites list, SHALL keep the result within the Design_Bible difficulty curve (a wave is never smaller than the one before, and the alive caps of 12 / 16 / 20 hold), and SHALL log every tuning change in the Kiro_Log.
18. WHEN the player has seen a creature (within the lantern cone or within 10 m, at least once), THE Bestiary SHALL show its sketch, a field note of at most 200 characters and a "What works" line on the journal's "Creatures" page, and SHALL keep unseen creatures hidden, with no name or sketch.
19. IF the model file for a creature is missing, THEN THE Creature_System SHALL use the existing zombie model scaled and tinted as a marked Placeholder_Asset, and SHALL add the missing path to the Waiting_List.
20. THE Creature_System SHALL ensure no creature, tell or scripted event reduces the player's health to 0 by itself: IF an attack would take the player below 1 HP and the player was above 1 HP when the scripted event began, THEN THE Creature_System SHALL leave the player at 1 HP.

### Requirement 3: Horror-game zombie looks (H3)

**User Story:** As a player, I want zombies that look like survival-horror enemies, so that the cemetery feels dangerous.

#### Acceptance Criteria

1. THE Creature_System SHALL load `public/assets/models/enemies/zombie.glb`, `zombie-brute.glb`, `crawler.glb`, `bride.glb` and `hound.glb` through paths defined in `src/data/assets.ts`, and SHALL NOT use any model path that is written outside that file.
2. THE Creature_System SHALL expect the clip names Idle, Walk, Run, Crawl, Attack, Lunge, Threaten, HitReact and Death on every model, with the hound and the Hollow_Bride using their own movement clip in place of Crawl.
3. IF a model file fails to load or lacks an expected clip, THEN THE Creature_System SHALL keep the game running, SHALL log one warning that names the model and the missing clip, and SHALL fall back to the Idle clip for the missing clip, or to the base `zombie.glb` model when the file itself fails to load.
4. WHEN a zombie spawns, THE Creature_System SHALL pick exactly one Look_Variant from `look-0`, `look-1`, `look-2` and `look-3` as a pure function of the spawn's uid, so that the same uid always gives the same variant, and SHALL show only that variant's mesh and hide the other three.
5. WHERE a Look_Variant defines a tint, THE Creature_System SHALL apply that tint to the variant, and WHERE it defines none, THE Creature_System SHALL show the variant with the material from the file.
6. IF the chosen Look_Variant mesh is missing from the model, THEN THE Creature_System SHALL show the base mesh and SHALL still show only one mesh for that creature.
7. THE Creature_System SHALL list each new creature id (crawler, bride, hound) in `ENEMY_LOOKS`, with 4 variants per id.
8. THE Creature_System SHALL keep each delivered model to one skinned mesh and fewer than 15,000 triangles.
9. THE Creature_System SHALL keep model materials from the file and SHALL NOT apply a flat colour override, except for the per-variant tint of criterion 5.

### Requirement 4: Bats that watch you (H4)

**User Story:** As a player, I want bats that stare at me from headstones and then take off, so that the cemetery feels watchful.

#### Acceptance Criteria

1. WHEN night begins in any stage from stage 1 onward, THE Bat_System SHALL perch between 8 and 12 bats (inclusive), one bat per box, on the top face of boxes in `graveyard-colliders.json` whose height is between 0.6 m and 1.6 m (inclusive).
2. IF `graveyard-colliders.json` holds fewer than 8 boxes between 0.6 m and 1.6 m tall, THEN THE Bat_System SHALL perch one bat on each qualifying box, perch none on any other box, and add no error to the player's view.
3. WHILE the player is within 14 m of a perched bat, THE Bat_System SHALL turn that bat's "head" and "eyes" meshes about the Y axis toward the player, easing the turn over a time constant of 0.3 s to 0.6 s, with the turn from the bat's rest heading limited to 120° in either direction.
4. WHEN the player moves beyond 14 m of a perched bat, THE Bat_System SHALL ease that bat's "head" and "eyes" meshes back to the rest heading within 2 s.
5. THE Bat_System SHALL make each bat's eyes glow with an emissive material and SHALL add no light source for any bat.
6. WHILE at least one bat is perched, THE Bat_System SHALL play no more than one chitter sound in any 20 s window, at a volume no higher than the SFX volume setting allows, and THE Subtitle_System SHALL show a caption for that chitter, while subtitles are on, for at least 2 s.
7. WHEN the player comes within 3 m of a perched bat, or a gun is fired within 10 m of a perched bat, THE Bat_System SHALL swap that bat to the flying model on the same frame, flap its `wing-left` and `wing-right` pivots at 8 flaps per second (±1), and fly it away from the player on a curved path.
8. WHEN a bat has been flying for 6 s, THE Bat_System SHALL fade it to fully transparent over 1 s or less and remove it from view.
9. WHEN 120 s have passed since a bat was removed from view, THE Bat_System SHALL perch it on a different box that meets the height rule of criterion 1 and holds no other bat.
10. THE Bat_System SHALL keep the perched, fleeing and returning states, and the transitions between them, as a pure state machine in `src/game/systems/` with a test file next to it.
11. THE Bat_System SHALL deal 0 damage to the player and SHALL NOT start a Screen_Scare, whatever value the Jumpscares_Setting holds.
12. WHERE the frame budget allows (the frame rate stays at or above 45 fps on the reference mid-range laptop at 1080p with the flock shown), WHEN the dusk bell rings, THE Bat_System SHALL burst a flock of 15 to 20 instanced flying bats out of the chapel belfry, and the flock SHALL leave view or fade out within 10 s.
13. WHILE Camera_Shake_Setting is off, THE Bat_System SHALL show the belfry flock with no camera shake.
14. WHILE Flashing_Lights_Setting is off, THE Bat_System SHALL show the belfry flock and the bat eyes with no flashing or pulsing (steady emissive only).
15. IF the bat models are missing, THEN THE Bat_System SHALL use a marked Placeholder_Asset for each missing model, add each missing model path to the Waiting_List, and continue running the game without error.

### Requirement 5: Info dots (H5)

**User Story:** As a player, I want small info dots that explain how things work, so that I understand the systems without leaving the game.

#### Acceptance Criteria

1. THE Game SHALL show one Info_Dot next to each journal section heading and next to each of these HUD panels: case board, clues, Curse meter, hints, map, recipes, satchel, relics, lantern oil, stamina, Bestiary and coins.
2. WHEN the player hovers over an Info_Dot, focuses it with Tab, or taps it, THE Game SHALL show a parchment-style tooltip within 100 ms containing at most 2 sentences about how to play, not the story.
3. WHEN the player moves the pointer off an Info_Dot, moves focus away from it, or taps outside it, THE Game SHALL close its tooltip within 100 ms.
4. WHEN the player presses Escape while a tooltip is open, THE Game SHALL close the tooltip and SHALL NOT open the pause menu from that key press.
5. WHEN the player presses Escape while no tooltip is open, THE Game SHALL handle the key press as it does without Info_Dots, so Pause stays available.
6. THE Info_Dot SHALL link to its tooltip through `aria-describedby`, SHALL be reachable by keyboard, and SHALL show a visible focus state.
7. THE Game SHALL keep the tip texts in `src/data/infoTips.ts` keyed by section, and each text SHALL match the behavior of the current code, with any wrong statement in the source draft corrected.
8. THE Game SHALL provide the setting "Show info dots", default On, saved in localStorage with the other settings, and restored on the next load.
9. WHILE "Show info dots" is Off, THE Game SHALL render no Info_Dot and SHALL show no tooltip, and Tab order SHALL skip the hidden dots.
10. WHILE the viewport is 800x600 and "Plain font for journal" is On, THE Game SHALL show each tooltip fully inside the viewport, with no clipped or overflowing text and no overlap with the health bar, oil gauge or controls hint panel.
11. WHERE the vending machine is in the game, THE Info_Tips_Data SHALL mention it in the coins tip.
12. THE Info_Tips_Data SHALL contain a non-empty tip for every journal section and every HUD panel listed in criterion 1, and a unit test SHALL fail if any key is missing or any tip has more than 2 sentences.

### Requirement 6: The hut's vending machine (H6)

**User Story:** As a player, I want to spend Grave Coins at a dispenser in the hut, so that I can buy convenience items by day or night.

#### Acceptance Criteria

1. THE Vending_Machine SHALL stand in the hut at (2.83, 0, 1.85) with rotationY −PI/2, with colliders in `hut.json` and the machine's JSON.
2. WHEN the player presses Interact within 2.5 m of the Vending_Machine, THE Vending_Machine SHALL open a panel in the merchant's style with one row per visible item, and each row SHALL show the item name, the price in Grave_Coins, the stock left today (as "N left") and a one-sentence description of what the item does, in every phase (day, dusk, night, dawn).
3. THE Vending_Machine SHALL stock only these rows: Revolver Cartridges x6 at 12 coins, 2 a day; Shotgun Shells x4 at 14, 2 a day; Lamp Oil x1 at 5, 3 a day; Kola Tonic x1 at 18, 1 a day; Brisk Draught x1 at 15, 1 a day; Bandage x1 at 7, 2 a day.
4. THE Vending_Machine SHALL never stock a relic, key item, journal page, recipe, clue, holy water or silver filings.
5. WHILE the player does not own the revolver, THE Vending_Machine SHALL hide the Revolver Cartridges row, and WHILE the player does not own the shotgun, THE Vending_Machine SHALL hide the Shotgun Shells row. A gun is owned under the same rule as elite ammo drops (in the satchel, or its magazine already tracked by the combat state).
6. WHEN the player buys a row that has stock of at least 1 and the player has at least the price in Grave_Coins and a free satchel slot (or a stack the goods fit into), THE Vending_Machine SHALL, within 1.2 s, deduct the price, reduce the row's stock by 1, play a coin clink, pull the row's `handle-0` to `handle-4` out 5 cm (±1 cm) and spring it back, and add the goods to the satchel (the tray shows the drop).
7. WHILE a purchase runs, THE Vending_Machine SHALL leave the player unprotected (no invulnerability, zombies and damage keep running) and the world running (the simulation is not paused), and the panel SHALL not block Pause (Esc).
8. IF the player has fewer Grave_Coins than the price, THEN THE Vending_Machine SHALL refuse the purchase, leave the coins, stock and satchel unchanged, and show a text reason that names the shortfall.
9. IF the satchel has no free slot and no existing stack of that item with room for the goods, THEN THE Vending_Machine SHALL refuse the purchase, leave the coins, stock and satchel unchanged, and show a text reason saying the satchel is full.
10. WHEN a row's stock reaches 0, THE Vending_Machine SHALL show a "Sold out" card for that row and SHALL refuse further purchases of it, leaving coins unchanged.
11. WHEN dawn begins, THE Vending_Machine SHALL reset every row's stock to its per-day value (6 rows as listed in criterion 3).
12. WHEN the player uses a Brisk Draught, THE Game SHALL add +25% move speed for 60 s as a timed effect in the shared timed-effects system, shown with its own glyph, a countdown ring and the seconds left as text. IF a Brisk Draught is used while the effect is active, THEN THE Game SHALL refresh the time to 60 s without stacking the speed bonus.
13. THE Vending_Machine SHALL keep the Grave_Coins counter at 0 or above after every purchase attempt, successful or refused.
14. WHERE the frame budget allows (the 60 fps target and the 4 shadow-casting lights cap hold), THE Vending_Machine SHALL add one small warm light at `marquee-light` that casts no shadow, and the marquee glass SHALL use an emissive material.
15. THE Vending_Machine SHALL keep data in `src/data/vending.ts` and rules as pure TypeScript in `src/game/systems/vending.ts`, with a test file `vending.test.ts` next to it covering prices, per-day stock, dawn reset, hidden weapon rows, forbidden items and non-negative coins.
16. WHEN a vending sound plays (coin clink, handle pull, tray drop, refusal), THE Subtitle_System SHALL show a caption for it while subtitles are enabled.
17. IF `props/vending-machine.glb` or `items/brisk-draught.glb` is missing, THEN THE Vending_Machine SHALL use a marked Placeholder_Asset, add the missing path to the Waiting_List, and keep the machine fully usable.

### Requirement 7: Detailed hands and a realistic lantern light (H7)

**User Story:** As a player, I want detailed hands holding the weapon and lantern, with a light that sways and flickers like a real flame, so that the first-person view feels physical.

#### Acceptance Criteria

1. WHERE `viewmodel/hands.glb` and `viewmodel/lantern.glb` are both present, THE Viewmodel SHALL show the right hand holding the equipped weapon and the left hand holding the lantern, using the clips Grip-Pistol, Grip-Haft, Grip-Long, Lantern-Hold, Throw, Reload-Revolver, Reload-Shotgun, Swing-Light and Swing-Heavy.
2. THE Viewmodel SHALL pick the Grip_Class from the equipped weapon: Grip-Pistol for the revolver; Grip-Haft for the Rusty Shovel, Sharpened Shovel, Wood Axe, Bone Club and Silver Sabre; Grip-Long for the shotgun. WHEN the player changes weapons, THE Viewmodel SHALL switch to the new Grip_Class within 0.3 s.
3. WHILE the player walks, THE Viewmodel SHALL sway the lantern hand with follow-through on turns and a lag of 80 ms (±20 ms), and WHILE the player sprints, THE Viewmodel SHALL lower the lantern hand by 0.05 to 0.15 m relative to its walking position. WHERE Head bob is off, THE Viewmodel SHALL hold the lantern hand steady instead of swaying it.
4. WHILE the player holds the shotgun, THE Viewmodel SHALL move the left hand to the fore-end, hook the lantern on the belt, and make the Lantern_Light come from the hip pointing forward and 10° to 20° downward. WHEN the player switches from the shotgun to another weapon, THE Viewmodel SHALL return the lantern to the left hand within 0.5 s.
5. WHEN the lantern is first hooked to the belt in a run, THE Subtitle_System SHALL show the caption "Lantern hooked to your belt" once, WHERE subtitles are on. The once-only flag SHALL be cleared by New Game and kept by Continue, Retry Night and Retry from morning.
6. WHEN the player throws an item or releases a Swing-Heavy attack with the axe or sabre, THE Viewmodel SHALL let the left hand release the lantern, hang it from the wrist strap during the swing, and have the left hand catch it again within 0.6 s of the swing or throw ending. WHILE the lantern hangs from the strap, THE Lantern_Light SHALL stay on and keep following the lantern.
7. IF `viewmodel/hands.glb` or `viewmodel/lantern.glb` is missing or fails to load, THEN THE Viewmodel SHALL keep the current weapon-only viewmodel, add each missing path to the Waiting_List, and continue play without an error screen.
8. THE Lantern_Light SHALL emit from the lantern glass in the left hand (or from the belt hook while the shotgun is held), so shadows move as the lantern sways.
9. THE Lantern_Light SHALL use exactly one shadow-casting spot light with a shadow map of 1024 × 1024 or smaller and a cookie (`SpotLight.map`) of the cage bars, plus one fill point light with no shadow and a radius of 3 m or less, both in colour `#ffb46b`.
10. IF `public/assets/textures/lantern-cookie.png` is missing, THEN THE Lantern_Light SHALL use a soft round Placeholder_Asset cookie and add the path to the Waiting_List.
11. THE Lantern_Light SHALL drive intensity from one layered-noise signal made of slow breathing (0.2 to 0.5 Hz), quick gutters (4 to 12 Hz) and occasional dips of up to −25% of base intensity, and THE `flame` mesh scale and the glass emissive SHALL follow that same signal within the same frame.
12. WHILE lantern oil is below 15%, THE Lantern_Light SHALL gutter with at least double the gutter amplitude of its normal state and shift to a redder colour than `#ffb46b`. WHEN lantern oil reaches 0, THE Lantern_Light SHALL play one flare of 0.3 s or less, then go out, and the lantern glass and flame SHALL show no emission afterwards.
13. WHILE the player sprints or a wind gust blows, THE Lantern_Light SHALL raise gutter amplitude by at least 50% over its walking value.
14. WHILE Flashing_Lights_Setting is off, THE Lantern_Light SHALL replace gutters, dips and the last flare with changes slower than 1 Hz, and no frame-to-frame intensity step SHALL exceed 10% of base intensity.
15. WHILE graphics quality is Low, THE Lantern_Light SHALL turn the cookie off and keep the spot light's shadow.
16. THE Lantern_Light SHALL apply bloom to the flame and glass only, and THE Game SHALL stay within the Perf_Budget (60 fps target, never below 45 fps, fewer than 150 draw calls) with at most 4 shadow-casting lights in the scene, checked by a GPU benchmark run before and after the change on the same scene and resolution.

### Requirement 8: Design bible §12, cross-cutting rules and delivery

**User Story:** As the project owner, I want the design written down first and shared rules applied to every part of the pass, so that the work is safe to build, accessible, finishable and logged.

#### Acceptance Criteria

1. THE Game SHALL contain a §12 "Horror pass" in the Design_Bible that covers each of Requirements 1 to 7 and is committed locally before the first commit that adds or changes code for Requirements 1 to 7.
2. THE Game SHALL mirror every content row of §12 (names, IDs, counts, durations, radii, costs and cooldowns) in `src/data/` with identical values, and IF a value in `src/data/` differs from §12, THEN the Design_Bible SHALL be treated as correct and the data SHALL be changed to match.
3. WHEN a requirement is cut under the freeze, THE Design_Bible SHALL mark the matching part of §12 as "cut" in the same change, and requirements SHALL be cut in the priority order stated in this spec, lowest priority first.
4. WHERE the Jumpscares_Setting is Reduced, THE Game SHALL play each new scare effect with a quieter stinger, a slower lunge and no camera shake.
5. WHERE the Jumpscares_Setting is Off, THE Game SHALL still run each new scare's gameplay effect, SHALL play no stinger and no shake, and SHALL show a subtitle describing the event.
6. WHERE the Flashing_Lights_Setting is Off, THE Game SHALL replace every new pulse, flash and strobe with a steady or slow change that has no brightness change faster than 3 times per second.
7. WHERE the Camera_Shake_Setting is Off, or WHERE `prefers-reduced-motion` is set and the player has not turned shake on, THE Game SHALL apply no camera shake from any new effect.
8. WHILE subtitles are on, WHEN a new sound plays, THE Game SHALL show a subtitle for it that starts within 0.2 s of the sound and stays for at least 1.5 s.
9. THE Game SHALL make every new menu, panel and tooltip reachable and operable with the keyboard alone, with a focus indicator visible on the focused element.
10. THE Game SHALL give every new piece of information at least one non-colour cue (a shape, glyph, text or position), so that it is readable with colour removed.
11. WHEN the player presses Esc during a new scare or effect, THE Game SHALL open the pause menu within 1 frame and SHALL halt that scare or effect's timers and audio until the player resumes.
12. WHEN a new scripted scare is about to fire, THE Game SHALL show a telegraph (a flicker, creak, breath or music drop) 0.5 to 1.5 s before it, SHALL wait at least 45 s after the previous major scare, and IF crafting, the satchel, the journal or pause is open, THEN THE Game SHALL hold the scare until all of them are closed.
13. THE Game SHALL play each new sound that comes from a place in the world as a 3D positional sound at that place, so that its direction can be heard.
14. THE Game SHALL hold at least 45 fps at all times and 60 fps on average in normal play at 1080p on the mid-range laptop target, with fewer than 150 draw calls and at most 4 shadow-casting lights.
15. THE Game SHALL compress every new model with Draco or meshopt, and SHALL keep the initial download under 25 MB.
16. THE Game SHALL mark every Placeholder_Asset with a `PLACEHOLDER` comment at its use in code and with an entry in the Waiting_List, SHALL NOT use drawn stand-in art as final art, and WHEN the spec's last task finishes, THE Game SHALL list every file still waiting on Claude's art with its full path.
17. WHEN a new third-party asset is added, THE Game SHALL add a line for it (name, source, license) to `docs/CREDITS.md` in the same commit.
18. THE Game SHALL keep game logic for each new system in `src/game/` as pure TypeScript that imports no React, three.js or Howler, with a `*.test.ts` file next to each system and all tunable values in `src/data/`.
19. WHEN a task finishes, THE Game SHALL have a `docs/kiro-log.md` entry for it, `npm run lint`, `npm run build` and `npm run test` each exiting with code 0, and one local git commit for the task that has not been pushed.
20. WHEN a decision is made without the user present, THE spec SHALL record it under "Decisions made unattended" with the decision, the reason and the date.
21. WHEN the spec's last task finishes, THE Game SHALL have browser checks for each Screen_Scare at Full and Reduced, the crawler ambush, the Bride in the lantern cone, the hound pack scatter, the bat turning and taking off, each Info_Dot, a vending purchase, hands per Grip_Class with the belt lantern, cage shadows and GPU performance, each with a screenshot at 1280x720 and at 800x600.
22. IF a requirement's art file is missing, THEN THE Game SHALL still build, pass `npm run test`, start, and show the Placeholder_Asset in its place without throwing an error.