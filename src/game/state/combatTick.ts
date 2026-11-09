// Fixed-step glue for weapons and timed effects (design "Fixed step", steps 1 to 6).
// Called once per fixed step from TickDriver after the dig step. Reads stores, holds no rules.
//
// HUD-visible timers (reload, charge, consumable use, effects) are advanced here at full
// precision in a private shadow and written to their stores only when the displayed value
// (tenths of a second) changes, so a 60 Hz sim does not cause 60 Hz React renders.

import { INTERACT_RANGE_M } from '../../data/balance'
import { DOORS } from '../../data/barricades'
import { BOSS } from '../../data/boss'
import { CHAPEL_DOORS, CONGREGATION_POINTS, CRANE_SPAWN } from '../../data/cemeteryLayout'
import { FIREARM_MAP } from '../../data/firearms'
import { WEAPON_MAP } from '../../data/weapons'
import { emit } from '../events'
import { swingHits, tickBoss, tollHits, type BossEvent } from '../systems/bossDirector'
import type { Vec2 } from '../systems/combat'
import { createEnemy } from '../systems/enemyAI'
import type { SaltCircle } from '../systems/projectiles'
import { nailBoard, tickNailing, type BarricadeState, type NailProgress } from '../systems/barricade'
import { tickNumbers } from '../systems/damageNumbers'
import { tickHitMarker } from '../systems/hitMarker'
import { applyEffect, effectMods, tickEffects, withSaltEffect, type ActiveEffect } from '../systems/effects'
import { completeReload, reloadReady, tickFirearm, type FirearmState } from '../systems/firearm'
import { heavyStatsFor, tickCharge, type ChargeState } from '../systems/heavyAttack'
import { tickDodge } from '../systems/dodge'
import { tickUse, type ConsumableUseState } from '../systems/consumables'
import { countItem, removeItem } from '../systems/inventory'
import { firearmStats } from '../systems/upgrades'
import type { FirearmId, HeavyMeleeId, ItemId } from '../types'
import { useBossStore } from './bossStore'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useMysteryStore } from './mysteryStore'
import { queuePlayerPush } from './playerPush'
import { hurtPlayer } from './retryNight'
import { emitCombatSound } from './combatSounds'
import { useCombatStore, type CombatLive } from './combatStore'
import { useDoorStore } from './doorStore'
import { useEffectStore } from './effectStore'
import { useFeedbackStore } from './feedbackStore'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { useLanternStore } from './lanternStore'
import { isSimFrozen } from './menuState'
import { usePlayerStore } from './playerStore'
import { useProjectileStore } from './projectileStore'
import { useSettingsStore } from './settingsStore'
import { useToastStore } from './toastStore'
import { setSprintDrainMult } from './staminaRuntime'

/** Sampled by the driver so game/ never imports the scene. Steps 7 to 9 read it. */
export interface CombatTickInput {
  interactHeld: boolean
  moving: boolean
  playerPos: readonly [number, number, number]
}

type Reload = NonNullable<CombatLive['reload']>

/** A precise value plus the object last written to the store, to spot outside changes. */
interface Shadow<T> {
  value: T
  published: T
}

let reloadShadow: Shadow<Reload> | null = null
let chargeShadow: Shadow<ChargeState> | null = null
let useShadow: Shadow<ConsumableUseState> | null = null
/** Where the player stood when the current nail began, to measure travel. */
let nailStart: readonly [number, number, number] | null = null
let effectsShadow: { value: readonly ActiveEffect[]; published: readonly ActiveEffect[] } | null = null

export function resetCombatTickRuntime(): void {
  reloadShadow = null
  chargeShadow = null
  useShadow = null
  effectsShadow = null
  nailStart = null
}

/** Full-precision timers, for tests. */
export function readPreciseTimers(): {
  reloadLeftS: number | null
  chargeS: number | null
  useElapsedS: number | null
  effects: readonly ActiveEffect[]
} {
  return {
    reloadLeftS: reloadShadow?.value.leftS ?? null,
    chargeS: chargeShadow?.value.heldS ?? null,
    useElapsedS: useShadow?.value.elapsed ?? null,
    effects: effectsShadow?.value ?? [],
  }
}

/** Re-reads the shadow when something else (an action, a cancel, a clear) wrote the store. */
function syncShadow<T>(shadow: Shadow<T> | null, stored: T | null): Shadow<T> | null {
  if (stored === null) return null
  if (shadow === null || shadow.published !== stored) return { value: stored, published: stored }
  return shadow
}

const tenths = (x: number): number => Math.ceil(x * 10 - 1e-9)

const isFirearm = (id: ItemId | null): id is FirearmId => id === 'revolver' || id === 'shotgun'
const isHeavy = (id: ItemId | null): id is HeavyMeleeId => id === 'wood-axe' || id === 'silver-sabre'

const dec = (x: number, dt: number): number => (x > 0 ? Math.max(0, x - dt) : 0)

/** Step 2: firearm timers and reload completion. */
function stepFirearm(dt: number, live: CombatLive, patch: Partial<CombatLive>): void {
  const held = live.heldId
  if (!isFirearm(held)) return
  const combat = useCombatStore.getState()
  const mag = combat.firearms[held]
  if (!mag) return
  const st = firearmStats(held, combat.upgrades)
  const fire = { capacity: st.capacity, reloadS: st.reloadS, fireIntervalS: st.fireIntervalS }

  reloadShadow = syncShadow(reloadShadow, live.reload)
  const state: FirearmState = {
    magazine: mag.magazine,
    reloadLeftS: reloadShadow ? reloadShadow.value.leftS : null,
    sinceShotS: live.sinceShotS,
  }
  const next = tickFirearm(state, dt)
  // Clamped at the fire interval: once the gun is ready there is nothing left to count.
  const since = Math.min(next.sinceShotS, st.fireIntervalS)
  if (since !== live.sinceShotS) patch.sinceShotS = since

  if (reloadShadow && reloadReady(next)) {
    const inv = useInventoryStore.getState().inventory
    const ammo = FIREARM_MAP[held].ammo
    const done = completeReload(next, fire, countItem(inv, ammo))
    if (done.ammoUsed > 0) {
      useInventoryStore.getState().setInventory(removeItem(inv, ammo, done.ammoUsed).inv)
    }
    combat.setMagazine(held, done.state.magazine)
    reloadShadow = null
    patch.reload = null
    emitCombatSound('reload')
    return
  }
  if (reloadShadow && next.reloadLeftS !== null) {
    const value: Reload = { ...reloadShadow.value, leftS: next.reloadLeftS }
    const shown = tenths(value.leftS) !== tenths(reloadShadow.published.leftS)
    if (shown) {
      patch.reload = value
      reloadShadow = { value, published: value }
    } else {
      reloadShadow = { value, published: reloadShadow.published }
    }
  }
}

/** Step 3: heavy charge. The release itself belongs to MeleeAttack. */
function stepCharge(dt: number, live: CombatLive, patch: Partial<CombatLive>): void {
  chargeShadow = syncShadow(chargeShadow, live.charge)
  const held = live.heldId
  if (!chargeShadow || !isHeavy(held)) return
  const chargeS = heavyStatsFor(held, useCombatStore.getState().upgrades).chargeS
  const r = tickCharge(chargeShadow.value, dt, chargeS)
  const shown = (c: ChargeState) => Math.floor((c.heldS / chargeS) * 10 + 1e-9)
  const pending = live.releaseRequest !== null
  let published = chargeShadow.published
  if (shown(r.charge) !== shown(published) || (r.autoRelease && !pending)) {
    patch.charge = r.charge
    published = r.charge
  }
  chargeShadow = { value: r.charge, published }
  if (r.autoRelease && !pending) patch.releaseRequest = 'heavy'
}

/** Step 4: kick, dodge and "too tired" timers. */
function stepMoveTimers(dt: number, live: CombatLive, patch: Partial<CombatLive>): void {
  if (live.kickLeftS > 0) patch.kickLeftS = dec(live.kickLeftS, dt)
  if (live.dodgeCooldownS > 0) patch.dodgeCooldownS = dec(live.dodgeCooldownS, dt)
  if (live.tooTiredS > 0) patch.tooTiredS = dec(live.tooTiredS, dt)
  if (live.dodge) patch.dodge = tickDodge(live.dodge, dt)
  const tired = (patch.tooTiredS ?? live.tooTiredS) > 0
  if (useFeedbackStore.getState().tooTired !== tired) useFeedbackStore.getState().setTooTired(tired)
}

/** Step 5: consumable use. Returns an effect to apply at step 6, if any. */
function stepUse(dt: number, live: CombatLive, patch: Partial<CombatLive>): ReturnType<typeof tickUse>['effect'] {
  useShadow = syncShadow(useShadow, live.use)
  if (!useShadow) return undefined
  const inv = useInventoryStore.getState().inventory
  if (countItem(inv, useShadow.value.item) <= 0) {
    useShadow = null
    patch.use = null
    return undefined
  }
  const r = tickUse(dt, useShadow.value)
  if (!r.applied) {
    const shown = Math.floor(r.state.elapsed * 10 + 1e-9) !== Math.floor(useShadow.published.elapsed * 10 + 1e-9)
    if (shown) patch.use = r.state
    useShadow = { value: r.state, published: shown ? r.state : useShadow.published }
    return undefined
  }
  const e = r.effect!
  const player = usePlayerStore.getState()
  if (e.healHp > 0) player.setHealth(Math.min(player.maxHealth, player.health + e.healHp))
  if (e.addFuel > 0) {
    const lantern = useLanternStore.getState()
    lantern.setFuel(Math.min(100, lantern.fuel + e.addFuel))
  }
  useInventoryStore.getState().setInventory(removeItem(inv, useShadow.value.item, 1).inv)
  useShadow = null
  patch.use = null
  return e
}

const effectsKey = (list: readonly ActiveEffect[]): string =>
  list.map((e) => `${e.id}:${tenths(e.leftS)}`).join('|')

/** Step 6: timed effects and the derived Salt Circle entry. */
function stepEffects(dt: number, applied: ReturnType<typeof tickUse>['effect']): void {
  const store = useEffectStore.getState()
  if (!effectsShadow || effectsShadow.published !== store.effects) {
    effectsShadow = { value: store.effects, published: store.effects }
  }
  let list: readonly ActiveEffect[] = tickEffects(effectsShadow.value, dt)
  if (applied?.effect) {
    list = applyEffect(list, applied.effect)
    emitCombatSound('effect-apply')
  }
  list = withSaltEffect(list, useProjectileStore.getState().salts)
  const mods = effectMods(list)
  setSprintDrainMult(mods.sprintDrain)
  if (effectsKey(list) !== effectsKey(effectsShadow.published)) {
    store.setEffects(list)
    effectsShadow = { value: list, published: list }
  } else {
    effectsShadow = { value: list, published: effectsShadow.published }
  }
}

/** Step 7: hold-to-nail. A started nail lives in the door store; this advances it and finishes it. */
function stepNailing(dt: number, input: CombatTickInput): void {
  const doors = useDoorStore.getState()
  const nail: NailProgress | null = doors.nail
  if (!nail) {
    nailStart = null
    return
  }
  nailStart ??= input.playerPos
  const [sx, , sz] = nailStart
  const travel = Math.hypot(input.playerPos[0] - sx, input.playerPos[2] - sz)
  const [dx, , dz] = CHAPEL_DOORS[nail.door].point
  const r = tickNailing(nail, dt, {
    held: input.interactHeld,
    moved: travel > DOORS.nailMoveEpsM,
    damaged: false, // playerDamaged clears the nail through combatWatchers before this runs
    inRange: Math.hypot(input.playerPos[0] - dx, input.playerPos[2] - dz) <= INTERACT_RANGE_M,
  })
  if (!r.done) {
    doors.setNail(r.nail)
    if (!r.nail) nailStart = null
    return
  }
  nailStart = null
  doors.setNail(null)
  const inv = useInventoryStore.getState().inventory
  const state: BarricadeState = { built: doors.built, doors: doors.doors }
  const res = nailBoard(state, inv, nail.door, DOORS.boardHp)
  if (!res.ok) return // the satchel changed mid-hold: nothing is spent
  useInventoryStore.getState().setInventory(res.inv)
  doors.setDoors(res.state.doors)
  const [x, y, z] = CHAPEL_DOORS[nail.door].point
  emit({ type: 'boardNailed', door: nail.door })
  emitCombatSound('board-nail', { x, y, z })
  useToastStore.getState().push(`Board nailed (${res.state.doors[nail.door].length}/${DOORS.slots})`)
}

/** Where Father Crane climbs out: the stair if the catacomb gate was opened, else the floor (Req 17.2). */
export function craneSpawnPoint(catacombOpen: boolean): Vec2 {
  const [x, , z] = catacombOpen ? CRANE_SPAWN.stair : CRANE_SPAWN.floorBreak
  return { x, z }
}

let bossUid = 0

const inSaltCircle = (pos: Vec2, salts: readonly SaltCircle[]): boolean => {
  const r = WEAPON_MAP['salt-circle'].radius ?? 0
  return salts.some((c) => Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) <= r)
}

const at = (p: Vec2): { x: number; y: number; z: number } => ({ x: p.x, y: 0, z: p.z })

/** Turns one boss event into its world effect, sound and caption. */
function applyBossEvent(e: BossEvent, player: Vec2): void {
  const enemies = useEnemyStore.getState()
  switch (e.type) {
    case 'riseTelegraph': {
      const spawn = craneSpawnPoint(useMysteryStore.getState().mystery.gates.catacombs)
      emitCombatSound('boss-rise', at(spawn))
      break
    }
    case 'spawn': {
      const p = craneSpawnPoint(useMysteryStore.getState().mystery.gates.catacombs)
      const rest = enemies.enemies.filter((z) => z.type !== 'father-crane')
      enemies.setEnemies([...rest, createEnemy(`crane-${bossUid++}`, 'father-crane', p)])
      emit({ type: 'bossRisen' })
      break
    }
    case 'swingStart':
      emitCombatSound('heavy-swing')
      break
    case 'swingHit':
      if (swingHits(e.origin, e.dir, player)) hurtPlayer(BOSS.censer.damage, false, 'swing')
      break
    case 'tollStart':
      emitCombatSound('toll')
      break
    case 'tollRing': {
      emitCombatSound('toll', at(e.center))
      // A dodge's invulnerable window makes hurtPlayer refuse, which also skips the push.
      if (tollHits(e.center, player) && hurtPlayer(BOSS.toll.damage, false, 'toll')) {
        queuePlayerPush(player.x - e.center.x, player.z - e.center.z, BOSS.toll.pushM)
      }
      break
    }
    case 'congregationStart':
      emitCombatSound('congregation')
      break
    case 'congregationRise': {
      const risen = CONGREGATION_POINTS.slice(0, BOSS.congregation.count).map(([x, , z]) =>
        createEnemy(`cong-${bossUid++}`, 'shambler', { x, z }),
      )
      enemies.setEnemies([...enemies.enemies, ...risen])
      break
    }
    case 'quietEnded':
      emitCombatSound('boss-death')
      emit({ type: 'bossDefeated' })
      useMysteryStore.getState().recordCraneRested()
      break
    case 'phase':
    case 'deathStart':
      break
  }
}

/** Step 8: the boss director. Crane is read from the enemy store; a missing body holds state. */
function stepBoss(dt: number, input: CombatTickInput): void {
  const bossStore = useBossStore.getState()
  const crane = useEnemyStore.getState().enemies.find((z) => z.type === 'father-crane')
  const player: Vec2 = { x: input.playerPos[0], z: input.playerPos[2] }
  const r = tickBoss(bossStore.boss, {
    dt,
    riteStarted: useEndingStore.getState().riteStarted,
    playerDead: useGameStore.getState().taken,
    player,
    crane: crane
      ? {
          hp: crane.hp,
          maxHp: crane.maxHp,
          pos: crane.pos,
          inSalt: inSaltCircle(crane.pos, useProjectileStore.getState().salts),
        }
      : null,
  })
  if (r.state !== bossStore.boss) bossStore.setBoss(r.state)
  for (const e of r.events) applyBossEvent(e, player)
}

/** Step 9: hit marker and damage number lifetimes. Only writes when something is showing. */
function stepFeedback(dt: number): void {
  const fb = useFeedbackStore.getState()
  if (fb.marker) {
    fb.setMarker(tickHitMarker(fb.marker, dt, useSettingsStore.getState().flashingLights))
  }
  if (fb.numbers.length > 0) fb.setNumbers(tickNumbers(fb.numbers, dt))
}

/** One fixed step of weapons and effects. Returns at once when taken or frozen. */
export function tickCombat(dt: number, input: CombatTickInput): void {
  if (useGameStore.getState().taken || isSimFrozen()) return
  if (!Number.isFinite(dt) || dt <= 0) return

  // 1. Reconcile weapon state with the satchel; a changed held item cancels reload/charge/use.
  useCombatStore.getState().reconcile(useInventoryStore.getState().inventory)
  const live = useCombatStore.getState().live

  const patch: Partial<CombatLive> = {}
  stepFirearm(dt, live, patch)
  stepCharge(dt, live, patch)
  stepMoveTimers(dt, live, patch)
  const applied = stepUse(dt, live, patch)
  if (Object.keys(patch).length > 0) useCombatStore.getState().patchLive(patch)
  stepEffects(dt, applied)
  stepNailing(dt, input)
  stepBoss(dt, input)
  stepFeedback(dt)
}
