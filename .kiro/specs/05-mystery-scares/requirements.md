# Requirements: Mystery, Scare Director and Endings

## Introduction
This spec turns Last Rites from a survival game into a horror mystery: the journal and its five pages, keys that open new zones, five relics, the scare director that runs fair jumpscares in dark alleys, the final rite on night 5 and the three endings.

## Requirements

### Requirement 1: Journal
**User Story:** As a player, I want a journal that collects what I've learned, so that I can follow the mystery.

#### Acceptance Criteria
1. WHEN the player presses J THEN the system SHALL open the journal with tabs: Pages, Clues, Relics, Map.
2. WHEN a journal page is collected THEN the system SHALL add it to Pages with handwritten text and play a page-turn sound.
3. WHEN a clue is discovered (examine mode, ledger, tombstone) THEN the system SHALL add a short entry to Clues and underline it with an ink animation.
4. The Relics tab SHALL show five relic outlines, filled in as each is found.
5. The journal SHALL pause the simulation.

### Requirement 2: Keys and zone gates
**User Story:** As a player, I want to unlock new areas with keys I find, so that exploring opens up the cemetery.

#### Acceptance Criteria
1. WHEN the player interacts with the Mausoleum Row gate while holding the Rusted Crypt Key THEN the system SHALL play an unlock sequence and remove the gate collider.
2. WHEN the player uses the Bone Whistle at the chapel altar THEN the system SHALL reveal the hidden catacomb stair.
3. WHEN the player interacts with the deepest ossuary door holding the Iron Ossuary Key THEN the system SHALL open it.
4. IF the player interacts with a locked gate without its key THEN the system SHALL show a hint that points toward where the key may be.
5. Key items SHALL appear at the locations in the design bible.

### Requirement 3: Tombstone and environment clues
**User Story:** As a player, I want to read tombstones and notice odd details, so that solving the mystery feels like detective work.

#### Acceptance Criteria
1. WHEN the player interacts with a readable tombstone THEN the system SHALL show its inscription in a close-up parchment rubbing style.
2. WHEN a tombstone's date is listed in the parish ledger as an 1849 burial AND the player holds the ledger THEN the system SHALL mark it as a "wrong grave" clue.
3. At least 6 environmental clues SHALL exist across the three zones as defined in the design bible.

### Requirement 4: Scare director
**User Story:** As a player, I want unpredictable but fair scares in dark places, so that exploring feels dangerous.

#### Acceptance Criteria
1. WHEN the player enters a scare zone THEN the system SHALL roll an event using the chance formula in the design bible.
2. The director SHALL respect a 45 s cooldown between major scares and 15 s between minor scares.
3. A zone SHALL NOT repeat the same event twice in a row.
4. Every scare SHALL play its telegraph 0.5–1.5 s before the main beat.
5. The director SHALL scale each scare's stinger volume, lunge speed and camera shake to the Scare Intensity setting, and at Off SHALL still run the gameplay effect with a descriptive subtitle and no stinger or shake.
6. The director SHALL NOT fire while the satchel, journal, workbench, examine mode or pause is open.
7. A scare SHALL NOT directly reduce the player's health to 0.
8. WHEN `digCompleted` is received THEN the director SHALL roll the `hand-from-grave` scare at 20% by day or 40% by night.
9. The first scare in a new game SHALL be the minor `statue-turn` event in the first grounds scare zone.

### Requirement 5: Relics and the final rite
**User Story:** As a player, I want to gather relics and perform the rite, so that the story has a climax I can affect.

#### Acceptance Criteria
1. Each of the five relics SHALL appear at the location in the design bible and open examine mode on pickup.
2. WHEN night 5 waves are cleared, OR the player holds at least 3 relics and interacts with the altar during night 5, THEN the system SHALL start the final rite.
3. WHILE the final rite runs THEN the player SHALL hold Interact at the altar for 45 s while zombies attack the chapel; releasing pauses progress without resetting it.
4. WHEN the rite completes THEN the system SHALL choose the ending by relic count: 5 = Rest, 3–4 = Uneasy Peace, 0–2 = Taken.
5. IF night 5 ends with fewer than 3 relics THEN the system SHALL show the Taken ending.

### Requirement 6: Endings and credits
**User Story:** As a player, I want a satisfying ending scene, so that the game feels complete.

#### Acceptance Criteria
1. Each ending SHALL play a short in-engine camera sequence of no more than 45 s with a narrated or subtitled closing line.
2. After the ending THEN the system SHALL show stats (nights survived, zombies banished, relics, clues found) and credits from `docs/CREDITS.md`.
3. The ending screen SHALL offer New Game and Title.

### Requirement 7: Save and continue
**User Story:** As a player, I want my progress saved, so that I can continue later.

#### Acceptance Criteria
1. WHEN the player uses the altar (stage 2 repaired) OR a new day starts THEN the system SHALL save the game to localStorage.
2. WHEN the player chooses Continue THEN the system SHALL load the latest save.
3. IF the save is missing or corrupt THEN the system SHALL hide Continue and not crash.
