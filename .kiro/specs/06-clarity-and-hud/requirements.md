# Requirements Document

Spec 06: Clarity and HUD

## Introduction
This spec makes Last Rites readable at a glance. Health moves from the lantern flame to a horizontal health bar, and the flame shows lantern fuel only. An objective tracker, a first-day tutorial, a compass, a player arrow on the journal map and zone name cards tell the player where to go and what to do. A short, skippable intro cutscene sets up the arrival at Hollowmere in October 1891 and the first objective.

All numbers, texts and tables are defined in `docs/game-design.md` §11 (HUD, guidance and navigation), with related rows in §2, §6 and §10. That file is the source of truth. This spec references those values and does not restate different ones. Balance and timing values live in `src/data/`, and rules are pure functions in `src/game/` covered by fast-check property tests.

## Glossary
- **Health_Bar**: The horizontal HP bar at the bottom left of the HUD.
- **Recent_Damage_Chunk**: The pale segment behind the Health_Bar fill that shows HP just lost.
- **Lantern_Gauge**: The flame icon with its label, showing lantern fuel only.
- **Objective_Tracker**: The top-left HUD block with a main goal line and a second line.
- **Objective_Rules**: The ordered table of 11 rules in §11 that picks the current objective, first match wins.
- **Tutorial_Director**: The pure-logic system that runs the 7 first-day tutorial steps.
- **Compass**: The 180° heading strip at the top centre of the HUD.
- **Compass_Marker**: A glyph with text shown on the Compass (objective, chapel, keeper's hut, wave spawn).
- **Zone_Card**: The zone name card shown on entering a zone.
- **Intro_Cutscene**: The in-engine arrival sequence played once on New Game.
- **Flashing_Lights**: The accessibility setting that turns flashes and pulses into steady or slow alternatives.
- **Save**: The localStorage record under `lastrites:save`, written by `src/game/state/gameSave.ts` and `src/game/systems/saveGame.ts`.
- **Retry_Snapshot**: The dusk snapshot restored by `src/game/state/retryNight.ts`.

## Requirements

### Requirement 1: Health bar
**User Story:** As a player, I want a clear health bar with numbers, so that I always know how much damage I can take.

#### Acceptance Criteria
1. THE Health_Bar SHALL render at the bottom left of the HUD at 260 × 18 px at 1080p with a dark ink frame and a `--blood` fill.
2. THE Health_Bar SHALL display current and max HP as text in the form "72 / 100" at all times, independent of the Accessible HUD setting.
3. THE Health_Bar fill width SHALL equal current HP divided by max HP, clamped to the range 0 to 1.
4. WHEN the player takes damage, THE Health_Bar SHALL drop the fill to the new value in the same frame.
5. WHEN the player takes damage, THE Health_Bar SHALL keep the Recent_Damage_Chunk at the previous value for 0.15 s and then drain it to the new value over 0.6 s.
6. WHEN the player takes further damage while the Recent_Damage_Chunk is holding or draining, THE Health_Bar SHALL keep the chunk's start at the highest value still shown and restart the 0.15 s hold.
7. WHEN the player heals, THE Health_Bar SHALL ease the fill up to the new value over 0.4 s.
8. WHEN the player takes damage and Flashing_Lights is On, THE Health_Bar SHALL flash its frame parchment-white for 120 ms.
9. WHEN the player takes damage and Flashing_Lights is Off, THE Health_Bar SHALL thicken its frame for 300 ms instead of flashing.
10. WHILE current HP is below 30 and Flashing_Lights is On, THE Health_Bar SHALL pulse on a 1.2 s cycle and show a "Low" tag.
11. WHILE current HP is below 30 and Flashing_Lights is Off, THE Health_Bar SHALL hold a thick, still frame and show the "Low" tag.
12. WHEN max HP changes, THE Health_Bar SHALL use the new max HP for the fill ratio and the text in the same frame.
13. THE Health_Bar timing values (hold, drain, ease, flash, thicken, pulse cycle, low threshold) SHALL be defined in `src/data/`.
14. FOR ALL sequences of damage and healing events, THE recent-damage state function SHALL keep the chunk value greater than or equal to the fill value and both within 0 to max HP (invariant property).
15. IF current HP reaches 0, THEN THE Health_Bar SHALL show the text "0 / " followed by max HP, an empty fill, and the "Low" tag, and the Recent_Damage_Chunk SHALL drain to 0 over 0.6 s.
16. IF the HP value supplied to THE Health_Bar is negative, greater than max HP, or not a finite number, THEN THE Health_Bar SHALL clamp it to the range 0 to max HP (using 0 for a non-finite value) and SHALL keep the previously displayed state without throwing an error.

### Requirement 2: Lantern gauge shows fuel only
**User Story:** As a player, I want the flame to tell me about lantern fuel, so that I do not confuse oil with health.

#### Acceptance Criteria
1. THE Lantern_Gauge SHALL set its flame height and brightness from lantern fuel (0% to 100%) and from no other value.
2. WHEN the player takes damage, THE Lantern_Gauge SHALL keep its flame height and brightness unchanged from their values immediately before the damage.
3. THE Lantern_Gauge SHALL show a label in the form "Oil N%" beside the flame at all times, where N is the lantern fuel rounded to a whole number from 0 to 100 (for example "Oil 64%").
4. WHILE lantern fuel is below 20%, THE Lantern_Gauge SHALL change its label from "Oil N%" to "Low oil".
5. WHILE lantern fuel is 20% or above, THE Lantern_Gauge SHALL show the "Oil N%" label and not "Low oil".
6. WHILE lantern fuel is below 20% and Flashing_Lights is On, THE Lantern_Gauge SHALL gutter the flame, varying its brightness over time.
7. WHILE lantern fuel is below 20% and Flashing_Lights is Off, THE Lantern_Gauge SHALL hold the flame steady, with no change in height or brightness other than that caused by a change in fuel.
8. THE HUD SHALL NOT read player health in `src/ui/hud/LanternHealth.tsx` or any other flame component.
9. THE Lantern_Gauge SHALL display the same fuel value as `src/ui/hud/FuelReservoir.tsx` on every rendered frame, so that the HUD never shows two different fuel values.
10. FOR ALL fuel values from 0 to 100, THE flame size function SHALL be monotonically non-decreasing in fuel (metamorphic property): for any fuel a ≤ b, size(a) ≤ size(b).

### Requirement 3: Objective tracker
**User Story:** As a player, I want an always-visible goal with progress, so that I never wonder what to do next.

#### Acceptance Criteria
1. THE Objective_Tracker SHALL render at the top left of the HUD during play, showing a main line of at most 60 characters and a smaller second line of at most 60 characters.
2. THE Objective_Selector SHALL choose the main line by applying the Objective_Rules (rules 1 to 11, defined in the design bible §11) in ascending order and returning the first rule whose condition matches the game state.
3. THE Objective_Selector SHALL be a pure function in `src/game/systems/` that takes game state and returns a main line, a second line and an optional world position, without reading or writing any store or clock.
4. THE Objective_Selector SHALL return exactly one objective for every possible game state, with rule 11 ("Hold out until the fifth night") as the fallback when no rule 1 to 10 matches.
5. WHEN the main line has a progress count, THE Objective_Tracker SHALL display it in the form "(0/1)" or "(R/5)", using the live collected count and the fixed target, with R between 0 and 5 inclusive.
6. WHILE the phase is night and waves are running, THE Objective_Tracker SHALL show "Survive: Wave N of M" on the main line, with N from 1 to M and M the wave count of the current night, and "Zombies left: K" on the second line, with K the live count of living zombies (K of 0 or more).
7. WHILE the phase is dusk, THE Objective_Tracker SHALL show "Prepare for the night" on the main line and "Night falls in m:ss" on the second line, counting down once per second from the 30 s dusk length to 0:00.
8. WHILE the phase is day, THE Objective_Tracker SHALL show "Dusk in m:ss" on the second line, updated once per second from the remaining day time, and SHALL show "Dusk in 0:00" rather than a negative value if the remaining time is below 0.
9. WHILE a tutorial prompt is showing, THE Objective_Tracker SHALL show the tutorial prompt on the second line in place of the countdown, and SHALL return to the countdown within 1 s of the prompt finishing or the Tutorial prompts setting being turned off.
10. WHEN the objective changes, THE Objective_Tracker SHALL fade the new text in over a duration between 150 ms and 300 ms, or switch instantly (0 ms) when `prefers-reduced-motion` is requested.
11. THE Objective_Tracker text SHALL use a minimum size of 16 px and SHALL expose its text to assistive technology as a polite live region that announces a change at most once per objective change, not on each countdown tick.
12. WHEN the Rusted Crypt Key, Bone Whistle, Iron Ossuary Key or a relic is collected, THE Objective_Selector SHALL select the next matching rule on the following evaluation, and the Objective_Tracker SHALL show the new objective within 1 s.
13. IF the selected objective has a world position, THEN THE Objective_Selector SHALL include that position in its result. Rules 1, 4 and 11 have no position. Rule 10 SHALL point to the nearest uncollected relic site whose map cell is already explored, and SHALL have no position when no such site is explored, so the tracker never reveals unexplored relic locations.
14. FOR ALL game states, evaluating the Objective_Selector twice on the same state SHALL return equal results (idempotence property).
15. FOR ALL day states, WHEN a state satisfies several day rules, THE Objective_Selector SHALL return the rule with the lowest number (property over generated states).
16. THE Objective_Rules text and rule order SHALL be defined in `src/data/`.

### Requirement 4: First-day tutorial
**User Story:** As a new player, I want short prompts in the first day, so that I learn the controls by doing.

#### Acceptance Criteria
1. THE Tutorial_Director SHALL run the 7 steps of §11 in this fixed order: (1) move, (2) pick up, (3) read page, (4) dig, (5) craft, (6) bind hotbar, (7) open journal.
2. THE Tutorial_Director SHALL show at most 1 prompt at a time, using the prompt text for that step as listed in §11.
3. WHEN the player completes the action of the current step, THE Tutorial_Director SHALL finish that step and make the next step that is not already done the current step within 1 frame (at most 17 ms at 60 fps).
4. IF the action of a step was already done before the step becomes current, THEN THE Tutorial_Director SHALL skip that step without showing its prompt.
5. WHEN the player's total walked distance since the start of the tutorial reaches 3 m, THE Tutorial_Director SHALL mark the "move" step done.
6. THE Tutorial_Director SHALL take key names shown in prompts from the current key bindings, and WHEN a binding changes while a prompt is showing, THE Tutorial_Director SHALL update the prompt text to the new key name.
7. WHERE the Tutorial prompts setting is Off, THE Tutorial_Director SHALL show 0 prompts.
8. THE settings store SHALL provide a "Tutorial prompts" toggle with default On, saved in localStorage and shown in the Settings menu.
9. WHEN the first night begins, THE Tutorial_Director SHALL remove any showing prompt and show no further prompts for the rest of the run.
10. WHEN the player turns Tutorial prompts back On during the first day, THE Tutorial_Director SHALL resume with the first step that is not done, and IF all 7 steps are done, THEN THE Tutorial_Director SHALL show no prompt.
11. WHEN a prompt is showing, THE Objective_Tracker SHALL display it on the second line as text with a glyph, never colour alone, in place of the "Dusk in M:SS" line.
12. THE Save SHALL store the set of completed tutorial steps, and WHEN the player chooses Continue, THE Tutorial_Director SHALL restore that set so that no completed step is shown again.
13. WHEN Retry Night restores the Retry_Snapshot, THE Tutorial_Director SHALL keep the completed steps recorded in the snapshot.
14. IF the Save holds no tutorial data or tutorial data that cannot be parsed, THEN THE Tutorial_Director SHALL start with an empty set of completed steps and SHALL leave the rest of the Save loaded unchanged.
15. FOR ALL orders of player actions, THE Tutorial_Director SHALL never show a step whose action is already done and SHALL never show two steps at once (invariant property).
16. FOR ALL tutorial states, serializing to the Save and parsing back SHALL produce an equal state (round-trip property).

### Requirement 5: Compass
**User Story:** As a player, I want a compass with distances, so that I can find my objective in the fog.

#### Acceptance Criteria
1. THE Compass SHALL render at the top centre of the HUD as a strip spanning 180° of the player's heading, from −90° to +90° relative to the current heading.
2. THE Compass SHALL show the letters N, E, S and W at their true bearings (0°, 90°, 180°, 270°) and ticks every 15°.
3. WHEN the player turns, THE Compass SHALL shift on the next rendered frame so that the current heading is at the strip's centre.
4. WHEN the current objective has a world position, THE Compass SHALL show a ◆ marker with the straight-line distance to it in whole metres, such as "34 m".
5. IF the current objective has no world position, THEN THE Compass SHALL hide the ◆ marker.
6. THE Compass SHALL always show a ✝ marker for the chapel and a ⌂ marker for the keeper's hut, each with its text label.
7. WHILE the phase is dusk or night and repair stage 3 (bell) is built, THE Compass SHALL show one ☠ marker for each wave spawn direction.
8. WHILE the phase is day or repair stage 3 is not built, THE Compass SHALL hide the ☠ markers.
9. IF a marker's relative angle is outside −90° to +90°, THEN THE Compass SHALL pin it to the nearer edge of the strip (left for negative angles, right for positive angles) with an arrow pointing toward it.
10. THE Compass SHALL render every marker as a glyph with text and never by colour alone.
11. THE Compass bearing and distance calculation SHALL be a pure function in `src/game/systems/` with property tests.
12. FOR ALL player and target positions, THE bearing function SHALL return a relative angle in the range −180° to 180°, and a target straight ahead SHALL return 0° (invariant property).
13. FOR ALL heading values, adding 360° to the heading SHALL produce the same relative angles (metamorphic property).
14. THE Compass SHALL not change the player's input focus or capture the pointer.

### Requirement 6: Map position and facing
**User Story:** As a player, I want to see where I am on the journal map, so that I can plan my route.

#### Acceptance Criteria
1. WHILE the journal Map tab is open, THE Map SHALL draw the player as an arrow at the player's world position, pointing along the player's facing direction, and SHALL update the arrow's position and heading within 100 ms of the player moving or turning.
2. WHILE the journal Map tab is open and the current objective has a world position, THE Map SHALL draw the objective marker at that position.
3. WHILE the journal Map tab is open and the current objective has no world position, THE Map SHALL draw no objective marker.
4. THE Map SHALL draw the arrow and the objective marker on top of the inked zones in `src/ui/journal/mapDraw.ts`, with the arrow drawn above the objective marker where they overlap.
5. THE Map SHALL label the objective marker with a glyph and a text label showing the objective's name, so that the marker is never conveyed by colour alone.
6. IF the player's position lies outside the map bounds, THEN THE Map SHALL clamp the arrow to the nearest point on the map edge, keeping the arrow's heading unchanged.
7. IF the current objective's position lies outside the map bounds, THEN THE Map SHALL clamp the objective marker to the nearest point on the map edge and keep its text label.
8. FOR ALL world positions inside the cemetery bounds, THE world-to-map transform SHALL return a point inside the map canvas (invariant property).
9. FOR ALL map points inside the map canvas, THE map-to-world transform applied after the world-to-map transform SHALL return the original position within 0.01 m (round-trip property).

### Requirement 7: Zone name cards
**User Story:** As a player, I want to see the name of the place I enter, so that I know where I am.

#### Acceptance Criteria
1. WHEN the player enters a zone whose last card was shown 30 s or more ago, or never, THE Zone_Card SHALL show that zone's name in IM Fell English SC with its short line from §11 beneath it for 2.5 s.
2. THE Zone_Card SHALL define a name and a short line for each of the four `ZoneId` values: `grounds` (Keeper's Hut and Grounds), `mausoleum-row` (Mausoleum Row), `chapel` (Hollowmere Chapel) and `catacombs` (The Catacombs), with the exact text given in §11.
3. WHILE less than 30 s has passed since a zone's card was last shown, THE Zone_Card SHALL not show a card for that zone, and re-entering that zone SHALL not restart the 30 s count.
4. WHEN the player enters a zone whose card is allowed while another zone's card is showing, THE Zone_Card SHALL replace the showing card with the new zone's card and show it for 2.5 s from that moment.
5. WHEN the Zone_Card appears or disappears, THE Zone_Card SHALL fade over a duration between 150 ms and 300 ms, or WHERE reduced motion is requested, THE Zone_Card SHALL switch instantly with no fade. The 2.5 s display time includes the fades.
6. WHILE a zone card is showing and Subtitles is On, THE subtitle system SHALL not show the card's name or line as a subtitle.
7. THE Zone_Card SHALL expose its name and line to assistive technology as a polite live region, announced once per showing.
8. WHEN a new game starts, THE Zone_Card SHALL clear all per-zone last-shown times, and THE Zone_Card SHALL not store them in the Save, so after loading a Save every zone's card is allowed on first entry.
9. THE Zone_Card trigger SHALL be a pure function that takes the previous zone, the new zone, the current time in seconds and the per-zone last-shown times, and returns whether to show a card, with no side effects.
10. IF the new zone equals the previous zone, THEN THE Zone_Card trigger SHALL return false and leave the last-shown times unchanged.
11. FOR ALL sequences of zone changes with non-decreasing times, THE Zone_Card trigger SHALL never return true for the same zone twice when the two times are less than 30 s apart (invariant property).

### Requirement 8: Intro cutscene
**User Story:** As a new player, I want a short arrival scene, so that I understand the story and what to do first.

#### Acceptance Criteria
1. WHEN the player starts a New Game, THE Intro_Cutscene SHALL play exactly once, beginning at elapsed time 0 s, before the player receives control.
2. WHEN the player chooses Continue, THE system SHALL not play the Intro_Cutscene, regardless of the stored intro-seen flag.
3. THE Intro_Cutscene SHALL last 35 s ± 3 s in total and consist of the five shots and text cards in §11, in the order 1 to 5, with each shot lasting at least 4 s and each card shown for at least 3 s.
4. THE Intro_Cutscene SHALL move the camera along data-defined paths with the same camera-path approach as `src/scene/effects/EndingCamera.tsx`.
5. WHEN shot 5 finishes, THE Intro_Cutscene SHALL end with the camera at the player's view of the workbench and SHALL then give the player control within 0.5 s.
6. WHEN the Intro_Cutscene ends or is skipped, THE Objective_Tracker SHALL show the first objective ("Read the page Elias left in the hut (0/1)") within 0.5 s of control being given.
7. WHEN the player presses Space or Enter during the Intro_Cutscene, THE system SHALL skip it, give the player control within 0.5 s, and place the camera at the player's view of the workbench.
8. WHEN the player presses Esc during the Intro_Cutscene, THE system SHALL open the pause menu and stop the cutscene clock until the player resumes, so that the elapsed cutscene time after resuming equals the elapsed time at the moment of pausing.
9. WHILE the Intro_Cutscene plays, THE Intro_Cutscene SHALL show the visible hint "Space to skip" and a skip button that can be focused and activated with the keyboard and shows a visible focus state.
10. WHILE a text card is shown, THE Intro_Cutscene SHALL render it in the keeper's handwriting style from the visual style guide at a font size of at least 20 px, on a dark backing.
11. WHILE the Intro_Cutscene plays, THE game simulation SHALL spawn 0 zombies, trigger 0 scares, leave lantern fuel unchanged and leave the day timer unchanged.
12. WHERE Camera shake is Off or reduced motion is requested, THE Intro_Cutscene SHALL use camera moves with 0 shake and 0 head bob.
13. WHERE Flashing_Lights is Off, THE Intro_Cutscene SHALL use fades of at least 0.5 s for shot transitions and SHALL show no full-screen flash.
14. WHERE the intro uses sound, THE Intro_Cutscene SHALL use procedural Web Audio on the shared Howler `AudioContext`, route it through the SFX volume setting, and show a subtitle for each important sound while Subtitles is On.
15. WHEN the Intro_Cutscene ends or is skipped, THE Save SHALL store the intro-seen flag as true, and WHEN a save is loaded, THE system SHALL restore that flag.
16. THE Intro_Cutscene shot timings, camera paths and card texts SHALL be defined in `src/data/`.
17. FOR ALL elapsed times from 0 to the total duration, THE camera path function SHALL return a finite position and look target, and the shot index SHALL never decrease with time (invariant property).
18. IF the intro-seen flag is already true when the player starts a New Game, THEN THE system SHALL reset the flag for that new game and play the Intro_Cutscene once.

### Requirement 9: Persistence and Retry Night
**User Story:** As a player, I want my HUD and tutorial progress saved, so that Continue and Retry Night do not repeat what I already learned.

#### Acceptance Criteria
1. WHEN the game writes a Save, THE Save SHALL include every new piece of persistent state added by this spec: the set of completed tutorial steps (each a step number from 1 to 7, no duplicates) and the intro-seen flag (true or false).
2. WHEN the save loader reads a Save written before this spec, THE save loader SHALL accept it and fill the new fields with defaults: completed tutorial steps empty, and intro-seen true if the Save has progressed past the first day (night 1 reached or later) and false otherwise.
3. WHEN the player chooses Continue, THE system SHALL NOT play the intro cutscene, whatever the intro-seen value.
4. IF the Save is missing, corrupt or unparseable, THEN THE system SHALL hide the Continue option, leave New Game available, show no crash or uncaught error, and leave any other stored data unchanged, as in Requirement 7 of spec 05.
5. WHEN Retry Night restores the Retry_Snapshot, THE system SHALL reset every new night-only piece of state to its initial value: the Health_Bar recent-damage state, the hit-flash state (including the 300 ms thickened-frame state), and any showing tutorial prompt.
6. WHEN Retry Night restores the Retry_Snapshot, THE Health_Bar SHALL show the restored HP and max HP as text ("N / M") with a Recent_Damage_Chunk of zero width on the first rendered frame, and no drain animation running.
7. WHEN Retry Night restores the Retry_Snapshot, THE system SHALL keep the completed tutorial steps and intro-seen flag that were in effect at the time of restore, and SHALL NOT show again a tutorial prompt whose step is already completed.
8. FOR ALL valid Save objects including the new fields, THE parser SHALL return an object deeply equal to the original after serialize then parse (round-trip property).
9. FOR ALL corrupt Save inputs (including malformed text, missing fields, wrong types, and empty input), THE parser SHALL signal an error result without throwing an uncaught exception (error-condition property). Invalid tutorial data is not a parse error: it is sanitised as in Requirement 4.14.

### Requirement 10: Accessibility
**User Story:** As a player with comfort or access needs, I want every new HUD element to respect my settings, so that I can play comfortably.

#### Acceptance Criteria
1. WHILE Flashing lights is Off, THE HUD SHALL show each new pulse, flash and gutter as its steady alternative from §11: the health bar hit flash as a frame that thickens for 300 ms, the low-health pulse as a thick, still frame with the "Low" tag kept, and the low-oil flame gutter as a flame held steady.
2. WHILE Camera shake is Off, THE Intro_Cutscene and every new HUD effect SHALL apply zero camera shake and zero screen-offset motion.
3. THE HUD SHALL show each of the following as text or a glyph, so that no meaning depends on colour alone: health as "current / max" numbers, fuel as "Oil N%" or "Low oil", the objective as a main line with its progress count, tutorial prompts as text, and each compass marker as a glyph with text.
4. THE Tutorial prompts toggle, the cutscene skip button and every other new interactive control SHALL be reachable using the keyboard alone (Tab, Shift+Tab, Enter or Space) and SHALL show a visible focus outline while focused.
5. THE HUD SHALL render every new text element, including the objective tracker, tutorial prompts, health and oil labels, compass distances and zone name cards, at a computed font size of 16 px or larger, at 1080p and after every text update.
6. IF a new sound is added, THEN THE system SHALL show a subtitle describing that sound while Subtitles is On, and SHALL show none while Subtitles is Off.
7. WHEN the player presses Esc during any new overlay or the Intro_Cutscene, THE system SHALL open the pause menu within 100 ms, and the cutscene SHALL stay paused (not skipped) until the player resumes.
8. WHILE prefers-reduced-motion is set, THE new HUD transitions SHALL use only fades or instant changes and SHALL use no sliding or translating motion.

### Requirement 11: Data, assets and project hygiene
**User Story:** As the developer, I want this spec to follow the project's rules, so that it stays testable and creditable.

#### Acceptance Criteria
1. THE HUD timings, Objective_Rules, tutorial steps, Compass markers, Zone_Card texts and Intro_Cutscene shots SHALL be defined as typed constants in `src/data/`, with no numeric timing, distance, threshold or text literal for these features appearing in `src/scene/` or `src/ui/`.
2. THE rules for the health display state, the Objective_Selector, the Tutorial_Director, the Compass bearing and the Zone_Card trigger SHALL be pure TypeScript in `src/game/` with no React, three.js or Howler imports.
3. THE spec SHALL give each new system in `src/game/systems/` a matching `*.test.ts` file in the same folder that contains at least one fast-check property test and that passes when `npm run test` is run.
4. THE spec SHALL add zero audio files and zero model files to `public/assets/`, and SHALL use only procedural Web Audio on Howler's shared `AudioContext` and simple built meshes.
5. IF a third-party asset is added, THEN THE change SHALL include a line in `docs/CREDITS.md` giving the asset name, source and licence in the same change.
6. WHEN a task from this spec is finished, THE developer SHALL append an entry to `docs/kiro-log.md` in the required format (Kiro feature used, what happened, what Kiro caught or sped up), headed with the real calendar date of completion in YYYY-MM-DD form.
7. THE spec SHALL end with a final checkpoint task that is marked done only after the feature has been played in a real desktop browser (Chrome, Edge or Firefox) and each of these has been observed working: health bar, lantern gauge, objective tracker, tutorial, compass, map arrow, zone name cards and intro cutscene.
8. WHILE the game is running with the new HUD elements visible on a mid-range laptop at 1080p, THE HUD rendering SHALL keep the frame rate at or above the 45 fps minimum (60 fps target) and the scene at fewer than 150 draw calls.
9. WHEN `npm run build` and `npm run lint` are run after any task from this spec, THE project SHALL complete both with zero errors.
