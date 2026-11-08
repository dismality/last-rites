# Implementation Plan: Mystery, Scare Director and Endings

- [x] 1. Journal, clue, relic and scare data
  - `src/data/journal.ts`, `clues.ts`, `relics.ts`, `scares.ts` from the design bible (write page text in Elias's voice)
  - _Requirements: 1.2, 3.3, 4.1, 5.1_

- [x] 2. Mystery state system with tests
  - Pages, clues, relics, gates, rite progress, `chooseEnding`
  - Property tests: `chooseEnding` total and monotonic
  - _Requirements: 2.1, 2.3, 5.3, 5.4, 5.5_

- [x] 3. Scare director with property tests
  - Chance formula, weighted pick, cooldowns, no repeats, UI blocking, first-scare rule, dig hook
  - Property tests: cooldown spacing, no repeats, chance bounds
  - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 4.9_

- [x] 4. Scare zones and stager in the scene
  - Sensor volumes in Mausoleum Row, Catacombs and 2 grounds spots
  - Stage all 8 events with telegraphs and intensity profiles
  - _Requirements: 4.4, 4.5_

- [x] 5. Keys and gates
  - Crypt gate, whistle stair reveal, ossuary door, hints for locked gates
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Tombstones and environmental clues
  - Parchment rubbing view; ledger cross-check for wrong graves; 6+ clues placed
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 7. Journal UI
  - Tabs Pages / Clues / Relics / Map; handwriting font; ink underline; pauses simulation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8. Save and continue
  - Versioned save with validation; altar and new-day saves; Continue button logic
  - Property test: save/load round-trip
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Final rite and endings
  - Night 5 rite trigger, 45 s hold under attack, three ending camera sequences, stats and credits
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_

- [x] 10. Checkpoint: full playthrough
  - Play nights 1–5 and reach each ending; scare intensity Off playthrough works; all tests pass
