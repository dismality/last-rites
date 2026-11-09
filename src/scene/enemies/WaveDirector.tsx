// WaveDirector: feeds the pure wave system each frame, turns its spawns into zombies
// and reports `wavesCleared` to the day/night system. No rules live here (see
// game/systems/waves.ts). Mount inside <GameLoop>, next to EnemyDirector.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { NIGHT_MAP, type NightNumber } from '../../data/waves'
import { subscribeToType } from '../../game/events'
import { LAST_NIGHT } from '../../data/balance'
import { useChapelStore, useEnemyStore, usePlayerStore, useWorldStore } from '../../game/state'
import { useEndingStore } from '../../game/state/endingStore'
import { isSimFrozen } from '../../game/state/menuState'
import { useWaveStore } from '../../game/state/waveStore'
import { createEnemy } from '../../game/systems/enemyAI'
import { createRng } from '../../game/rng'
import { emitCombatSound } from '../../game/state/combatSounds'
import { startNight, tickWaves } from '../../game/systems/waves'
import { graveBurstRuntime } from '../effects/graveBurstRuntime'

const MAX_DT = 0.1

export function WaveDirector() {
  const rng = useRef(createRng(1849))
  const uid = useRef(0)

  useEffect(
    () =>
      subscribeToType('nightStarted', (ev) => {
        const def = NIGHT_MAP[ev.nightNumber as NightNumber]
        useWorldStore.getState().setWavesCleared(false)
        // A retried night 5 starts the rite flow afresh (progress itself is kept).
        useEndingStore.getState().setNightFiveCleared(false)
        useEndingStore.getState().setRiteStarted(false)
        useChapelStore.getState().setFinalRiteActive(false)
        useWaveStore.getState().setTotalWaves(def?.waves.length ?? 0)
        useWaveStore.getState().setWaves(startNight(ev.nightNumber))
      }),
    [],
  )

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
    const waves = useWaveStore.getState().waves
    if (waves.phase === 'idle' || waves.phase === 'done') return

    const enemies = useEnemyStore.getState().enemies
    const player = usePlayerStore.getState().position
    const r = tickWaves(waves, Math.min(rawDelta, MAX_DT), {
      playerPos: { x: player[0], z: player[2] },
      liveCount: enemies.filter((e) => e.state !== 'dying' && e.state !== 'dead').length,
      rng: rng.current,
    })
    useWaveStore.getState().setWaves(r.state)

    if (r.spawns.length > 0) {
      useEnemyStore
        .getState()
        .setEnemies([
          ...enemies,
          ...r.spawns.map((s) => createEnemy(`z-${uid.current++}`, s.type, { x: s.x, z: s.z })),
        ])
      r.spawns.forEach((s) => graveBurstRuntime.queue.push({ x: s.x, z: s.z }))
      for (const s of r.spawns) {
        const at = { x: s.x, y: 0, z: s.z }
        if (s.elite) emitCombatSound('elite-arrival', at)
        if (s.type === 'brute') emitCombatSound('brute-grunt', at)
      }
    }
    if (r.events.some((e) => e.type === 'wavesCleared')) {
      // Night 5 does not end at dawn: it ends with the rite or the Taken ending.
      if (useWorldStore.getState().nightNumber >= LAST_NIGHT) {
        useEndingStore.getState().setNightFiveCleared(true)
      } else {
        useWorldStore.getState().setWavesCleared(true)
      }
    }
  })

  return null
}
