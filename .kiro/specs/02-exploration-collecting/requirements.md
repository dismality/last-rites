# Requirements: Exploration and Collecting

## Introduction
Players explore the cemetery to find materials, key items and relics. This spec covers interactables, picking up, digging graves, examining items in 3D, the satchel inventory and the self-drawing map.

## Requirements

### Requirement 1: Interactables
**User Story:** As a player, I want to see and use objects I can interact with, so that I know what is worth investigating in the dark.

#### Acceptance Criteria
1. WHILE an interactable is within lantern radius THEN the system SHALL show a faint pulse on it.
2. WHEN the crosshair is on an interactable within 2.5 m THEN the system SHALL outline it and show a prompt with its action and key (e.g. "E: Dig").
3. WHEN the player presses Interact on an interactable THEN the system SHALL perform its action (pick up, dig, open, read, examine).
4. Interactable highlights SHALL use both a glow and a shape cue, never colour alone.

### Requirement 2: Picking up materials
**User Story:** As a player, I want to collect materials, so that I can craft weapons and repair the chapel.

#### Acceptance Criteria
1. WHEN the player picks up a material THEN the system SHALL add it to the satchel and show a small parchment toast "+2 Bone".
2. IF the material's stack is at its limit (10) THEN the system SHALL refuse the pickup and show "Satchel full: Bone".
3. IF the material is not in the satchel AND all 12 slots are used THEN the system SHALL refuse the pickup and show "Satchel full".
4. WHEN a pickup is refused THEN the item SHALL remain in the world.

### Requirement 3: Digging graves
**User Story:** As a player, I want to dig disturbed graves, so that I can find buried materials at a risk.

#### Acceptance Criteria
1. WHEN the player holds Interact on a disturbed grave with a shovel equipped THEN the system SHALL dig for 3 s with progress shown.
2. WHEN digging completes THEN the system SHALL grant loot from the grave's loot table.
3. WHEN digging completes THEN the system SHALL have a 20% chance (at night 40%) to trigger the `hand-from-grave` scare via the scare director.
4. A dug grave SHALL NOT be diggable again until the next day.
5. IF the player moves or is hit while digging THEN the system SHALL cancel the dig without granting loot.

### Requirement 4: Key items, lore and examine mode
**User Story:** As a player, I want to inspect important items up close, so that I can find clues.

#### Acceptance Criteria
1. WHEN the player picks up a key item, relic or lore item THEN the system SHALL open examine mode showing the item as a rotatable 3D model.
2. WHILE in examine mode THEN the player SHALL be able to rotate the item with the mouse and zoom with the scroll wheel.
3. IF an examined item has a hidden mark THEN the system SHALL reveal its clue text when the mark faces the camera for 1 s.
4. WHEN examine mode closes THEN the item SHALL be stored in the journal (key items, relics) without using a satchel slot.
5. The simulation SHALL pause while in examine mode.

### Requirement 5: Satchel
**User Story:** As a player, I want an inventory that feels physical, so that managing items adds tension.

#### Acceptance Criteria
1. WHEN the player presses Tab THEN the system SHALL open the satchel overlay with a creak sound and a leather/cloth styled layout of 12 slots.
2. The satchel SHALL show each stack's icon, name and count, and the hotbar assignment (1–4).
3. WHEN the player drops a stack THEN the system SHALL spawn it in the world in front of the player.
4. WHEN the player assigns an item to a hotbar slot THEN pressing that number SHALL equip it.
5. The satchel SHALL NOT pause the game; the world keeps running.

### Requirement 6: Self-drawing map
**User Story:** As a player, I want a hand-drawn map that fills in as I explore, so that I can navigate without breaking the mood.

#### Acceptance Criteria
1. WHEN the player first enters a map cell (8 m grid) THEN the system SHALL mark it explored and ink it on the journal map with a short draw animation.
2. The map SHALL show the player's position and facing as a small quill mark.
3. Discovered landmarks (workbench, chapel, gates, relic sites) SHALL appear as sketched icons.
4. Map state SHALL persist in the save.

### Requirement 7: Item spawning
**User Story:** As a player, I want new materials to appear each day, so that the cemetery stays worth exploring.

#### Acceptance Criteria
1. WHEN a new Day begins THEN the system SHALL respawn materials at spawn points by zone loot table.
2. Key items, relics and journal pages SHALL spawn once only, at their fixed locations from the design bible.
3. The Child's Locket SHALL only be visible and collectable during Night.
