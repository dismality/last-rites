# Implementation Plan: Combat, Zombies and Night Waves

- [x] 1. Enemy and wave data
  - `src/data/enemies.ts`, `waves.ts` from the design bible
  - _Requirements: 4.1, 4.2, 4.3, 5.1_

- [x] 2. Combat math with property tests
  - `meleeHits`, `applyDamage`, `aoe`, darkness damage reduction
  - _Requirements: 2.1, 2.2, 3.3, 3.4, 4.5_

- [x] 3. Player health, block, death and Retry Night
  - `playerHealth.ts`, dusk snapshot save and restore, "You were taken" screen
  - _Requirements: 2.4, 6.1, 6.2, 6.3, 6.4_

- [x] 4. Viewmodel layer
  - Separate render pass, swap animation, sway and bob
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Melee attacks in the scene
  - Swing animation, hit at midpoint, dust, stagger, optional shake
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6. Enemy AI state machines
  - Shambler, Lurker, Wailer per design; steering and waypoints; spatial audio signatures
  - Unit tests per transition
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

- [x] 7. Wave director
  - `tickWaves` with spawn distance, 15 s gaps, live cap 14, `wavesCleared`
  - Grave-burst effect; tally HUD
  - Property tests on totals and cap
  - _Requirements: 5.1–5.6_

- [x] 8. Throwables and placeables
  - Arc preview, physics throw, flask, nail bomb fuse, lantern trap, salt circle barrier
  - _Requirements: 3.1–3.6_

- [x] 9. Damage feedback
  - Lantern HUD dip, vignette behind flashing setting, heartbeat and desaturation under 30 HP
  - _Requirements: 6.1, 6.2_

- [x] 10. Checkpoint
  - Survive night 1 and night 2 using the club and a flask; check fps stays above 45 with 14 zombies
