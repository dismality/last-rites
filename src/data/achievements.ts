import type { AchievementId } from '../game/types'

// Design bible §12 "Achievements".
export interface AchievementDef {
  id: AchievementId
  name: string
  goal: string
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'a-first-light', name: 'First Light', goal: 'Survive night 1' },
  { id: 'a-grave-robber', name: 'Grave Robber', goal: 'Dig 10 graves in one run' },
  { id: 'a-marksman', name: 'Marksman', goal: 'Make 10 headshot kills in one night' },
  { id: 'a-close-shave', name: 'Close Shave', goal: 'Clear a night with 10 HP or less' },
  { id: 'a-combo', name: 'Requiem', goal: 'Reach a ×3.0 combo' },
  { id: 'a-barricade', name: 'Hold the Door', goal: 'Nail 20 barricade boards in one run' },
  { id: 'a-pages', name: "The Keeper's Account", goal: 'Read all 5 journal pages' },
  { id: 'a-relics', name: 'Every Relic', goal: 'Hold all 5 relics' },
  { id: 'a-crane', name: 'Forgive Them', goal: 'Put Father Crane to rest' },
  { id: 'a-rest', name: 'Rest', goal: 'Reach the Rest ending' },
  { id: 'a-endless-10', name: 'Long Night', goal: 'Reach night 10 in Endless Survival' },
  { id: 'a-patron', name: 'Valued Custom', goal: 'Spend 100 Grave Coins in one run' },
]

export const ACHIEVEMENTS_KEY = 'lastrites:achievements'

// Toast timings and cap are chosen here; the bible only says "parchment toast".
export const TOAST = { showS: 4, fadeS: 0.5, maxVisible: 3 } as const

export const ACHIEVEMENT_THRESHOLDS = {
  firstLightNights: 1,
  digs: 10,
  headshotsPerNight: 10,
  closeShaveHp: 10,
  comboCap: 3.0,
  boards: 20,
  pages: 5,
  relics: 5,
  endlessNight: 10,
  coinsSpent: 100,
} as const
