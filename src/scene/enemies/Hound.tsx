// Corpse Hounds (spec 11 H2): every hound of every pack. Rendering only; the pack rules are in
// game/systems/hounds.ts and the step in game/state/creatureStep.ts.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useCreatureStore } from '../../game/state/creatureStore'
import { isSimFrozen } from '../../game/state/menuState'
import { usePlayerStore } from '../../game/state/playerStore'
import { CreatureModel } from './CreatureModel'
import { lookScale, useCreatureRig, type CreatureClip, type LoadedModel } from './creatureRig'

const MAX_DT = 0.1

function HoundBody({ packId, houndId, model }: { packId: string; houndId: string; model: LoadedModel }) {
  const outer = useRef<Group>(null)
  const rig = useCreatureRig('hound', model)
  const scale = useMemo(() => lookScale('hound', model.placeholder), [model.placeholder])
  const last = useRef<{ x: number; z: number } | null>(null)

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
    const h = useCreatureStore
      .getState()
      .packs.find((p) => p.id === packId)
      ?.pack.hounds.find((x) => x.id === houndId)
    const o = outer.current
    if (!h || !o) return
    const dt = Math.min(rawDelta, MAX_DT)
    o.position.set(h.x, 0, h.z)
    // Face the way it is moving; before the first move (and while warning) face the player.
    const prev = last.current
    const moved = prev ? Math.hypot(h.x - prev.x, h.z - prev.z) : 0
    if (prev && moved > 0.001 && h.mode !== 'tell') o.rotation.y = Math.atan2(h.x - prev.x, h.z - prev.z)
    else {
      const p = usePlayerStore.getState().position
      o.rotation.y = Math.atan2(p[0] - h.x, p[2] - h.z)
    }
    last.current = { x: h.x, z: h.z }
    const clip: CreatureClip =
      h.mode === 'tell' ? 'Threaten' : h.mode === 'circle' ? 'Walk' : 'Run'
    rig.play(clip)
    rig.update(dt)
  })

  return (
    <group ref={outer} scale={scale}>
      <primitive object={rig.root} />
    </group>
  )
}

export function Hounds() {
  // "pack:hound" pairs; the list re-renders only when a hound appears or leaves.
  const key = useCreatureStore((s) =>
    s.packs.flatMap((p) => p.pack.hounds.map((h) => `${p.id}|${h.id}`)).join(','),
  )
  const list = key === '' ? [] : key.split(',').map((k) => k.split('|') as [string, string])
  return (
    <>
      {list.map(([packId, houndId]) => (
        <CreatureModel key={`${packId}|${houndId}`} id="hound">
          {(m) => <HoundBody packId={packId} houndId={houndId} model={m} />}
        </CreatureModel>
      ))}
    </>
  )
}
