# Requirements Document

Spec 09: Playtest Fixes

## Introduction
This spec turns the playtest of https://last-rites.vercel.app on 2026-11-10, and a check of the repo against the Kiroween rules, into fixes, a developer mode for fast testing, a documentation tidy-up and a set of browser test passes. The source is the "Last Rites: prompts for Kiro" list (Parts A to D). Item ids (A1, B1, C1, D1 and so on) are kept so each requirement traces back to it.

`docs/game-design.md` stays the source of truth for content. Where a fix changes a number (lantern drain, Retry Night loadout, Short Vigil), the bible and `src/data/` change together, so the data-matches-design-bible hook passes.

## Glossary
- **Player_Controller**: `src/scene/player/FirstPersonController.tsx`, the Rapier kinematic character controller.
- **Scare_Sensor**: a sensor `CuboidCollider` made by `src/scene/scares/ScareZoneVolumes.tsx` from `SCARE_ZONES` in `src/data/scares.ts`.
- **Dev_Mode**: the playtest tools in `src/dev/`, enabled only by `?dev=1` or `import.meta.env.DEV`.
- **Dev_Panel**: the parchment panel Dev_Mode opens with the backquote key.
- **Debug_Hook**: the existing dev-only `window.__lastRites` API in `src/debug/debugHook.ts`.
- **Retry_Snapshot**: the dusk snapshot restored by Retry Night (`src/game/state/retryNight.ts`).
- **Objective_Tracker**: the top-left objective panel driven by `guidanceStore.objective`.
- **Short_Vigil**: the proposed demo mode in B10.

## Requirements

### Requirement 1 (B1): Scare sensors never block the player
**User Story:** As a player, I want to walk into every scare zone, so that the key items, relics and pages inside them can be reached and the game can be finished.

#### Acceptance Criteria
1. THE Player_Controller SHALL pass `QueryFilterFlags.EXCLUDE_SENSORS` to `computeColliderMovement`, so that Scare_Sensors are not obstacles.
2. Solid colliders (walls, headstones, fences, doors) SHALL still block the player.
3. WHEN the player walks into any of the 7 scare zones, THE scare runtime SHALL record the zone as entered, so that its scare can fire.
4. A Playwright test SHALL walk the player (held movement keys, not teleport) into every scare zone and assert both that the body is inside the zone bounds and that the zone was entered.
5. A unit test SHALL fail if the controller call loses the sensor filter.

### Requirement 2 (A1): Developer mode
**User Story:** As a developer, I want a hidden dev panel, so that I can reach any part of the game in seconds while playtesting.

#### Acceptance Criteria
1. Dev_Mode SHALL be enabled only when the URL has `?dev=1` or `import.meta.env.DEV` is true, and SHALL never appear in the Settings menu.
2. WHILE Dev_Mode is enabled, the backquote key SHALL toggle the Dev_Panel, styled with the parchment tokens.
3. THE Dev_Panel SHALL offer teleports to the named points listed in A1, plus "teleport to current objective".
4. THE Dev_Panel SHALL offer time controls: dawn, midday, dusk, night start, speed 1x, 5x and 20x, and skip to night 1 to 5.
5. THE Dev_Panel SHALL offer wave controls: spawn a wave, kill all, spawn one of each enemy type (Lurker and elites included) and spawn Father Crane.
6. THE Dev_Panel SHALL offer god mode, infinite oil, infinite stamina, noclip and a refill of health and oil.
7. THE Dev_Panel SHALL give any material in any amount, any crafted weapon, any key item, relic or journal page, and "give everything".
8. THE Dev_Panel SHALL offer progress shortcuts: complete the current objective, unlock all recipes, set chapel repairs to any level, trigger any scare by id and trigger each ending.
9. THE Dev_Panel SHALL offer debug views: collider wireframes (sensors in a different colour), FPS and draw calls, and the player position and objective id on screen.
10. All dev code SHALL live in `src/dev/` and load through a dynamic import, so a production build without `?dev=1` does not run it.
11. `.kiro/steering/structure.md` SHALL describe `src/dev/`.
12. A unit test SHALL show the Dev_Panel cannot open without the flag.

### Requirement 3 (A2): Automated playthrough
**User Story:** As a developer, I want one browser test that plays the main story, so that a broken step is caught before a deploy.

#### Acceptance Criteria
1. A Playwright test SHALL start a new game, skip the intro, read page 1, walk to the crypt key and take it, teleport to Mausoleum Row, walk to the whistle, blow it at the altar, take the ossuary key, collect all 5 relics, finish the rite and defeat Father Crane with god mode on.
2. THE test SHALL assert the Objective_Tracker text changes at each step and that an ending screen appears.
3. Item spawns inside scare zones SHALL be reached by walking, not by teleport.

### Requirement 4 (B2): Retry Night is fair
1. WHEN Retry Night is used, THE player SHALL start the dusk with full health and at least 60% lantern oil.
2. THE death screen SHALL offer "Retry from morning" in story modes.
3. A fast-check property SHALL show that for any snapshot, a retried night never starts below 60% oil.

### Requirement 5 (B3): Enough oil on day 1
1. THE lantern SHALL drain less by day (no drain or half rate; the choice is recorded in the design).
2. An oil pickup SHALL lie on the day-1 objective path.
3. `src/data/balance.ts` and `docs/game-design.md` SHALL agree.

### Requirement 6 (B4): Hut oil and tutorial step 2
1. THE oil bottle on the hut table SHALL show an "E" prompt and be picked up.
2. Tutorial step 2 SHALL appear after step 1 and be required.
3. A test SHALL check the tutorial step order.

### Requirement 7 (B5 to B9): First-day clarity
1. (B5) THE spawn yaw SHALL face the side table with page 1, and the intro card SHALL say "on the table".
2. (B6) WHILE the player is in the hut and the objective is outside, THE compass marker SHALL point at the hut door, or a "Leave the hut" step SHALL show.
3. (B7) THE examined journal page SHALL show its text.
4. (B8) Walls SHALL stay readable with the lantern at 0.5 m.
5. (B9) Recipe cards SHALL name the recipe and each ingredient with its count; the tooltip SHALL sit by the hovered item and go away when the workbench closes.

### Requirement 8 (B10): Short Vigil demo mode
**Gate:** this changes game balance. Work stops and the user is asked before it starts.
1. THE difficulty screen SHALL offer Short Vigil: 2-minute days, 3 nights, 100% starting oil and a basic weapon.

### Requirement 9 (C1 to C3): Submission tidy-up
1. (C1) README links SHALL point at the deploy and the video, with a screenshot at the top. The video link waits until it is uploaded.
2. (C2) Every `docs/kiro-log.md` date SHALL match the git history.
3. (C3) `docs/submission-kit.md` SHALL list 9 specs and fill in "How Kiro was used" with the named examples.

### Requirement 10 (B11 to B17): Polish
1. (B11) THE movement hint SHALL clear after 2 m walked and the camera turned.
2. (B12) THE HUD SHALL not overlap below 900 px wide, with an 800x600 screenshot test.
3. (B13) Begin and Back SHALL be visible at 800 px tall.
4. (B14) THE journal handwriting SHALL be larger, with a "plain font for journal" setting.
5. (B15) THE intro SHALL run about 20 s, keeping the fog flyover and the hut card.
6. (B16) Quit to Title SHALL ask for confirmation, and the title SHALL offer Continue when a save exists.
7. (B17) `src/scene/world/useWorkbench.ts` SHALL be removed or wired up.

### Requirement 11 (D1 to D9): Browser test passes
1. Each pass SHALL run through Playwright and Dev_Mode, and SHALL add an automated test where it can.
2. Each pass SHALL report what it could not verify (feel, real GPU frame rates, the live Vercel build) instead of guessing.
