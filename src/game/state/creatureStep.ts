// One fixed step of the new creatures (spec 11 H2): ambush crawlers, the Hollow Bride, hound packs.
// Rules live in systems/crawler.ts, bride.ts, hounds.ts and hurtGuard.ts; this file only reads the
// stores, calls them and applies the results. Every creature hit goes through hurtPlayer with the
// 1 HP floor, and every tell and attack raises a captioned, positional sound.
import { CRAWLER_MIN_HUT_DIST_M, CRAWLER_SPOT_DEFS } from '../../data/creatureSpots'
import {
  BRIDE,
  BRIDE_SPAWN_DIST_M,
  CREATURE_LIFETIME_S,
  CREATURE_SOUND_Y,
  CRAWLER,
  HOUND,
  HOUND_PACKS_MAX,
  LANTERN_CONE_HALF_DEG,
  CRAWLER_LATCH_LINE,
} from '../../data/creatures'
import { HUT } from '../../data/cemeteryLayout'
import { ZONE_BOUNDS } from '../../data/zones'
import { emit, subscribeToType } from '../events'
import { createRng, type Rng } from '../rng'
import { markSeen } from '../systems/bestiary'
import {
  brideCanSpawn,
  brideMoveBlocked,
  brideTouch,
  brideVisible,
  lanternBend,
  spawnBride,
  stepBride,
  tickBrideReturn,
  type BrideCollider,
} from '../systems/bride'
import type { Vec2 } from '../systems/combat'
import { createCrawler, faceTriggerApplies, pickCrawlerSpots, stepCrawler } from '../systems/crawler'
import { resolveDeferred, type DeferredKind } from '../systems/creatureScare'
import { pendingScreenScares, queueScreenScare } from './screenScareQueue'
import { useScreenScareStore } from './screenScareStore'
import { simClock } from './simClock'
import { guardedDamage } from '../systems/hurtGuard'
import { createPack, stepPack, type PackEvent } from '../systems/hounds'
import { lanternRadius } from '../systems/lantern'
import { forwardFromYaw } from '../systems/melee'
import { emitCombatSound } from './combatSounds'
import { useCreatureStore, type CrawlerEntry, type PackEntry } from './creatureStore'
import { useLanternStore } from './lanternStore'
import { usePlayerStore } from './playerStore'
import { useProjectileStore } from './projectileStore'
import { hurtPlayer } from './retryNight'
import { useSettingsStore } from './settingsStore'
import { useWorldStore } from './worldStore'

/** True when a gun went off since the last step; the shot's origin is the player. */
let shotPending = false
let waveUid = 0

/** Listens for firearm shots for as long as the scene is mounted. Returns the unsubscribe. */
export function installCreatureShotListener(): () => void {
  return subscribeToType('firearmFired', () => {
    shotPending = true
  })
}

export function resetCreatureRuntime(): void {
  shotPending = false
  waveUid = 0
  deferred = []
}

/**
 * Gameplay effects held back by a screen scare: a crawler's grab until the out phase starts, the
 * bride's oil drain until the in phase ends (Req 1.6, 1.7). Not saved: a load drops them.
 */
interface Deferred {
  kind: DeferredKind
  apply: () => void
}
let deferred: Deferred[] = []

/** Runs `apply` now, or once the scare for `kind` reaches its release point (at once if none is coming). */
function deferOrApply(kind: DeferredKind, apply: () => void): void {
  const queued = pendingScreenScares().some((p) => p.kind === kind)
  const active = useScreenScareStore.getState().scare.active
  if (resolveDeferred(kind, active, queued, simClock.now) === 'apply') apply()
  else deferred.push({ kind, apply })
}

function releaseDeferred(): void {
  if (deferred.length === 0) return
  const active = useScreenScareStore.getState().scare.active
  const queue = pendingScreenScares()
  const keep: Deferred[] = []
  for (const d of deferred) {
    const queued = queue.some((p) => p.kind === d.kind)
    if (resolveDeferred(d.kind, active, queued, simClock.now) === 'apply') d.apply()
    else keep.push(d)
  }
  deferred = keep
}

/** The chapel and the hut stop the bride. Fences and gravestones are not listed, so she floats through. */
const chapel = ZONE_BOUNDS.find((z) => z.zone === 'chapel')!.rect
export const BRIDE_WALLS: readonly BrideCollider[] = [
  { kind: 'wall', minX: chapel.minX, maxX: chapel.maxX, minZ: chapel.minZ, maxZ: chapel.maxZ },
  { kind: 'wall', minX: -HUT.halfX, maxX: HUT.halfX, minZ: -HUT.halfZ, maxZ: HUT.halfZ },
]

/** True when `target` is inside the lit lantern cone in front of the player. */
export function inLanternCone(player: Vec2, facing: Vec2, target: Vec2, radiusM: number): boolean {
  const dx = target.x - player.x
  const dz = target.z - player.z
  const d = Math.hypot(dx, dz)
  if (d > radiusM) return false
  if (d < 1e-6) return true
  const len = Math.hypot(facing.x, facing.z) || 1
  return (dx * facing.x + dz * facing.z) / (d * len) >= Math.cos((LANTERN_CONE_HALF_DEG * Math.PI) / 180)
}

const soundAt = (p: Vec2, y: number) => ({ x: p.x, y, z: p.z })

/** The seeded ambush crawlers of a night, on distinct mounds and coffins away from the hut. */
export function seedCrawlers(night: number): CrawlerEntry[] {
  const spots = CRAWLER_SPOT_DEFS.filter((s) => Math.hypot(s.x, s.z) >= CRAWLER_MIN_HUT_DIST_M)
  const count = CRAWLER.spotsMin + Math.floor(createRng(night * 7919 + 31)() * (CRAWLER.spotsMax - CRAWLER.spotsMin + 1))
  return pickCrawlerSpots(spots, night * 104729 + 5, count).map((s) => ({
    id: `crawler-${s.id}`,
    c: createCrawler(s),
    emergedS: 0,
    wave: false,
    hpAtEvent: 0,
  }))
}

/**
 * Routes the crawlers and hounds a wave spawned to the creature store (they are not zombies).
 * Crawlers lie hidden at their grave until the player is near; hounds form packs of 2 to 3, at
 * most HOUND_PACKS_MAX at once. A spawn over the pack limit is dropped.
 */
export function queueWaveCreatures(
  spawns: readonly { type: string; x: number; z: number }[],
  rng: Rng = Math.random,
): void {
  const crawlers = spawns.filter((s) => s.type === 'crawler')
  let hounds = spawns.filter((s) => s.type === 'hound').length
  if (crawlers.length === 0 && hounds === 0) return
  const player = usePlayerStore.getState().position
  const here = { x: player[0], z: player[2] }
  const store = useCreatureStore.getState()
  const nextCrawlers = [
    ...store.crawlers,
    ...crawlers.map((s): CrawlerEntry => ({
      id: `wave-crawler-${waveUid++}`,
      c: createCrawler(s),
      emergedS: 0,
      wave: true,
      hpAtEvent: 0,
    })),
  ]
  const packs = [...store.packs]
  while (hounds > 0 && packs.length < HOUND_PACKS_MAX) {
    // 4 left makes 2 + 2, never 3 + 1; a lone hound still makes the minimum pack of 2.
    const size = hounds === 4 ? 2 : Math.min(HOUND.packMax, Math.max(HOUND.packMin, hounds))
    packs.push({ id: `pack-${waveUid++}`, pack: createPack(here, size, rng), hpAtEvent: 0 })
    hounds -= size
  }
  useCreatureStore.setState({ crawlers: nextCrawlers, packs })
}

/** Applies a creature's damage through hurtPlayer, honouring the 1 HP floor of the event's start. */
function applyGuarded(damage: number, hpAtEvent: number): void {
  const dealt = guardedDamage(usePlayerStore.getState().health, hpAtEvent, damage)
  if (dealt > 0) hurtPlayer(dealt, false, 'zombie')
}

/** Advances the creatures by `dt` seconds of sim time. */
export function stepCreatures(dt: number, rng: Rng = Math.random): void {
  releaseDeferred()
  const world = useWorldStore.getState()
  const st = useCreatureStore.getState()
  const shot = shotPending
  shotPending = false

  // Creatures are a night thing: day and dawn clear them, and night start seeds them.
  if (world.phase === 'day' || world.phase === 'dawn') {
    if (st.seededNight !== null || st.crawlers.length > 0 || st.packs.length > 0 || st.bride.alive) {
      st.clearNight()
    }
    return
  }
  if (world.phase === 'night' && st.seededNight !== world.nightNumber) {
    const stage2 = brideCanSpawn({ stage: world.nightNumber, brideAlive: false })
    useCreatureStore.setState({
      seededNight: world.nightNumber,
      // Crawlers hide from night 2; wave-placed ones stay.
      crawlers: [...st.crawlers.filter((c) => c.wave), ...(world.nightNumber >= 2 ? seedCrawlers(world.nightNumber) : [])],
      // The bride's first visit comes after the usual 30 to 60 s delay.
      bride: { ...st.bride, alive: false, returnIn: stage2 ? BRIDE.respawnMinS + rng() * (BRIDE.respawnMaxS - BRIDE.respawnMinS) : 0 },
    })
    return
  }
  const night = world.phase === 'night'
  const live = useCreatureStore.getState()
  const lantern = useLanternStore.getState()
  if (!night && live.crawlers.length === 0 && live.packs.length === 0 && !live.bride.alive) {
    useCreatureStore.setState({ prevFuel: lantern.fuel })
    return
  }

  const simTime = live.simTime + dt
  const pp = usePlayerStore.getState()
  const p: Vec2 = { x: pp.position[0], z: pp.position[2] }
  const facing = forwardFromYaw(pp.yaw)
  const flashing = useSettingsStore.getState().flashingLights
  const lit = lantern.on
  const radius = lanternRadius(lantern.fuel)
  let seen = live.seen
  const hpNow = (): number => usePlayerStore.getState().health

  // --- Pale Crawlers ---------------------------------------------------------------------------
  const crawlers: CrawlerEntry[] = []
  for (const e of live.crawlers) {
    let { hpAtEvent } = e
    const r = stepCrawler(e.c, p, dt, rng)
    for (const ev of r.events) {
      if (ev.type === 'burst' || ev.type === 'tell') {
        hpAtEvent = hpNow()
        if (ev.type === 'tell') emitCombatSound('crawler-tell', soundAt(r.crawler, CREATURE_SOUND_Y.crawler))
        // A burst within 1.5 m in front of the player brings the zombie face up from the bottom.
        if (ev.type === 'burst' && faceTriggerApplies(r.crawler, { ...p, fx: facing.x, fz: facing.z })) {
          queueScreenScare('crawler')
        }
      } else if (ev.type === 'bite') {
        // Already latched: the bite lands at once.
        emitCombatSound('crawler-grab', soundAt(r.crawler, CREATURE_SOUND_Y.crawler))
        applyGuarded(ev.damage, hpNow())
      } else {
        emitCombatSound('crawler-grab', soundAt(r.crawler, CREATURE_SOUND_Y.crawler))
        // It has the leg now: say once how to get free.
        emit({ type: 'subtitleShown', text: CRAWLER_LATCH_LINE, duration: CRAWLER.latchPinS + CRAWLER.latchBiteS, force: true })
        // The grab lands once the face starts to leave (or at once if no face is coming).
        const floor = hpAtEvent
        deferOrApply('crawler', () => applyGuarded(ev.damage, floor))
      }
    }
    const emerged = r.crawler.phase === 'emerged'
    const emergedS = emerged ? e.emergedS + dt : 0
    // Only an emerged crawler can be seen: a hidden one under a mound must not reach the Bestiary.
    if (emerged) seen = markSeen(seen, 'crawler', p, r.crawler, false)
    // A crawler holding the leg never sinks back: the player has to kill it.
    if (emergedS > CREATURE_LIFETIME_S.crawlerEmerged && r.crawler.latchedS === null) continue
    crawlers.push({ ...e, c: r.crawler, emergedS, hpAtEvent })
  }

  // --- Hollow Bride ----------------------------------------------------------------------------
  let bride = tickBrideReturn(live.bride, dt)
  if (night && brideCanSpawn({ stage: world.nightNumber, brideAlive: bride.alive, returnIn: bride.returnIn })) {
    const a = rng() * Math.PI * 2
    const d = BRIDE_SPAWN_DIST_M.min + rng() * (BRIDE_SPAWN_DIST_M.max - BRIDE_SPAWN_DIST_M.min)
    bride = spawnBride(bride, { stage: world.nightNumber }, { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d })
  }
  if (!night && bride.alive) bride = { ...bride, alive: false, tellLeft: null }
  let visible = false
  let brideDist = Number.POSITIVE_INFINITY
  if (bride.alive) {
    const r = stepBride(bride, p, dt, rng)
    let next = r.bride
    const salts = useProjectileStore.getState().salts
    // Walls and salt stop her; fences and gravestones do not (they are not in the collider list).
    if (brideMoveBlocked(bride, next, BRIDE_WALLS, salts)) next = { ...next, x: bride.x, z: bride.z }
    bride = next
    for (const ev of r.events) {
      if (ev.type === 'tell') {
        emitCombatSound('bride-tell', soundAt(bride, CREATURE_SOUND_Y.bride))
      } else {
        const touched = brideTouch(bride, lantern.fuel, rng)
        bride = touched.bride
        const drained = Math.max(0, lantern.fuel - touched.fuel)
        emitCombatSound('bride-touch', soundAt(next, CREATURE_SOUND_Y.bride))
        // The ghost face comes from the top; the oil goes once its in phase is over.
        queueScreenScare('bride')
        deferOrApply('bride', () => {
          const ls = useLanternStore.getState()
          ls.setFuel(Math.max(0, ls.fuel - drained))
        })
      }
    }
    if (bride.alive) {
      brideDist = Math.hypot(bride.x - p.x, bride.z - p.z)
      visible = brideVisible(bride, p, lit, lit && inLanternCone(p, facing, bride, radius))
      // Seen only while she is drawn, so an unseen bride never reaches the Bestiary.
      if (visible) seen = markSeen(seen, 'bride', p, bride, true)
    }
  }
  const bend = lanternBend(brideDist, live.brideDim, dt, flashing)

  // --- Corpse Hounds ---------------------------------------------------------------------------
  const flare = live.prevFuel !== null && live.prevFuel > 0 && lantern.fuel <= 0
  const packs: PackEntry[] = []
  for (const e of live.packs) {
    const nearest = Math.min(...e.pack.hounds.map((h) => Math.hypot(h.x - p.x, h.z - p.z)))
    // The shot or the flare comes from the player's lantern and gun, so its distance is the pack's.
    const event: PackEvent | null = shot
      ? { kind: 'gunshot', distM: nearest }
      : flare
        ? { kind: 'flare', distM: nearest }
        : null
    let { hpAtEvent } = e
    const r = stepPack(e.pack, p, event, dt, rng)
    const at = (id: string): Vec2 => r.pack.hounds.find((h) => h.id === id) ?? p
    for (const ev of r.events) {
      if (ev.type === 'tell') {
        hpAtEvent = hpNow()
        emitCombatSound('hound-tell', soundAt(at(ev.houndId), CREATURE_SOUND_Y.hound))
      } else if (ev.type === 'bite') {
        emitCombatSound('hound-bite', soundAt(at(ev.houndId), CREATURE_SOUND_Y.hound))
      }
    }
    if (r.damage > 0) applyGuarded(r.damage, hpAtEvent)
    // Hounds circle at 4 to 6 m, so a pack is seen as soon as it forms (within 10 m).
    for (const h of r.pack.hounds) seen = markSeen(seen, 'hound', p, h, false)
    if (r.pack.t > CREATURE_LIFETIME_S.houndPack) continue
    packs.push({ ...e, pack: r.pack, hpAtEvent })
  }

  useCreatureStore.setState({
    simTime,
    prevFuel: lantern.fuel,
    crawlers,
    bride,
    brideDim: bend.dim,
    brideBend: bend.bend,
    brideVisible: visible,
    packs,
    seen,
  })
}
