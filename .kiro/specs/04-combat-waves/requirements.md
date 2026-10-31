# Requirements: Combat, Zombies and Night Waves

## Introduction
At night, zombies rise in waves from the graves. This spec covers first-person melee and thrown combat, the viewmodel, the three zombie types, wave spawning, player damage, death and respawn.

## Requirements

### Requirement 1: First-person viewmodel
**User Story:** As a player, I want to see my hands and weapon, so that combat feels physical.

#### Acceptance Criteria
1. The system SHALL render the equipped item in a viewmodel layer in front of the camera, never clipping into world geometry.
2. WHEN the player switches hotbar slots THEN the system SHALL play a 0.3 s lower/raise animation.
3. The viewmodel SHALL sway slightly with mouse movement and bob with walking when head bob is enabled.

### Requirement 2: Melee combat
**User Story:** As a player, I want to swing melee weapons at zombies, so that I can defend myself.

#### Acceptance Criteria
1. WHEN the player presses Attack with a melee weapon off cooldown THEN the system SHALL play a swing and check for hits in a 1.8 m arc of 70° in front of the camera at the swing's midpoint.
2. WHEN a swing hits a zombie THEN the system SHALL apply the weapon's damage, play a hit sound, spawn dust particles and stagger the zombie for 0.3 s.
3. WHEN a hit lands AND camera shake is enabled THEN the system SHALL apply a small shake.
4. WHEN the player holds Block with a melee weapon THEN incoming melee damage SHALL be reduced by 60% and movement slowed to 50%.

### Requirement 3: Thrown and placed items
**User Story:** As a player, I want to throw flasks and bombs and place traps, so that I can deal with groups.

#### Acceptance Criteria
1. WHILE the player holds Aim with a throwable THEN the system SHALL show a dotted arc preview of the trajectory and landing point.
2. WHEN the player releases Attack while aiming THEN the system SHALL throw the item along the previewed arc with physics.
3. WHEN a Holy Water Flask lands THEN the system SHALL deal 40 damage in a 2 m radius, stun for 2 s and double damage against Wailers.
4. WHEN a Nail Bomb's 2 s fuse ends THEN the system SHALL deal 80 damage in a 3 m radius.
5. WHEN the player places a Lantern Trap THEN the system SHALL arm it, and WHEN a zombie comes within 1.5 m THEN it SHALL burn zombies within 2 m for 10/s for 5 s and light the area.
6. WHEN the player places a Salt Circle THEN zombies SHALL NOT cross its 2 m radius for 30 s.

### Requirement 4: Zombie types
**User Story:** As a player, I want distinct zombie types, so that each fight needs different tactics.

#### Acceptance Criteria
1. Shamblers SHALL path toward the player at 1.4 m/s and attack for 10 damage when within 1.2 m, with a 1.5 s attack cooldown.
2. Lurkers SHALL stay motionless until the player is within 4 m and not facing them, or the lantern fuel is under 20%, then lunge at 6 m/s for 20 damage.
3. Wailers SHALL keep 8–12 m from the player and every 8 s scream, pulling all zombies within 25 m toward the player.
4. Each type SHALL play its audio signature from the design bible as spatial audio.
5. Zombies SHALL take 50% less damage while the player's lantern fuel is 0.
6. WHEN a zombie's HP reaches 0 THEN the system SHALL play a collapse-to-dust effect and remove it within 2 s.

### Requirement 5: Waves
**User Story:** As a player, I want waves that escalate each night, so that I feel the pressure build.

#### Acceptance Criteria
1. WHEN `nightStarted(n)` fires THEN the system SHALL run the waves for night n from the design bible.
2. Each wave SHALL spawn its zombies from open graves at least 15 m from the player, with a grave-burst effect.
3. WHEN all zombies in a wave are dead THEN the system SHALL wait 15 s, then start the next wave.
4. WHEN the last wave of a night is cleared THEN the system SHALL report `wavesCleared` to the day/night system.
5. The system SHALL cap live zombies at 14 to keep performance within budget.
6. A wave counter SHALL appear as a hand-written tally in the HUD.

### Requirement 6: Player damage, death and respawn
**User Story:** As a player, I want clear feedback when I'm hurt and a fair restart when I die, so that I stay engaged.

#### Acceptance Criteria
1. WHEN the player takes damage THEN the system SHALL reduce health, dip the lantern-flame HUD and show a red vignette unless flashing lights is off.
2. WHILE health is under 30 THEN the system SHALL play a heartbeat and desaturate the screen slightly.
3. WHEN health reaches 0 THEN the system SHALL show a "You were taken" screen with a Retry Night option.
4. WHEN Retry Night is chosen THEN the system SHALL restore the state saved at the start of that dusk.
