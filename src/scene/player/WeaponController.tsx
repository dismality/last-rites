// Weapon driver: edge-detects attack, reload, kick and dodge from the input snapshot and calls
// the combat actions. It also owns the aim flag and the recoil state the camera and viewmodel
// read. No rules live here (see game/state/combatActions.ts). Mount inside <GameLoop>.
// Requirements 3.1, 4.1, 4.4, 5.1, 9.1, 9.4.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { FIREARM_MAP } from '../../data/firearms'
import {
  cancelHeldReload,
  dodge,
  fireHeld,
  kick,
  reloadHeld,
} from '../../game/state/combatActions'
import { useInventoryStore, usePlayerStore } from '../../game/state'
import { isSimFrozen } from '../../game/state/menuState'
import { forwardFromYaw } from '../../game/systems/melee'
import { addKick, aimBlend, recoilOffsetRad, tickRecoil } from '../../game/systems/recoil'
import { hotbarItem } from '../../game/systems/satchel'
import type { FirearmId } from '../../game/types'
import { makeWallProbe } from '../enemies/wallProbe'
import { input } from './input'
import { makeWallDistance } from './shotOcclusion'
import { weaponRuntime } from './weaponRuntime'

const MAX_DT = 0.1
/** Eye height above the feet (matches FirstPersonController). */
const EYE_HEIGHT_M = 1.6

const isFirearm = (id: string | null): id is FirearmId => id !== null && id in FIREARM_MAP

export function WeaponController() {
  const { world, rapier } = useRapier()
  const prev = useRef({ attack: false, reload: false, kick: false, dodge: false })
  const lastHeld = useRef<string | null>(null)

  useFrame((_s, rawDelta) => {
    const dt = Math.min(rawDelta, MAX_DT)
    const inv = useInventoryStore.getState()
    const held = inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot)

    // A reload belongs to the weapon it started on (Req 4.4).
    if (held !== lastHeld.current) {
      lastHeld.current = held
      cancelHeldReload()
    }

    const frozen = isSimFrozen()
    const snap = input.peek()
    // Edges are tracked even while frozen so a key held through pause does not fire on resume.
    const edge = {
      attack: snap.attack && !prev.current.attack,
      reload: snap.reload && !prev.current.reload,
      kick: snap.kick && !prev.current.kick,
      dodge: snap.dodge && !prev.current.dodge,
    }
    prev.current = { attack: snap.attack, reload: snap.reload, kick: snap.kick, dodge: snap.dodge }

    const firearm = isFirearm(held) ? held : null
    const aiming = !frozen && firearm !== null && snap.aim
    weaponRuntime.aiming = aiming
    weaponRuntime.aimBlend = aimBlend(weaponRuntime.aimBlend, aiming, dt)

    const player = usePlayerStore.getState()
    const cp = Math.cos(player.pitch)
    const eye: [number, number, number] = [player.position[0], player.position[1] + EYE_HEIGHT_M, player.position[2]]
    const dir: [number, number, number] = [
      -Math.sin(player.yaw) * cp,
      Math.sin(player.pitch),
      -Math.cos(player.yaw) * cp,
    ]
    weaponRuntime.camera = { position: eye, direction: dir }
    weaponRuntime.recoil = tickRecoil(weaponRuntime.recoil, frozen ? 0 : dt)
    if (frozen) return

    if (edge.dodge) {
      const f = forwardFromYaw(player.yaw)
      // Right-hand vector of the facing; strafe and forward input blend into the dash direction.
      const right = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) }
      dodge({
        x: f.x * snap.forward + right.x * snap.strafe,
        z: f.z * snap.forward + right.z * snap.strafe,
      })
    }
    if (edge.kick) kick(makeWallProbe(world, rapier))
    if (!firearm) return
    if (edge.reload) reloadHeld()

    if (edge.attack) {
      // The recoil still left from the last shot lifts the next one, so rapid fire climbs.
      const pitch = player.pitch + recoilOffsetRad(weaponRuntime.recoil)
      const cpa = Math.cos(pitch)
      const aim = { x: -Math.sin(player.yaw) * cpa, y: Math.sin(pitch), z: -Math.cos(player.yaw) * cpa }
      const res = fireHeld({
        origin: { x: eye[0], y: eye[1], z: eye[2] },
        aim,
        aiming,
        wall: makeWallDistance(world, rapier),
      })
      if (res.outcome === 'fired' && res.weapon) {
        weaponRuntime.recoil = addKick(weaponRuntime.recoil, res.recoilKickDeg, res.recoilRecoverS)
        weaponRuntime.muzzleEvents.push({ ageS: 0, kind: res.weapon })
      }
    }
  })

  return null
}
