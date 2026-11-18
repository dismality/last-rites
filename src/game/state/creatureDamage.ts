// Player attacks against the new creatures (spec 11 H2, Req 2.4, 2.5, 2.10, 2.11).
// The creatures are not zombies in the enemy store, so the melee swing and the firearm call in here
// after their zombie pass. Rules live in systems/crawler.ts (crawlerHit) and systems/bride.ts
// (brideDamage); this file finds who was hit, applies the result to the creature store and gives
// the cues. A heavy swing (axe or sabre chop) counts as downward; a light swing is level and passes
// over a crawler.
import { ENEMY_MAP } from '../../data/enemies'
import { BRIDE } from '../../data/creatures'
import { brideDamage, type BrideDamageSource } from '../systems/bride'
import { meleeHits, DEFAULT_MELEE_ARC_DEG, DEFAULT_MELEE_RANGE_M, type AttackKind, type CombatEnemy, type Vec2 } from '../systems/combat'
import { crawlerHit, swingIsDownward } from '../systems/crawler'
import { spawnNumbers } from '../systems/damageNumbers'
import { useCreatureStore } from './creatureStore'
import { useFeedbackStore } from './feedbackStore'
import { useSettingsStore } from './settingsStore'

export const BRIDE_HP_KEY = 'bride'

export interface CreatureHitResult {
  /** Damage actually dealt. */
  damage: number
  /** A level swing passed over a crawler. */
  miss: boolean
  /** Lead hit the bride and did nothing. */
  noEffect: boolean
  killed: boolean
}

const maxHp = (key: string): number => (key === BRIDE_HP_KEY ? ENEMY_MAP.bride.hp : ENEMY_MAP.crawler.hp)

function showNumber(at: Vec2, damage: number): void {
  const fb = useFeedbackStore.getState()
  const spawned = spawnNumbers(
    fb.numbers,
    [{ point: [at.x, 1, at.z] as const, damage, headshot: false }],
    useSettingsStore.getState().damageNumbers,
    fb.nextNumberId,
  )
  fb.setNumbers(spawned.list, spawned.nextId)
}

/** Applies one attack to one creature (`crawler-…` id or the bride) and returns what happened. */
export function hitCreature(
  target: { kind: 'crawler'; id: string } | { kind: 'bride' },
  attack: AttackKind,
  source: BrideDamageSource,
  amount: number,
): CreatureHitResult {
  const st = useCreatureStore.getState()
  if (target.kind === 'crawler') {
    const entry = st.crawlers.find((c) => c.id === target.id)
    if (!entry || entry.c.phase !== 'emerged') return { damage: 0, miss: false, noEffect: false, killed: false }
    const r = crawlerHit(attack, amount)
    showNumber(entry.c, r.damage)
    if (r.miss) return { damage: 0, miss: true, noEffect: false, killed: false }
    const hp = (st.hp[target.id] ?? maxHp(target.id)) - r.damage
    if (hp <= 0) {
      const rest = { ...st.hp }
      delete rest[target.id]
      useCreatureStore.setState({ crawlers: st.crawlers.filter((c) => c.id !== target.id), hp: rest })
      return { damage: r.damage, miss: false, noEffect: false, killed: true }
    }
    useCreatureStore.setState({ hp: { ...st.hp, [target.id]: hp } })
    return { damage: r.damage, miss: false, noEffect: false, killed: false }
  }
  if (!st.bride.alive) return { damage: 0, miss: false, noEffect: false, killed: false }
  const r = brideDamage(source, amount)
  // The "0" damage number is the no-effect cue: a shape that does not depend on colour.
  showNumber(st.bride, r.damage)
  if (r.noEffectCue) {
    useCreatureStore.setState({ noEffectCount: st.noEffectCount + 1 })
    return { damage: 0, miss: false, noEffect: true, killed: false }
  }
  const hp = (st.hp[BRIDE_HP_KEY] ?? maxHp(BRIDE_HP_KEY)) - r.damage
  if (hp <= 0) {
    const rest = { ...st.hp }
    delete rest[BRIDE_HP_KEY]
    useCreatureStore.setState({
      bride: { ...st.bride, alive: false, tellLeft: null, returnIn: BRIDE.respawnMinS },
      hp: rest,
    })
    return { damage: r.damage, miss: false, noEffect: false, killed: true }
  }
  useCreatureStore.setState({ hp: { ...st.hp, [BRIDE_HP_KEY]: hp } })
  return { damage: r.damage, miss: false, noEffect: false, killed: false }
}

/** A melee swing: emerged crawlers and the drawn bride inside the swing cone. */
export function meleeCreatures(origin: Vec2, dir: Vec2, damage: number, heavy: boolean, source: BrideDamageSource, pitch = 0): CreatureHitResult[] {
  const st = useCreatureStore.getState()
  const candidates = st.crawlers
    .filter((c) => c.c.phase === 'emerged')
    .map((c): CombatEnemy => ({ uid: c.id, type: 'crawler', hp: 1, pos: { x: c.c.x, z: c.c.z } }))
  if (st.bride.alive && st.brideVisible) {
    candidates.push({ uid: BRIDE_HP_KEY, type: 'bride', hp: 1, pos: { x: st.bride.x, z: st.bride.z } })
  }
  const ids = meleeHits(origin, dir, DEFAULT_MELEE_ARC_DEG, DEFAULT_MELEE_RANGE_M, candidates)
  const kind: AttackKind = swingIsDownward(heavy, pitch) ? 'melee-down' : 'melee-horizontal'
  return ids.map((id) =>
    hitCreature(id === BRIDE_HP_KEY ? { kind: 'bride' } : { kind: 'crawler', id }, kind, source, damage),
  )
}

/** Half width of a creature for a shot (m). */
const SHOT_RADIUS_M = 0.45
const SHOT_RANGE_M = 40

/** A gunshot: the nearest emerged crawler or drawn bride on the aim line takes the shot's damage. */
export function shotCreatures(origin: Vec2, aim: Vec2, damage: number, source: BrideDamageSource): CreatureHitResult | null {
  const len = Math.hypot(aim.x, aim.z)
  if (len < 1e-6) return null
  const ax = aim.x / len
  const az = aim.z / len
  const st = useCreatureStore.getState()
  const targets: { key: string; x: number; z: number }[] = st.crawlers
    .filter((c) => c.c.phase === 'emerged')
    .map((c) => ({ key: c.id, x: c.c.x, z: c.c.z }))
  if (st.bride.alive && st.brideVisible) targets.push({ key: BRIDE_HP_KEY, x: st.bride.x, z: st.bride.z })
  let best: { key: string; t: number } | null = null
  for (const t of targets) {
    const rx = t.x - origin.x
    const rz = t.z - origin.z
    const along = rx * ax + rz * az
    if (along <= 0 || along > SHOT_RANGE_M) continue
    if (Math.abs(rx * az - rz * ax) > SHOT_RADIUS_M) continue
    if (!best || along < best.t) best = { key: t.key, t: along }
  }
  if (!best) return null
  return hitCreature(best.key === BRIDE_HP_KEY ? { kind: 'bride' } : { kind: 'crawler', id: best.key }, 'bullet', source, damage)
}
