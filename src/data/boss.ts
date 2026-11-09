// Father Aldous Crane boss numbers — mirrored from docs/game-design.md §7 (07).
// Pure data: no logic, no side effects.

export const BOSS = {
  /** Sim seconds after the final rite starts before he rises. */
  riseAfterS: 10,
  riseTelegraphS: 1.5,
  nameCardS: 3,
  /** Rite progress stops here (of 45 s) while he lives. */
  riteCapS: 44,
  /** Quiet after he crumbles, before the closing line. */
  deathQuietS: 4,
  /** HP fractions at which the next phase begins. */
  phaseAt: { two: 0.6, three: 0.25 },
  speed: { 1: 1.2, 2: 1.5, 3: 1.7 },
  /** Salt slows him instead of stopping him. */
  saltSpeedMult: 0.5,
  censer: { windupS: 1.0, arcDeg: 120, reachM: 3, damage: 30 },
  toll: { everyS: 12, telegraphS: 1.2, radiusM: 8, damage: 20, pushM: 3 },
  congregation: { everyS: { 1: 25, 2: 25, 3: 18 }, telegraphS: 1.0, count: 3 },
} as const
