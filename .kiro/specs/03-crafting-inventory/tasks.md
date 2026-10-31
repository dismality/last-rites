# Implementation Plan: Crafting and Chapel Repairs

- [ ] 1. Recipe, weapon and repair data
  - `src/data/recipes.ts`, `weapons.ts`, `repairs.ts` from the design bible
  - _Requirements: 4.1, 6.1_

- [ ] 2. Crafting system with property tests
  - `canCraft`, atomic `craft`, tool replacement
  - Property tests: no negatives, failed craft leaves inventory unchanged, exact deltas
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 3. Recipe unlocks
  - Start recipes; `dawnStarted` night unlocks; journal page 3 → salt circle
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 4. Workbench camera rig and bench layout
  - Interact → camera to bench, pointer unlock, Esc returns; world keeps running
  - Instanced material piles with counts
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 5. Recipe book UI with glow and highlighting
  - Craftable glow and rune; hover highlights; missing amounts with label; smudged locked entries
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 6. Crafting animation with hit cancel
  - 1.5 s timed craft, sound, cancel on damage without consuming
  - _Requirements: 3.1, 3.3_

- [ ] 7. Durability and consumables
  - `durability.ts` with property tests; break flow; crack decals under 20%
  - Bandage and refill timed use
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. Chapel repairs
  - Repair points UI; ordered stages; door blocks zombies; altar save and heal; bell warning
  - _Requirements: 6.1–6.6_

- [ ] 9. Checkpoint
  - Craft a bone club, sharpen the shovel after night 1, repair stage 1; all tests pass
