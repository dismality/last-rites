# Implementation Plan: Playtest Fixes

## Overview
Tasks run in the order the user set. Every task ends with **Finish**:

- **Finish:** run `npm run lint`, `npm run build` and `npm test -- --run` (plus the task's Playwright spec when it has one), fix any failures, append a `docs/kiro-log.md` entry with the real date, and commit with a clear message. Do not push.

**Gate:** stop and ask the user before task 13 (B10, Short Vigil), because it changes game balance.

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

- [ ] 5. B3: Day-1 oil
  - Finish
  - _Requirements: 5.1-5.3_

- [ ] 6. B4: Hut oil pickup and tutorial step 2
  - Finish
  - _Requirements: 6.1-6.3_

- [ ] 7. B5: Spawn yaw and intro card
  - Finish
  - _Requirements: 7.1_

- [ ] 8. B6: Compass inside the hut
  - Finish
  - _Requirements: 7.2_

- [ ] 9. B7: Readable examined journal page
  - Finish
  - _Requirements: 7.3_

- [ ] 10. B8: Lantern glare near walls
  - Finish
  - _Requirements: 7.4_

- [ ] 11. B9: Recipe book names and tooltip
  - Finish
  - _Requirements: 7.5_

- [ ] 12. Gate: ask the user about B10 before going on

- [ ] 13. B10: Short Vigil demo mode
  - Finish
  - _Requirements: 8.1_

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

- [ ] 22. B16: Quit confirmation and Continue on title
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
  - [ ] 24.5 D5 night combat and balance
  - [ ] 24.6 D6 scares and comfort settings
  - [ ] 24.7 D7 endings and save/load
  - [ ] 24.8 D8 performance (SwiftShader numbers only; real GPU fps not verifiable here)
    - Also measure these performance-review items; fix one only if D8 shows a real cost:
      - `LanternTraps.tsx` 44-55: the always-mounted pool of trap point lights (cost even at intensity 0)
      - `Cemetery.tsx` 123 and the chapel, gate and workbench meshes: non-instanced shadow casters; `InstancedModel` casts by default
      - `ThrowControls.tsx` ~101: `setArc` every frame while aiming (a React re-render per frame)
      - `Interactable.tsx` 98-110: one `useFrame` and one sprite material per interactable
  - [ ] 24.9 D9 screens and settings
  - Each pass reports what it could not verify
  - _Requirements: 11.1-11.2_
