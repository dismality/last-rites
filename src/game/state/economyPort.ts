// Lets caseStore spend coins and change the score without importing progressionStore, which would
// form an import cycle (caseStore is read by guidanceTick, which progressionStore's chain loads).
// progressionStore registers itself on load.

export interface EconomyPort {
  coins: () => number
  addCoins: (delta: number) => void
  /** Adds to the run score, never below 0. */
  addScore: (delta: number) => void
  story: () => boolean
}

let port: EconomyPort | null = null

export function registerEconomyPort(p: EconomyPort): void {
  port = p
}

/** Until progressionStore loads there is nothing to spend and nothing to score. */
export const economy = (): EconomyPort =>
  port ?? { coins: () => 0, addCoins: () => undefined, addScore: () => undefined, story: () => true }
