// Live zombies. The AI (EnemyDirector) ticks them; melee writes damage and stagger;
// the wave director (task 7) will add spawns.
import { create } from 'zustand'
import type { AIEnemy } from '../systems/enemyAI'

interface EnemyStoreState {
  enemies: readonly AIEnemy[]
  setEnemies: (enemies: readonly AIEnemy[]) => void
}

export const useEnemyStore = create<EnemyStoreState>((set) => ({
  enemies: [],
  setEnemies: (enemies) => set({ enemies }),
}))
