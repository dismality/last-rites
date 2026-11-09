// Father Crane's director: pure rules for the rise, the phases and his speed.
// Attacks (2.21) and death (2.22) extend the same state and event types below.
import { BOSS } from '../../data/boss'
import type { Vec2 } from './combat'
import { RITE_DURATION } from './mystery'

/** Pause between the two swings of phase 3, and the rest after a swing (bible placements). */
const SWING_GAP_S = 0.3
const SWING_COOLDOWN_S = 2.0
export type BossStage = 'dormant' | 'telegraph' | 'risen' | 'dying' | 'dead'
export type BossPhase = 1 | 2 | 3

export type BossAttack =
  | { kind: 'swing'; leftS: number; dir: Vec2 }
  | { kind: 'toll'; leftS: number }
  | { kind: 'congregation'; leftS: number }

export interface BossState {
  stage: BossStage
  /** Sim seconds since the rite started, whether or not Interact is held. */
  riteClock: number
  /** Seconds spent in the current stage. */
  stageClock: number
  phase: BossPhase
  attack: BossAttack | null
  swingsLeft: number
  swingIn: number
  tollIn: number
  congregationIn: number
  nameCardLeftS: number
}

export interface BossInput {
  dt: number
  riteStarted: boolean
  playerDead: boolean
  player: Vec2
  crane: { hp: number; maxHp: number; pos: Vec2; inSalt: boolean } | null
}

export type BossEvent =
  | { type: 'riseTelegraph' }
  | { type: 'spawn' }
  | { type: 'phase'; phase: BossPhase }
  | { type: 'swingStart'; dir: Vec2 }
  | { type: 'swingHit'; origin: Vec2; dir: Vec2 }
  | { type: 'tollStart' }
  | { type: 'tollRing'; center: Vec2 }
  | { type: 'congregationStart' }
  | { type: 'congregationRise' }
  | { type: 'deathStart' }
  | { type: 'quietEnded' }

export interface BossTick {
  state: BossState
  events: BossEvent[]
}

/** Also the Retry Night reset. */
export const initialBoss = (): BossState => ({
  stage: 'dormant',
  riteClock: 0,
  stageClock: 0,
  phase: 1,
  attack: null,
  swingsLeft: 0,
  swingIn: 0,
  tollIn: 0,
  congregationIn: 0,
  nameCardLeftS: 0,
})

export const bossPhase = (hp: number, maxHp: number): BossPhase => {
  if (maxHp <= 0) return 3
  const f = hp / maxHp
  if (f >= BOSS.phaseAt.two) return 1
  if (f >= BOSS.phaseAt.three) return 2
  return 3
}

export const bossSpeed = (phase: BossPhase, inSalt: boolean): number =>
  BOSS.speed[phase] * (inSalt ? BOSS.saltSpeedMult : 1)

/** Stage 'risen': HP above 0, drives the tracker and the boss bar. */
export const craneFighting = (s: BossState): boolean => s.stage === 'risen'

/** The rite cannot finish until the 4 s of quiet after his death has passed. */
export const riteBlocked = (s: BossState): boolean => s.stage !== 'dead'

export const riteCapS = (s: BossState): number => (riteBlocked(s) ? BOSS.riteCapS : RITE_DURATION)

export function tickBoss(s: BossState, i: BossInput): BossTick {
  const events: BossEvent[] = []
  if (i.playerDead || i.dt <= 0) return { state: s, events }

  if (s.stage === 'dormant') {
    // Not started: nothing runs, so no event can precede the rite.
    if (!i.riteStarted) return { state: s, events }
    const riteClock = s.riteClock + i.dt
    if (riteClock < BOSS.riseAfterS) return { state: { ...s, riteClock }, events }
    events.push({ type: 'riseTelegraph' })
    return { state: { ...s, riteClock, stage: 'telegraph', stageClock: 0 }, events }
  }

  const riteClock = i.riteStarted ? s.riteClock + i.dt : s.riteClock

  if (s.stage === 'telegraph') {
    const stageClock = s.stageClock + i.dt
    if (stageClock < BOSS.riseTelegraphS) {
      return { state: { ...s, riteClock, stageClock }, events }
    }
    events.push({ type: 'spawn' })
    return {
      state: {
        ...s,
        riteClock,
        stage: 'risen',
        stageClock: 0,
        nameCardLeftS: BOSS.nameCardS,
        congregationIn: BOSS.congregation.everyS[1],
      },
      events,
    }
  }

  if (s.stage === 'risen') {
    let next: BossState = {
      ...s,
      riteClock,
      stageClock: s.stageClock + i.dt,
      nameCardLeftS: Math.max(0, s.nameCardLeftS - i.dt),
      tollIn: Math.max(0, s.tollIn - i.dt),
      congregationIn: Math.max(0, s.congregationIn - i.dt),
      swingIn: Math.max(0, s.swingIn - i.dt),
    }
    // Without a body there is no HP to read, so the state holds.
    if (!i.crane) return { state: next, events }

    // Death cancels the pending attack and every timer, so nothing lands after 0 HP.
    if (i.crane.hp <= 0) {
      events.push({ type: 'deathStart' })
      return {
        state: {
          ...next,
          stage: 'dying',
          stageClock: 0,
          attack: null,
          swingsLeft: 0,
          swingIn: 0,
          tollIn: 0,
          congregationIn: 0,
          nameCardLeftS: 0,
        },
        events,
      }
    }

    // Phase only ever goes up, whatever the damage sequence.
    const phase = Math.max(next.phase, bossPhase(i.crane.hp, i.crane.maxHp)) as BossPhase
    if (phase > next.phase) {
      next = { ...next, phase }
      if (s.phase < 2 && phase >= 2) next.tollIn = BOSS.toll.everyS
      if (s.phase < 3 && phase >= 3) {
        next.congregationIn = Math.min(next.congregationIn, BOSS.congregation.everyS[3])
      }
      events.push({ type: 'phase', phase })
    }
    next = tickAttacks(next, i, i.crane, events)
    return { state: next, events }
  }

  if (s.stage === 'dying') {
    const stageClock = s.stageClock + i.dt
    if (stageClock < BOSS.deathQuietS) return { state: { ...s, riteClock, stageClock }, events }
    events.push({ type: 'quietEnded' })
    return { state: { ...s, riteClock, stage: 'dead', stageClock: 0 }, events }
  }

  return { state: { ...s, riteClock }, events }
}

/** Phase 3 chains two swings; every other phase swings once. */
const swingsFor = (phase: BossPhase): number => (phase >= 3 ? 2 : 1)

const swingDir = (from: Vec2, to: Vec2): Vec2 => {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const len = Math.hypot(dx, dz)
  return len === 0 ? { x: 0, z: 1 } : { x: dx / len, z: dz / len }
}

/** True when `player` is inside the Censer Swing cone (3 m, 120 degrees, inclusive). */
export const swingHits = (origin: Vec2, dir: Vec2, player: Vec2): boolean => {
  const dx = player.x - origin.x
  const dz = player.z - origin.z
  const dist = Math.hypot(dx, dz)
  if (dist > BOSS.censer.reachM) return false
  // Standing on him: the angle is undefined, so the blow lands.
  if (dist === 0) return true
  const dirLen = Math.hypot(dir.x, dir.z)
  if (dirLen === 0) return false
  const cosHalf = Math.cos((BOSS.censer.arcDeg / 2) * (Math.PI / 180))
  return (dx * dir.x + dz * dir.z) / (dist * dirLen) >= cosHalf
}

/** True when `player` is inside the Toll ring (8 m, inclusive). */
export const tollHits = (center: Vec2, player: Vec2): boolean =>
  Math.hypot(player.x - center.x, player.z - center.z) <= BOSS.toll.radiusM

/** Largest damage a single boss hit may deal, by attack. */
export const bossHitDamage = (kind: 'swing' | 'toll'): number =>
  kind === 'swing' ? BOSS.censer.damage : BOSS.toll.damage

type Crane = NonNullable<BossInput['crane']>

function startSwing(n: BossState, i: BossInput, crane: Crane, events: BossEvent[]): BossState {
  // Aim is fixed here, so strafing during the wind-up dodges the blow.
  const dir = swingDir(crane.pos, i.player)
  events.push({ type: 'swingStart', dir })
  return { ...n, attack: { kind: 'swing', leftS: BOSS.censer.windupS, dir } }
}

/**
 * Attack scheduling while risen. One attack at a time; when free, a due Toll goes first,
 * then a due Congregation, then a Swing. Every attack finishes its telegraph before it
 * deals damage or spawns.
 */
function tickAttacks(s: BossState, i: BossInput, crane: Crane, events: BossEvent[]): BossState {
  let n = s
  if (n.attack) {
    const leftS = n.attack.leftS - i.dt
    if (leftS > 0) return { ...n, attack: { ...n.attack, leftS } }
    const done = n.attack
    n = { ...n, attack: null }
    if (done.kind === 'swing') {
      events.push({ type: 'swingHit', origin: crane.pos, dir: done.dir })
      n.swingsLeft = Math.max(0, n.swingsLeft - 1)
      n.swingIn = n.swingsLeft > 0 ? SWING_GAP_S : SWING_COOLDOWN_S
    } else if (done.kind === 'toll') {
      events.push({ type: 'tollRing', center: crane.pos })
    } else {
      events.push({ type: 'congregationRise' })
    }
    return n
  }
  // Mid-chain: the second swing owns the gap, nothing else may cut in.
  if (n.swingsLeft > 0) return n.swingIn > 0 ? n : startSwing(n, i, crane, events)
  if (n.phase >= 2 && n.tollIn <= 0) {
    events.push({ type: 'tollStart' })
    return { ...n, tollIn: BOSS.toll.everyS, attack: { kind: 'toll', leftS: BOSS.toll.telegraphS } }
  }
  if (n.congregationIn <= 0) {
    events.push({ type: 'congregationStart' })
    return {
      ...n,
      congregationIn: BOSS.congregation.everyS[n.phase],
      attack: { kind: 'congregation', leftS: BOSS.congregation.telegraphS },
    }
  }
  const near = Math.hypot(i.player.x - crane.pos.x, i.player.z - crane.pos.z) <= BOSS.censer.reachM
  if (near && n.swingIn <= 0) {
    return startSwing({ ...n, swingsLeft: swingsFor(n.phase) }, i, crane, events)
  }
  return n
}
