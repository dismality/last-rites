// Melee driver: turns the Attack input into a swing, and at the swing's midpoint
// asks the pure combat code who was hit. No rules live here (see systems/melee.ts).
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { playMeleeHit } from '../../audio/AudioManager'
import { WEAPON_MAP } from '../../data/weapons'
import {
  useEnemyStore,
  useGameStore,
  useInventoryStore,
  useLanternStore,
  usePlayerStore,
  useSettingsStore,
} from '../../game/state'
import {
  REST_POSE,
  forwardFromYaw,
  resolveMelee,
  shakeAllowed,
  spawnDust,
  startSwing,
  swingPose,
  swingProgress,
  tickSwing,
  type SwingState,
} from '../../game/systems/melee'
import { hotbarItem } from '../../game/systems/satchel'
import type { CraftedItemId } from '../../game/types'
import { input } from './input'
import { meleeRuntime } from './meleeRuntime'

const MAX_DT = 0.1
/** Dust bursts from roughly chest height. */
const DUST_Y = 1.0

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** Mount inside the Canvas, inside GameLoop. Renders nothing. */
export function MeleeAttack() {
  const swing = useRef<SwingState | null>(null)

  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    if (gs.paused || gs.examining || gs.journalOpen) return
    const dt = Math.min(rawDelta, MAX_DT)

    // Stagger timers are counted down by the enemy AI (EnemyDirector).
    meleeRuntime.shakeAge += dt

    const inv = useInventoryStore.getState()
    const held = inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot)
    const def = held ? WEAPON_MAP[held as CraftedItemId] : undefined
    const melee = def?.kind === 'melee' && def.cooldown !== null ? def : undefined

    if (!swing.current && melee && !gs.satchelOpen && input.peek().attack) {
      swing.current = startSwing(melee.cooldown ?? 0.9)
    }

    const s = swing.current
    if (!s) {
      meleeRuntime.pose = REST_POSE
      return
    }
    const t = tickSwing(s, dt)
    swing.current = t.swing
    meleeRuntime.pose = t.swing ? swingPose(swingProgress(t.swing)) : REST_POSE

    if (t.hit && melee) {
      const player = usePlayerStore.getState()
      const result = resolveMelee(
        { x: player.position[0], z: player.position[2] },
        forwardFromYaw(player.yaw),
        melee.damage,
        useEnemyStore.getState().enemies,
        { lanternFuel: useLanternStore.getState().fuel },
      )
      if (result.hitUids.length === 0) return
      // Dead zombies stay in the list for the AI task to play the death; hp 0 excludes them from further hits.
      useEnemyStore.getState().setEnemies(result.enemies)
      playMeleeHit()
      for (const e of result.enemies) {
        if (result.hitUids.includes(e.uid)) {
          meleeRuntime.dustQueue.push(...spawnDust({ x: e.pos.x, y: DUST_Y, z: e.pos.z }, Math.random))
        }
      }
      if (shakeAllowed(useSettingsStore.getState().cameraShake, prefersReducedMotion())) {
        meleeRuntime.shakeAge = 0
      }
    }
  })

  return null
}
