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

- [ ] 3. A2: Automated playthrough test
  - `e2e/playthrough.spec.ts` following the main story with objective text checks and an ending screen
  - Finish
  - _Requirements: 3.1-3.3_

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

- [ ] 11. B9: Recipe book names and tooltip
  - Finish
  - _Requirements: 7.5_

- [ ] 11b. F6: Elite ammo drops only for owned guns (user approved)
  - Roll revolver ammo only once the revolver is owned and shells only once the shotgun is owned; otherwise drop materials; property test
  - Finish
  - _Requirements: 12.7_

- [ ] 12. Gate: after task 11b, draft E0 (design bible and steering diff for 3 stages) and stop for the user's approval

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

- [ ] 17. B11: Movement hint clears
  - Finish
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
