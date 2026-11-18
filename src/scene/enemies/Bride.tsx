// The Hollow Bride (spec 11 H2): invisible until she is in the lantern cone or within 3 m, drawn
// as a fading material opacity so her approach is never a pop. She has no physics body: walls and
// salt stop her in game/state/creatureStep.ts (BRIDE_WALLS), and fences and gravestones do not.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useCreatureStore } from '../../game/state/creatureStore'
import { isSimFrozen } from '../../game/state/menuState'
import { usePlayerStore } from '../../game/state/playerStore'
import { CreatureModel } from './CreatureModel'
import { lookScale, useCreatureRig, type LoadedModel } from './creatureRig'

const MAX_DT = 0.1
/** Opacity when drawn: a pale, see-through figure. */
const SHOWN_OPACITY = 0.8
/** Seconds to fade fully in or out. */
const FADE_S = 0.35
/** She floats a little off the ground. */
const HOVER_M = 0.15

function BrideBody({ model }: { model: LoadedModel }) {
  const outer = useRef<Group>(null)
  const rig = useCreatureRig('bride', model, true)
  const scale = useMemo(() => lookScale('bride', model.placeholder), [model.placeholder])
  const opacity = useRef(0)

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
    const o = outer.current
    if (!o) return
    const dt = Math.min(rawDelta, MAX_DT)
    const { bride, brideVisible } = useCreatureStore.getState()
    const p = usePlayerStore.getState().position
    o.position.set(bride.x, HOVER_M, bride.z)
    o.rotation.y = Math.atan2(p[0] - bride.x, p[2] - bride.z)
    const target = brideVisible ? SHOWN_OPACITY : 0
    const step = (SHOWN_OPACITY / FADE_S) * dt
    opacity.current += Math.max(-step, Math.min(step, target - opacity.current))
    rig.setOpacity(opacity.current)
    // A fully faded bride is not drawn at all.
    o.visible = opacity.current > 0.01
    rig.play(bride.tellLeft !== null ? 'Threaten' : 'Walk')
    rig.update(dt)
  })

  return (
    <group ref={outer} visible={false} scale={scale}>
      <primitive object={rig.root} />
    </group>
  )
}

export function Bride() {
  const alive = useCreatureStore((s) => s.bride.alive)
  if (!alive) return null
  return <CreatureModel id="bride">{(m) => <BrideBody model={m} />}</CreatureModel>
}
