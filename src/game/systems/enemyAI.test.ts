import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  applyWailerScream,
  createEnemy,
  loopCue,
  lurkerShouldTrigger,
  tickEnemies,
  tickEnemy,
  type AIContext,
  type AIEnemy,
} from './enemyAI'
import { buildGraph } from './navigation'
import {
  ENEMY_ATTACK_DURATION_S,
  ENEMY_ATTACK_WINDUP_S,
  ENEMY_DYING_S,
  ENEMY_RISE_S,
  LURKER_LUNGE_MAX_S,
  LURKER_TELEGRAPH_S,
  WAILER_BOOST_MULT,
  WAILER_BOOST_S,
  WAILER_SCREAM_DURATION_S,
  WAILER_SCREAM_INTERVAL,
} from '../../data/enemies'

const DT = 1 / 60
// Player at the origin looking down -Z.
const baseCtx: AIContext = { playerPos: { x: 0, z: 0 }, playerFacing: { x: 0, z: -1 }, lanternFuel: 100 }
const ctxAt = (over: Partial<AIContext> = {}): AIContext => ({ ...baseCtx, ...over })

/** Runs ticks until `pred` or `maxS` seconds; returns the enemy and all events. */
function run(e: AIEnemy, secs: number, ctx: AIContext = baseCtx) {
  const events = []
  let cur = e
  for (let t = 0; t < secs; t += DT) {
    const r = tickEnemy(cur, DT, ctx)
    cur = r.enemy
    events.push(...r.events)
  }
  return { enemy: cur, events }
}

const withState = (e: AIEnemy, patch: Partial<AIEnemy>): AIEnemy => ({ ...e, ...patch })

describe('shambler', () => {
  const fresh = () => createEnemy('s1', 'shambler', { x: 10, z: 0 })

  it('starts rising and cannot move', () => {
    const r = run(fresh(), 1)
    expect(r.enemy.state).toBe('rise')
    expect(r.enemy.pos).toEqual({ x: 10, z: 0 })
  })

  it('rise → chase after the rise time', () => {
    expect(run(fresh(), ENEMY_RISE_S + 0.1).enemy.state).toBe('chase')
  })

  it('chases at 1.4 m/s', () => {
    const chasing = withState(fresh(), { state: 'chase' })
    const r = run(chasing, 1)
    expect(10 - r.enemy.pos.x).toBeCloseTo(1.4, 1)
  })

  it('chase → attack within 1.2 m, damage 10 after the wind-up', () => {
    const close = withState(fresh(), { state: 'chase', pos: { x: 1, z: 0 } })
    const r1 = tickEnemy(close, DT, baseCtx)
    expect(r1.enemy.state).toBe('attack')
    const r2 = run(r1.enemy, ENEMY_ATTACK_WINDUP_S + 0.05)
    expect(r2.events).toEqual([expect.objectContaining({ type: 'enemyAttack', damage: 10 })])
  })

  it('attack → chase, and waits 1.5 s between blows', () => {
    const close = withState(fresh(), { state: 'chase', pos: { x: 1, z: 0 } })
    const r = run(close, 3.2)
    const hits = r.events.filter((e) => e.type === 'enemyAttack')
    // Blows land at ≈0.4 s and ≈1.9 s; the third would land at ≈3.4 s.
    expect(hits.length).toBe(2)
  })

  it('whiffs when the player backs away during the wind-up', () => {
    const swing = withState(fresh(), { state: 'attack', pos: { x: 5, z: 0 } })
    const r = run(swing, ENEMY_ATTACK_DURATION_S + 0.1)
    expect(r.events.filter((e) => e.type === 'enemyAttack')).toHaveLength(0)
    expect(r.enemy.state).toBe('chase')
  })

  it('stagger interrupts an attack, then returns to chase', () => {
    const swing = withState(fresh(), { state: 'attack', pos: { x: 1, z: 0 }, stagger: 0.3 })
    const r1 = tickEnemy(swing, DT, baseCtx)
    expect(r1.enemy.state).toBe('stagger')
    const r2 = run(r1.enemy, 0.4)
    // Recovered from the stagger (back in range it starts a fresh swing via chase).
    expect(r2.enemy.state).not.toBe('stagger')
    expect(r2.events.filter((e) => e.type === 'enemyAttack')).toHaveLength(0)
  })

  it('does not move while staggered', () => {
    const hit = withState(fresh(), { state: 'chase', stagger: 0.3 })
    const r = run(hit, 0.2)
    expect(r.enemy.pos).toEqual({ x: 10, z: 0 })
  })

  it('any state → dying at 0 HP, emits collapse once, removed within 2 s', () => {
    const doomed = withState(fresh(), { state: 'chase', hp: 0 })
    const r = tickEnemy(doomed, DT, baseCtx)
    expect(r.enemy.state).toBe('dying')
    expect(r.events).toEqual([expect.objectContaining({ type: 'enemyCollapsed', uid: 's1' })])
    const done = run(r.enemy, ENEMY_DYING_S + 0.1)
    expect(done.enemy.state).toBe('dead')
    expect(done.events).toHaveLength(0)
    expect(ENEMY_DYING_S).toBeLessThanOrEqual(2)
  })

  it('stays dead and does not attack once dying', () => {
    const dying = withState(fresh(), { state: 'dying', hp: 0, pos: { x: 1, z: 0 } })
    expect(run(dying, 0.5).events).toHaveLength(0)
  })
})

describe('lurker', () => {
  const lurker = (x: number, z: number) => createEnemy('l1', 'lurker', { x, z })

  it('starts dormant and stays motionless when the player is far', () => {
    const r = run(lurker(20, 0), 3)
    expect(r.enemy.state).toBe('dormant')
    expect(r.enemy.pos).toEqual({ x: 20, z: 0 })
  })

  it('triggers within 4 m when the player is not facing it', () => {
    // Player faces -Z; lurker is behind at +Z.
    expect(lurkerShouldTrigger(lurker(0, 3), baseCtx)).toBe(true)
  })

  it('stays dormant within 4 m when the player is facing it', () => {
    expect(lurkerShouldTrigger(lurker(0, -3), baseCtx)).toBe(false)
  })

  it('does not trigger beyond 4 m even when unseen', () => {
    expect(lurkerShouldTrigger(lurker(0, 5), baseCtx)).toBe(false)
  })

  it('triggers on lantern fuel under 20% while facing it', () => {
    const l = lurker(0, -6)
    expect(lurkerShouldTrigger(l, ctxAt({ lanternFuel: 19 }))).toBe(true)
    expect(lurkerShouldTrigger(l, ctxAt({ lanternFuel: 20 }))).toBe(false)
  })

  it('low fuel does not wake lurkers on the far side of the map', () => {
    expect(lurkerShouldTrigger(lurker(0, -40), ctxAt({ lanternFuel: 5 }))).toBe(false)
  })

  it('dormant → lunge emits a telegraph event', () => {
    const r = tickEnemy(lurker(0, 3), DT, baseCtx)
    expect(r.enemy.state).toBe('lunge')
    expect(r.events).toEqual([expect.objectContaining({ type: 'lurkerTriggered' })])
  })

  it('holds still for the telegraph, then lunges at 6 m/s', () => {
    const lunging = withState(lurker(0, 3.9), { state: 'lunge' })
    const held = run(lunging, LURKER_TELEGRAPH_S - 0.05)
    expect(held.enemy.pos).toEqual({ x: 0, z: 3.9 })
    const far = withState(lurker(0, 30), { state: 'lunge', stateTime: LURKER_TELEGRAPH_S })
    const moved = run(far, 0.5)
    expect(30 - moved.enemy.pos.z).toBeCloseTo(3, 0)
  })

  it('reduced scare intensity slows the lunge', () => {
    const far = withState(lurker(0, 30), { state: 'lunge', stateTime: LURKER_TELEGRAPH_S })
    const moved = run(far, 0.5, ctxAt({ lungeSpeedScale: 0.5 }))
    expect(30 - moved.enemy.pos.z).toBeCloseTo(1.5, 0)
  })

  it('lunge → attack in range deals 20 damage', () => {
    const near = withState(lurker(0, 1), { state: 'lunge', stateTime: LURKER_TELEGRAPH_S })
    const r1 = tickEnemy(near, DT, baseCtx)
    expect(r1.enemy.state).toBe('attack')
    const r2 = run(r1.enemy, ENEMY_ATTACK_WINDUP_S + 0.05)
    expect(r2.events).toEqual([expect.objectContaining({ type: 'enemyAttack', damage: 20 })])
  })

  it('lunge → chase when it overshoots, then attack → chase', () => {
    const missed = withState(lurker(0, 30), { state: 'lunge', stateTime: LURKER_TELEGRAPH_S + LURKER_LUNGE_MAX_S })
    expect(tickEnemy(missed, DT, baseCtx).enemy.state).toBe('chase')
    const swung = withState(lurker(0, 1), { state: 'attack', stateTime: ENEMY_ATTACK_DURATION_S })
    expect(tickEnemy(swung, DT, baseCtx).enemy.state).toBe('chase')
  })

  it('a struck dormant lurker wakes and chases', () => {
    const r = tickEnemy(withState(lurker(0, -10), { stagger: 0.3 }), DT, baseCtx)
    expect(r.enemy.state).toBe('chase')
  })
})

describe('wailer', () => {
  const wailer = (x: number) => createEnemy('w1', 'wailer', { x, z: 0 })

  it('rise → keepDistance', () => {
    expect(run(wailer(10), ENEMY_RISE_S + 0.1).enemy.state).toBe('keepDistance')
  })

  it('backs away when closer than 8 m', () => {
    const r = run(withState(wailer(5), { state: 'keepDistance' }), 1)
    expect(r.enemy.pos.x).toBeGreaterThan(5)
  })

  it('approaches when farther than 12 m', () => {
    const r = run(withState(wailer(20), { state: 'keepDistance' }), 1)
    expect(r.enemy.pos.x).toBeLessThan(20)
  })

  it('holds position between 8 and 12 m', () => {
    const r = run(withState(wailer(10), { state: 'keepDistance' }), 1)
    expect(r.enemy.pos).toEqual({ x: 10, z: 0 })
  })

  it('keepDistance → scream after 8 s, emitting wailerScream once', () => {
    const r = run(withState(wailer(10), { state: 'keepDistance' }), WAILER_SCREAM_INTERVAL + 0.1)
    expect(r.events.filter((e) => e.type === 'wailerScream')).toHaveLength(1)
    expect(r.enemy.state).toBe('scream')
  })

  it('scream → keepDistance and the timer resets', () => {
    const screaming = withState(wailer(10), { state: 'scream' })
    const r = run(screaming, WAILER_SCREAM_DURATION_S + 0.05)
    expect(r.enemy.state).toBe('keepDistance')
    expect(r.enemy.screamTimer).toBeGreaterThan(WAILER_SCREAM_INTERVAL - 0.2)
  })

  it('scream boosts awake zombies within 25 m only, and spares dormant lurkers', () => {
    const near = createEnemy('a', 'shambler', { x: 24, z: 0 })
    const far = createEnemy('b', 'shambler', { x: 26, z: 0 })
    const sleeper = createEnemy('c', 'lurker', { x: 5, z: 0 })
    const [a, b, c] = applyWailerScream([near, far, sleeper], { x: 0, z: 0 }, 'w1')
    expect(a.boost).toBe(WAILER_BOOST_S)
    expect(b.boost).toBe(0)
    expect(c.boost).toBe(0)
  })

  it('boost raises chase speed and expires after 3 s', () => {
    const base = withState(createEnemy('s', 'shambler', { x: 30, z: 0 }), { state: 'chase', boost: WAILER_BOOST_S })
    const boosted = run(base, 1)
    expect(30 - boosted.enemy.pos.x).toBeCloseTo(1.4 * WAILER_BOOST_MULT, 1)
    expect(run(base, WAILER_BOOST_S + 0.1).enemy.boost).toBe(0)
  })

  it('tickEnemies pulls neighbours when a wailer screams and drops corpses', () => {
    const w = withState(wailer(10), { state: 'keepDistance', screamTimer: 0.001 })
    const s = withState(createEnemy('s', 'shambler', { x: 15, z: 0 }), { state: 'chase' })
    const dead = withState(createEnemy('d', 'shambler', { x: 3, z: 3 }), { state: 'dying', hp: 0, stateTime: ENEMY_DYING_S })
    const r = tickEnemies([w, s, dead], DT, baseCtx)
    expect(r.enemies.map((z) => z.uid)).toEqual(['w1', 's'])
    expect(r.enemies[1].boost).toBeGreaterThan(0)
  })
})

describe('knockdown (Property 16, disarm half)', () => {
  const near = () => withState(createEnemy('k', 'shambler', { x: 1, z: 0 }), { state: 'chase' })

  it('does not move or attack until the timer ends, then resumes', () => {
    const down = withState(near(), { knockdown: 1.2 })
    const lying = run(down, 1.1)
    expect(lying.enemy.state).toBe('down')
    expect(lying.enemy.pos).toEqual({ x: 1, z: 0 })
    expect(lying.events).toHaveLength(0)
    const up = run(lying.enemy, 0.2)
    expect(up.enemy.state).not.toBe('down')
    expect(up.enemy.knockdown).toBe(0)
  })

  it('never attacks while down, for any duration (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 3, noNaN: true }), (s) => {
        const r = run(withState(near(), { knockdown: s, state: 'attack', hitDealt: false }), s - 0.05)
        expect(r.events.filter((ev) => ev.type === 'enemyAttack')).toHaveLength(0)
      }),
      { numRuns: 20 },
    )
  })

  it('wakes a dormant lurker that is knocked down', () => {
    const l = withState(createEnemy('l', 'lurker', { x: 0, z: -20 }), { knockdown: 1 })
    const r = tickEnemy(l, DT, baseCtx)
    expect(r.enemy.state).toBe('down')
    expect(r.events).toEqual([expect.objectContaining({ type: 'lurkerTriggered' })])
    expect(run(r.enemy, 1.1).enemy.state).toBe('chase')
  })

  it('down zombies are silent and ignore wailer screams', () => {
    const d = withState(createEnemy('d', 'shambler', { x: 5, z: 0 }), { state: 'down', knockdown: 1 })
    expect(loopCue(d)).toBeNull()
    expect(applyWailerScream([d], { x: 0, z: 0 }, 'w')[0].boost).toBe(0)
  })
})

describe('bloater swell', () => {
  const dead = () => withState(createEnemy('b', 'bloater', { x: 5, z: 0 }), { state: 'chase', hp: 0 })

  it('swells for 0.8 s without moving, then bursts exactly once and dies', () => {
    const first = tickEnemy(dead(), DT, baseCtx)
    expect(first.enemy.state).toBe('swell')
    expect(first.events.map((ev) => ev.type)).toEqual(['bloaterSwell', 'enemyCollapsed'])
    const mid = run(first.enemy, 0.7)
    expect(mid.enemy.state).toBe('swell')
    expect(mid.events).toHaveLength(0)
    expect(mid.enemy.pos).toEqual({ x: 5, z: 0 })
    const rest = run(mid.enemy, 3)
    expect(rest.events.filter((ev) => ev.type === 'bloaterBurst')).toHaveLength(1)
    expect(rest.enemy.state).toBe('dead')
  })

  it('other types go straight to dying without a swell', () => {
    const r = tickEnemy(withState(createEnemy('s', 'shambler', { x: 5, z: 0 }), { hp: 0 }), DT, baseCtx)
    expect(r.enemy.state).toBe('dying')
    expect(r.events.map((ev) => ev.type)).toEqual(['enemyCollapsed'])
  })
})

describe('noise and door targets', () => {
  it('investigate steers toward the noise and clears within 1.2 m', () => {
    const z = withState(createEnemy('n', 'shambler', { x: 10, z: 0 }), {
      state: 'chase',
      investigate: { x: 10, z: 8 },
    })
    const moved = run(z, 1)
    expect(moved.enemy.pos.z).toBeGreaterThan(1)
    expect(moved.enemy.investigate).not.toBeNull()
    const arrived = run(withState(z, { pos: { x: 10, z: 7 } }), 0.1)
    expect(arrived.enemy.investigate).toBeNull()
  })

  it('a door target moves the attack goal and the event names the door', () => {
    const ctx = ctxAt({ doors: { front: { x: 10, z: 0 }, vestry: { x: 0, z: 30 } } })
    // Player is 10 m away, but the zombie stands at its door.
    const z = withState(createEnemy('d', 'shambler', { x: 10.5, z: 0 }), { state: 'chase', target: 'front' })
    const r = run(z, 0.6, ctx)
    expect(r.events).toEqual([
      expect.objectContaining({ type: 'enemyAttack', target: 'front', enemyType: 'shambler' }),
    ])
    // Without the door the same zombie is simply chasing a distant player.
    const away = run(withState(z, { target: 'player' }), 0.6, ctx)
    expect(away.events).toHaveLength(0)
  })

  it('damage and speed scale with their multipliers; speedOverride wins', () => {
    const e = createEnemy('e', 'shambler', { x: 30, z: 0 }, { elite: true })
    expect(e.maxHp).toBe(120)
    const chasing = withState(e, { state: 'chase' })
    expect(30 - run(chasing, 1).enemy.pos.x).toBeCloseTo(1.4 * 1.15, 1)
    const over = run(chasing, 1, ctxAt({ speedOverride: () => 3 }))
    expect(30 - over.enemy.pos.x).toBeCloseTo(3, 1)
    const hit = run(withState(chasing, { pos: { x: 1, z: 0 } }), 0.6)
    expect(hit.events).toEqual([expect.objectContaining({ damage: 12.5 })])
  })

  it('Father Crane never emits enemyAttack', () => {
    const c = withState(createEnemy('c', 'father-crane', { x: 2, z: 0 }), { state: 'chase' })
    expect(run(c, 4).events.filter((ev) => ev.type === 'enemyAttack')).toHaveLength(0)
  })
})

describe('audio signatures', () => {
  it('each awake type loops its own cue; sleeping, rising and dying are silent', () => {
    const at = (type: 'shambler' | 'lurker' | 'wailer', state: AIEnemy['state']) =>
      loopCue(withState(createEnemy('x', type, { x: 0, z: 0 }), { state }))
    expect(at('shambler', 'chase')).toBe('shambler-drag')
    expect(at('lurker', 'chase')).toBe('lurker-breath')
    expect(at('wailer', 'keepDistance')).toBe('wailer-wail')
    expect(at('lurker', 'dormant')).toBeNull()
    expect(at('shambler', 'rise')).toBeNull()
    expect(at('shambler', 'dying')).toBeNull()
  })
})

describe('steering', () => {
  it('spreads two overlapping shamblers apart', () => {
    const a = withState(createEnemy('a', 'shambler', { x: 10, z: 0 }), { state: 'chase' })
    const b = withState(createEnemy('b', 'shambler', { x: 10.2, z: 0.1 }), { state: 'chase' })
    let zs = [a, b]
    for (let i = 0; i < 60; i++) zs = tickEnemies(zs, DT, baseCtx).enemies
    expect(Math.hypot(zs[0].pos.x - zs[1].pos.x, zs[0].pos.z - zs[1].pos.z)).toBeGreaterThan(0.3)
  })

  it('turns away from a wall directly ahead', () => {
    // A wall at x = 8 blocks only the straight-ahead probe (same z); angled probes are clear.
    const blocked: AIContext['blocked'] = (p, q) => p.x > 8 && q.x < 8 && q.z === p.z
    const z = withState(createEnemy('a', 'shambler', { x: 9, z: 0 }), { state: 'chase' })
    // An empty graph isolates wall avoidance from waypoint routing.
    const r = tickEnemy(z, DT, ctxAt({ blocked, graph: buildGraph([], []) }))
    expect(r.enemy.pos.z).not.toBe(0)
  })

  it('never moves faster than its speed or lets HP rise (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(['shambler', 'lurker', 'wailer'] as const)),
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.integer({ min: 1, max: 600 }),
        (type, x, z, ticks) => {
          let e = createEnemy('p', type, { x, z })
          for (let i = 0; i < ticks; i++) {
            const before = e.pos
            e = tickEnemy(e, DT, baseCtx).enemy
            const step = Math.hypot(e.pos.x - before.x, e.pos.z - before.z)
            // Fastest legal mover is the 6 m/s lunge (boost only applies to others).
            expect(step).toBeLessThanOrEqual(6 * WAILER_BOOST_MULT * DT + 1e-9)
            expect(e.hp).toBeGreaterThan(0)
          }
        },
      ),
      { numRuns: 30 },
    )
  })
})
