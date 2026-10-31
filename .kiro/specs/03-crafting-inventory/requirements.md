# Requirements: Crafting and Chapel Repairs

## Introduction
Players turn materials into weapons, tools and consumables at a 3D workbench, and spend materials to repair the chapel into a safe zone. The workbench is the showpiece of the Costume Contest entry: craftable items visibly glow, so the spooky look is what tells you what you can make.

## Requirements

### Requirement 1: Workbench
**User Story:** As a player, I want to craft at a workbench in the keeper's hut, so that I have a safe-feeling place to prepare.

#### Acceptance Criteria
1. WHEN the player interacts with the workbench THEN the system SHALL move the camera smoothly to a fixed view over the bench and release pointer lock.
2. The workbench view SHALL show the player's materials laid out on the bench as 3D objects.
3. WHEN the player presses Esc or Interact THEN the system SHALL return to first-person control.
4. The world SHALL keep running while at the workbench (no pause).

### Requirement 2: Recipe display and glow
**User Story:** As a player, I want to see at a glance what I can craft, so that I don't waste time at night.

#### Acceptance Criteria
1. The workbench SHALL show a recipe book listing all unlocked recipes with inputs and output.
2. WHEN the player has all inputs for a recipe THEN the system SHALL make the recipe entry and the matching bench materials glow ember and show a rune icon.
3. WHEN the player hovers a recipe THEN the system SHALL highlight its required materials on the bench and show missing quantities in blood red with a "missing" label.
4. Locked recipes SHALL appear as smudged, unreadable entries with a hint of how to unlock them.

### Requirement 3: Crafting
**User Story:** As a player, I want to craft items, so that I can fight and survive.

#### Acceptance Criteria
1. WHEN the player selects a craftable recipe THEN the system SHALL play a 1.5 s crafting animation and sound, then remove the inputs and add the output.
2. IF the output cannot fit in the satchel THEN the system SHALL refuse before consuming anything and say why.
3. IF the player is hit during crafting THEN the system SHALL cancel without consuming inputs.
4. Recipes that consume a tool (Sharpened Shovel from Rusty Shovel) SHALL replace that tool, including its hotbar slot.

### Requirement 4: Recipe unlocks
**User Story:** As a player, I want new recipes as I progress, so that surviving feels rewarding.

#### Acceptance Criteria
1. At game start the system SHALL unlock the four starting recipes from the design bible.
2. WHEN `dawnStarted(n)` fires for n = 1..4 THEN the system SHALL unlock the recipe listed for surviving night n and show it on the dawn card.
3. WHEN the player reads journal page 3 THEN the system SHALL unlock the Salt Circle recipe with an ink-writing animation in the recipe book.

### Requirement 5: Durability and consumables
**User Story:** As a player, I want crafted weapons to wear out, so that I keep scavenging.

#### Acceptance Criteria
1. Each melee hit SHALL reduce weapon durability by 1, per the design bible.
2. WHEN durability reaches 0 THEN the system SHALL break the weapon with a sound, remove it, and equip the Rusty Shovel.
3. WHEN durability is under 20% THEN the system SHALL show visible cracks on the viewmodel.
4. Using a consumable (bandage, refill) SHALL take its listed time and apply its effect only on completion.

### Requirement 6: Chapel repairs
**User Story:** As a player, I want to repair the chapel, so that I have a safe zone and better tools for the nights ahead.

#### Acceptance Criteria
1. WHEN the player interacts with a repair point in the chapel THEN the system SHALL show the stage's cost, effect and whether it is affordable.
2. WHEN the player confirms an affordable repair THEN the system SHALL consume the materials and apply the stage effect permanently.
3. Stages SHALL be completed in order 1 → 2 → 3.
4. WHILE stage 1 is complete AND it is not the final rite THEN zombies SHALL NOT enter the chapel.
5. WHILE stage 2 is complete THEN interacting with the altar SHALL save the game and heal 25 HP once per day.
6. WHILE stage 3 is complete THEN the bell SHALL ring 20 s before each wave and mark spawn directions on the map.
