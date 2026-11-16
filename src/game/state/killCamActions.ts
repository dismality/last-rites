// Grab kill-cam actions (spec 10 task 8, Req 25). The rules are in systems/killCam.ts.
// A zombie blow on the keeper comes here first: it either lands at once as a normal hit, or starts a
// kill-cam that holds the keeper facing the zombie and lands the same blow on release. The camera is
// turned by FirstPersonController (heldGrabPose), the release by KillCam.tsx, the edge by the HUD.

import { GRAB_CAPTION, KILL_CAM } from '../../data/killCam'
import { CAPTION_MIN_SECONDS } from '../../data/captions'
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import type { EnemyId } from '../../data/enemies'
import { useKillCamStore } from './killCamStore'
import { attemptGrab, grabPose, isFacing, lookAt } from '../systems/killCam'
import { isInvulnerable } from '../systems/dodge'
import { spawnDust } from '../systems/melee'
import { meleeRuntime } from '../../scene/player/meleeRuntime'
import { emit } from '../events'
import { emitCombatSound } from './combatSounds'
import { useCombatStore } from './combatStore'
import { getDevCheats } from './devCheats'
import { useGameStore } from './gameStore'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'
import { hurtPlayer, type HurtSource } from './retryNight'
import { simClock } from './simClock'

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const EYE_Y = 1.6

/**
 * A zombie blow on the keeper (EnemyDirector). Returns what hurtPlayer would for a blow that lands
 * now; a held blow returns true (it lands at release).
 */
export function zombieBlow(enemy: EnemyId, at: { x: number; z: number }, damage: number, blocking: boolean, source: HurtSource): boolean {
  const k = useKillCamStore.getState()
  const player = usePlayerStore.getState()
  // Nothing seizes a keeper who is already taken, mid-dodge, in god mode or already held.
  const exempt =
    useGameStore.getState().taken ||
    isInvulnerable(useCombatStore.getState().live.dodge) ||
    getDevCheats().god ||
    k.active !== null
  if (exempt) return hurtPlayer(damage, blocking, source)
  const s = useSettingsStore.getState()
  const pos = { x: player.position[0], z: player.position[2] }
  const out = attemptGrab(
    { lastStartS: k.lastStartS },
    {
      enemy,
      health: player.health,
      maxHealth: PLAYER_MAX_HEALTH,
      stamina: player.stamina,
      facing: isFacing(pos, player.yaw, at),
      nowS: simClock.now,
      intensity: s.scareIntensity,
      damage,
    },
    { cameraShake: s.cameraShake, flashingLights: s.flashingLights, reducedMotion: reducedMotion() },
  )
  const plan = out.plan
  if (plan === null) return hurtPlayer(damage, blocking, source)

  // Sound and subtitle: the stinger's caption, or at Off the subtitle alone, shown even with Subtitles off.
  if (plan.stinger !== null) emitCombatSound(plan.stinger, { x: at.x, y: 1, z: at.z })
  else emit({ type: 'subtitleShown', text: GRAB_CAPTION, duration: CAPTION_MIN_SECONDS, force: plan.forceCaption })
  // Silhouette, sound and dust only (Req 25.8).
  meleeRuntime.dustQueue.push(...spawnDust({ x: at.x, y: KILL_CAM.dustY, z: at.z }, Math.random))

  const eye: [number, number, number] = [pos.x, player.position[1] + EYE_Y, pos.z]
  const from = { yaw: player.yaw, pitch: player.pitch }
  useKillCamStore.setState((st) => ({
    lastStartS: simClock.now,
    edge: { startS: simClock.now, kind: plan.edge },
    count: st.count + 1,
    active: plan.pull
      ? { enemy, at, startS: simClock.now, plan, damage, source, from, to: lookAt(eye, at) }
      : null,
  }))
  // At Off the blow lands at once; a pulled grab lands it on release.
  return plan.pull ? true : hurtPlayer(damage, blocking, source)
}

/** The camera pose while the keeper is held, or null. Read by FirstPersonController each frame. */
export function heldGrabPose(): (ReturnType<typeof grabPose> & { shake: boolean }) | null {
  const a = useKillCamStore.getState().active
  if (a === null) return null
  return { ...grabPose(a.from, a.to, simClock.now - a.startS, a.plan.closeUp), shake: a.plan.shake }
}

/** Releases the keeper once the hold is over, landing the zombie's blow (KillCam.tsx, each frame). */
export function tickKillCam(): void {
  const a = useKillCamStore.getState().active
  if (a === null) return
  if (useGameStore.getState().taken) {
    useKillCamStore.setState({ active: null })
    return
  }
  if (simClock.now - a.startS < a.plan.holdS) return
  useKillCamStore.setState({ active: null })
  // The keeper ends up facing what seized them; the controller already wrote that look.
  hurtPlayer(a.damage, false, a.source)
}
