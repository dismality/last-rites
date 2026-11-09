// Kick and dodge numbers mirrored from docs/game-design.md §4 "Heavy melee and combat moves (07)".
export const KICK = {
  staminaCost: 15,
  damage: 5,
  pushM: 2,
  staggerS: 0.6,
  bruteStaggerS: 0.3,
  cooldownS: 1.2,
} as const

export const DODGE = {
  staminaCost: 25,
  distanceM: 3,
  durationS: 0.25,
  iFramesS: 0.2,
  cooldownS: 0.8,
} as const

/** A knocked-down zombie takes 25% more damage. */
export const KNOCKDOWN_DAMAGE_MULT = 1.25
