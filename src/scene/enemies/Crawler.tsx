// Pale Crawlers (spec 11 H2): drawn only once they have burst out of their mound or coffin, so a
// hidden crawler costs nothing and cannot be spotted early. Rendering only: state and rules are in
// game/state/creatureStep.ts and game/systems/crawler.ts.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { CREATURE_LIFETIME_S, CRAWLER } from '../../data/creatures'
import { useCreatureStore } from '../../game/state/creatureStore'
import { isSimFrozen } from '../../game/state/menuState'
import { usePlayerStore } from '../../game/state/playerStore'
import { CreatureModel } from './CreatureModel'
import { lookScale, useCreatureRig, type LoadedModel } from './creatureRig'

const MAX_DT = 0.1
/** Seconds the crawler takes to climb out, and to sink back at the end of its time. */
const RISE_S = 0.4
const SINK_S = 0.8
const DEPTH_M = 0.5

function CrawlerBody({ crawlerId, model }: { crawlerId: string; model: LoadedModel }) {
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const rig = useCreatureRig('crawler', model)
  const scale = useMemo(() => lookScale('crawler', model.placeholder), [model.placeholder])

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
    const e = useCreatureStore.getState().crawlers.find((c) => c.id === crawlerId)
    const o = outer.current
    const i = inner.current
    if (!e || !o || !i) return
    const dt = Math.min(rawDelta, MAX_DT)
    const p = usePlayerStore.getState().position
    o.position.set(e.c.x, 0, e.c.z)
    o.rotation.y = Math.atan2(p[0] - e.c.x, p[2] - e.c.z) // models face +Z
    const rise = Math.min(1, e.emergedS / RISE_S)
    const sink = Math.max(0, e.emergedS - (CREATURE_LIFETIME_S.crawlerEmerged - SINK_S)) / SINK_S
    i.position.y = -(1 - rise) * DEPTH_M - sink * DEPTH_M
    i.scale.set(scale[0], scale[1], scale[2])
    // The warning is the threaten pose; the grab is the attack clip for the first part of its cooldown.
    const grabbing = e.c.grabCooldown > CRAWLER.grabCooldownS - 0.4
    rig.play(grabbing ? 'Attack' : e.c.tellLeft !== null ? 'Threaten' : 'Crawl')
    rig.update(dt)
  })

  return (
    <group ref={outer}>
      <group ref={inner}>
        <primitive object={rig.root} />
      </group>
    </group>
  )
}

/** Every emerged crawler. The list re-renders only when one emerges or sinks away. */
export function Crawlers() {
  const key = useCreatureStore((s) =>
    s.crawlers
      .filter((c) => c.c.phase === 'emerged')
      .map((c) => c.id)
      .join(','),
  )
  const ids = key === '' ? [] : key.split(',')
  return (
    <>
      {ids.map((id) => (
        <CreatureModel key={id} id="crawler">
          {(m) => <CrawlerBody crawlerId={id} model={m} />}
        </CreatureModel>
      ))}
    </>
  )
}
