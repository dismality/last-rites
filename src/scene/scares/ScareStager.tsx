// ScareStager: runs the pure scare director each frame and turns its cues into staged effects
// (telegraph first, main beat after the lead time). No scare rules live here: chance, cooldowns
// and repeat rules are in game/systems/scareDirector.ts; geometry rules in scareStaging.ts.
// Mount inside <GameLoop>, next to the other directors.
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { duckAmbient, playScareSound, type ScareSound } from '../../audio/AudioManager'
import { LURKER_TELEGRAPH_S } from '../../data/enemies'
import {
  SCARE_CANDLES,
  SCARE_DOORS,
  SCARE_EVENT_MAP,
  SCARE_NICHES,
  SCARE_STAGING,
  SCARE_STATUES,
  type ScareEventId,
  type TelegraphCue,
} from '../../data/scares'
import { emit, subscribeToType } from '../../game/events'
import { createRng, type Rng } from '../../game/rng'
import {
  useEnemyStore,
  useGameStore,
  useLanternStore,
  usePlayerStore,
  useSettingsStore,
  useWorldStore,
} from '../../game/state'
import { isMenuOpen } from '../../game/state/menuState'
import { createEnemy } from '../../game/systems/enemyAI'
import {
  createScareDirectorState,
  tickScares,
  type ScareCue,
  type ScareDirectorState,
} from '../../game/systems/scareDirector'
import {
  behindPoint,
  pickBehind,
  sidePoint,
  startSnuff,
  tickCandles,
  tickDoor,
  tickStatue,
  triggerStatue,
  zoneForEvent,
} from '../../game/systems/scareStaging'
import { SCARE_ENEMY_PREFIX } from '../enemies/scareEnemy'
import { resetScareRuntime, scareRuntime } from './scareRuntime'
import { resetStagedProps, stagedProps } from './stagedProps'

const MAX_DT = 0.1
const S = SCARE_STAGING
/** Eye height for positional audio. */
const AUDIO_Y = 1.4
/** Telegraph sounds stay audible at Off: they are cues, not stingers, and keep scares fair. */
const TELEGRAPH_MIN_VOLUME = 0.4

const TELEGRAPH_SOUND: Partial<Record<TelegraphCue, ScareSound>> = {
  'stone-grind': 'stone-grind',
  'wind-gust': 'wind-gust',
  'door-creak': 'door-creak',
  'soil-crumble': 'soil-crumble',
}

/** Per-event facts picked at the telegraph and reused at the beat. */
interface Pending {
  zoneId?: string
  side: -1 | 1
  doorIndex?: number
}

export function ScareStager() {
  const director = useRef<ScareDirectorState | null>(null)
  const rng = useRef<Rng | null>(null)
  const queue = useRef<ScareCue[]>([])
  const digDone = useRef(false)
  const picked = useRef(new Map<ScareEventId, Pending>())
  const lurkerCount = useRef({ n: 0 })

  useEffect(() => {
    resetStagedProps()
    resetScareRuntime()
    director.current = createScareDirectorState()
    rng.current = createRng((Math.random() * 0xffffffff) >>> 0)
    queue.current = []
    const off = subscribeToType('digCompleted', () => {
      digDone.current = true
    })
    return () => {
      off()
      resetStagedProps()
      resetScareRuntime()
    }
  }, [])

  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    if (gs.paused || gs.examining || gs.journalOpen || gs.taken) return
    const state = director.current
    const random = rng.current
    if (!state || !random) return

    const dt = Math.min(rawDelta, MAX_DT)
    const player = usePlayerStore.getState()
    const settings = useSettingsStore.getState()
    const blocking = isMenuOpen()

    const entered = scareRuntime.justEntered.splice(0)
    const result = tickScares(
      state,
      dt,
      {
        enteredZones: entered,
        lanternFuel: useLanternStore.getState().fuel,
        phase: useWorldStore.getState().phase,
        // Placed tallow candles have no runtime yet; wire them in when they do (design bible §9).
        nearCandle: false,
        uiBlocking: blocking,
        intensity: settings.scareIntensity,
        cameraShakeEnabled: settings.cameraShake,
        digCompleted: digDone.current,
      },
      random,
    )
    digDone.current = false
    director.current = result.state
    queue.current.push(...result.cues)

    // Telegraphs play at once; a beat waits while a menu is open so it never fires over one.
    const now = result.state.time
    const due: ScareCue[] = []
    queue.current = queue.current.filter((cue) => {
      if (cue.at > now) return true
      if (cue.phase === 'beat' && blocking) return true
      due.push(cue)
      return false
    })
    for (const cue of due) {
      if (cue.phase === 'telegraph') telegraph(cue, random, picked.current)
      else beat(cue, picked.current, lurkerCount.current)
    }

    tickProps(dt, player.position, player.yaw)
  })

  return null
}

function telegraph(cue: ScareCue, random: Rng, picked: Map<ScareEventId, Pending>): void {
  const def = SCARE_EVENT_MAP[cue.eventId]
  const p = usePlayerStore.getState()
  const pos = { x: p.position[0], z: p.position[2] }
  const zone = zoneForEvent(cue.eventId, pos)
  const side: -1 | 1 = random() < 0.5 ? -1 : 1
  const info: Pending = { zoneId: zone?.id, side }
  picked.set(cue.eventId, info)

  emit({ type: 'scareFired', scareId: cue.eventId })
  emit({
    type: 'subtitleShown',
    text: def.subtitle,
    duration: S.subtitleS,
    force: cue.intensityProfile.subtitle === 'always',
  })

  const vol = Math.max(cue.intensityProfile.stingerVolume, TELEGRAPH_MIN_VOLUME)
  const lead = def.telegraph.lead
  const sound = TELEGRAPH_SOUND[def.telegraph.cue]

  switch (cue.eventId) {
    case 'statue-turn': {
      // Grinding comes from behind: the player turns toward the sound and finds the statue moved.
      const at = behindPoint(pos, p.yaw, 3)
      if (sound) playScareSound(sound, at.x, AUDIO_Y, at.z, vol)
      break
    }
    case 'candle-snuff':
    case 'whisper-name': {
      // Wind and whispers come from the side the event will happen on.
      const at = sidePoint(pos, p.yaw, side, S.whisperSideM * 2)
      if (sound) playScareSound(sound, at.x, AUDIO_Y, at.z, vol)
      if (def.telegraph.cue === 'silence') duckAmbient(lead + S.duckAfterBeatS)
      break
    }
    case 'breath-behind':
      scareRuntime.flickerLeft = lead + 0.2
      scareRuntime.flickerStrobe = useSettingsStore.getState().flashingLights
      break
    case 'door-slam': {
      const doors = SCARE_DOORS.map((d, index) => ({ ...d, index }))
        .filter((d) => d.zoneId === zone?.id)
      const door = pickBehind(pos, p.yaw, doors)
      if (door) {
        info.doorIndex = door.index
        stagedProps.doorCreakLead = lead
        stagedProps.doors.set(door.index, { phase: 'creak', t: 0 })
        playScareSound('door-creak', door.position[0], AUDIO_Y, door.position[2], vol)
      }
      break
    }
    case 'hand-from-grave':
      stagedProps.hand.x = pos.x
      stagedProps.hand.z = pos.z
      playScareSound('soil-crumble', pos.x, 0.1, pos.z, vol)
      break
    case 'lurker-lunge':
    case 'false-quiet':
      duckAmbient(lead + (cue.eventId === 'false-quiet' ? S.falseQuietS : S.duckAfterBeatS))
      break
  }
}

function beat(cue: ScareCue, picked: Map<ScareEventId, Pending>, lurkers: { n: number }): void {
  const info = picked.get(cue.eventId) ?? { side: 1 as const }
  picked.delete(cue.eventId)
  const p = usePlayerStore.getState()
  const pos = { x: p.position[0], z: p.position[2] }
  const vol = cue.intensityProfile.stingerVolume
  const shake = (): void => {
    if (cue.intensityProfile.cameraShake) scareRuntime.shakeAge = 0
  }

  switch (cue.eventId) {
    case 'statue-turn': {
      const zoneId = info.zoneId
      if (zoneId && SCARE_STATUES.some((s) => s.zoneId === zoneId)) {
        stagedProps.statues.set(zoneId, triggerStatue(stagedProps.statues.get(zoneId) ?? { status: 'away', waited: 0 }))
      }
      break
    }
    case 'candle-snuff': {
      const cluster = SCARE_CANDLES.find((c) => c.zoneId === info.zoneId)
      if (cluster) {
        const points = cluster.positions.map((v) => ({ x: v[0], z: v[2] }))
        stagedProps.candles.set(cluster.zoneId, startSnuff(points, pos))
      }
      break
    }
    case 'whisper-name': {
      const at = sidePoint(pos, p.yaw, info.side, S.whisperSideM)
      playScareSound('whisper-keeper', at.x, AUDIO_Y, at.z, vol)
      break
    }
    case 'breath-behind': {
      const at = behindPoint(pos, p.yaw, S.breathBehindM)
      playScareSound('breath-behind', at.x, AUDIO_Y, at.z, vol)
      break
    }
    case 'door-slam': {
      if (info.doorIndex !== undefined) {
        stagedProps.doors.set(info.doorIndex, { phase: 'slam', t: 0 })
        const d = SCARE_DOORS[info.doorIndex]
        playScareSound('door-slam', d.position[0], AUDIO_Y, d.position[2], vol)
      } else {
        const at = behindPoint(pos, p.yaw, 3)
        playScareSound('door-slam', at.x, AUDIO_Y, at.z, vol)
      }
      shake()
      break
    }
    case 'lurker-lunge':
      spawnLurker(info.zoneId, vol, lurkers)
      shake()
      break
    case 'hand-from-grave':
      stagedProps.hand.age = 0
      scareRuntime.slowLeft = S.handSlowS
      playScareSound('hand-grab', pos.x, 0.2, pos.z, vol)
      shake()
      break
    case 'false-quiet':
      break
  }
}

function spawnLurker(zoneId: string | undefined, vol: number, lurkers: { n: number }): void {
  const niche = SCARE_NICHES.find((n) => n.zoneId === zoneId)
  if (!niche) return
  const uid = `${SCARE_ENEMY_PREFIX}lurker-${lurkers.n++}`
  const lurker = createEnemy(uid, 'lurker', { x: niche.position[0], z: niche.position[2] })
  // Skip most of the AI's own motionless breath: the director's silence was the telegraph.
  const awake = { ...lurker, state: 'lunge' as const, stateTime: LURKER_TELEGRAPH_S - S.lurkerPreLungeS }
  const store = useEnemyStore.getState()
  store.setEnemies([...store.enemies, awake])
  playScareSound('breath-behind', niche.position[0], AUDIO_Y, niche.position[2], vol)
}

/** Advance the prop animations that depend on where the player is looking. */
function tickProps(dt: number, position: readonly number[], yaw: number): void {
  const player = { x: position[0], z: position[2] }
  for (const st of SCARE_STATUES) {
    const cur = stagedProps.statues.get(st.zoneId)
    if (cur) {
      stagedProps.statues.set(st.zoneId, tickStatue(cur, dt, player, yaw, { x: st.position[0], z: st.position[2] }))
    }
  }
  stagedProps.doors.forEach((d, i) => stagedProps.doors.set(i, tickDoor(d, dt)))
  stagedProps.candles.forEach((c, zone) => stagedProps.candles.set(zone, tickCandles(c, dt)))
  stagedProps.hand.age += dt
}
