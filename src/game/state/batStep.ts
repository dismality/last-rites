// One fixed step of the bats (spec 11 H4): seeds them at night start, watches, flees, returns.
// Bats never touch player health and never ask for a screen scare (Req 4.11).
import { BAT } from '../../data/bats'
import { GRAVEYARD_COLLIDERS } from '../../data/graveyardColliders'
import { subscribeToType } from '../events'
import { createRng } from '../rng'
import { bearingDeg, chitterAllowed, createBat, returnBat, stepBat } from '../systems/bats'
import { choosePerches, perchPosition, type PerchBox } from '../systems/batPerches'
import { emitCombatSound } from './combatSounds'
import { useBatStore, type BatEntry } from './batStore'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'

export const PERCH_BOXES: readonly PerchBox[] = GRAVEYARD_COLLIDERS

/** True when a gun went off since the last step; the shot's origin is the player. */
let shotPending = false

/** Listens for firearm shots for as long as the scene is mounted. Returns the unsubscribe. */
export function installBatShotListener(): () => void {
  return subscribeToType('firearmFired', () => {
    shotPending = true
  })
}

export function resetBatRuntime(): void {
  shotPending = false
}

/** Where a bat is standing now (its box's top face), for sounds and the scene. */
export function batPerchPoint(boxIndex: number): readonly [number, number, number] {
  return perchPosition(PERCH_BOXES[boxIndex])
}

function seed(night: number): BatEntry[] {
  const rng = createRng(night * 7919 + 17)
  const spots = choosePerches(PERCH_BOXES, night * 104729 + 3)
  return spots.map((s) => ({ bat: createBat(s.boxIndex, rng() * 360 - 180), fleeYaw: 0 }))
}

/** Advances the bats by `dt` seconds of sim time. */
export function stepBats(dt: number, rng: () => number = Math.random): void {
  const world = useWorldStore.getState()
  const store = useBatStore.getState()
  const shot = shotPending
  shotPending = false

  // Bats are a night thing: they go with the day and are seeded again at the next night's start.
  if (world.phase === 'day' || world.phase === 'dawn') {
    if (store.seededNight !== null || store.entries.length > 0) {
      useBatStore.setState({ seededNight: null, entries: [], lastChitter: null })
    }
    return
  }
  if (world.phase === 'night' && store.seededNight !== world.nightNumber) {
    useBatStore.setState({ seededNight: world.nightNumber, entries: seed(world.nightNumber) })
    return
  }
  if (store.entries.length === 0) return

  const simTime = store.simTime + dt
  const [px, , pz] = usePlayerStore.getState().position
  const occupied = store.entries.filter((e) => e.bat.phase !== 'gone').map((e) => e.bat.boxIndex)
  let changed = false
  const entries = store.entries.map((entry) => {
    const [bx, , bz] = batPerchPoint(entry.bat.boxIndex)
    const dist = Math.hypot(px - bx, pz - bz)
    const { bat } = entry
    if (bat.phase === 'perched') {
      // Far perched bats skip the update, unless a shot is near enough to matter.
      if (dist > BAT.skipUpdateM) return entry
      const next = stepBat(
        bat,
        { playerDist: dist, shotDist: shot ? dist : null, bearing: bearingDeg(bx, bz, px, pz) },
        dt,
      )
      changed = true
      if (next.phase === 'fleeing') return { bat: next, fleeYaw: bearingDeg(px, pz, bx, bz) }
      return { ...entry, bat: next }
    }
    changed = true
    if (bat.phase === 'gone') {
      const back = returnBat(stepBat(bat, { playerDist: dist, shotDist: null, bearing: 0 }, dt), PERCH_BOXES, occupied, rng, rng() * 360 - 180)
      if (back.phase === 'perched') occupied.push(back.boxIndex)
      return { ...entry, bat: back }
    }
    return { ...entry, bat: stepBat(bat, { playerDist: dist, shotDist: null, bearing: 0 }, dt) }
  })

  let lastChitter = store.lastChitter
  const perched = entries.filter((e) => e.bat.phase === 'perched')
  if (chitterAllowed(lastChitter, simTime, perched.length) && rng() < BAT.chitterRatePerS * dt) {
    // Only a bat the player can actually hear (inside the watch range) chitters.
    let best: { d: number; at: readonly [number, number, number] } | null = null
    for (const e of perched) {
      const at = batPerchPoint(e.bat.boxIndex)
      const d = Math.hypot(px - at[0], pz - at[2])
      if (d <= BAT.watchRangeM && (best === null || d < best.d)) best = { d, at }
    }
    if (best) {
      emitCombatSound('bat-chitter', { x: best.at[0], y: best.at[1], z: best.at[2] })
      lastChitter = simTime
    }
  }
  useBatStore.setState({ simTime, lastChitter, ...(changed ? { entries } : {}) })
}
