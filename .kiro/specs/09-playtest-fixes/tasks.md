# Implementation Plan: Playtest Fixes

## Overview
Tasks run in the order the user set. Every task ends with **Finish**:

- **Finish:** run `npm run lint`, `npm run build` and `npm test -- --run` (plus the task's Playwright spec when it has one), fix any failures, append a `docs/kiro-log.md` entry with the real date, and commit with a clear message. Do not push.

**Order (user decision, 2026-11-10):** tasks 5 to 11b (B3 to B9 and F6) next, then task 12: draft E0 and stop for approval. Part E (E1 to E5, plus E7, G1 and G2) goes in spec `10-curse-stages`; E6, E8 to E11 and the other G items are stretch goals. Source: `docs/kiro-prompts.md`.

## Tasks

- [x] 1. B1: Scare sensors no longer block the player
  - Pass `rapier.QueryFilterFlags.EXCLUDE_SENSORS` to `computeColliderMovement` in `FirstPersonController.tsx`
  - Unit test guarding the filter; Debug_Hook `scareZones()` (inside now, entered since run start); `e2e/scare-zones.spec.ts` walks into all 7 zones
  - Finish
  - _Requirements: 1.1-1.5_

- [x] 1b. Lantern lights stay visible and use intensity 0 instead of toggling visible
  - `src/scene/player/Lantern.tsx`: the spot, fill and ember lights are never hidden; off and empty states set `intensity = 0`, so the scene's light count never changes and lit materials are not recompiled when the lantern toggles or runs dry
  - From the performance-review hook, item 1 (approved by the user)
  - Finish

- [x] 2. A1: Developer mode
  - `src/dev/` (flag, cheats, panel, debug views), backquote toggle, `?dev=1` or DEV only
  - Steering note in `.kiro/steering/structure.md`; unit test that the panel cannot open without the flag
  - Finish
  - _Requirements: 2.1-2.12_

- [x] 4. B2: Fair Retry Night and Retry from morning
  - Finish
  - _Requirements: 4.1-4.3_

- [x] 5. B3: Day-1 oil, with F1 (day-1 setup) and F4 (darkness)
  - Lantern day drain 0 (user decision); night rate unchanged; `balance.ts`, `lantern.ts` and design bible §6 together
  - An oil pickup on the day-1 objective path
  - F1: on day 1 the first dig gives at least 3 bone and the hut holds at least 1 cloth; a "Craft a weapon at the workbench (0/1)" objective when it's day, only the shovel is owned and dusk is under 2:00
  - F4: remove the 50% damage cut on zombies while the lantern is empty (`DARKNESS_DAMAGE_MULT`, user approved); the match of last resort stays out of scope
  - Finish
  - _Requirements: 5.1-5.3, 12.1-12.4_

- [x] 6. B4: Hut oil pickup and tutorial step 2, with F1 (oil-only step)
  - Tutorial step 2 finishes only on picking up the oil, not on any pickup
  - Finish
  - _Requirements: 6.1-6.3, 12.5_

- [x] 7. B5: Spawn yaw and intro card, with F11
  - F11: intro card "on the table"; a clue that the Child's Locket only shows on the west hill after dark
  - Finish
  - _Requirements: 7.1, 12.6_

- [x] 8. B6: Compass inside the hut
  - Finish
  - _Requirements: 7.2_

- [x] 9. B7: Readable examined journal page
  - Finish
  - _Requirements: 7.3_

- [x] 10. B8: Lantern glare near walls
  - Finish
  - _Requirements: 7.4_

- [x] 11. B9: Recipe book names and tooltip
  - Finish
  - _Requirements: 7.5_

- [x] 11b. F6: Elite ammo drops only for owned guns (user approved)
  - Roll revolver ammo only once the revolver is owned and shells only once the shotgun is owned; otherwise drop materials; property test
  - Finish
  - _Requirements: 12.7_

- [x] 11c. Interaction cues never mislead
  - Rule: show a cue (prompt text, hover outline, rune, pulse, hand crosshair) only when pressing Interact right now would do something
  - Used up (picked up, dug today, looted, examined, opened, sold out): all cues fade out over about 0.5 s (a steady fade with Flashing lights off) and the object stops being targeted; collected items and their meshes fade away
  - A dug grave shows only the open pit with no cue until the next day refills it, then its cues return
  - Blocked but fixable: keep the prompt and say what is needed ("Needs a shovel", "Locked: needs the Rusted Crypt Key", "Satchel full"); never "Hold E" for an action that cannot happen
  - Repeatable (workbench, tombstone reading, merchant with stock, damaged barricade): keep the prompt; stop the rune's attract pulse once there is nothing new to do
  - A journal page or clue that fades shows "Added to your journal (J)" with the current binding
  - Audit every interactable (all pickups including dug-grave loot, clues, tombstones, gates, grave mounds, weapon pickups, merchant, barricade boards, doors, workbench) into one data table marked used up / needs something (what) / repeatable; code follows the table; state resets correctly on a new day, Retry Night, Continue and New Game
  - Unit tests: the table and the cue rule. Browser tests: a dug grave's cue goes and returns the next day; a picked-up item fades and stops being targeted; an examined clue's cue goes
  - Log in docs/kiro-log.md; do not commit
- [x] 11d. Crypt key pickup from the south
  - `e2e/obstruction.spec.ts` fails picking up the Rusted Crypt Key from the south: the player stops 0.9 m away with the key hovered but Interact does not collect it. Find why, fix it, get the spec passing
  - Log in docs/kiro-log.md; do not commit
- [x] 11e. Minimap on the HUD
  - Reuse the Journal map's explored 8 m cells, `mapReveal` and `mapDraw` (no second reveal system; the Journal map keeps working); same pencil style, slightly see-through
  - North up; the player is an arrow shape showing facing; about 40 m around the player; unexplored stays blank; new cells ink in (plain fade with reduced motion)
  - Objective marker and discovered landmarks; an off-edge objective is pinned to the border pointing toward it
  - Top right below the score; no overlap with the compass, objective text, hotbar, health bar or boss bar at 1920x1080, 1280x720 and 800x600; fits B12
  - Hidden during the intro, endings, menus, the workbench view and other cinematics
  - "Show minimap" setting (on by default) and a rebindable toggle key (M)
  - No per-frame React render: redraw the canvas only on movement, a noticeable turn or a revealed cell, at most about 15 per second; report the longest frame walking and turning with the map on and off
  - Unit tests: view window, edge pinning, redraw throttle. Browser test: reveals new ground, no HUD overlap at the three sizes, hidden during the intro
  - Log in docs/kiro-log.md; do not commit
- [x] 11f. Finish the spec 08 task 11.2 browser checks on the merged tree
  - Run e2e/items-1-6, items-7-12, items-13-15, dig-mound and look-perf, plus the new 11c and 11e specs and obstruction; keep the dev server up or run in small groups
  - Item 11 also measures the Taken ending; item 12 confirms Best combo; item 13 re-times the barricades; item 15 measures the workbench's longest frame on first open
  - Real game bugs: fix and retest; setup failures: fix the setup and say so. Spec 08 task 9 stays open
  - Log in docs/kiro-log.md; do not commit
- [x] 11g. package.json license matches LICENSE
  - "license": "ISC" becomes "MIT"
  - Log in docs/kiro-log.md; do not commit
- [x] 11h. Dawn boon picker can be clicked and shows its icons
  - Any screen that needs the mouse releases pointer lock when it opens and the game takes it back when it closes; one shared hook keyed off `isOverlayOpen` in menuState.ts (which includes `isDawnPickPending`), not a one-off in DawnPicker.tsx; check Journal, Satchel, Examine, Workbench, Settings, pause, the dawn summary and the dawn picker use it; relock only after a user gesture
  - Each card shows `public/assets/icons/boons/<boonId>.png` at 64 px, `image-rendering: pixelated`; on load failure the rune text as now
  - The dawn summary and the picker do not overlap at 1920x1080, 1280x720 and 800x600
  - Keys 1 to 3 (or arrows and Enter) pick a card
  - Tests: every boon id has an icon file; a browser test reaches dawn, clicks a card with a real mouse click, sees the boon applied and pointer lock back after the next canvas click; picker screenshots at the three sizes
  - Log in docs/kiro-log.md; do not commit
- [x] 11i. Swap in the new graveyard scene
  - Wiring only (assets in the repo). Do not change gameplay positions, the hut, the chapel, the catacombs tunnel, gates, lamp posts, interactables, scare props, grave mounds or the 5 readable tombstones
  - New `src/scene/world/GraveyardScene.tsx` loads `public/assets/models/scene/graveyard.glb` once with drei `useGLTF` (Draco at `/draco/`), mounted in Cemetery.tsx, no transform (game coordinates); vertex colours on for lr-stone, lr-iron, lr-bark, lr-ground, lr-grass (lr-grass double-sided)
  - Shadows: castShadow on stone, iron and bark meshes; receiveShadow on all; if frame time rises, no castShadow on `outer-*` and `grass*`
  - Colliders: one fixed rigid body with a cuboid per box in `graveyard-colliders.json` (`{center, half, rotY}`, Y rotation only)
  - Remove what the scene replaces: the flat grounds block (keep the y=0 physics floor), the 60 random headstones (seed 1891) with their models and colliders, the fence models (keep the invisible boundary walls), the generateTrees() pines and trunks, the avenue crypt and Crane crypt visuals (keep their interactions; colliders from the old code or the JSON but never both), the darkStone avenue floor (keep rails and invisible walls)
  - Navigation: waypoint and zombie path tests; in the browser walk from the hut to row-mouth, crane step, cat-mouth, the merchant, the chapel doors, each of the 8 wave graves and the 4 grounds clue spots; no collider on a waypoint edge; a blocking box is reported by index and position, not deleted
  - Performance: `longestFrameMs()` over a 20 s walk no more than 2 ms worse than before; if so, drop shadows on outer-* and grass* first
  - Screenshots: hut door looking north-west, Mausoleum Row from the gate, the south grounds from the chapel vestry
  - Log in docs/kiro-log.md; do not commit
- [x] 11j. Use the rune and mark images
  - `public/assets/icons/runes/interact/{pickup,dig,open,read,examine,nail,trade}.png` replace the font rune in the interaction prompt (`ACTION_RUNE` in interaction.ts), shown at 32 px; font rune as alt text and load-failure fallback
  - `public/assets/icons/runes/boons/<boonId>.png` replace `{c.rune}` on the dawn boon cards at 32 px beside the boon icon; fallback the font rune
  - `public/assets/icons/marks/{hut,chapel,graves,merchant,objective,gate,relic,workbench,player}-{light,dark}.png`: `-light` on the HUD compass and minimap (COMPASS_MARKERS objective, chapel, hut, spawn = graves, merchant) at 20 px; `-dark` on the journal Map tab (workbench, chapel, gate, relic, plus hut, merchant, graves, objective and the player arrow) at 24 px; text glyphs stay as fallback
  - All pixel art with `image-rendering: pixelated`; one `iconUrl(kind, id)` helper for every path; unit test that every id used by ACTION_RUNE, the dawn upgrades, COMPASS_MARKERS and the map landmarks has a file on disk
  - Done (with 11i) when lint, build, all unit tests and the e2e suite pass, with the 11i screenshots plus one each of the interaction prompt, the dawn picker and the journal map
  - Log in docs/kiro-log.md; do not commit
- [x] 11k. Every item uses its Blender model
  - Data: in `src/data/items.ts` every item gets `model: assets/models/items/<id>.glb`; journal pages 1–5 use `journal-page.glb`; delete `BORROWED_MODEL`. Orientation, grip offset, rotation and scale live in data (shovels grip +Y; club, axe, sabre grip −Y; guns barrel +X; ground items lie flat). Never rotate or scale the GLB files. Sizes and orientation from `docs/world-items.md`
  - Use the model wherever the item is drawn: ground pickups (MaterialPickups; MaterialShape only as the Suspense fallback), fixed spawns (TornPaper → journal-page.glb, LedgerBook → parish-ledger.glb, the hut oil and the hut shelf), dug-grave loot and elite drops, weapon pickups (WeaponPickups.tsx: axe, sabre, revolver, shotgun; the woodpile stays), placed items (LanternTraps, SaltCircles, placed tallow candles), the workbench RecipeGhost (owned ingredients use their model, missing ones stay wireframe), the examine view (check it shows the new models), and the first-person held weapons (Viewmodel.tsx, viewmodelWeaponGeometry.ts) keeping the swing and recoil animations and the lantern hand, with no weapon clipping the camera at 1280x720 and 800x600
  - Performance: each GLB loaded once (drei useGLTF, preloaded); repeated pickups via `<Clone>` or instancing; no new lights (an emissive material on the ember vertex colour of candles and lanterns is allowed); report draw calls and longestFrameMs() on a 20 s walk before and after
  - The 11c hover outline, rune and fade work on every new mesh; collected items still fade their mesh (useLingering)
  - Unit: every item in ITEMS has a model file on disk; every held weapon has a grip transform
  - Browser: screenshots into `e2e/screenshots/items/` of a ground pickup of each material, the journal page in the hut, the oil, each weapon pickup and each held weapon; every model is visible at its spot and targetable
  - Design bible first; log in docs/kiro-log.md with "Decisions made unattended"; lint, build and unit tests pass; commit locally (`... (spec 09 task 11k)`), never push
- [x] 11l. Big map on M with clickable pins
  - M opens a full-screen map overlay in the Journal map's pencil style (mapDraw): explored cells, landmarks (`-dark` marks), player arrow, objective. Esc or M closes it; uses the shared cursor-release hook (11h). Pauses by day like the journal; at night follows F8 (dims, sound on) if F8 is in, otherwise pauses
  - Mouse: wheel zooms from the whole grounds to about 30 m across; drag pans; left-click places a pin; clicking a landmark pins it and names the pin after it; clicking or right-clicking a pin removes it; pins may sit on unexplored ground ("?") anywhere inside PLAYABLE_BOUNDS. Keyboard: arrows move a cursor, Enter places, Delete removes, 1–3 select a pin, +/− zoom
  - Pins: up to 3, numbered 1–3 in distinct shapes (not colour only); a 4th replaces the oldest; a legend lists them with distance and "Clear all"
  - Compass: one marker per pin ("① 23 m"), off-range pins at the edge with an arrow like the objective. Minimap: drawn, and pinned to the border when off-map (reuse minimapView edge pinning). Journal Map tab: shown and editable
  - World: a faint upright pencil-line beacon per pin, visible through fog; emissive mesh only, no light, no flashing; fades out within 4 m; setting "Show pins in the world" (default On)
  - Walking within 2 m clears a pin with a soft sound and the caption "[pin reached]". Pins saved and restored on Continue and Retry, cleared on New Game
  - Key change: M opens the big map; the minimap toggle moves to N (rebindable); the "Show minimap" setting stays. Update `src/data/controls.ts`, the controls screen, the design bible §10 and §11, and any tutorial or hint text that mentions M
  - Pure rules in `src/game/systems/mapPins.ts` (add, remove, limit, reach-to-clear, save/restore) with tests. Click-to-world uses the exact inverse of the map draw transform; property test: world → map → world returns the same point at every zoom and pan
  - Browser: press M and click a spot; the compass shows the pin with a distance that drops while walking to it; the minimap shows it; it clears on arrival. M and N work keyboard-only; the overlay does not overlap the HUD at 1920x1080, 1280x720 and 800x600; screenshots
  - Design bible first; log in docs/kiro-log.md with "Decisions made unattended"; lint, build and unit tests pass; commit locally (`... (spec 09 task 11l)`), never push
- [x] 11m. Unknown recipes say where to look; bench stock uses the models
  - Full brief: `docs/kiro-prompt-playtest-batch.md` Part A, 11m
  - Pure `itemSources(itemId)` in `src/game/systems/` from data only (lootTables, zones FIXED_SPAWNS and SPAWN_POINTS, the hut shelf, the merchant's stock); plain-word places, at most two per ingredient, nearest first; unit test that every recipe material has a source
  - Missing ingredients show "??? · <sources>" (unnamed until held); unknown-recipe tooltip "??? Needs N ingredients. You have: … Still to find: …"; known recipes with a shortfall show "Found: …" under the count; readable at 800x600 with the plain font
  - "Mark on map" button (M on a focused row) drops an 11l pin on the nearest unlooted source of the first missing ingredient, or shows "None left today. Try again tomorrow"
  - Bench stock piles (Workbench.tsx boxGeometry Instances) drawn with the item models, keeping the ember glow as emissive (no light); the recipe ghost's missing-ingredient outline becomes the item's silhouette (model in flat dark material); any other box/cylinder standing in for an item gets its model (list them)
  - Browser: source text on an unknown recipe; Mark on map puts a pin on the compass; bench screenshots at 1280x720 and 800x600
  - Design bible first; kiro-log with "Decisions made unattended"; lint, build, unit tests; commit locally (`... (spec 09 task 11m)`), never push
- [ ] 11o. Objective hint fits where you are; clue outline fits the clue
  - Full brief: `docs/kiro-prompt-playtest-batch.md` Part A, 11o
  - Each objective rule has a near hint (key and action) and a far hint (where to go); near only within 6 m and in the same building (hut, chapel, catacombs vs outside), far again past 8 m (hysteresis); reuse objectiveAim and the hut-door logic; pure logic in the objective system, texts in data; unit tests for near, far, inside/outside and hysteresis
  - Clue highlight hugs the clue model (inverted-hull outline or soft ground ring), sized from model bounds, fades in within about 4 m and out after examining; no box, no wireframe; follows whichever model is shown (11n-d clue GLBs); replace any other wireframe highlight box
  - Browser: screenshot a clue spot near and far at 1280x720
  - Design bible first; kiro-log with "Decisions made unattended"; lint, build, unit tests; commit locally (`... (spec 09 task 11o)`), never push
- [ ] 11n-a. Scenery swap: chapel inside and out
  - Full brief: `docs/kiro-prompt-playtest-batch.md` Part B ("What's there", 11n-a, Realism, Tests)
  - Mount `scene/chapel-interior.glb` and `scene/chapel-exterior.glb` (useGLTF with DRACO_PATH, `<Clone>`, preloadModels); old Slabs collider-only; remove the old frames, glass boxes, Kenney pillars, GableRoof, belfry, cross, Kenney altar and candles, visible floor slab
  - Bell mesh swings at anchor bell-pivot on the dusk bell; door lantern light at door-lantern-light; stair cover hides when the whistle opens the stair
  - Interior and buttress colliders from the JSON, none in the aisle, doors, altar trigger or congregation points; zombie paths still reach the altar and vestry
  - Seat fx-page-5, font loot, pew loot and the revolver (cupboard shelf; the revolver Shelf goes); hymn board numbers checked against cases.ts and case-design (report a mismatch, never edit the GLB)
  - Renderer: AgX tone mapping, low-intensity AO, selective bloom on emissives, moon shadow camera around the player, denser interior fog; anything over budget turns off at "Low"
  - GPU perf before and after; screenshots; commit locally (`... (spec 09 task 11n-a)`)
- [ ] 11n-b. Scenery swap: hut
  - Mount `scene/hut.glb`; Slabs collider-only; remove floor box, roof, window boxes, table meshes; add hut.json colliders (tables, stove, cot, barrels, log stack, vending machine footprint)
  - Workbench becomes `props/workbench.glb` (collider and pile placement kept); seat hut-shelf, fx-page-1 on the east table and POWDER_TIN_HUT on the new west table (surfaces 0.78); boots clue uses clue-hut-boots.glb; stove ember light only if the budget allows
  - GPU perf before and after; screenshots; commit locally (`... (spec 09 task 11n-b)`)
- [ ] 11n-c. Scenery swap: catacombs and the gates
  - Mount `scene/catacombs.glb` untransformed; keep corridor colliders; remove brick-wall instances, hide floor and ceiling Blocks; add portal, ledge, bier and altar colliders; move cat-wall-a/b/c, fx-page-4, fx-shroud, fx-heart onto their surfaces (catacombs.json move-items); at most two dim candle lights if the budget allows
  - Gates use gate-catacombs.glb and gate-mausoleum-row.glb lifted whole by useLift; ossuary door uses ossuary-door.glb; avenue rails use iron-railing.glb with a closing post
  - Unit: corridor keeps 1.6 m clear width; GPU perf before and after; screenshots; commit locally (`... (spec 09 task 11n-c)`)
- [ ] 11n-d. Scenery swap: props everywhere else
  - Lamp post, broken coffin, grave mounds (both states), merchant cart, statue, scare door, candle stub, grave hand, woodpile (axe at axe-rest), lodge table, sabre plinth, vending machine (new, placed only), bats (loaded for H4), and the nine `props/clue-<clueId>.glb` in ClueSpots; keep every collider and interactable, add the JSON colliders the game lacks
  - Unit: every seated spot within 0.03 m of its surface, every JSON loads, no collider in the chapel aisle or the hut spawn-to-bench path; browser screenshots of each swapped prop; GPU perf before and after; list anything that could not be seated; commit locally (`... (spec 09 task 11n-d)`)- [ ] 3. A2: Automated playthrough test
  - `e2e/playthrough.spec.ts` following the main story with objective text checks and an ending screen
  - Finish
  - _Requirements: 3.1-3.3_
  - Moved to spec 10 final task (`.kiro/specs/10-curse-stages/tasks.md` task 12): a full 3-stage run in Short Vigil. Not done here.

- [x] 12. Gate: after task 11b, draft E0 (design bible and steering diff for 3 stages) and stop for the user's approval
  - approved 2026-11-11, applied unattended

- 13. Moved to spec 10 (stages replace them): B10 Short Vigil (now E11), D5 night balance, D7 endings and save/load

- [ ] 14. C1: README links and screenshot
  - Finish
  - _Requirements: 9.1_

- [ ] 15. C2: Dev log dates from git history
  - Finish
  - _Requirements: 9.2_

- [ ] 16. C3: Submission kit
  - Finish
  - _Requirements: 9.3_

- [ ] 17. B11: Controls hint at the bottom left (rewritten 2026-11-14)
  - Full brief: `docs/kiro-prompt-playtest-batch.md` Part A, 17; read design bible §11 first
  - Panel above the health bar and oil gauge, parchment on dark: "W A S D Move", "Shift Sprint" (stamina bar named), "Hold V Charge a heavy swing" only while the axe or sabre is in hand; keys read live from the bindings with readable names ("Shift", "Mouse 2")
  - Shows from the end of the intro; each line fades (steady with Flashing lights off) after its action (about 10 m moved, 2 s sprinted, one charged swing); the charge line returns on the first axe or sabre equip; setting "Show control hints" (On) hides it or brings every line back; hidden in menus, workbench, big map, examine, cutscenes and endings; used lines saved
  - Stamina bar gets a "Stamina" caption or a run icon with an accessible name
  - Data in `src/data/controlHints.ts`, pure logic in `src/game/systems/controlHints.ts`; texts fit at 800x600 with the plain font
  - Compass bug: labels that would overlap (objective distance over "Hut") stack or shift aside, never draw over each other; unit test for the layout and a screenshot with the hut and objective in the same direction
  - Unit: rebound keys, charge line only with the axe or sabre, each line clears, the setting brings them back, save and restore. Browser: panel after the intro, walk and sprint fade, axe charge line, no overlap at 1920x1080, 1280x720 and 800x600; screenshots
  - Design bible first; kiro-log with "Decisions made unattended"; lint, build, unit tests; commit locally (`... (spec 09 task 17)`), never push
  - _Requirements: 10.1_

- [ ] 18. B12: Responsive HUD and 800x600 screenshot test
  - Finish
  - _Requirements: 10.2_

- [ ] 19. B13: Difficulty screen Begin visible
  - Finish
  - _Requirements: 10.3_

- [ ] 20. B14: Journal font size and plain-font setting
  - Finish
  - _Requirements: 10.4_

- [ ] 21. B15: Shorter intro
  - Finish
  - _Requirements: 10.5_

- [ ] 22. B16: Quit confirmation and Continue on title, with F5
  - F5: autosave at every dawn and at the start of each dusk, separate from the altar save; on Retry, clues and journal pages found after the retry point stay found
  - Finish
  - _Requirements: 10.6_

- [ ] 23. B17: Remove dead useWorkbench.ts
  - Finish
  - _Requirements: 10.7_

- [ ] 24. D1 to D9: Browser test passes
  - [ ] 24.1 D1 main story path
  - [ ] 24.2 D2 crafting and the workbench
  - [ ] 24.3 D3 digging and materials
  - [ ] 24.4 D4 chapel repairs
  - 24.5 D5: moved to spec 10
  - [ ] 24.6 D6 scares and comfort settings
  - 24.7 D7: moved to spec 10
  - [ ] 24.8 D8 performance (SwiftShader numbers only; real GPU fps not verifiable here)
    - Also measure these performance-review items; fix one only if D8 shows a real cost:
      - `LanternTraps.tsx` 44-55: the always-mounted pool of trap point lights (cost even at intensity 0)
      - `Cemetery.tsx` 123 and the chapel, gate and workbench meshes: non-instanced shadow casters; `InstancedModel` casts by default
      - `ThrowControls.tsx` ~101: `setArc` every frame while aiming (a React re-render per frame)
      - `Interactable.tsx` 98-110: one `useFrame` and one sprite material per interactable
  - [ ] 24.9 D9 screens and settings
  - Each pass reports what it could not verify
  - _Requirements: 11.1-11.2_
