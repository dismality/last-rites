# Requirements Document

Spec 07: Combat and Enemies

## Introduction
This spec deepens combat in Last Rites. The player gains two firearms (Service Revolver, Double-Barrel Shotgun), two heavy melee weapons (Wood Axe, Silver Sabre), a kick, a stamina dodge, workbench weapon upgrades and a shared timed-effect system. Combat feel improves with hit markers, kill feedback and floating damage numbers. Three new enemy types (Bloater, Brute, elites) and a night 5 boss (Father Aldous Crane) join the waves. The chapel gets two barricaded doors that zombies attack at night, and the final rite cannot complete while Father Crane lives.

All numbers, names, tables and texts are defined in `docs/game-design.md` (§2 doors and barricades, §3 items and ammunition, §4 weapons, firearms, heavy melee, feedback, upgrades and timed effects, §5 recipes, §7 enemies, looks, elites and boss, §8 waves, §10 controls), with enemy visuals in `docs/enemy-models.md`. That file is the source of truth. This spec references those values and does not restate different ones. Balance values live in `src/data/`, and rules are pure functions in `src/game/` covered by fast-check property tests. Spec 06 (clarity and HUD) is planned before this spec: the Objective_Tracker rule 3 and the Compass already exist and this spec supplies their inputs.

## Glossary
- **Firearm**: A weapon that fires from a magazine using ammunition (`revolver`, `shotgun`).
- **Magazine**: The loaded rounds in a Firearm. Capacity comes from the Firearms table.
- **Ammo_Stack**: A satchel stack of `revolver-cartridge` or `shotgun-shell`.
- **Ballistics**: The pure system that resolves a shot into spread directions, hits, headshots and damage.
- **Head_Zone**: The top 0.3 m of a zombie's fixed capsule.
- **Heavy_Weapon**: The `wood-axe` or `silver-sabre`.
- **Heavy_Attack**: A charged swing with a Heavy_Weapon that knocks a zombie down.
- **Knockdown**: A zombie state where it lies on the ground, cannot attack and takes 25% more damage.
- **Kick**: The Q action that pushes and staggers a zombie.
- **Dodge**: The C action, a short invulnerable dash.
- **Stamina**: The player's stamina pool (100) from `docs/game-design.md` §6.
- **Upgrade**: A one-time workbench purchase from the Weapon upgrades table (`up-*` IDs).
- **Effect_System**: The pure system that tracks Timed_Effects.
- **Timed_Effect**: A buff with a duration (`blessed-rounds`, `adrenaline`, `salt-circle`).
- **Effect_Icon**: The HUD icon for a Timed_Effect, with a glyph, a countdown ring and the seconds left as text.
- **Bloater**: The `bloater` enemy that bursts into Grave_Gas on death.
- **Grave_Gas**: The grey-green gas cloud released by a Bloater burst.
- **Brute**: The `brute` enemy (300 HP, slow, resists stagger).
- **Elite**: A Shambler, Bloater or Brute spawned with the elite modifiers.
- **Sigil_Ring**: The floating ring above an Elite's head.
- **Door**: One of the two chapel doors, `front` or `vestry`.
- **Board**: A barricade board on a Door. Each Door has 3 slots.
- **Door_Attacker**: A zombie assigned to attack a Door instead of the player.
- **Barricade_System**: The pure system that tracks Boards, Board health and Door state.
- **Father_Crane**: The boss `father-crane`.
- **Boss_Director**: The pure system that runs Father_Crane's phases, attacks and timers.
- **Final_Rite**: The 45 s night 5 rite at the altar from `docs/game-design.md` §8.
- **Hit_Marker**: The crosshair cross shown when the player hits a zombie.
- **Damage_Number**: A floating number at a hit point.
- **Noise_Event**: A Firearm shot that pulls zombies within its noise radius.
- **Subtitle**: The on-screen caption for a sound, shown when the Subtitles setting is On.
- **Flashing_Lights**: The accessibility setting that turns flashes and pulses into steady or slow alternatives.
- **Camera_Shake**: The accessibility setting that controls shake, including recoil strength.
- **Save**: The localStorage record under `lastrites:save`, written by `src/game/state/gameSave.ts` and `src/game/systems/saveGame.ts`.
- **Dusk_Snapshot**: The snapshot taken at dusk by `src/game/systems/duskSnapshot.ts` and restored by Retry_Night.
- **Retry_Night**: The flow in `src/game/state/retryNight.ts` that restores the Dusk_Snapshot after death.
- **Night_State**: State that exists only during a night: live Timed_Effects, active Grave_Gas, Knockdown state, boss state, Door_Attackers, Damage_Numbers and Hit_Markers.
- **Combat_Data**: The typed constants in `src/data/` that hold this spec's balance values.

## Requirements

### Requirement 1: Combat data and new items
**User Story:** As a developer, I want all new combat content defined as data, so that systems contain no magic numbers.

#### Acceptance Criteria
1. THE Combat_Data SHALL define the materials `wood-plank`, `black-powder`, `lead-shot` and `silver-filings`, each with a stack limit of 10 and each using one satchel slot.
2. THE Combat_Data SHALL define `revolver-cartridge` with a stack limit of 36 and `shotgun-shell` with a stack limit of 20, each stack using one satchel slot.
3. THE Combat_Data SHALL define the weapons `revolver`, `shotgun`, `wood-axe` and `silver-sabre` and the consumables `blessed-rounds` and `kola-tonic`, with every stat value (damage, fire interval or speed, durability, capacity, reload time, spread, range, headshot multiplier, recoil, noise radius, charge time, stamina cost) equal to the values in `docs/game-design.md` §4.
4. THE Combat_Data SHALL define the recipes `r-revolver-cartridge`, `r-shotgun-shell` and `r-blessed-rounds`, each with the inputs, output item and output quantity (6 revolver cartridges, 4 shotgun shells, 1 Blessed Rounds) and the unlock condition in `docs/game-design.md` §5.
5. THE Combat_Data SHALL define the enemies `bloater`, `brute` and `father-crane` with the HP, speed, damage and audio signature in `docs/game-design.md` §7.
6. THE Combat_Data SHALL define the Elite modifiers (6% chance from night 2, at most 1 per wave, HP ×2, speed ×1.15, damage ×1.25) and the Elite drop table with weights 30, 25, 20, 15 and 10 summing to 100.
7. THE Combat_Data SHALL define each of the 10 `up-*` Upgrades with its weapon, cost and old and new stat values from the Weapon upgrades table in `docs/game-design.md` §4.
8. THE Combat_Data SHALL define the Timed_Effects `blessed-rounds`, `adrenaline` and `salt-circle` with durations of 30 s, 20 s and 30 s, the Door and Board values (3 slots per door, 60 board health, 1 wood plank and 2 iron nails per board, 2 s nailing time, brute ×2 and rite ×2 damage), the Boss phase values, and the wave additions from `docs/game-design.md` §2, §7 and §8.
9. THE Combat_Data SHALL use kebab-case string-literal union types for all new IDs.
10. FOR ALL new item IDs, every item referenced by a recipe, Upgrade cost, Elite drop or loot entry SHALL exist in the item table (referential integrity property).
11. IF a Combat_Data entry references an ID that is not in the item table, THEN THE Combat_Data test suite SHALL fail and name the entry and the missing ID.
12. IF a Combat_Data value differs from `docs/game-design.md`, THEN THE Combat_Data test suite SHALL fail and name the ID and the field.

### Requirement 2: Weapon pickups and ownership
**User Story:** As a player, I want to find weapons in the world, so that exploring is rewarded with power.

#### Acceptance Criteria
1. WHEN the player interacts with the Service Revolver in the chapel vestry cupboard from within the 2.5 m interact range and the satchel has at least 2 free slots, THE Inventory SHALL add the `revolver` with a Magazine of 6 rounds and 6 `revolver-cartridge` (one stack) to the satchel, and THE Crafting_System SHALL unlock `r-revolver-cartridge`.
2. WHEN the player interacts with the Double-Barrel Shotgun in the gatekeeper's lodge from within the 2.5 m interact range and the satchel has at least 2 free slots, THE Inventory SHALL add the `shotgun` with a Magazine of 2 rounds and 4 `shotgun-shell` (one stack) to the satchel, and THE Crafting_System SHALL unlock `r-shotgun-shell`.
3. WHEN the player interacts with the Wood Axe at the woodpile by the hut from within the 2.5 m interact range and the satchel has at least 1 free slot, THE Inventory SHALL add the `wood-axe` with 60 hits of durability.
4. WHEN the player interacts with the Silver Sabre in the Crane crypt from within the 2.5 m interact range and the satchel has at least 1 free slot, THE Inventory SHALL add the `silver-sabre`.
5. IF the satchel has fewer free slots than a weapon pickup needs (2 for the revolver or shotgun, 1 for the axe or sabre), THEN THE Inventory SHALL add nothing, leave the pickup in the world and not unlock any recipe, and THE HUD SHALL show a "Satchel full" message.
6. WHEN a weapon pickup completes, THE Inventory SHALL mark that pickup as taken, so that it is not interactable again and does not respawn after the Save is loaded.
7. WHEN a pickup unlocks a recipe the player has already unlocked, THE Crafting_System SHALL keep the recipe unlocked and SHALL NOT list it twice.
8. THE Viewmodel SHALL render each new weapon (`revolver`, `shotgun`, `wood-axe`, `silver-sabre`) from primitive meshes only, with no new model files.

### Requirement 3: Firearm shots and hit resolution
**User Story:** As a player, I want accurate, readable gunfire, so that aiming and headshots matter.

#### Acceptance Criteria
1. WHEN the player presses the attack input with a Firearm that has at least 1 round loaded and is not reloading and its fire interval has elapsed, THE Ballistics SHALL consume exactly 1 round and resolve the shot with raycasts against the zombie capsules.
2. WHEN the revolver fires, THE Ballistics SHALL cast 1 ray inside the spread cone and apply 34 damage on a body hit.
3. WHEN the shotgun fires, THE Ballistics SHALL consume 1 round, cast 8 pellet rays inside the spread cone and apply 9 damage per pellet that hits.
4. WHEN a ray hits the Head_Zone (the top 0.3 m of a zombie capsule), THE Ballistics SHALL apply a headshot multiplier of ×2 for the revolver and ×1.5 per pellet for the shotgun.
5. THE Ballistics SHALL use a spread cone of 1.5° hip and 0.5° aimed for the revolver, and 6° hip and 5° aimed for the shotgun.
6. IF a revolver ray travels beyond 40 m, THEN THE Ballistics SHALL deal 0 damage for that ray.
7. THE Ballistics SHALL scale shotgun pellet damage linearly from full damage at 15 m or less to 0 at 20 m or more.
8. THE Firearm SHALL enforce a minimum interval between shots of 0.45 s for the revolver and 0.3 s for the shotgun, and SHALL ignore attack inputs that arrive sooner.
9. IF the player presses the attack input with a Firearm that has 0 rounds loaded, THEN THE Firearm SHALL consume nothing, deal no damage, play a dry click and show the subtitle "[click]".
10. WHILE a Firearm is reloading, THE Firearm SHALL ignore the attack input and SHALL keep the rounds already loaded unchanged until the reload completes.
11. WHILE Blessed Rounds is active, THE Ballistics SHALL double Firearm damage, applying the doubling after the headshot multiplier and the shotgun range falloff.
12. WHEN a single shot has several rays that hit the same zombie, THE Ballistics SHALL add up each ray's damage as one hit event for that zombie.
13. FOR ALL ray origins, directions and seeds, every generated spread direction SHALL lie within the configured cone angle of the aim direction (property).
14. FOR ALL shots, the total damage dealt SHALL be non-negative, and a ray at a target beyond its effective range (40 m revolver, 20 m shotgun) SHALL deal 0 damage (property).
15. FOR ALL hits, a headshot hit SHALL deal at least as much damage as a body hit with the same weapon, distance and effects (metamorphic property).

### Requirement 4: Reload and ammunition
**User Story:** As a player, I want to reload and craft ammunition, so that firearms need planning.

#### Acceptance Criteria
1. WHEN the player presses the Reload input with a Firearm whose Magazine is below capacity and at least 1 matching round in the Ammo_Stack, THE Firearm SHALL start a reload lasting 2.4 s for the revolver or 2.0 s for the shotgun, or the upgraded duration if a reload-time upgrade is owned.
2. WHEN a reload completes, THE Firearm SHALL add to the Magazine the lesser of the missing rounds and the rounds in the Ammo_Stack, and remove the same number of rounds from the Ammo_Stack.
3. WHILE a reload is in progress, THE Firearm SHALL refuse the attack input and any second Reload input without changing the Magazine, the Ammo_Stack or the reload timer.
4. WHEN the player switches weapon during a reload, THE Firearm SHALL cancel the reload and leave the Magazine and Ammo_Stack unchanged.
5. WHEN the player is hit by a Brute heavy blow during a reload, THE Firearm SHALL cancel the reload and leave the Magazine and Ammo_Stack unchanged.
6. WHEN the player presses the attack input with an empty Magazine, THE Audio_Manager SHALL play a dry click and THE Subtitle system SHALL show "[click]" when subtitles are enabled, and the Firearm SHALL not start a reload automatically.
7. IF the Reload input is pressed with a full Magazine or an empty Ammo_Stack, THEN THE Firearm SHALL make no change to the Magazine, the Ammo_Stack or the reload state.
8. WHEN the player crafts `r-revolver-cartridge` or `r-shotgun-shell`, THE Crafting_System SHALL add 6 revolver cartridges or 4 shotgun shells to the matching Ammo_Stack, capped at the stack limit of 36 or 20.
9. IF a craft of ammunition would exceed the stack limit, THEN THE Crafting_System SHALL add only the rounds that fit, keep the Ammo_Stack at the limit, and consume the recipe inputs once.
10. FOR ALL reload sequences, THE Firearm SHALL keep rounds in the Magazine plus rounds in the Ammo_Stack unchanged by a completed reload (conservation property).
11. FOR ALL Magazine and Ammo_Stack values, a completed reload SHALL leave the Magazine between 0 and capacity inclusive (invariant property).
12. FOR ALL Magazine and Ammo_Stack values, applying a completed reload twice SHALL give the same result as applying it once (idempotence property).

### Requirement 5: Aiming, recoil and muzzle flash
**User Story:** As a player, I want firearms to have weight, so that shooting feels physical without hurting accessibility.

#### Acceptance Criteria
1. WHILE the player holds the aim input with a Firearm, THE Camera_Controller SHALL reduce the field of view by 10° from the Field of view setting, and THE Player_Controller SHALL scale walking speed to 70% of its current value.
2. WHEN the player releases the aim input or switches to a non-Firearm weapon, THE Camera_Controller SHALL restore the field of view to the Field of view setting.
3. WHILE the player holds the aim input with a melee weapon, THE Melee_System SHALL block, and THE Camera_Controller SHALL leave the field of view and walking speed unchanged.
4. WHILE the player holds the aim input with a Firearm, THE Firearm_System SHALL use the aimed spread: 0.5° for the revolver and 5° for the shotgun. Otherwise it SHALL use the hip spread: 1.5° for the revolver and 6° for the shotgun.
5. WHEN a Firearm fires, THE Camera_Controller SHALL kick the view up by 2.5° and recover over 0.3 s for the revolver, or kick up by 6° and recover over 0.4 s for the shotgun.
6. WHERE Camera_Shake is Off, THE Camera_Controller SHALL halve the recoil kick angle (1.25° revolver, 3° shotgun) and keep the recovery times.
7. WHEN a Firearm fires, THE Effects_Layer SHALL show a muzzle flash sprite and a light pop.
8. WHERE Flashing_Lights is Off, THE Effects_Layer SHALL dim the muzzle flash sprite and skip the light pop.
9. THE Effects_Layer SHALL keep the muzzle light pop from casting shadows, so the scene has at most 4 shadow-casting lights.
10. IF the player pulls the trigger with 0 rounds loaded, THEN THE Firearm_System SHALL fire no shot, apply no recoil, show no muzzle flash, play a dry click, and show the subtitle "[click]" while Subtitles are On.

### Requirement 6: Gunfire noise
**User Story:** As a player, I want gunfire to have a cost, so that firearms carry risk.

#### Acceptance Criteria
1. WHEN a Firearm fires a round, THE Enemy_AI SHALL raise one Noise_Event at the shot position with radius 30 m for the revolver and 40 m for the shotgun, and a shotgun blast of 8 pellets SHALL raise exactly one Noise_Event.
2. IF a Firearm trigger is pulled with no rounds loaded, THEN THE Enemy_AI SHALL NOT raise a Noise_Event.
3. WHEN a Noise_Event is raised, THE Enemy_AI SHALL set every living zombie whose distance to the shot position is at most the radius to move toward the shot position.
4. WHEN a Noise_Event is raised, THE Enemy_AI SHALL wake and set to hunt every Lurker whose distance to the shot position is at most 15 m.
5. WHEN a second Noise_Event is raised while a zombie is already moving toward an earlier shot position, THE Enemy_AI SHALL replace that zombie's destination with the newest shot position.
6. IF a zombie is attacking the player at melee range when a Noise_Event reaches it, THEN THE Enemy_AI SHALL leave its target unchanged.
7. FOR ALL zombie positions and shot positions, a zombie SHALL be affected by a Noise_Event if and only if its distance is within the radius (property).
8. WHEN a Firearm fires a round, THE Audio_Manager SHALL play a procedural gunshot on the SFX volume, and THE Subtitle system SHALL show a gunfire caption.

### Requirement 7: Ammunition HUD
**User Story:** As a player, I want to see my rounds at a glance, so that I can plan reloads in the dark.

#### Acceptance Criteria
1. WHILE a Firearm is equipped, THE HUD SHALL show the Magazine count and the Ammo_Stack count in the form "M / S", where M is the rounds in the Magazine (0 up to the Firearm's current capacity, 6 or 8 for the revolver and 2 for the shotgun) and S is the matching ammunition stack in the satchel (0 to 36 revolver cartridges, 0 to 20 shotgun shells).
2. WHEN a Magazine count or Ammo_Stack count changes, THE HUD SHALL show the new value within 100 ms.
3. WHILE a Firearm is reloading, THE HUD SHALL show a "Reloading" label with the seconds left as text to one decimal place, refreshed at least every 100 ms, counting down from that Firearm's current reload time.
4. WHEN a reload finishes, is cancelled, or the Firearm is unequipped, THE HUD SHALL remove the "Reloading" label within 100 ms.
5. WHILE a Firearm is equipped and the Magazine is empty, THE HUD SHALL show an "Empty" label alongside the count.
6. WHILE a Firearm is equipped and the Ammo_Stack is empty, THE HUD SHALL show "No ammo" beside the Magazine count.
7. IF the Magazine and the Ammo_Stack are both empty, THEN THE HUD SHALL show both the "Empty" label and the "No ammo" label.
8. WHILE no Firearm is equipped, THE HUD SHALL NOT show the ammunition readout.
9. THE HUD SHALL convey ammo state with text and a distinct shape or glyph for each of the states Reloading, Empty and No ammo, and SHALL NOT convey it by colour alone.

### Requirement 8: Heavy melee and the Heavy_Attack
**User Story:** As a player, I want slow, powerful melee weapons, so that I can knock zombies down and control crowds.

#### Acceptance Criteria
1. WHILE the player holds the attack input with a Heavy_Weapon equipped, THE Melee_System SHALL fill a charge meter over 0.8 s for the wood axe and 0.6 s for the silver sabre, and SHALL show the charge progress on the HUD.
2. WHEN the player releases the attack input with a full charge and has at least 25 Stamina (axe) or 20 Stamina (sabre), THE Melee_System SHALL perform a Heavy_Attack that deals 70 damage (axe) or 60 damage (sabre) to each zombie in the melee arc and SHALL spend 25 (axe) or 20 (sabre) Stamina.
3. WHEN the player presses the Heavy Attack input (default V) with a Heavy_Weapon equipped, THE Melee_System SHALL charge for the weapon's full charge time and then release the Heavy_Attack automatically, applying the same Stamina rule as criterion 2.
4. WHEN the player releases the attack input before the charge is full, THE Melee_System SHALL perform a normal attack (30 damage axe, 28 damage sabre), spend no Stamina, and apply no Knockdown.
5. IF the player releases a full charge or the auto-release fires with Stamina below the cost, THEN THE Melee_System SHALL perform a normal attack instead, spend no Stamina, and show a "Too tired" cue that is visible without relying on colour alone.
6. WHEN a Heavy_Attack hits a zombie, THE Enemy_AI SHALL put that zombie in Knockdown for 1.5 s (axe) or 1.2 s (sabre). A zombie already in Knockdown SHALL have its timer reset to that duration, not extended.
7. WHILE a zombie is in Knockdown, THE Combat_System SHALL multiply damage taken by that zombie by 1.25 and THE Enemy_AI SHALL prevent that zombie from attacking or moving.
8. WHEN a Heavy_Attack hits a Brute, THE Enemy_AI SHALL apply Knockdown. WHEN a Heavy_Attack hits Father Crane, THE Enemy_AI SHALL apply no Knockdown but SHALL still apply the damage.
9. WHEN the sabre hits a Wailer, THE Combat_System SHALL add 50% to the damage dealt (the sabre's 60 heavy damage becomes 90).
10. WHEN a swing with a Heavy_Weapon hits at least one zombie, THE Durability_System SHALL spend exactly 1 durability, regardless of the number of zombies hit, and a swing that hits nothing SHALL spend none. The sabre has unlimited durability and SHALL spend none.
11. WHEN the `wood-axe` durability reaches 0, THE Durability_System SHALL break it, remove it from the player's weapons, and show a subtitle for the break sound when subtitles are enabled.
12. WHILE a Heavy_Weapon is mid-swing or charging, THE Melee_System SHALL cancel the charge, with no Stamina spent, if the player switches weapon, dodges, or opens the pause menu.
13. WHERE a weapon upgrade changes a Heavy_Weapon stat (damage, durability or heavy-attack Stamina cost), THE Melee_System SHALL use the upgraded value in criteria 2, 4, 5 and 10 in place of the base value.
14. FOR ALL Stamina values below the cost, a Heavy_Attack SHALL NOT spend Stamina and Stamina SHALL NOT go below 0 (property).
15. FOR ALL Knockdown applications, a knocked-down zombie SHALL deal no damage until the timer ends (property).

### Requirement 9: Kick and Dodge
**User Story:** As a player, I want a kick and a dodge, so that I can create space without a weapon swap.

#### Acceptance Criteria
1. WHEN the player presses the Kick input with at least 15 Stamina and no active Kick cooldown, THE Combat_System SHALL spend 15 Stamina, deal 5 damage to the nearest zombie in front of the player, push it 2 m back, stagger it for 0.6 s and start a Kick cooldown of 1.2 s.
2. WHEN a Kick hits a Brute, THE Combat_System SHALL deal 5 damage, stagger it for 0.3 s and apply no push.
3. WHEN a Kick hits Father_Crane, THE Combat_System SHALL deal 5 damage and apply no push and no stagger.
4. WHEN the player presses the Dodge input with at least 25 Stamina and no active Dodge cooldown, THE Player_Controller SHALL spend 25 Stamina, dash 3 m over 0.25 s in the movement direction (backwards when there is no movement input) and start a Dodge cooldown of 0.8 s.
5. WHILE the first 0.2 s of a Dodge is running, THE Player_Health system SHALL ignore all incoming damage.
6. WHILE the Dodge has run longer than 0.2 s, THE Player_Health system SHALL apply incoming damage normally.
7. IF the player presses the Dodge or Kick input while Stamina is below that move's cost or while that move's cooldown is active, THEN THE Combat_System SHALL ignore the input, spend no Stamina and leave the cooldown unchanged.
8. IF a Kick finds no zombie in front of the player, THEN THE Combat_System SHALL still spend 15 Stamina and start the 1.2 s cooldown, and SHALL deal damage to no target.
9. IF a wall lies within 3 m on the dash path, THEN THE Player_Controller SHALL stop the dash at the wall, and the Dodge SHALL still spend 25 Stamina and start its cooldown.
10. FOR ALL Stamina values, Kick and Dodge SHALL leave Stamina within 0 to 100 (invariant property).

### Requirement 10: Combat feedback
**User Story:** As a player, I want clear feedback on hits and kills, so that I can tell what my attacks do.

#### Acceptance Criteria
1. WHEN the player's attack damages a zombie, THE HUD SHALL flick a Hit_Marker cross on the crosshair.
2. WHEN a hit is a headshot, THE HUD SHALL add a dot and a ring to the Hit_Marker, so that the headshot marker is distinguishable by shape and not by colour alone.
3. WHEN the player's attack kills a zombie, THE HUD SHALL show a Hit_Marker larger than the non-lethal one, THE Effects_Layer SHALL release a dust puff from the body and THE Score_Tracker SHALL count the kill exactly once.
4. WHEN a single attack damages several zombies (shotgun pellets, thrown or area weapons), THE HUD SHALL show one Hit_Marker flick for that attack, and THE Effects_Layer SHALL spawn one Damage_Number per zombie hit.
5. WHERE the Damage numbers setting is On, THE Effects_Layer SHALL float a Damage_Number up from each hit point and fade it out over 0.8 s.
6. THE Effects_Layer SHALL draw body-hit Damage_Numbers in pale parchment and headshot Damage_Numbers in ember with a "!" after the number.
7. WHERE the Damage numbers setting is Off, THE Effects_Layer SHALL spawn no Damage_Numbers.
8. THE Settings_Menu SHALL offer a "Damage numbers" On/Off toggle with default On, saved in localStorage, with a visible focus state and keyboard operation.
9. IF the saved Damage numbers value in localStorage is missing or invalid, THEN THE Settings_Menu SHALL use the default On.
10. WHERE Flashing_Lights is Off, THE HUD SHALL show hit flashes as steady changes of 300 ms or longer.
11. THE Effects_Layer SHALL show kills with dust particles only and no blood or gore.
12. FOR ALL Damage_Number lists and time steps, no Damage_Number SHALL exist for longer than 0.8 s (property).

### Requirement 11: Weapon upgrades
**User Story:** As a player, I want to improve my weapons at the workbench, so that resources turn into visible power.

#### Acceptance Criteria
1. WHILE the player is at the Workbench and owns a weapon, THE Workbench_UI SHALL list every Upgrade for that weapon with its name and cost, and SHALL list no Upgrades for weapons the player does not own.
2. WHEN the player selects an Upgrade they own the weapon for, have not bought, and can afford, THE Upgrade_System SHALL, in one step, remove the full cost from the satchel, record the Upgrade as bought and apply its effect.
3. THE Workbench_UI SHALL show each changed stat of an Upgrade as "old → new" (for example "Capacity 6 → 8") before purchase.
4. THE Workbench_UI SHALL mark each bought Upgrade with text and a rune, and SHALL mark each Upgrade the player cannot afford with a text reason naming the missing material and the missing amount.
5. IF the player lacks any part of the cost, THEN THE Upgrade_System SHALL reject the purchase, leaving the satchel and Upgrade state unchanged, and THE Workbench_UI SHALL show the text reason from criterion 4.
6. IF the player selects an Upgrade they already bought, THEN THE Upgrade_System SHALL reject the purchase and leave the satchel and Upgrade state unchanged, so each Upgrade can be bought once.
7. IF the player selects an Upgrade for a weapon they do not own, THEN THE Upgrade_System SHALL reject the purchase and leave the satchel and Upgrade state unchanged.
8. WHEN an Upgrade is bought, THE Upgrade_System SHALL set the changed stats to the values in the design bible, including: Larger Cylinder capacity 6 → 8, Speed Loader reload 2.4 → 1.4 s, Rifled Barrel damage 34 → 44, Choke spread 6° → 4°, Shell Belt reload 2.0 → 1.3 s, Heavy Shot pellet damage 9 → 12, Iron-Banded Haft durability 60 → 100, Honed Edge damage 30 / 70 → 38 / 88, Blessed Edge damage 28 / 60 → 34 / 72, and Basket Hilt heavy attack stamina 20 → 12.
9. WHEN the Larger Cylinder Upgrade is bought, THE Firearm SHALL use a capacity of 8 for the revolver, and the revolver's loaded rounds SHALL remain unchanged until the next reload.
10. FOR ALL Upgrade subsets, the derived weapon stats SHALL be independent of the order in which the Upgrades were bought (confluence property).
11. FOR ALL successful purchases, the satchel after the purchase SHALL equal the satchel before minus the cost, and FOR ALL rejected purchases it SHALL equal the satchel before (conservation property).

### Requirement 12: Timed effects
**User Story:** As a player, I want buffs I can read and trust, so that I know what is active and for how long.

#### Acceptance Criteria
1. WHEN the player uses `blessed-rounds`, THE Effect_System SHALL apply Blessed Rounds for 30 s (Firearm damage ×2) and consume one `blessed-rounds` item.
2. WHEN the player uses `kola-tonic`, THE Effect_System SHALL apply Adrenaline for 20 s (movement speed ×1.3, sprint Stamina drain ×0.5) and consume one `kola-tonic` item.
3. WHEN the player places a Salt Circle, THE Effect_System SHALL apply a Salt Circle Timed_Effect for 30 s and show the remaining time of the newest circle.
4. WHEN a Timed_Effect is applied while the same effect is active, THE Effect_System SHALL reset its remaining time to the full duration and SHALL NOT stack its magnitude or create a second entry.
5. WHEN a Timed_Effect remaining time reaches 0, THE Effect_System SHALL remove it and restore the affected stat to its unmodified value on the same simulation step.
6. WHILE Blessed Rounds is active, THE Effect_System SHALL apply the ×2 multiplier to Firearm damage only and SHALL NOT change melee or thrown damage.
7. WHILE the game is paused, THE Effect_System SHALL NOT reduce the remaining time of any Timed_Effect.
8. IF the player dies or a night is retried, THEN THE Effect_System SHALL remove all active Timed_Effects.
9. THE HUD SHALL show one Effect_Icon per active Timed_Effect, each with its own glyph, a countdown ring and the seconds left as text, up to a maximum of 6 icons.
10. WHERE Flashing_Lights is Off, THE HUD SHALL show the countdown ring as a steady fill without pulsing.
11. FOR ALL effect sequences, applying an effect twice at the same time SHALL give the same state as applying it once (idempotence property).
12. FOR ALL time steps, remaining time SHALL be non-increasing and never negative (invariant property).
13. FOR ALL active effects, at most one entry per effect ID SHALL exist (invariant property).

### Requirement 13: Bloater
**User Story:** As a player, I want a swollen enemy I must kill at range, so that positioning matters.

#### Acceptance Criteria
1. THE Enemy_Director SHALL render the Bloater with `zombie.glb` scaled x 1.35, y 1.1, z 1.35 and tinted `#9aa58a`, following `docs/enemy-models.md` (SkeletonUtils clone, cloned material).
2. THE Enemy_Director SHALL spawn each Bloater with 80 HP, a speed of 1.0 m/s and a melee hit damage of 15, before elite and mode multipliers.
3. WHEN a Bloater's HP reaches 0, THE Enemy_AI SHALL start a swell of 0.8 s with a rising hiss, and SHALL stop the Bloater moving and attacking for the duration of the swell.
4. WHEN a Bloater swell starts, THE Subtitle system SHALL show a caption for the hiss while subtitles are enabled.
5. WHEN the swell ends, THE Combat_System SHALL burst the Bloater exactly once and deal 25 damage to the player and to every other zombie within 3 m of the Bloater's position at that moment.
6. WHEN the burst happens, THE Effects_Layer SHALL show grey-green gas and dust particles only, with no blood or gore.
7. IF the player is invulnerable from a Dodge when the burst happens, THEN THE Player_Health system SHALL ignore the burst damage to the player and SHALL still apply it to other zombies in range.
8. IF the burst damage reduces another Bloater's HP to 0, THEN THE Combat_System SHALL start that Bloater's own 0.8 s swell, so a chain of bursts resolves one burst per Bloater with no repeats.
9. FOR ALL zombie positions, the burst SHALL damage a target if and only if its distance to the Bloater is 3 m or less (property).
10. FOR ALL bursts, damage to the player SHALL NOT reduce health below 0 and the burst SHALL NOT kill the player outright from above 25 HP (invariant property).

### Requirement 14: Brute
**User Story:** As a player, I want a slow, heavy enemy that needs a plan, so that nights escalate.

#### Acceptance Criteria
1. WHEN a Brute is rendered, THE Enemy_Director SHALL use `zombie-brute.glb` at scale 1.0 tinted `#b5a99a`.
2. THE Enemy_AI SHALL give the Brute 300 HP, 1.1 m/s speed and 30 damage before mode and Elite modifiers, and SHALL apply those modifiers to the base values (HP, speed, damage) as defined in the Mode and Elite requirements.
3. WHEN a light attack or Kick hits a Brute, THE Enemy_AI SHALL apply no Knockdown, SHALL apply no Kick push, and SHALL stagger it for 0.3 s only.
4. WHEN a Heavy_Attack hits a Brute, or a shotgun blast fired from 3 m or less hits a Brute, THE Enemy_AI SHALL apply Knockdown.
5. IF a shotgun blast is fired from more than 3 m away and hits a Brute, THEN THE Enemy_AI SHALL apply damage only and no Knockdown.
6. WHILE a Brute is Knocked down, THE Enemy_AI SHALL prevent it from attacking and SHALL apply the Knockdown rules from Requirement 8 (duration and +25% damage taken).
7. WHEN a Brute spawns, THE Subtitle system SHALL show an arrival caption, and THE Audio_Manager SHALL play a spatial low grunt at the Brute's position.
8. WHILE a Brute is walking, THE Audio_Manager SHALL play heavy thudding steps as a spatial sound at the Brute's position.
9. WHILE a Brute attacks a Door, THE Barricade_System SHALL apply double its hit damage to Board health, and WHILE the final rite is running SHALL apply the rite's double-damage multiplier on top of that (four times the Brute's hit damage).
10. IF Subtitles are off, THEN THE Subtitle system SHALL show no arrival caption while the Brute's grunt still plays.

### Requirement 15: Elite zombies
**User Story:** As a player, I want rare dangerous zombies that reward me, so that fights carry risk and payoff.

#### Acceptance Criteria
1. WHEN a Shambler, Bloater or Brute spawns on night 2 or later and the wave has no Elite yet, THE Wave_Director SHALL roll the Elite chance using the seeded random source, with the chance set to 4% on Easy, 6% on Normal and 10% on Hard (Easy and Hard arrive in spec 08; until then the Normal value applies).
2. THE Wave_Director SHALL spawn at most 1 Elite per wave.
3. IF the night is 1, THEN THE Wave_Director SHALL NOT roll the Elite chance and SHALL spawn 0 Elites.
4. IF the spawning enemy is a Wailer, Lurker or Father_Crane, THEN THE Wave_Director SHALL NOT roll the Elite chance for it.
5. WHEN an enemy becomes an Elite, THE Enemy_AI SHALL set its HP to ×2, its speed to ×1.15 and its damage to ×1.25 of the base values for its type, applied before the Mode multipliers for Easy and Hard.
6. THE Enemy_Director SHALL render an Elite at ×1.05 of its normal model scale with an ember aura and a floating Sigil_Ring above its head, so that the Elite is identifiable by shape as well as colour.
7. WHERE Flashing_Lights is Off, THE Effects_Layer SHALL show the ember aura at constant brightness with no pulsing.
8. WHEN an Elite spawns, THE Subtitle system SHALL show an arrival caption for 3 s while Subtitles is On.
9. WHEN an Elite dies, THE Loot_System SHALL drop exactly one item drawn by weight from the Elite drop table (6 revolver cartridges 30, 2 shotgun shells 25, 1 silver filings 20, 1 kola tonic 15, 2 black powder 10, total weight 100), using the seeded random source.
10. IF the satchel has no room for the dropped item, THEN THE Loot_System SHALL leave the item on the ground at the Elite's death position as a pickup, and the drop SHALL NOT be discarded.
11. FOR ALL seeds, a wave SHALL contain 0 or 1 Elites (invariant property).
12. FOR ALL seeds on night 1, a wave SHALL contain 0 Elites (property).
13. FOR ALL Elite drop rolls, the drop SHALL be one of the five table entries, and over 10,000 rolls each entry's observed frequency SHALL be within 3 percentage points of its weight (statistical property).

### Requirement 16: Barricade doors
**User Story:** As a player, I want to board up the chapel, so that the safe zone is something I build and defend.

#### Acceptance Criteria
1. WHEN chapel repair stage 1 is built, THE Barricade_System SHALL fit barricade frames on the front Door and the vestry Door, each with 3 slots, and nail 2 Boards on each Door, each Board with 60 health.
2. WHILE repair stage 1 is built, WHEN the player holds Interact for 2 s within 2.5 m of a Door that has a free slot while holding at least 1 `wood-plank` and 2 `iron-nail`, THE Barricade_System SHALL spend exactly 1 `wood-plank` and 2 `iron-nail` and add a Board with full health (60, or the Hardened Boards value) to that Door, in any phase.
3. IF the player moves or takes damage during the 2 s hold, or releases Interact before 2 s, THEN THE Barricade_System SHALL cancel the nailing, spend no materials and add no Board.
4. IF the player holds Interact at a Door with 3 Boards, or without at least 1 `wood-plank` and 2 `iron-nail`, THEN THE Barricade_System SHALL start no nailing, spend no materials and show a prompt stating that the Door is full or which material is missing.
5. WHILE repair stage 1 is built and both Doors have at least 1 Board, THE Chapel SHALL act as a safe zone that zombies cannot enter.
6. WHILE repair stage 1 is built and a Door has 0 Boards, THE Enemy_AI SHALL let zombies walk through that Door.
7. WHILE repair stage 1 is not built, THE Chapel SHALL leave both doorways open and SHALL NOT act as a safe zone, and THE Barricade_System SHALL show no frames, plaques or door HUD lines.
8. WHILE the night is running and the player is inside the chapel, THE Enemy_AI SHALL assign every zombie that targets the player to attack the nearest Door that has at least 1 Board.
9. WHEN a wave of N zombies spawns, THE Enemy_AI SHALL assign max(floor(N / 3), 1 if the night is 2 or later else 0) of them as Door_Attackers heading for the nearest Door instead of the player.
10. WHEN a Door_Attacker hits a Door that has at least 1 Board, THE Barricade_System SHALL deal the zombie's normal hit damage to the Board with the lowest health, ×2 for a Brute, ×2 during the Final_Rite, and ×4 for a Brute during the Final_Rite.
11. WHEN a Board's health reaches 0, THE Barricade_System SHALL remove the Board (leaving damage beyond its remaining health unapplied to other Boards), THE Audio_Manager SHALL play a splintering sound at that Door, and THE Subtitle system SHALL show "[wood splinters at the front door]" or "[wood splinters at the vestry door]" for that Door.
12. WHILE repair stage 1 is built, THE Chapel SHALL show a board-count plaque over each Door, and THE HUD SHALL show "Front door n/3" and "Vestry n/3" with each remaining Board's health as numbers, updated within 1 frame of any change in Board count or health.
13. WHERE the Hardened Boards dawn upgrade exists, THE Barricade_System SHALL scale the maximum health of Boards nailed after the upgrade by the upgrade's factor (+25%, so 75), and Boards already in place SHALL keep their current health.
14. FOR ALL attack and nailing sequences, Board count SHALL stay between 0 and 3 and Board health between 0 and its maximum (invariant property).
15. FOR ALL Doors, damage dealt to Boards SHALL equal the total health removed from Boards (conservation property).
16. FOR ALL wave sizes N and nights, the number of Door_Attackers SHALL equal max(floor(N / 3), 1 if night is 2 or later else 0) (property).

### Requirement 17: Father_Crane
**User Story:** As a player, I want a climactic, tragic boss in the final rite, so that the story ends with weight.

#### Acceptance Criteria
1. WHEN 10 s of simulation time have passed since the Final_Rite started (counted whether or not Interact is held), THE Boss_Director SHALL begin the rising with a 1.5 s telegraph, a stone-grinding sound and the subtitle "[stone grinding beneath the altar]".
2. WHEN the rising telegraph ends, THE Boss_Director SHALL spawn Father_Crane with 1500 HP from the catacomb stair behind the altar if the stair was revealed, or breaking through the floor beside the altar if it was never revealed.
3. WHEN Father_Crane spawns, THE HUD SHALL show a 3 s name card "Father Aldous Crane" with the line "He sealed the doors", and THE Player_Controller SHALL keep player control.
4. WHILE Father_Crane is alive, THE HUD SHALL show a wide top-centre health bar with his name, phase marks at 60% and 25% of max HP, and current and max HP as numbers.
5. WHILE Father_Crane is alive, THE Boss_Director SHALL cap the Final_Rite progress at 44 of 45 s, keeping any progress already earned.
6. WHILE Father_Crane has 60% or more of his max HP, THE Boss_Director SHALL use phase 1: speed 1.2 m/s, Censer Swing (1.0 s wind-up, 120° arc, 3 m reach, 30 damage) and Call the Congregation every 25 s (3 Shamblers rise from the chapel floor after a 1 s telegraph and a subtitle).
7. WHILE Father_Crane has under 60% and at least 25% of his max HP, THE Boss_Director SHALL use phase 2: speed 1.5 m/s, the phase 1 attacks, and The Toll every 12 s (1.2 s raised hand with the subtitle "[a great bell tolls]", then a ring of radius 8 m around him dealing 20 damage and pushing the player 3 m).
8. WHILE Father_Crane has under 25% of his max HP, THE Boss_Director SHALL use phase 3: speed 1.7 m/s, two Censer Swings in a row, The Toll every 12 s, and Call the Congregation every 18 s.
9. WHEN the player dodges through The Toll ring during the dodge's first 0.2 s of invulnerability, THE Player_Health system SHALL apply no damage and no push from that ring.
10. WHILE Father_Crane is inside a Salt Circle, THE Boss_Director SHALL halve his current speed and SHALL NOT stop him.
11. WHEN a Kick or Knockdown targets Father_Crane, THE Combat_System SHALL apply no push, stagger or knockdown (a Kick still deals its 5 damage and a Heavy_Attack its damage), and SHALL still spend the player's stamina and start the Kick cooldown.
12. WHEN Father_Crane reaches 0 HP, THE Boss_Director SHALL cancel any pending Censer Swing, The Toll and Congregation, play a kneel and crumble-to-dust sequence, hold 4 s of quiet, show the subtitle "Forgive them. Not me.", and then allow the Final_Rite to complete.
13. IF the player dies while Father_Crane is alive, THEN THE Boss_Director SHALL stop all of his attacks and timers, and THE Final_Rite SHALL end as a failed run through the normal death flow.
14. WHILE Father_Crane is alive during the Final_Rite, THE Objective_Tracker SHALL show "Put Father Crane to rest" (rule 3 of `docs/game-design.md` §11).
15. WHEN Father_Crane dies, THE Score_Tracker SHALL award exactly one Father Crane kill (1000 base points, once spec 08 adds scoring), and THE Mystery_System SHALL record the event for the ending.
16. THE Enemy_Director SHALL render Father_Crane with `zombie-brute.glb` at scale 1.2 tinted `#3a3440`, with a censer and stole built from primitive meshes.
17. FOR ALL damage sequences, Father_Crane's phase SHALL be a monotonic non-decreasing function of lost HP (property).
18. FOR ALL Final_Rite progress values while Father_Crane is alive, progress SHALL be at most 44 s (invariant property).
19. FOR ALL times, the Toll and Congregation timers SHALL fire at their phase intervals and SHALL NOT fire before the boss has risen (property).

### Requirement 18: Wave additions
**User Story:** As a player, I want the new enemies to appear in a paced way, so that difficulty climbs across the nights.

#### Acceptance Criteria
1. WHEN the Wave_Director generates the wave list for night 3, THE Wave_Director SHALL add exactly 1 Bloater to the last wave (wave 3 of 3) and no Bloaters or Brutes to waves 1 and 2.
2. WHEN the Wave_Director generates the wave list for night 4, THE Wave_Director SHALL add exactly 1 Bloater and exactly 1 Brute to the last wave (wave 4 of 4) and no Bloaters or Brutes to waves 1 to 3.
3. WHEN the Wave_Director generates the wave list for night 5, THE Wave_Director SHALL add exactly 2 Bloaters and exactly 1 Brute to each of the last 2 waves (waves 4 and 5 of 5) and no Bloaters or Brutes to waves 1 to 3.
4. WHEN the Wave_Director generates the wave list for night 1 or night 2, THE Wave_Director SHALL add no Bloaters, Brutes or Father Crane, leaving the base composition in `docs/game-design.md` §8 unchanged.
5. THE Wave_Director SHALL keep the wave count per night at 2, 3, 3, 4 and 5 for nights 1 to 5, and SHALL keep every base-composition entry (Shamblers, Wailers, Lurkers) unchanged in type, count and wave position.
6. THE Wave_Director SHALL NOT add Father Crane to any wave; he appears only during the Final_Rite on night 5.
7. IF the Wave_Director is asked for a night outside 1 to 5, THEN THE Wave_Director SHALL return no additions (an empty addition list) and SHALL leave the game state unchanged.
8. WHEN all 5 waves of night 5 are cleared, THE Wave_Director SHALL make the Final_Rite available, as it did before this spec.
9. FOR ALL nights 1 to 5, the generated wave list SHALL equal the base composition plus the additions in `docs/game-design.md` §8, compared by wave index, enemy type and count (model-based property).

### Requirement 19: Save and load
**User Story:** As a player, I want my combat progress saved, so that continuing does not lose weapons, ammo or defences.

#### Acceptance Criteria
1. WHEN the Save is written, THE Save_System SHALL include owned weapons, taken weapon pickups, rounds loaded in each Firearm, Ammo_Stacks (revolver-cartridge and shotgun-shell), bought Upgrades, each Door's Boards with their health (front door and vestry door, 0 to 3 Boards each), remaining durability of each durability-limited weapon, and counts of the new materials (wood-plank, black-powder, lead-shot, silver-filings).
2. WHEN the Save is loaded, THE Save_System SHALL restore all of the state listed in criterion 1 so that each value equals the saved value.
3. WHEN a Save written before this spec is loaded, THE Save_System SHALL set each new field to its default (no new weapons or Upgrades owned, no Ammo_Stacks, new material counts 0, no Boards on either Door) and load without error.
4. IF a Save holds an unknown weapon ID, an unknown Upgrade ID, or a value outside its valid range (Magazine above capacity, Board health outside 0 to its maximum, Board count outside 0 to 3, negative count, Ammo_Stack above its stack limit of 36 revolver cartridges or 20 shotgun shells, material count above 10), THEN THE Save_System SHALL discard only the invalid entry, replace it with the field default, keep all valid entries and load without error.
5. IF a Save holds an Upgrade whose weapon is not in the owned weapons, THEN THE Save_System SHALL discard that Upgrade and load without error.
6. IF the Save data is unreadable or structurally invalid, THEN THE Save_System SHALL treat it as no save (Continue hidden, as in Requirement 7 of spec 05), SHALL not crash, and SHALL leave the stored data unchanged.
7. FOR ALL valid combat states, loading a written Save SHALL give a state equal to the original (round-trip property).
8. FOR ALL valid combat states, a Save SHALL keep Magazine counts within 0 to capacity (including capacity raised by Upgrades), Board health within 0 to maximum, and Ammo_Stack counts within 0 to their stack limits (invariant property).

### Requirement 20: Retry Night
**User Story:** As a player, I want Retry Night to give me a clean, fair second try, so that a death does not carry broken state.

#### Acceptance Criteria
1. WHEN the player chooses Retry Night, THE Retry_Night flow SHALL restore the Dusk_Snapshot values for Boards, Board health, Magazine counts, Ammo_Stacks, owned weapons, weapon durability, Upgrades, materials, lantern fuel, player health and stamina, and the repair stages, so that each equals its value at the start of Dusk of the failed night.
2. WHEN the player chooses Retry Night, THE Retry_Night flow SHALL clear live Timed_Effects, active Grave_Gas, Knockdown state, boss state, Door_Attackers, Damage_Numbers, Hit_Markers, live zombies, thrown or placed items, and the night's wave progress, so that each count is 0 and the first wave of the night has not started.
3. THE Dusk_Snapshot SHALL include every combat field that the Save includes, and a test SHALL fail if a combat field is present in the Save but absent from the Dusk_Snapshot.
4. WHEN Retry Night restores a Final_Rite night, THE Boss_Director SHALL reset so that Father_Crane has not risen and his HP and phase are back at their starting values, and the rite progress SHALL return to its value at the start of that Dusk.
5. WHEN Retry Night completes, THE Retry_Night flow SHALL restore the player to the Dusk phase with the full Dusk duration of 30 s remaining, and the player SHALL have control within 3 s of choosing Retry Night.
6. IF no Dusk_Snapshot exists or it fails to load, THEN THE Retry_Night flow SHALL keep its existing fallback (current inventory, full health, Dusk phase) and SHALL still clear all Night_State listed in criterion 2.
7. WHERE the game mode is Endless Survival (spec 08), THE Retry_Night flow SHALL NOT be offered, and death SHALL end the run.
8. FOR ALL combat states, taking a Dusk_Snapshot then restoring it after any night actions SHALL give the snapshot values for persistent fields and empty Night_State (round-trip property).
9. FOR ALL states, restoring twice SHALL give the same result as restoring once (idempotence property).

### Requirement 21: Accessibility
**User Story:** As a player who needs comfort options, I want all new effects to respect my settings, so that I can play safely.

#### Acceptance Criteria
1. WHERE Flashing_Lights is Off, THE Effects_Layer SHALL replace muzzle flashes, hit flashes, elite glow pulses and boss telegraph flashes with steady or gradual changes that last at least 300 ms and never alternate brightness more than once per second.
2. WHERE Flashing_Lights is Off, THE Effects_Layer SHALL dim the muzzle flash sprite and skip the muzzle flash light pop.
3. WHERE Camera_Shake is Off, THE Camera_Controller SHALL apply no impact shake and SHALL apply firearm recoil kick at 50% of its Firearms table value (Revolver 1.25° up, Shotgun 3° up).
4. WHERE Scare intensity is Reduced or Off, THE Camera_Controller SHALL apply no shake from boss attacks or Bloater bursts, regardless of the Camera_Shake setting.
5. THE HUD SHALL convey headshots with a marker shape (dot and ring) and a "!" after the number in the Damage_Number, elites with the Sigil_Ring, and Door state with text counts ("Front door 2/3", "Vestry 3/3"), and SHALL NOT convey any of them by colour alone.
6. THE Subtitle_System SHALL show a subtitle, while Subtitles is On, for each of these sounds: nearby gunfire, dry click, board breaking, Bloater hiss and burst, elite arrival, boss rising, Congregation call, The Toll and boss death.
7. THE Input_System SHALL expose Reload, Kick, Dodge, Heavy Attack and Aim as rebindable actions with the defaults R, Q, C, V and Right mouse.
8. WHEN the player rebinds an action, THE Settings_Menu SHALL save the binding to localStorage and SHALL show the new key in every prompt that names that action within 1 s.
9. IF the player rebinds an action to a key already bound to another action, THEN THE Settings_Menu SHALL reject the change, keep both existing bindings, and show a message naming the conflicting action.
10. THE Settings_Menu, Workbench_UI and all new overlays SHALL be fully operable with the keyboard alone and SHALL show a visible focus indicator on the focused element.
11. WHEN the pause input is pressed during a boss attack, a scare or a cutscene, THE Game_Loop SHALL open the pause menu within 100 ms and halt simulation until the player resumes.

### Requirement 22: Subtitles
**User Story:** As a deaf or hard-of-hearing player, I want captions for important combat sounds, so that I do not miss threats.

#### Acceptance Criteria
1. WHERE Subtitles is On, WHEN any of these sound events occurs, THE Subtitle system SHALL show a caption for it: gunfire within the firing weapon's noise radius of the player (30 m revolver, 40 m shotgun), the dry click ("[click]"), a reload, a barricade board breaking ("[wood splinters at the front door]" or "[wood splinters at the vestry door]"), the Bloater's rising hiss, a Brute's arrival, an Elite's arrival, The Toll ("[a great bell tolls]"), the Congregation rising, and the boss rising ("[stone grinding beneath the altar]").
2. WHERE Subtitles is On, THE Subtitle system SHALL keep each caption visible for at least the duration of its sound, and for no less than 1.5 s when the sound is shorter than 1.5 s.
3. WHERE Subtitles is On, THE Subtitle system SHALL show the captions listed in criterion 1 at every Scare intensity setting (Full, Reduced and Off).
4. WHERE Subtitles is On, IF a new caption is triggered while 3 captions are already showing, THEN THE Subtitle system SHALL remove the oldest caption and show the new one, without dropping any caption before its minimum display time from criterion 2 has elapsed except for this replacement.
5. WHERE Subtitles is Off, THE Subtitle system SHALL show no combat captions, and gameplay and audio SHALL be unaffected.
6. FOR ALL sound events in the criterion 1 list, a caption entry SHALL exist in the Combat_Data caption table (completeness property), and every caption entry SHALL refer to a sound event in that list.

### Requirement 23: Horror design and content rules
**User Story:** As the designer, I want the new combat to follow the horror pillars, so that it stays scary, fair and respectful.

#### Acceptance Criteria
1. WHEN Father_Crane starts a Censer Swing, The Toll or Call the Congregation, THE Boss_Director SHALL show the telegraph for at least 1.0 s, 1.2 s and 1.0 s respectively before any damage or spawn is applied.
2. IF Father_Crane is interrupted during a telegraph, THEN THE Boss_Director SHALL either complete the full telegraph before applying damage or cancel the attack with no damage applied.
3. THE Enemy_Director SHALL NOT include jokes, mockery or taunt text about the church or the rite in any Father_Crane name card, subtitle, health bar label or journal text.
4. WHEN a zombie dies or a Bloater bursts, THE Effects_Layer SHALL show only dust and grey-green gas particles and SHALL NOT render blood, gore or a close-up camera on the body.
5. WHEN a Bloater burst or a Father_Crane attack deals damage to the player, THE Player_Health_System SHALL apply no more than that attack's single-hit damage value as listed in the design bible (25 for the burst, 30 for the Censer Swing, 20 for The Toll), after Mode and elite multipliers.
6. IF a single hit caused by a scare event would reduce the player from above 0 HP to 0 HP, THEN THE Scare_Director SHALL leave the player at 1 HP or more; scare events SHALL NOT kill the player.
7. THE Audio_Manager SHALL produce all new sounds as procedural Web Audio on `Howler.ctx`, routed through the master volume and the music or SFX volume settings.
8. THE Scene SHALL build weapons, the censer, the stole, the Sigil_Ring and barricade Boards from primitive meshes and SHALL reuse only `zombie.glb` and `zombie-brute.glb` as enemy models.
9. THE Scene SHALL add no new model, texture or audio files.
10. WHILE the game is running, THE Scene SHALL keep draw calls under 150 and shadow-casting lights at 4 or fewer, using instancing for Boards and Damage_Numbers.

### Requirement 24: Testing, logging and verification
**User Story:** As the maintainer, I want every system tested and logged, so that the hackathon write-up is accurate and the game is actually playable.

#### Acceptance Criteria
1. THE Project SHALL include, for every new system file in `src/game/systems/`, a `*.test.ts` file in the same directory that contains at least 1 passing test.
2. THE Project SHALL include fast-check property tests, each run with at least 100 generated cases, for the pure rules in Requirements 3, 4, 8, 9, 11, 12, 13, 15, 16, 17, 19 and 20.
3. WHEN a task completes, THE Developer SHALL run `npm run build`, `npm run test` and `npm run lint` and confirm that all three exit with code 0 before marking the task done.
4. IF any of `npm run build`, `npm run test` or `npm run lint` exits with a non-zero code, THEN THE Developer SHALL leave the task not done and fix the failure before starting the next task.
5. WHEN a task completes, THE Developer SHALL append one entry to `docs/kiro-log.md` containing the real calendar date (YYYY-MM-DD), the spec name, the task number and the Kiro feature used.
6. THE Project SHALL contain no imports of React, three.js, Howler or any of their packages in any file under `src/game/`.
7. THE Project SHALL define every balance value from `docs/game-design.md` in `src/data/` and SHALL contain no numeric balance literals for those values in files under `src/game/systems/`.
8. IF a value in `src/data/` differs from the matching value in `docs/game-design.md`, THEN THE Developer SHALL change the code in `src/data/` to match the design bible and SHALL leave the design bible unchanged.
9. WHEN every other task in the spec is done, THE Developer SHALL play the spec in a real desktop browser (Chrome, Edge or Firefox) before marking the final checkpoint task done, and the play session SHALL include each of: a firearm shot, a heavy attack, a barricade board nailed, a Bloater burst, an Elite drop and the Father_Crane fight.
10. IF any of the six play-session actions in criterion 9 cannot be completed or fails, THEN THE Developer SHALL leave the final checkpoint task not done and record the failing action in `docs/kiro-log.md`.
