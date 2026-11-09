import { useFrame } from '@react-three/fiber'
import { stepMusic } from '../../audio/music'
import { isSimFrozen } from '../../game/state/menuState'
import { musicRuntime } from '../../game/state/musicRuntime'

/** Feeds the reactive-music runtime into the stem gains each frame. Renders nothing. */
export function MusicDriver(): null {
  useFrame(() => {
    stepMusic({ stems: musicRuntime.stems, master: musicRuntime.master, frozen: isSimFrozen() })
  })
  return null
}
