import { beforeEach, describe, expect, it } from 'vitest'
import { gasRuntime } from '../../scene/effects/gasRuntime'
import { graveBurstRuntime } from '../../scene/effects/graveBurstRuntime'
import { meleeRuntime } from '../../scene/player/meleeRuntime'
import { useBossStore } from './bossStore'
import { useChapelStore } from './chapelStore'
import { useCombatStore } from './combatStore'
import { useDoorStore } from './doorStore'
import { useEffectStore } from './effectStore'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useFeedbackStore } from './feedbackStore'
import { clearNightState } from './nightState'
import { useProjectileStore } from './projectileStore'
import { useWaveStore } from './waveStore'

describe('clearNightState', () => {
  beforeEach(() => {
    useCombatStore.setState(useCombatStore.getInitialState(), true)
    useDoorStore.getState().reset()
    useEffectStore.getState().clear()
  })

  it('empties every Night_State item', () => {
    useEffectStore.getState().setEffects([{ id: 'adrenaline', remainingS: 10 } as never])
    gasRuntime.queue.push({ x: 1, z: 1 })
    meleeRuntime.dustQueue.push({} as never)
    graveBurstRuntime.queue.push({ x: 2, z: 2 })
    useEnemyStore.getState().setEnemies([{ uid: 'z-1' } as never])
    useFeedbackStore.getState().setTooTired(true)
    useCombatStore.getState().patchLive({ sinceShotS: 3, kickLeftS: 1, tooTiredS: 1, dodgeCooldownS: 1 })
    useDoorStore.getState().setNail({ door: 'front', elapsedS: 1 })
    useProjectileStore.getState().setSalts([{ id: 's' } as never])
    useEndingStore.getState().setRiteStarted(true)
    useChapelStore.getState().setFinalRiteActive(true)

    clearNightState()

    expect(useEffectStore.getState().effects).toEqual([])
    expect(gasRuntime.queue).toEqual([])
    expect(meleeRuntime.dustQueue).toEqual([])
    expect(graveBurstRuntime.queue).toEqual([])
    expect(useEnemyStore.getState().enemies).toEqual([])
    expect(useBossStore.getState().boss).toEqual(useBossStore.getInitialState().boss)
    expect(useFeedbackStore.getState().tooTired).toBe(false)
    expect(useCombatStore.getState().live).toEqual(useCombatStore.getInitialState().live)
    expect(useDoorStore.getState().nail).toBeNull()
    expect(useProjectileStore.getState().salts).toEqual([])
    expect(useWaveStore.getState().totalWaves).toBe(0)
    expect(useEndingStore.getState().riteStarted).toBe(false)
    expect(useChapelStore.getState().chapel.finalRiteActive).toBe(false)
  })

  it('leaves persisted combat fields untouched', () => {
    useCombatStore.setState({
      firearms: { revolver: { magazine: 3 } },
      durability: { 'wood-axe': 40 },
      upgrades: ['up-axe-edge'],
      takenPickups: ['revolver'],
    })
    useDoorStore.getState().build()
    const doors = useDoorStore.getState().doors

    clearNightState()

    const s = useCombatStore.getState()
    expect(s.firearms).toEqual({ revolver: { magazine: 3 } })
    expect(s.durability).toEqual({ 'wood-axe': 40 })
    expect(s.upgrades).toEqual(['up-axe-edge'])
    expect(s.takenPickups).toEqual(['revolver'])
    expect(useDoorStore.getState().built).toBe(true)
    expect(useDoorStore.getState().doors).toEqual(doors)
  })
})
