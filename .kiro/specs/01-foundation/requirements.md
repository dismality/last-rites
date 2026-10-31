# Requirements: Foundation (first-person core, world, day/night, settings)

## Introduction
This spec gives Last Rites a playable first-person base: project setup, a moving and looking player with a lantern, a greyboxed cemetery, the day/dusk/night/dawn cycle, the settings and comfort options, and the screens around the game (content warning, loading, title, pause). Every later spec builds on it.

## Requirements

### Requirement 1: Project setup
**User Story:** As the developer, I want a configured project, so that all later features follow the same stack and tooling.

#### Acceptance Criteria
1. WHEN `npm run dev` is executed THEN the system SHALL serve the app with hot reload.
2. WHEN `npm run build` is executed THEN the system SHALL type-check in strict mode and produce a static build in `dist/`.
3. WHEN `npm run test` is executed THEN the system SHALL run vitest, including fast-check property tests.
4. The project SHALL follow the folder layout in the structure steering doc.

### Requirement 2: First-person controller
**User Story:** As a player, I want to walk and look around in first person, so that I can explore the cemetery.

#### Acceptance Criteria
1. WHEN the player clicks the game canvas THEN the system SHALL request pointer lock and hide the cursor.
2. WHILE pointer lock is active WHEN the mouse moves THEN the system SHALL rotate the camera with the configured sensitivity and Invert Y setting, with pitch clamped to ±85°.
3. WHEN the player holds W/A/S/D THEN the system SHALL move the player at 3.0 m/s relative to camera yaw, colliding with world geometry.
4. WHEN the player holds Sprint with stamina above 0 THEN the system SHALL move at 5.5 m/s and drain stamina at 20/s.
5. WHEN Sprint is not held for 1 s THEN the system SHALL regenerate stamina at 15/s up to 100.
6. WHILE moving AND head bob is enabled THEN the system SHALL apply a subtle vertical bob to the camera.
7. WHEN pointer lock is lost THEN the system SHALL open the pause menu.

### Requirement 3: Lantern
**User Story:** As a player, I want a lantern that runs on fuel, so that light becomes a resource I manage.

#### Acceptance Criteria
1. WHILE the lantern is on THEN the system SHALL drain fuel by 1% per 6 s by day and 1% per 3 s by night.
2. The lantern light radius SHALL scale linearly from 8 m at 100% fuel to 2 m at 0% fuel.
3. WHEN fuel reaches 0 THEN the system SHALL reduce the light to a dim 1.5 m ember glow and not turn off completely.
4. WHEN the player presses F THEN the system SHALL toggle the lantern on or off; while it is off, fuel SHALL NOT drain.
5. WHEN fuel drops below 20% THEN the system SHALL flicker the light intermittently.

### Requirement 4: Cemetery world (greybox)
**User Story:** As a player, I want a cemetery with distinct zones, so that I can learn the layout.

#### Acceptance Criteria
1. The world SHALL contain the zones Keeper's Hut and Grounds, Mausoleum Row, Chapel and Catacombs as defined in the design bible.
2. Mausoleum Row and Catacombs SHALL be blocked by locked gates until unlocked by the mystery spec.
3. WHEN the player leaves the playable area THEN the system SHALL block them with a fence or wall collider.
4. Repeated props (headstones, fences) SHALL be rendered with instancing.

### Requirement 5: Day/night cycle
**User Story:** As a player, I want time to pass through day, dusk, night and dawn, so that the game has a rhythm of exploring and surviving.

#### Acceptance Criteria
1. The system SHALL advance phases in order Day (360 s) → Dusk (30 s) → Night (until waves are cleared) → Dawn (10 s) → next Day.
2. WHEN the phase changes THEN the system SHALL transition sky colour, ambient light, fog density and music over 5 s.
3. WHEN Night begins THEN the system SHALL emit a `nightStarted(nightNumber)` event for the combat spec.
4. WHEN Dawn begins THEN the system SHALL emit `dawnStarted(nightNumber)` and show the dawn summary card.
5. Fog density SHALL follow the per-night values in the design bible.
6. The day/night logic SHALL be a pure function of `(state, dt, events)` with no rendering dependencies.

### Requirement 6: Settings and comfort
**User Story:** As a player who is sensitive to scares or motion, I want to adjust intensity and comfort options, so that I can enjoy the game safely.

#### Acceptance Criteria
1. The system SHALL provide every setting listed in the accessibility steering doc with the listed ranges and defaults.
2. WHEN a setting changes THEN the system SHALL apply it immediately and save it to localStorage.
3. IF localStorage is unavailable or throws THEN the system SHALL use defaults without crashing.
4. WHEN the OS reports `prefers-reduced-motion` on first run THEN the system SHALL default camera shake and head bob to Off.
5. WHEN the player presses a rebound key THEN the system SHALL perform the bound action.

### Requirement 7: Screens and flow
**User Story:** As a player, I want clear screens before and around gameplay, so that I know what to expect and can pause at any time.

#### Acceptance Criteria
1. WHEN the app loads THEN the system SHALL show a content warning screen (jumpscares, flashing lights) with buttons for Continue and Settings.
2. WHILE assets load THEN the system SHALL show a themed loading screen with real progress.
3. The title screen SHALL offer New Game, Continue (if a save exists), Settings and Credits.
4. WHEN the player presses Esc during play THEN the system SHALL pause the simulation and show the pause menu, including mid-scare.
5. All menus SHALL be fully keyboard-navigable with visible focus states.

### Requirement 8: Baseline HUD
**User Story:** As a player, I want in-world style feedback on my state, so that I can read my health and fuel without breaking immersion.

#### Acceptance Criteria
1. The HUD SHALL show the lantern-flame health indicator and fuel reservoir described in the visual style guide.
2. WHEN Accessible HUD is enabled THEN the system SHALL also show numeric health, fuel and stamina.
3. The crosshair SHALL be a small dot that changes to a hand icon when an interactable is within interact range and under the crosshair.
4. WHEN subtitles are enabled AND a captioned sound plays THEN the system SHALL show its subtitle for its duration.
