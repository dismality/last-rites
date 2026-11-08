// GameLoop: thin driver for the fixed-timestep simulation. All rules live in src/game.

import { Suspense, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { emit } from '../game/events'
import { useDigStore } from '../game/state/digStore'
import {
  useGameStore,
  useLanternStore,
  usePlayerStore,
  useWorldStore,
} from '../game/state'
import { STEP, advanceAccumulator } from '../game/systems/fixedStep'
import { runTick, type TickInput } from '../game/systems/gameTick'
import type { GameEvent, StaminaState } from '../game/types'
import { input } from './player/input'
import { usePauseTriggers } from './player/usePauseTriggers'

export { STEP, MAX_DELTA } from '../game/systems/fixedStep'

interface GameLoopProps {
  /** Sampled once per tick. Defaults to the live keyboard bindings. */
  sampleInput?: () => TickInput
  /** Scene content that needs physics (controller, cemetery). */
  children?: ReactNode
}

// peek, not sample: look deltas are consumed per render frame by the controller.
const liveInput = (): TickInput => ({ sprinting: input.peek().sprint })

function TickDriver({ sampleInput = liveInput }: { sampleInput?: () => TickInput }) {
  usePauseTriggers()
  const accumulator = useRef(0)
  // regenDelayTimer is sim-internal, so it lives here rather than in a store.
  const staminaDelay = useRef(0)

  useFrame((_state, delta) => {
    // Paused: skip entirely and drop the backlog so resume doesn't fast-forward.
    const { paused, examining, journalOpen, screen } = useGameStore.getState()
    // The ending sequence plays over a frozen world.
    if (paused || examining || journalOpen || screen === 'ending') {
      accumulator.current = 0
      return
    }

    const step = advanceAccumulator(accumulator.current, delta)
    accumulator.current = step.accumulator

    const pending: GameEvent[] = []
    for (let i = 0; i < step.ticks; i++) {
      const player = usePlayerStore.getState()
      const lantern = useLanternStore.getState()
      const world = useWorldStore.getState()
      const stamina: StaminaState = {
        stamina: player.stamina,
        regenDelayTimer: staminaDelay.current,
      }

      const r = runTick(
        { player, stamina, lantern, world },
        sampleInput(),
        STEP
      )

      staminaDelay.current = r.stamina.regenDelayTimer
      usePlayerStore.getState().applyPlayerState({ stamina: r.player.stamina })
      useLanternStore.getState().applyLanternState(r.lantern)
      useWorldStore.getState().applyWorldState(r.world)
      pending.push(...r.events)
      // Same fixed step as everything else, so a dig takes DIG_DURATION_S of sim time.
      useDigStore.getState().step(STEP, input.peek().interact)
    }

    // Publish after all systems have run so subscribers see consistent state.
    pending.forEach(emit)
  })

  return null
}

// Rapier loads WASM asynchronously, so <Physics> must sit inside <Suspense>.
export function GameLoop({ sampleInput, children }: GameLoopProps) {
  return (
    <Suspense fallback={null}>
      <Physics>
        <TickDriver sampleInput={sampleInput} />
        {children}
      </Physics>
    </Suspense>
  )
}
