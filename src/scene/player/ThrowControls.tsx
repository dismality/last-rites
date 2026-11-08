// Throw / place driver. While Aim is held with a throwable it previews the arc;
// releasing Attack throws. Placeables are set down on Attack. Rules live in
// systems/projectiles.ts; this file only reads input and talks to the stores.
// Mount inside <GameLoop>. Requirements 3.1, 3.2, 3.5, 3.6.
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { playThrowSfx } from '../../audio/AudioManager'
import {
  ARC_STEPS,
  ARC_STEP_S,
  GRAVITY,
  PLACE_DISTANCE_M,
  PLACEABLE_IDS,
  THROWABLE_IDS,
  THROW_SPAWN_OFFSET_M,
  THROW_SPEED,
  type PlaceableId,
  type ThrowableId,
} from '../../data/projectiles'
import { WEAPON_MAP } from '../../data/weapons'
import {
  useGameStore,
  useInventoryStore,
  usePlayerStore,
  useProjectileStore,
} from '../../game/state'
import { removeItem } from '../../game/systems/inventory'
import {
  arcPoints,
  createSaltCircle,
  createTrap,
  throwVelocity,
  type Arc,
  type Vec3,
} from '../../game/systems/projectiles'
import { dropPosition, hotbarItem } from '../../game/systems/satchel'
import { input } from './input'
import { ArcPreview } from './ArcPreview'

/** Eye height above the feet (matches FirstPersonController). */
const EYE_HEIGHT_M = 1.6

let nextId = 0
const newId = (prefix: string): string => `${prefix}-${nextId++}`

const isThrowable = (id: string | null): id is ThrowableId =>
  id !== null && (THROWABLE_IDS as readonly string[]).includes(id)
const isPlaceable = (id: string | null): id is PlaceableId =>
  id !== null && (PLACEABLE_IDS as readonly string[]).includes(id)

/** Spends one of the held item; the hotbar binding clears itself when the stack empties. */
function consumeOne(id: ThrowableId | PlaceableId): void {
  const store = useInventoryStore.getState()
  store.setInventory(removeItem(store.inventory, id, 1).inv)
}

export function ThrowControls() {
  const prevAttack = useRef(false)
  const [arc, setArc] = useState<(Arc & { radius: number }) | null>(null)

  useFrame(() => {
    const gs = useGameStore.getState()
    const attack = input.peek().attack
    const pressed = attack && !prevAttack.current
    const released = !attack && prevAttack.current
    prevAttack.current = attack

    const paused = gs.paused || gs.examining || gs.journalOpen || gs.satchelOpen
    const inv = useInventoryStore.getState()
    const held = inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot)
    const player = usePlayerStore.getState()

    if (paused || !held) {
      if (arc) setArc(null)
      return
    }

    if (isPlaceable(held)) {
      if (arc) setArc(null)
      if (!pressed) return
      const p = dropPosition(player.position, player.yaw, PLACE_DISTANCE_M)
      const at = { x: p[0], z: p[2] }
      const ps = useProjectileStore.getState()
      if (held === 'lantern-trap') {
        ps.setTraps([...ps.traps, createTrap(newId('trap'), at)])
        playThrowSfx('trap-spring', p[0], p[1], p[2])
      } else {
        ps.setSalts([...ps.salts, createSaltCircle(newId('salt'), at)])
        playThrowSfx('salt-place', p[0], p[1], p[2])
      }
      consumeOne(held)
      return
    }

    if (!isThrowable(held) || !input.peek().aim) {
      if (arc) setArc(null)
      return
    }

    // Aiming: the same numbers drive the preview and the real throw.
    const origin = launchOrigin(player.position, player.yaw, player.pitch)
    const velocity = throwVelocity(player.yaw, player.pitch, THROW_SPEED)
    const a = arcPoints(origin, velocity, GRAVITY, ARC_STEPS, ARC_STEP_S)
    setArc({ ...a, radius: WEAPON_MAP[held].radius ?? 0.5 })

    if (released) {
      useProjectileStore.getState().addThrown({ id: newId('thrown'), kind: held, origin, velocity })
      playThrowSfx('throw', origin.x, origin.y, origin.z)
      consumeOne(held)
    }
  })

  return arc ? <ArcPreview points={arc.points} landing={arc.landing} radius={arc.radius} /> : null
}

/** Eye position nudged along the look direction so the item clears the player capsule. */
function launchOrigin(feet: readonly number[], yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch)
  return {
    x: feet[0] - Math.sin(yaw) * cp * THROW_SPAWN_OFFSET_M,
    y: feet[1] + EYE_HEIGHT_M + Math.sin(pitch) * THROW_SPAWN_OFFSET_M,
    z: feet[2] - Math.cos(yaw) * cp * THROW_SPAWN_OFFSET_M,
  }
}
