// Consumable driver: an attack press with a consumable in hand calls `useHeld`. Bandage and
// Lantern Refill become timed uses that the combat tick finishes; Blessed Rounds and Kola Tonic
// apply at once. A hit (playerDamaged watcher) and a weapon switch (combat store) already drop
// the use; this component also drops it on pause. No rules live here. Mount inside <GameLoop>.
// Requirements 12.1, 12.2.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCombatStore } from '../../game/state/combatStore'
import { useHeld as consumeHeld } from '../../game/state/combatActions'
import { isSimFrozen } from '../../game/state/menuState'
import { input } from './input'

export function UseController() {
  const prevAttack = useRef(false)

  useFrame(() => {
    const snap = input.peek()
    // Tracked while frozen so a click held through pause does not start a use on resume.
    const edge = snap.attack && !prevAttack.current
    prevAttack.current = snap.attack

    if (isSimFrozen()) {
      // A use must not survive a pause: cancelled with no effect and nothing spent.
      const combat = useCombatStore.getState()
      if (combat.live.use) combat.patchLive({ use: null })
      return
    }
    if (edge) consumeHeld()
  })

  return null
}
