// When a case is solved the living zombies collapse to dust (spec 10, Req 2.12). The rule is
// the pure `collapseLiving`; this component applies it to the enemy store and queues the puffs
// that DustBurst draws. Dust is soft grey and steady, so Flashing lights has nothing to dim,
// but calm players (shake or flashing off, or reduced motion) get one puff per zombie.
import { useEffect } from 'react'
import { useEnemyStore } from '../../game/state/enemyStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { useStageStore } from '../../game/state/stageStore'
import { useWorldStore } from '../../game/state/worldStore'
import { collapseLiving, collapsePuffCount } from '../../game/systems/caseCollapse'
import { spawnDust } from '../../game/systems/melee'
import { meleeRuntime } from '../player/meleeRuntime'

/** Chest height of a standing zombie, where the puff starts. */
const COLLAPSE_DUST_Y = 0.9

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function CaseCollapse() {
  useEffect(
    () =>
      useStageStore.subscribe((s, prev) => {
        if (!s.caseSolved || prev.caseSolved) return
        // A restored save carries a solved flag too; only a night in progress collapses zombies.
        if (useWorldStore.getState().phase !== 'night') return
        const result = collapseLiving(useEnemyStore.getState().enemies)
        if (result.collapsed.length === 0) return
        useEnemyStore.getState().setEnemies(result.enemies)
        const { flashingLights, cameraShake } = useSettingsStore.getState()
        const puffs = collapsePuffCount(!flashingLights || !cameraShake || prefersReducedMotion())
        for (const at of result.collapsed) {
          meleeRuntime.dustQueue.push(
            ...spawnDust({ x: at.x, y: COLLAPSE_DUST_Y, z: at.z }, Math.random).slice(0, puffs),
          )
        }
      }),
    [],
  )
  return null
}
