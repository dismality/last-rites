// Combat actions the scene drivers call (design: "Actions"). Plain functions that return what
// happened, so tests need no React. This file holds the firearm actions; later tasks add more.
import { DODGE, KICK } from '../../data/combatMoves'
import { FIREARM_MAP, SHOTGUN_BRUTE_KNOCKDOWN } from '../../data/firearms'
import { emit } from '../events'
import { applyDamage, type Vec2 } from '../systems/combat'
import { isConsumable, startUse, tickUse, type ConsumableId } from '../systems/consumables'
import { canDodge, startDodge } from '../systems/dodge'
import { applyEffect, effectMods } from '../systems/effects'
import { heavyStatsFor, resolveRelease, type HeavyStats, type ReleaseKind } from '../systems/heavyAttack'
import { canKick, resolveKick } from '../systems/kick'
import { forwardFromYaw, spawnDust } from '../systems/melee'
import { meleeRuntime } from '../../scene/player/meleeRuntime'
import type { SegmentBlocked } from '../systems/navigation'
import type { AIEnemy, AIEvent } from '../systems/enemyAI'
import { canReload, pullTrigger, startReload } from '../systems/firearm'
import type { FirearmState, TriggerOutcome } from '../systems/firearm'
import { markAttack } from '../systems/hitMarker'
import { spawnNumbers } from '../systems/damageNumbers'
import { countItem, removeItem } from '../systems/inventory'
import { applyKnockdown, shotKnocksDown } from '../systems/knockdown'
import { applyNoise } from '../systems/noise'
import type { NoiseEvent } from '../systems/noise'
import { capsuleFor, resolveShot } from '../systems/ballistics'
import type { ShotHit, WallDistance } from '../systems/ballistics'
import type { Vec3 } from '../systems/projectiles'
import { recoilKickDeg } from '../systems/recoil'
import { hotbarItem } from '../systems/satchel'
import { firearmStats, missingReason } from '../systems/upgrades'
import type { WeaponPickupId } from '../../data/weaponPickups'
import { ITEM_MAP } from '../../data/items'
import { UPGRADE_MAP } from '../../data/upgrades'
import { nailPrompt } from '../systems/barricade'
import type { CraftedItemId, DoorId, FirearmId, HeavyMeleeId, ItemId, UpgradeId } from '../types'
import { useDoorStore } from './doorStore'
import { useToastStore } from './toastStore'
import { emitCombatSound } from './combatSounds'
import { useCombatStore } from './combatStore'
import { useEffectStore } from './effectStore'
import { useEnemyStore } from './enemyStore'
import { useFeedbackStore } from './feedbackStore'
import { useInventoryStore } from './inventoryStore'
import { useLanternStore } from './lanternStore'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'
import { setSprintDrainMult, spendStamina } from './staminaRuntime'

/** Chest height of a standing zombie, where the kill puff starts. */
const KILL_DUST_Y = 1.0

const FIREARM_IDS: readonly FirearmId[] = ['revolver', 'shotgun']

/** Camera snapshot for one trigger pull; the weapon controller builds it each frame. */
export interface FireInput {
  origin: Vec3
  /** Aim direction with the recoil offset already applied. */
  aim: Vec3
  aiming: boolean
  /** Rapier wall distance in the scene; no walls when absent. */
  wall?: WallDistance
  seed?: number
}

export interface FireResult {
  outcome: TriggerOutcome | 'no-firearm'
  weapon: FirearmId | null
  hits: ShotHit[]
  kills: string[]
  /** One per trigger pull that fired, however many pellets. */
  noise: NoiseEvent | null
  aiEvents: AIEvent[]
  /** Upward camera kick in degrees, for the recoil state; 0 when nothing fired. */
  recoilKickDeg: number
  recoilRecoverS: number
}

const NO_FIRE: FireResult = {
  outcome: 'no-firearm',
  weapon: null,
  hits: [],
  kills: [],
  noise: null,
  aiEvents: [],
  recoilKickDeg: 0,
  recoilRecoverS: 0,
}

function heldFirearm(): FirearmId | null {
  const { inventory, equippedSlot } = useInventoryStore.getState()
  const id: ItemId | null = equippedSlot === null ? null : hotbarItem(inventory, equippedSlot)
  return FIREARM_IDS.find((f) => f === id) ?? null
}

function firearmState(weapon: FirearmId): FirearmState {
  const { firearms, live } = useCombatStore.getState()
  const reload = live.reload && live.reload.weapon === weapon ? live.reload.leftS : null
  return { magazine: firearms[weapon]?.magazine ?? 0, reloadLeftS: reload, sinceShotS: live.sinceShotS }
}

/**
 * Pulls the trigger of the firearm in hand. A shot spends one round and raises one noise
 * event, however many pellets it throws. A dry pull clicks and raises nothing (Req 3.9, 6.2).
 */
export function fireHeld(input: FireInput): FireResult {
  const weapon = heldFirearm()
  const combat = useCombatStore.getState()
  if (!weapon || !combat.firearms[weapon]) return NO_FIRE

  const stats = firearmStats(weapon, combat.upgrades)
  const pull = pullTrigger(firearmState(weapon), stats)
  const at = { x: input.origin.x, y: input.origin.y, z: input.origin.z }
  const refused: FireResult = { ...NO_FIRE, outcome: pull.outcome, weapon }

  if (pull.outcome === 'dry') {
    emitCombatSound('dry-click', at)
    return refused
  }
  if (pull.outcome !== 'fired') return refused

  combat.setMagazine(weapon, pull.state.magazine)
  combat.patchLive({ sinceShotS: 0 })

  const enemies = useEnemyStore.getState().enemies
  const blessed = effectMods(useEffectStore.getState().effects).firearmDamage > 1
  const { hits } = resolveShot(
    {
      weapon,
      origin: input.origin,
      aim: input.aim,
      aiming: input.aiming,
      stats,
      blessed,
      seed: input.seed ?? Math.floor(Math.random() * 0x7fffffff),
    },
    enemies.filter((e) => e.hp > 0).map(capsuleFor),
    input.wall ?? (() => Infinity),
  )

  const byUid = new Map(hits.map((h) => [h.uid, h]))
  const ctx = { lanternFuel: useLanternStore.getState().fuel, source: weapon }
  const kills: string[] = []
  const killEvents: AIEnemy[] = []
  let next: AIEnemy[] = enemies.map((e) => {
    const hit = byUid.get(e.uid)
    if (!hit || e.hp <= 0) return e
    // Damage first, so the blast that knocks a Brute down does not get the x1.25.
    const hurt = applyDamage(e, hit.damage, ctx)
    if (hurt.hp <= 0) {
      kills.push(e.uid)
      killEvents.push(e)
      return hurt
    }
    return weapon === 'shotgun' && shotKnocksDown(e.type, hit.nearestM)
      ? applyKnockdown(hurt, SHOTGUN_BRUTE_KNOCKDOWN.durationS)
      : hurt
  })

  // One noise event per pull; dead zombies are excluded by the rule itself.
  const noise: NoiseEvent = {
    pos: { x: input.origin.x, z: input.origin.z },
    radiusM: stats.noiseRadiusM,
  }
  const heard = applyNoise(next, noise)
  next = heard.enemies
  if (hits.length > 0 || next.some((e, i) => e !== enemies[i])) useEnemyStore.getState().setEnemies(next)

  for (const e of killEvents) {
    const hit = byUid.get(e.uid)!
    // Kill feedback (Req 10.3): a dust puff from the body, never gore.
    meleeRuntime.dustQueue.push(...spawnDust({ x: e.pos.x, y: KILL_DUST_Y, z: e.pos.z }, Math.random))
    emit({
      type: 'enemyKilled',
      uid: e.uid,
      enemy: e.type,
      source: weapon,
      headshot: hit.headshot,
      elite: e.elite,
    })
  }
  emit({ type: 'firearmFired', weapon, hit: hits.length > 0 })

  const settings = useSettingsStore.getState()
  const fb = useFeedbackStore.getState()
  fb.setMarker(
    markAttack(fb.marker, {
      zombiesHit: hits.length,
      kills: kills.length,
      headshots: hits.filter((h) => h.headshot).length,
    }),
  )
  if (hits.length > 0) {
    const spawned = spawnNumbers(
      fb.numbers,
      hits.map((h) => ({ point: [h.point.x, h.point.y, h.point.z] as const, damage: h.damage, headshot: h.headshot })),
      settings.damageNumbers,
      fb.nextNumberId,
    )
    fb.setNumbers(spawned.list, spawned.nextId)
  }
  emitCombatSound(weapon === 'revolver' ? 'revolver-shot' : 'shotgun-blast', at)

  return {
    outcome: 'fired',
    weapon,
    hits,
    kills,
    noise,
    aiEvents: heard.events,
    recoilKickDeg: recoilKickDeg(stats.recoilUpDeg, settings.cameraShake),
    recoilRecoverS: stats.recoilRecoverS,
  }
}

/** Starts a reload of the firearm in hand when there is room and spare ammunition. */
export function reloadHeld(): boolean {
  const weapon = heldFirearm()
  if (!weapon) return false
  const combat = useCombatStore.getState()
  if (!combat.firearms[weapon]) return false
  const stats = firearmStats(weapon, combat.upgrades)
  const spare = countItem(useInventoryStore.getState().inventory, FIREARM_MAP[weapon].ammo)
  const state = firearmState(weapon)
  if (!canReload(state, stats, spare)) return false
  const started = startReload(state, stats, spare)
  combat.patchLive({ reload: { weapon, leftS: started.reloadLeftS!, totalS: stats.reloadS } })
  emitCombatSound('reload')
  return true
}

/** How long the "Too tired" cue shows (bible §4: 1 s). */
const TOO_TIRED_CUE_S = 1

const HEAVY_IDS: readonly HeavyMeleeId[] = ['wood-axe', 'silver-sabre']

export interface HeavyReleaseResult {
  /** 'none' when no charge was running for this weapon; nothing changed then. */
  kind: ReleaseKind | 'none'
  tooTired: boolean
  staminaSpent: number
  /** Knockdown seconds to pass to the melee resolver: set only for a heavy release. */
  knockdownS: number
  /** Per-swing stats (upgrades applied) for the caller's damage and Wailer bonus. */
  stats: HeavyStats | null
}

/**
 * Ends the heavy charge of `kind` (the weapon in hand). A full charge with enough stamina is
 * a heavy attack and pays its cost; a full charge without it falls back to a normal swing,
 * pays nothing and raises the "Too tired" cue. An early release is a normal swing (Req 8.2, 8.4, 8.5).
 */
export function releaseHeavy(kind: HeavyMeleeId): HeavyReleaseResult {
  const none: HeavyReleaseResult = { kind: 'none', tooTired: false, staminaSpent: 0, knockdownS: 0, stats: null }
  const combat = useCombatStore.getState()
  const charge = combat.live.charge
  if (!HEAVY_IDS.includes(kind) || !charge || combat.live.heldId !== kind) return none

  const stats = heavyStatsFor(kind, combat.upgrades)
  let res = resolveRelease(charge, stats, usePlayerStore.getState().stamina)
  // Spend through the runtime so the next tick cannot undo it; a refusal there means too tired.
  if (res.kind === 'heavy' && !spendStamina(res.staminaSpent)) {
    res = { kind: 'normal', tooTired: true, staminaSpent: 0 }
  }
  combat.patchLive({
    charge: null,
    releaseRequest: null,
    ...(res.tooTired ? { tooTiredS: TOO_TIRED_CUE_S } : {}),
  })
  if (res.tooTired) useFeedbackStore.getState().setTooTired(true)
  if (res.kind === 'heavy') emitCombatSound('heavy-swing')
  return {
    kind: res.kind,
    tooTired: res.tooTired,
    staminaSpent: res.staminaSpent,
    knockdownS: res.kind === 'heavy' ? stats.knockdownS : 0,
    stats,
  }
}

export interface KickOutcome {
  performed: boolean
  targetUid: string | null
  killed: boolean
}

/**
 * Kick: 15 stamina and a 1.2 s cooldown, spent even when nothing is in the cone (Req 9.8).
 * A press without the stamina or during the cooldown changes nothing (Req 9.7).
 */
export function kick(blocked?: SegmentBlocked): KickOutcome {
  const combat = useCombatStore.getState()
  const player = usePlayerStore.getState()
  if (!canKick(player.stamina, combat.live.kickLeftS) || !spendStamina(KICK.staminaCost)) {
    return { performed: false, targetUid: null, killed: false }
  }
  combat.patchLive({ kickLeftS: KICK.cooldownS })
  emitCombatSound('kick')

  const enemies = useEnemyStore.getState().enemies
  const origin = { x: player.position[0], z: player.position[2] }
  const r = resolveKick(
    origin,
    forwardFromYaw(player.yaw),
    enemies,
    { lanternFuel: useLanternStore.getState().fuel },
    blocked,
  )
  if (r.targetUid === null) return { performed: true, targetUid: null, killed: false }

  useEnemyStore.getState().setEnemies(r.enemies)
  const target = enemies.find((e) => e.uid === r.targetUid)!
  if (r.killed) {
    emit({ type: 'enemyKilled', uid: target.uid, enemy: target.type, source: 'kick', headshot: false, elite: target.elite })
  }
  const fb = useFeedbackStore.getState()
  fb.setMarker(markAttack(fb.marker, { zombiesHit: 1, kills: r.killed ? 1 : 0, headshots: 0 }))
  return { performed: true, targetUid: r.targetUid, killed: r.killed }
}

/**
 * Dodge: 25 stamina, 0.8 s cooldown, dash direction from the movement input (backwards with
 * none). The controller reads `live.dodge` for the dash itself (Req 9.4, 9.7).
 */
export function dodge(moveDir: Vec2 = { x: 0, z: 0 }): boolean {
  const combat = useCombatStore.getState()
  const player = usePlayerStore.getState()
  if (!canDodge(player.stamina, combat.live.dodgeCooldownS, combat.live.dodge !== null)) return false
  if (!spendStamina(DODGE.staminaCost)) return false
  combat.patchLive({
    dodge: startDodge(moveDir, forwardFromYaw(player.yaw)),
    dodgeCooldownS: DODGE.cooldownS,
    // A dash cancels a charge in progress, with nothing spent (Req 8.12).
    charge: null,
    releaseRequest: null,
  })
  emitCombatSound('dodge')
  return true
}

export interface UseOutcome {
  started: boolean
  /** True for Blessed Rounds and Kola Tonic, which take effect at once. */
  instant: boolean
  item: ConsumableId | null
}

/**
 * Uses the consumable in hand. Bandage and Lantern Refill start a timed use that the combat
 * tick finishes; Blessed Rounds and Kola Tonic apply their effect now and take one item.
 */
export function useHeld(): UseOutcome {
  const none: UseOutcome = { started: false, instant: false, item: null }
  const { inventory, equippedSlot } = useInventoryStore.getState()
  const held = equippedSlot === null ? null : hotbarItem(inventory, equippedSlot)
  if (!held || !isConsumable(held as CraftedItemId)) return none
  const item = held as ConsumableId
  if (countItem(inventory, item) <= 0) return none
  const combat = useCombatStore.getState()
  if (combat.live.use) return none

  const use = startUse(item)
  if (use.duration > 0) {
    combat.patchLive({ use })
    return { started: true, instant: false, item }
  }
  const effect = tickUse(0, use).effect
  if (effect?.effect) {
    const list = applyEffect(useEffectStore.getState().effects, effect.effect)
    useEffectStore.getState().setEffects(list)
    setSprintDrainMult(effectMods(list).sprintDrain)
  }
  useInventoryStore.getState().setInventory(removeItem(inventory, item, 1).inv)
  emitCombatSound('effect-apply')
  return { started: true, instant: true, item }
}

export type PickupOutcome = { taken: true; message: string } | { taken: false; message: string }

/**
 * Takes a weapon pickup (all-or-nothing). Success binds the weapon to the first empty hotbar
 * slot inside the rule; a refusal leaves the satchel and the pickup untouched (Req 2.1-2.6).
 */
export function takeWeaponPickup(id: WeaponPickupId): PickupOutcome {
  const res = useCombatStore.getState().takePickup(id)
  const toasts = useToastStore.getState()
  if (!res.ok) {
    toasts.push(res.message)
    return { taken: false, message: res.message }
  }
  const message = `Took the ${ITEM_MAP[id]?.name ?? id}`
  toasts.push(message)
  return { taken: true, message }
}

export type UpgradeOutcome = { bought: true } | { bought: false; message: string }

/** Buys a workbench upgrade: the whole cost and the record land together or not at all (Req 11.2, 11.5). */
export function buyUpgrade(id: UpgradeId): UpgradeOutcome {
  const res = useCombatStore.getState().buyUpgrade(id)
  if (res.ok) {
    useToastStore.getState().push(`Upgraded: ${UPGRADE_MAP[id].name}`)
    return { bought: true }
  }
  const message =
    res.reason === 'missing'
      ? missingReason(res.missing ?? [])
      : res.reason === 'already-bought'
        ? 'Already bought'
        : 'Weapon not owned'
  return { bought: false, message }
}

export type NailStart = { started: true } | { started: false; text: string }

/** Starts the hold-to-nail timer on a door, or refuses with the prompt text (Req 16.4). */
export function startNail(door: DoorId): NailStart {
  const doors = useDoorStore.getState()
  if (doors.nail) return { started: false, text: 'Already nailing' }
  const prompt = nailPrompt(
    { built: doors.built, doors: doors.doors },
    useInventoryStore.getState().inventory,
    door,
  )
  if (!prompt.canStart) return { started: false, text: prompt.text }
  doors.setNail({ door, elapsedS: 0 })
  return { started: true }
}

/** Drops a running reload, e.g. when the weapon is switched or the player is hit by a Brute. */
export function cancelHeldReload(): void {
  const { live, patchLive } = useCombatStore.getState()
  if (live.reload) patchLive({ reload: null })
}
