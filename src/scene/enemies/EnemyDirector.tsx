// EnemyDirector: drives the pure enemy AI each frame, wires wall probes (Rapier
// raycasts) and spatial audio, and applies attack events to the player.
// No rules live here (see game/systems/enemyAI.ts). Mount inside <GameLoop>.
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { playEnemyCue, setListener, syncEnemyLoops } from '../../audio/AudioManager'
import { CUE_SUBTITLES, ENEMY_MAP } from '../../data/enemies'
import type { EnemyId } from '../../data/enemies'
import type { DoorId } from '../../game/types'
import { CHAPEL_DOORS } from '../../data/cemeteryLayout'
import { emit } from '../../game/events'
import { useEnemyStore, usePlayerStore, useSettingsStore } from '../../game/state'
import {
  useChapelStore,
  useDoorStore,
  useInventoryStore,
  useLanternStore,
  useWorldStore,
} from '../../game/state'
import { emitCombatSound } from '../../game/state/combatSounds'
import { hotbarItem } from '../../game/systems/satchel'
import { WEAPON_MAP } from '../../data/weapons'
import { boardDamageFor, damageDoor } from '../../game/systems/barricade'
import {
  CHAPEL_DOOR_GEOM,
  barricadeFor,
  chooseTarget,
  closedDoorBlocks,
  doorClosed,
  ejectFromClosedDoors,
  insideChapel,
} from '../../game/systems/chapelDoors'
import { input } from '../player/input'
import { isSimFrozen } from '../../game/state/menuState'
import { hurtPlayer } from '../../game/state/retryNight'
import { loopCue, tickEnemies, type AIEvent } from '../../game/systems/enemyAI'
import {
  LUNGE_SPEED_FULL,
  capScareDamage,
  intensityProfile,
} from '../../game/systems/scareDirector'
import { forwardFromYaw } from '../../game/systems/melee'
import { createRng } from '../../game/rng'
import { resolveBurst } from '../../game/systems/bloater'
import { killReports } from '../../game/systems/killReports'
import { ownedGuns, placeEliteDrop, rollEliteDrop } from '../../game/systems/elites'
import { useCombatStore } from '../../game/state/combatStore'
import { useSpawnStore } from '../../game/state/spawnStore'
import { gasRuntime } from '../effects/gasRuntime'
import { EnemyModels } from './EnemyModels'
import { isScareEnemy } from './scareEnemy'
import { makeWallProbe } from './wallProbe'

const MAX_DT = 0.1
/** Audio sources sit at head height. */
const AUDIO_Y = 1.4
const SUBTITLE_S = 2.5
/** Elite drops are cosmetic randomness, not part of the seeded wave stream. */
const dropRng = createRng((Date.now() & 0x7fffffff) >>> 0)
let dropCounter = 0

export function EnemyDirector() {
  const { world, rapier } = useRapier()

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
    const store = useEnemyStore.getState()
    const player = usePlayerStore.getState()
    setListener(player.position, player.yaw)
    if (store.enemies.length === 0) {
      syncEnemyLoops([])
      return
    }

    const dt = Math.min(rawDelta, MAX_DT)
    const wall = makeWallProbe(world, rapier)
    const playerXZ = { x: player.position[0], z: player.position[2] }
    const barricade = currentBarricade()
    const closed = {
      front: doorClosed(barricade, 'front'),
      vestry: doorClosed(barricade, 'vestry'),
    }
    const doorBlock = closedDoorBlocks(closed)
    const blocked: typeof wall = (a, b) => wall(a, b) || doorBlock(a, b)
    const night = useWorldStore.getState().phase === 'night'
    const playerInside = insideChapel(playerXZ)
    const targeted = store.enemies.map((e) => ({
      ...e,
      target: chooseTarget(e, { barricade, playerInside, night }),
    }))

    const result = tickEnemies(targeted, dt, {
      doors: {
        front: CHAPEL_DOOR_GEOM.front.standPoint,
        vestry: CHAPEL_DOOR_GEOM.vestry.standPoint,
      },
      playerPos: { x: player.position[0], z: player.position[2] },
      playerFacing: forwardFromYaw(player.yaw),
      lanternFuel: useLanternStore.getState().fuel,
      blocked,
      // Reduced and off lunge at 4 m/s instead of 6 (design bible: intensity profiles).
      lungeSpeedScale:
        intensityProfile(useSettingsStore.getState().scareIntensity).lungeSpeed / LUNGE_SPEED_FULL,
    })
    store.setEnemies(ejectFromClosedDoors(result.enemies, closed).slice())

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

/** Door store plus repair stage 1: the barricade only counts once the chapel stage is built. */
function currentBarricade() {
  const d = useDoorStore.getState()
  return barricadeFor(useChapelStore.getState().chapel, { built: d.built, doors: d.doors })
}

/** Block = Aim held with a melee weapon in hand (design bible §4). */
function isBlocking(): boolean {
  if (!input.peek().aim) return false
  const { inventory, equippedSlot } = useInventoryStore.getState()
  const held = equippedSlot === null ? null : hotbarItem(inventory, equippedSlot)
  if (held === null || !(held in WEAPON_MAP)) return false
  const kind = WEAPON_MAP[held as keyof typeof WEAPON_MAP].kind
  return kind === 'melee' || kind === 'heavy'
}

/** A zombie blow on a door: the lowest board takes it, and a broken board is heard and captioned. */
function hitDoor(door: DoorId, enemy: EnemyId, hit: number): void {
  const barricade = currentBarricade()
  const riteActive = useChapelStore.getState().chapel.finalRiteActive
  const res = damageDoor(barricade, door, boardDamageFor(hit, enemy, riteActive))
  if (res.applied <= 0) return
  useDoorStore.getState().setDoors(res.state.doors)
  if (!res.removed) return
  const d = CHAPEL_DOORS[door]
  emit({ type: 'boardBroken', door })
  emitCombatSound('board-break', { x: d.point[0], y: 1, z: d.point[2] }, `board-break-${door}`)
}

function handleEvent(ev: AIEvent): void {
  switch (ev.type) {
    case 'enemyAttack':
      // Father Crane's blows come from the boss director with his own timings (Req 15.8).
      if (ev.enemyType === 'father-crane') break
      if (ev.target !== 'player') {
        hitDoor(ev.target, ev.enemyType, ev.damage)
        break
      }
      // A lurker staged by the scare director may hurt but never deal the killing blow (Req 4.7).
      hurtPlayer(
        isScareEnemy(ev.uid)
          ? capScareDamage(usePlayerStore.getState().health, ev.damage)
          : ev.damage,
        isBlocking(),
        ev.enemyType === 'brute' ? 'brute' : 'zombie',
      )
      if (ev.enemyType === 'brute') {
        emitCombatSound('melee-hit', { x: ev.pos.x, y: 1, z: ev.pos.z })
      }
      break
    case 'bloaterSwell':
      emitCombatSound('bloater-hiss', { x: ev.pos.x, y: 1, z: ev.pos.z })
      break
    case 'bloaterBurst':
      burst(ev.uid, ev.pos)
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
      if (ev.elite) dropEliteLoot(ev.pos)
      break
  }
}

/** Bloater gas: 25 to the player and every other zombie within 3 m; chain kills are credited to the burst. */
function burst(uid: string, pos: { x: number; z: number }): void {
  emitCombatSound('bloater-burst', { x: pos.x, y: 1, z: pos.z })
  gasRuntime.queue.push({ x: pos.x, z: pos.z })
  const store = useEnemyStore.getState()
  const player = usePlayerStore.getState()
  const before = store.enemies
  const res = resolveBurst(
    pos,
    uid,
    store.enemies,
    { x: player.position[0], z: player.position[2] },
    { lanternFuel: useLanternStore.getState().fuel, source: 'burst' },
    player.health,
  )
  store.setEnemies(res.enemies)
  if (res.playerDamage > 0) hurtPlayer(res.playerDamage, false, 'burst')
  for (const ev of killReports(before, res.enemies, 'burst')) emit(ev)
}

/** One elite drop: into the satchel first, and what does not fit lies where it fell. */
function dropEliteLoot(pos: { x: number; z: number }): void {
  const inv = useInventoryStore.getState()
  const drop = rollEliteDrop(dropRng, ownedGuns(inv.inventory, useCombatStore.getState().firearms))
  const placed = placeEliteDrop(
    inv.inventory,
    drop,
    [pos.x, 0.2, pos.z],
    `elite-drop-${++dropCounter}`,
  )
  if (placed.added > 0) inv.setInventory(placed.inv)
  const ground = placed.ground
  if (ground) useSpawnStore.setState((s) => ({ drops: [...s.drops, ground] }))
}
