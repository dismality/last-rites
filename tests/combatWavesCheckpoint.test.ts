// Checkpoint integration tests — spec 04-combat-waves, Task 10.
//
// Headless stand-in for manual play: runs nights 1 and 2 through tickWaves,
// tickEnemies, resolveMelee (bone club) and resolveFlask with a scripted player.
// It proves waves clear, the player survives and live count never passes the cap.
// It CANNOT measure rendered fps (no GPU); the perf test only bounds the CPU cost
// of the simulation with 14 zombies.

import { describe, it, expect } from 'vitest'
import { createRng } from '../src/game/rng'
import { startNight, tickWaves, nightTotal, type WaveState } from '../src/game/systems/waves'
import { createEnemy, tickEnemies, type AIEnemy, type AIEvent } from '../src/game/systems/enemyAI'
import { resolveMelee, startSwing, tickSwing, type SwingState } from '../src/game/systems/melee'
import { resolveFlask } from '../src/game/systems/projectiles'
import { damagePlayer } from '../src/game/systems/playerHealth'
import { WEAPON_MAP } from '../src/data/weapons'
import { FLASK_STUN_S } from '../src/data/projectiles'
import { LIVE_ENEMY_CAP, type NightNumber } from '../src/data/waves'
import { PLAYER_MAX_HEALTH } from '../src/data/balance'

const DT = 1 / 60
const PLAYER = { x: 0, z: 0 }
const CLUB = WEAPON_MAP['bone-club']

interface NightResult {
  cleared: boolean
  health: number
  maxLive: number
  spawned: number
  clubsUsed: number
  flasksThrown: number
  seconds: number
}

/**
 * Scripted player: stands at the hut, swings the bone club at the nearest zombie in
 * reach (swapping to a fresh club when one breaks) and throws a flask when 3+ zombies
 * crowd within 5 m. A bandage (+30) is used below 40 HP, up to `bandages` times.
 */
function simulateNight(night: NightNumber, flasks: number, bandages: number): NightResult {
  const rng = createRng(1000 + night)
  let waves: WaveState = startNight(night)
  let zombies: AIEnemy[] = []
  let health = PLAYER_MAX_HEALTH
  let player = { ...PLAYER }
  let swing: SwingState | null = null
  let clubHits = CLUB.durability ?? 30
  let clubsUsed = 1
  let flasksLeft = flasks
  let flasksThrown = 0
  let uid = 0
  let maxLive = 0
  let t = 0
  const limit = 600 // seconds; a stuck night fails rather than hanging

  while (waves.phase !== 'done' && t < limit && health > 0) {
    t += DT
    const live = zombies.filter((z) => z.state !== 'dying' && z.state !== 'dead')

    const wt = tickWaves(waves, DT, { playerPos: player, liveCount: live.length, rng })
    waves = wt.state
    for (const s of wt.spawns) zombies.push(createEnemy(`z${uid++}`, s.type, { x: s.x, z: s.z }))
    maxLive = Math.max(maxLive, zombies.filter((z) => z.state !== 'dying' && z.state !== 'dead').length)

    // Facing: toward the nearest living zombie.
    const alive = zombies.filter((z) => z.hp > 0)
    const nearest = alive.reduce<AIEnemy | null>(
      (best, z) =>
        !best || Math.hypot(z.pos.x - player.x, z.pos.z - player.z) < Math.hypot(best.pos.x - player.x, best.pos.z - player.z) ? z : best,
      null,
    )
    const nd = nearest ? Math.hypot(nearest.pos.x - player.x, nearest.pos.z - player.z) || 1 : 1
    const facing = nearest ? { x: (nearest.pos.x - player.x) / nd, z: (nearest.pos.z - player.z) / nd } : { x: 0, z: -1 }

    // Wailers keep their distance, so the player must hunt them (they are the priority target).
    const wailer = alive.find((z) => z.type === 'wailer')
    if (wailer && alive.every((z) => z.type === 'wailer' || Math.hypot(z.pos.x - player.x, z.pos.z - player.z) > 8)) {
      const d = Math.hypot(wailer.pos.x - player.x, wailer.pos.z - player.z)
      if (d > 1.2) {
        player = {
          x: player.x + ((wailer.pos.x - player.x) / d) * 5.5 * DT,
          z: player.z + ((wailer.pos.z - player.z) / d) * 5.5 * DT,
        }
      }
    }

    // Player actions
    if (health < 40 && bandages > 0) {
      bandages--
      health = Math.min(PLAYER_MAX_HEALTH, health + 30)
    }
    const crowd = alive.filter((z) => Math.hypot(z.pos.x - player.x, z.pos.z - player.z) < 5)
    if (flasksLeft > 0 && crowd.length >= 3) {
      flasksLeft--
      flasksThrown++
      // Aim at the crowd's centroid.
      const c = {
        x: crowd.reduce((a, z) => a + z.pos.x, 0) / crowd.length,
        z: crowd.reduce((a, z) => a + z.pos.z, 0) / crowd.length,
      }
      zombies = resolveFlask(c, zombies, 100, FLASK_STUN_S).enemies
    }
    if (swing) {
      const st = tickSwing(swing, DT)
      swing = st.swing
      if (st.hit) {
        const r = resolveMelee(player, facing, CLUB.damage, zombies, { lanternFuel: 100 })
        zombies = r.enemies
        if (r.hitUids.length > 0) {
          clubHits -= 1
          if (clubHits <= 0) {
            clubsUsed++
            clubHits = CLUB.durability ?? 30
          }
        }
      }
    } else if (nearest && nd < 1.5) {
      swing = startSwing(CLUB.cooldown ?? 0.6)
    }
    const r = tickEnemies(zombies, DT, {
      playerPos: player,
      playerFacing: facing,
      lanternFuel: 100,
    })
    zombies = r.enemies
    for (const ev of r.events as AIEvent[]) {
      if (ev.type === 'enemyAttack') health = damagePlayer(health, ev.damage, false).health
    }
  }
  return {
    cleared: waves.phase === 'done',
    health,
    maxLive,
    spawned: waves.spawned,
    clubsUsed,
    flasksThrown,
    seconds: t,
  }
}

describe('combat/waves checkpoint — headless night simulation', () => {
  it('survives night 1 with the bone club and clears every wave', () => {
    const r = simulateNight(1, 0, 2)
    expect(r.cleared).toBe(true)
    expect(r.health).toBeGreaterThan(0)
    expect(r.spawned).toBe(nightTotal(1))
    expect(r.maxLive).toBeLessThanOrEqual(LIVE_ENEMY_CAP)
  })

  it('survives night 2 with the club and a flask and clears every wave', () => {
    const r = simulateNight(2, 1, 3)
    expect(r.cleared).toBe(true)
    expect(r.health).toBeGreaterThan(0)
    expect(r.spawned).toBe(nightTotal(2))
    expect(r.maxLive).toBeLessThanOrEqual(LIVE_ENEMY_CAP)
    expect(r.flasksThrown).toBeLessThanOrEqual(1)
  })

  it('holds the live cap when a wave is bigger than 14 (night 5 waves have 12; stress with idle player)', () => {
    // An idle player never kills anything, so every spawn the cap allows stays alive.
    const rng = createRng(7)
    let waves = startNight(5)
    let live = 0
    let peak = 0
    for (let i = 0; i < 600; i++) {
      const tk = tickWaves(waves, DT, { playerPos: PLAYER, liveCount: live, rng })
      waves = tk.state
      live += tk.spawns.length
      peak = Math.max(peak, live)
    }
    expect(peak).toBeLessThanOrEqual(LIVE_ENEMY_CAP)
  })

  it('simulating 14 zombies costs far less than a 45 fps frame budget (CPU only)', () => {
    const zs: AIEnemy[] = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2
      return { ...createEnemy(`p${i}`, 'shambler', { x: Math.cos(a) * 20, z: Math.sin(a) * 20 }), state: 'chase' as const }
    })
    let cur: AIEnemy[] = zs
    const frames = 600
    const start = performance.now()
    for (let i = 0; i < frames; i++) {
      cur = tickEnemies(cur, DT, { playerPos: PLAYER, playerFacing: { x: 0, z: -1 }, lanternFuel: 100 }).enemies
    }
    const perFrameMs = (performance.now() - start) / frames
    // 45 fps = 22.2 ms per frame; logic must use a small fraction of it.
    expect(perFrameMs).toBeLessThan(2)
  })
})




