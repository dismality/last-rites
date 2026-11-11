// Melee driver: turns the Attack input into a swing, and at the swing's midpoint
// asks the pure combat code who was hit. Heavy weapons (axe, sabre) charge while Attack is
// held, or by themselves after the V key; the release rules live in combatActions.releaseHeavy.
// Aim held with a melee weapon is the block. No rules live here (see systems/melee.ts).
// Requirements 5.3, 8.1-8.6, 8.10-8.12.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { playMeleeHit } from '../../audio/AudioManager'
import { ITEM_MAP } from '../../data/items'
import { WEAPON_MAP } from '../../data/weapons'
import {
  useEnemyStore,
  useGameStore,
  useInventoryStore,
  useLanternStore,
  usePlayerStore,
  useSettingsStore,
} from '../../game/state'
import { releaseHeavy } from '../../game/state/combatActions'
import { emitCombatSound } from '../../game/state/combatSounds'
import { useCombatStore } from '../../game/state/combatStore'
import { isSimFrozen } from '../../game/state/menuState'
import { useToastStore } from '../../game/state/toastStore'
import { startCharge, type HeavyStats } from '../../game/systems/heavyAttack'
import { removeItem } from '../../game/systems/inventory'
import { crossedCracking, nextSlotAfterBreak } from '../../game/systems/weaponBreak'
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
import type { CraftedItemId, HeavyMeleeId } from '../../game/types'
import { emit } from '../../game/events'
import { meleeHitEvents } from './meleeEvents'
import { killReports } from '../../game/systems/killReports'
import { input } from './input'
import { meleeRuntime } from './meleeRuntime'

const MAX_DT = 0.1
/** Dust bursts from roughly chest height. */
const DUST_Y = 1.0
const HOTBAR_SLOTS = [0, 1, 2, 3] as const

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** What the swing in progress is, fixed at the moment it started. */
interface SwingInfo {
  weapon: CraftedItemId
  /** Present for a heavy release: the knockdown and the per-swing damage numbers. */
  heavy: { kind: 'heavy' | 'normal'; knockdownS: number; stats: HeavyStats } | null
}

const isHeavyId = (id: string | null): id is HeavyMeleeId =>
  id === 'wood-axe' || id === 'silver-sabre'

/** After the held weapon broke: the next melee weapon on the hotbar, else the next filled slot. */
function equipNextItem(): void {
  const inv = useInventoryStore.getState()
  const slots = HOTBAR_SLOTS.map((s) => hotbarItem(inv.inventory, s))
  const next = nextSlotAfterBreak(slots, inv.equippedSlot ?? 0)
  if (next !== null) inv.equipSlot(next as (typeof HOTBAR_SLOTS)[number])
}

/** Spends 1 durability for a hitting swing; at 0 the weapon breaks and leaves the satchel (Req 8.10, 8.11). */
function spendSwingDurability(id: CraftedItemId): boolean {
  const combat = useCombatStore.getState()
  if (combat.durability[id as 'bone-club'] === undefined) return false
  const before = combat.durability[id as 'bone-club']
  if (!combat.spendDurability(id as 'bone-club')) {
    if (crossedCracking(before, useCombatStore.getState().durability[id as 'bone-club'])) {
      const name = ITEM_MAP[id]?.name ?? 'Your weapon'
      useToastStore.getState().push(`${name} is cracking`)
      // The caption is raised even when audio is muted or unavailable.
      emitCombatSound('weapon-crack', undefined, undefined, name)
    }
    return false
  }
  const inv = useInventoryStore.getState()
  inv.setInventory(removeItem(inv.inventory, id, 1).inv)
  // The only break caption in the bible is the axe's; other weapons get a toast.
  if (id === 'wood-axe') emitCombatSound('weapon-break')
  else useToastStore.getState().push(`${ITEM_MAP[id]?.name ?? 'Your weapon'} broke`)
  equipNextItem()
  return true
}

/** Mount inside the Canvas, inside GameLoop. Renders nothing. */
export function MeleeAttack() {
  const swing = useRef<SwingState | null>(null)
  const info = useRef<SwingInfo | null>(null)
  const prev = useRef({ attack: false, heavy: false })

  const setBlocking = (on: boolean) => {
    if (useCombatStore.getState().live.blocking !== on)
      useCombatStore.getState().patchLive({ blocking: on })
  }

  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    const snap = input.peek()
    // Edges are tracked while frozen too, so a key held through pause does not start a charge on resume.
    const edge = {
      attack: snap.attack && !prev.current.attack,
      heavy: snap.heavy && !prev.current.heavy,
    }
    prev.current = { attack: snap.attack, heavy: snap.heavy }

    const combat = useCombatStore.getState()
    if (gs.paused || gs.examining || gs.journalOpen || isSimFrozen()) {
      // Pausing cancels a charge with nothing spent (Req 8.12).
      if (combat.live.charge || combat.live.releaseRequest)
        combat.patchLive({ charge: null, releaseRequest: null })
      setBlocking(false)
      return
    }
    const dt = Math.min(rawDelta, MAX_DT)

    // Stagger timers are counted down by the enemy AI (EnemyDirector).
    meleeRuntime.shakeAge += dt

    const inv = useInventoryStore.getState()
    const held = inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot)
    const def = held ? WEAPON_MAP[held as CraftedItemId] : undefined
    const melee =
      (def?.kind === 'melee' || def?.kind === 'heavy') && def.cooldown !== null ? def : undefined
    const heavyId = melee && isHeavyId(held) ? held : null

    // A weapon switch or a dash drops the swing in progress (Req 8.12).
    if (swing.current && (info.current?.weapon !== held || combat.live.dodge)) {
      swing.current = null
      info.current = null
    }

    const live = combat.live
    // Block: aim held with a melee weapon, not while swinging or charging (Req 5.3).
    setBlocking(
      melee !== undefined && !swing.current && !live.charge && snap.aim && !gs.satchelOpen,
    )

    if (heavyId && !swing.current && !gs.satchelOpen) {
      if (!live.charge && (edge.attack || edge.heavy) && !live.dodge) {
        // Attack fills the meter while held; V fills it and releases by itself.
        combat.patchLive({ charge: startCharge(!edge.attack), releaseRequest: null })
      } else if (
        live.charge &&
        (live.releaseRequest !== null || (!live.charge.auto && !snap.attack))
      ) {
        const res = releaseHeavy(heavyId)
        if (res.kind !== 'none' && res.stats) {
          swing.current = startSwing(melee?.cooldown ?? 0.9)
          info.current = {
            weapon: heavyId,
            heavy: { kind: res.kind, knockdownS: res.knockdownS, stats: res.stats },
          }
        }
      }
    } else if (!heavyId && !swing.current && melee && !gs.satchelOpen && snap.attack) {
      swing.current = startSwing(melee.cooldown ?? 0.9)
      info.current = { weapon: melee.id, heavy: null }
    }

    const s = swing.current
    if (!s) {
      meleeRuntime.pose = REST_POSE
      return
    }
    const t = tickSwing(s, dt)
    swing.current = t.swing
    meleeRuntime.pose = t.swing ? swingPose(swingProgress(t.swing)) : REST_POSE

    const cur = info.current
    if (!t.swing) info.current = null
    if (t.hit && cur) {
      const player = usePlayerStore.getState()
      const h = cur.heavy
      const damage = h
        ? h.kind === 'heavy'
          ? h.stats.heavyDamage
          : h.stats.lightDamage
        : WEAPON_MAP[cur.weapon].damage
      const result = resolveMelee(
        { x: player.position[0], z: player.position[2] },
        forwardFromYaw(player.yaw),
        damage,
        useEnemyStore.getState().enemies,
        // The sabre's Wailer bonus is applied by the damage rules from `weapon`.
        {
          lanternFuel: useLanternStore.getState().fuel,
          weapon: isHeavyId(cur.weapon) ? cur.weapon : undefined,
        },
        h && h.kind === 'heavy' ? { knockdownS: h.knockdownS } : {},
      )
      if (result.hitUids.length === 0) return
      // Dead zombies stay in the list for the AI task to play the death; hp 0 excludes them from further hits.
      const before = useEnemyStore.getState().enemies
      useEnemyStore.getState().setEnemies(result.enemies)
      // Kills are reported once per zombie, with the swing's own source (Req 6.4: contracts count these two).
      const swingSource = cur.heavy?.kind === 'heavy' ? 'heavy' : 'melee'
      for (const ev of killReports(before, result.enemies, swingSource)) emit(ev)
      playMeleeHit()
      for (const ev of meleeHitEvents(
        result.hitUids,
        cur.heavy?.kind === 'heavy' ? 'heavy' : 'melee',
      )) {
        emit(ev)
      }
      for (const e of result.enemies) {
        if (result.hitUids.includes(e.uid)) {
          meleeRuntime.dustQueue.push(
            ...spawnDust({ x: e.pos.x, y: DUST_Y, z: e.pos.z }, Math.random),
          )
        }
      }
      if (shakeAllowed(useSettingsStore.getState().cameraShake, prefersReducedMotion())) {
        meleeRuntime.shakeAge = 0
      }
      // One durability per swing that hit, however many zombies it hit (Req 8.10).
      if (spendSwingDurability(cur.weapon)) {
        swing.current = null
        info.current = null
        meleeRuntime.pose = REST_POSE
      }
    }
  })

  return null
}
