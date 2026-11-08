// EnemyDirector: drives the pure enemy AI each frame, wires wall probes (Rapier
// raycasts) and spatial audio, and applies attack events to the player.
// No rules live here (see game/systems/enemyAI.ts). Mount inside <GameLoop>.
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { playEnemyCue, setListener, syncEnemyLoops } from '../../audio/AudioManager'
import { CUE_SUBTITLES, ENEMY_MAP } from '../../data/enemies'
import { emit } from '../../game/events'
import { useEnemyStore, useGameStore, usePlayerStore, useSettingsStore } from '../../game/state'
import { useLanternStore } from '../../game/state'
import { useEndingStore } from '../../game/state/endingStore'
import { hurtPlayer } from '../../game/state/retryNight'
import type { Vec2 } from '../../game/systems/combat'
import { loopCue, tickEnemies, type AIEvent } from '../../game/systems/enemyAI'
import { LUNGE_SPEED_FULL, capScareDamage, intensityProfile } from '../../game/systems/scareDirector'
import { forwardFromYaw } from '../../game/systems/melee'
import { EnemyModels } from './EnemyModels'
import { isScareEnemy } from './scareEnemy'

const MAX_DT = 0.1
/** Wall probes run at roughly knee height so low headstones still count. */
const PROBE_Y = 0.6
/** Probes stop short of their end point so the player's own capsule never reads as a wall. */
const PROBE_END_MARGIN_M = 0.5
/** Audio sources sit at head height. */
const AUDIO_Y = 1.4
const SUBTITLE_S = 2.5

export function EnemyDirector() {
  const { world, rapier } = useRapier()

  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    if (gs.paused || gs.examining || gs.journalOpen) return
    const store = useEnemyStore.getState()
    const player = usePlayerStore.getState()
    setListener(player.position, player.yaw)
    if (store.enemies.length === 0) {
      syncEnemyLoops([])
      return
    }

    const dt = Math.min(rawDelta, MAX_DT)
    const blocked = (a: Vec2, b: Vec2): boolean => {
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.hypot(dx, dz) - PROBE_END_MARGIN_M
      if (len <= 0) return false
      const ray = new rapier.Ray(
        { x: a.x, y: PROBE_Y, z: a.z },
        { x: dx / (len + PROBE_END_MARGIN_M), y: 0, z: dz / (len + PROBE_END_MARGIN_M) },
      )
      return world.castRay(ray, len, true) !== null
    }

    const result = tickEnemies(store.enemies, dt, {
      playerPos: { x: player.position[0], z: player.position[2] },
      playerFacing: forwardFromYaw(player.yaw),
      lanternFuel: useLanternStore.getState().fuel,
      blocked,
      // Reduced and off lunge at 4 m/s instead of 6 (design bible: intensity profiles).
      lungeSpeedScale:
        intensityProfile(useSettingsStore.getState().scareIntensity).lungeSpeed / LUNGE_SPEED_FULL,
    })
    store.setEnemies(result.enemies)

    result.events.forEach(handleEvent)
    syncEnemyLoops(
      result.enemies.flatMap((e) => {
        const cue = loopCue(e)
        return cue ? [{ uid: e.uid, cue, x: e.pos.x, y: AUDIO_Y, z: e.pos.z }] : []
      }),
    )
  })

  return <EnemyModels />
}

function handleEvent(ev: AIEvent): void {
  switch (ev.type) {
    case 'enemyAttack':
      // Block input is not wired yet; see playerHealth.damagePlayer for the reduction.
      // A lurker staged by the scare director may hurt but never deal the killing blow (Req 4.7).
      hurtPlayer(isScareEnemy(ev.uid) ? capScareDamage(usePlayerStore.getState().health, ev.damage) : ev.damage, false)
      break
    case 'wailerScream':
      playEnemyCue('wailer-wail', ev.pos.x, AUDIO_Y, ev.pos.z)
      emit({ type: 'subtitleShown', text: CUE_SUBTITLES['wailer-wail'], duration: SUBTITLE_S })
      break
    case 'lurkerTriggered':
      playEnemyCue(ENEMY_MAP.lurker.audio, ev.pos.x, AUDIO_Y, ev.pos.z)
      emit({ type: 'subtitleShown', text: CUE_SUBTITLES['lurker-breath'], duration: SUBTITLE_S })
      break
    case 'enemyCollapsed':
      useEndingStore.getState().banish()
      break
  }
}
