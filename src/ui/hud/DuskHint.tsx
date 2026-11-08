import { useEffect } from 'react'
import { subscribeToType } from '../../game/events'
import { useToastStore } from '../../game/state/toastStore'

/** Zombies only rise at night, so tell the player when the bell is about to ring. */
export const DUSK_HINT = 'They rise at nightfall.'

/** Renders nothing; pushes a toast whenever dusk begins. */
export function DuskHint() {
  useEffect(
    () =>
      subscribeToType('phaseChanged', (ev) => {
        if (ev.phase === 'dusk') useToastStore.getState().push(DUSK_HINT)
      }),
    [],
  )
  return null
}
