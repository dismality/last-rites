// WaveDirector: feeds the pure wave system each frame, turns its spawns into zombies
// and reports `wavesCleared` to the day/night system. No rules live here (see
// game/systems/waves.ts). Mount inside <GameLoop>, next to EnemyDirector.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { subscribeToType, emit } from '../../game/events'
import { useChapelStore, useEnemyStore, usePlayerStore, useWorldStore } from '../../game/state'
import { useEndingStore } from '../../game/state/endingStore'
import { isSimFrozen } from '../../game/state/menuState'
import { useProgressionStore } from '../../game/state/progressionStore'
import { updateRunStats } from '../../game/state/statsPort'
import { useWaveStore } from '../../game/state/waveStore'
import { createRng } from '../../game/rng'
import { emitCombatSound } from '../../game/state/combatSounds'
import { tickWaves } from '../../game/systems/waves'
import {
  clearedRoute,
  createWaveEnemy,
  eliteChanceFor,
  nightRngs,
  planNight,
  statsAfterClear,
} from '../../game/systems/waveDirection'
import { graveBurstRuntime } from '../effects/graveBurstRuntime'

const MAX_DT = 0.1

export function WaveDirector() {
  const rng = useRef(createRng(1849))
  const eliteRng = useRef(createRng(1849))
  // Night whose clear was already announced; the night-5 rite assault clears again.
  const announced = useRef<number | null>(null)
  const uid = useRef(0)

  useEffect(
    () =>
      subscribeToType('nightStarted', (ev) => {
        const { mode, seed } = useProgressionStore.getState()
        const plan = planNight(mode, ev.nightNumber)
        const streams = nightRngs(seed, ev.nightNumber)
        rng.current = streams.rng
        eliteRng.current = streams.eliteRng
        announced.current = null
        useWorldStore.getState().setWavesCleared(false)
        // A retried night 5 starts the rite flow afresh (progress itself is kept).
        useEndingStore.getState().setNightFiveCleared(false)
        useEndingStore.getState().setRiteStarted(false)
        useChapelStore.getState().setFinalRiteActive(false)
        useWaveStore.getState().setTotalWaves(plan.totalWaves)
        useWaveStore.getState().setWaves(plan.state)
      }),
    [],
  )

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
    const waves = useWaveStore.getState().waves
    if (waves.phase === 'idle' || waves.phase === 'done') return

    const { mode } = useProgressionStore.getState()
    const enemies = useEnemyStore.getState().enemies
    const player = usePlayerStore.getState().position
    const r = tickWaves(waves, Math.min(rawDelta, MAX_DT), {
      playerPos: { x: player[0], z: player[2] },
      liveCount: enemies.filter((e) => e.state !== 'dying' && e.state !== 'dead').length,
      rng: rng.current,
      eliteRng: eliteRng.current,
      eliteChance: eliteChanceFor(mode),
    })
    useWaveStore.getState().setWaves(r.state)

    if (r.spawns.length > 0) {
      useEnemyStore
        .getState()
        .setEnemies([
          ...enemies,
          ...r.spawns.map((s) => createWaveEnemy(`z-${uid.current++}`, s, mode, waves.night ?? 1)),
        ])
      r.spawns.forEach((s) => graveBurstRuntime.queue.push({ x: s.x, z: s.z }))
      for (const s of r.spawns) {
        const at = { x: s.x, y: 0, z: s.z }
        if (s.elite) emitCombatSound('elite-arrival', at)
        if (s.type === 'brute') emitCombatSound('brute-grunt', at)
      }
    }
    if (r.events.some((e) => e.type === 'wavesCleared')) {
      const night = waves.night ?? useWorldStore.getState().nightNumber
      if (announced.current !== night) {
        announced.current = night
        updateRunStats((s) => statsAfterClear(s, mode, night))
        emit({ type: 'nightCleared', nightNumber: night })
      }
      // Story night 5 does not end at dawn: it ends with the rite or the Taken ending.
      if (clearedRoute(mode, night) === 'rite') {
        useEndingStore.getState().setNightFiveCleared(true)
      } else {
        useWorldStore.getState().setWavesCleared(true)
      }
    }
  })

  return null
}
