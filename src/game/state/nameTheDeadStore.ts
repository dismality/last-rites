// Name the Dead glue (spec 10 task 11): reads the hovered glowing grave, the evidence found and
// damage taken, steps the pure hold at the fixed timestep, and on a seal speaks the name, shuts
// the grave for the wave and scores. No React / three.js imports.

import { create } from 'zustand'
import { NAME_HIT_TEXT, NAME_SEALED_TEXT, NAME_THE_DEAD, UNKNOWN_NAME_TEXT } from '../../data/nameTheDead'
import { subscribeToType } from '../events'
import { createNameHold, isNameKnown, nameHoldProgress, tickNameHold, type NameHold } from '../systems/nameTheDead'
import { emitCombatSound } from './combatSounds'
import { economy } from './economyPort'
import { useInteractionStore } from './interactionStore'
import { isMenuOpen } from './menuState'
import { foundClues } from './tieredCraft'
import { useToastStore } from './toastStore'
import { useWaveStore } from './waveStore'

/** Interactable ids of glowing graves are `name:<wave grave id>`. */
export const NAME_ID_PREFIX = 'name:'

interface NameTheDeadState {
  hold: NameHold
  /** 0-1 progress of the hold in progress, for the HUD ring. */
  progress: number
  /** The name being spoken while the hold runs, or null. */
  naming: string | null
  /** Graves sealed this run (for the run summary and the e2e). */
  sealedCount: number
  step: (dt: number, interactHeld: boolean) => void
  reset: () => void
}

let hitPending = false
subscribeToType('playerDamaged', () => {
  hitPending = true
})

export const useNameTheDeadStore = create<NameTheDeadState>((set, get) => ({
  hold: createNameHold(),
  progress: 0,
  naming: null,
  sealedCount: 0,
  step: (dt, interactHeld) => {
    const hit = hitPending
    hitPending = false
    const glow = useWaveStore.getState().glow
    const hoverId = useInteractionStore.getState().hover?.id ?? null
    const onGlow = glow !== null && hoverId === `${NAME_ID_PREFIX}${glow.graveId}`
    const sealed = useWaveStore.getState().sealed
    const alreadySealed = glow !== null && sealed?.graveId === glow.graveId && sealed.wave === glow.wave
    const target = onGlow && !alreadySealed ? glow.graveId : null
    const known = glow !== null && isNameKnown(glow.name, foundClues())
    const r = tickNameHold(get().hold, dt, {
      // A satchel or journal opened mid-hold counts as letting go.
      held: interactHeld && !isMenuOpen(),
      target,
      known,
      hit,
    })
    const progress = nameHoldProgress(r.state)
    const naming = progress > 0 && glow !== null ? glow.name : null
    if (r.state !== get().hold || progress !== get().progress || naming !== get().naming) {
      set({ hold: r.state, progress, naming })
    }
    if (r.event === null || glow === null) return
    const toast = useToastStore.getState().push
    if (r.event === 'unknown') toast(UNKNOWN_NAME_TEXT)
    else if (r.event === 'struck') toast(NAME_HIT_TEXT)
    else {
      useWaveStore.getState().seal(glow.graveId, glow.wave)
      economy().addScore(NAME_THE_DEAD.score)
      // The keeper speaks the name: a voice, not a place, so it is not spatial.
      emitCombatSound('name-spoken', undefined, undefined, glow.name)
      toast(NAME_SEALED_TEXT.replace('NAME', glow.name))
      set({ sealedCount: get().sealedCount + 1 })
    }
  },
  reset: () => {
    hitPending = false
    set({ hold: createNameHold(), progress: 0, naming: null, sealedCount: 0 })
  },
}))
