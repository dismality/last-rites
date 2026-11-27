// Diggable grave mounds. Each is an Interactable "dig" target; the hold-E dig itself runs in
// digStore at the fixed step. A mound shows nothing on top: loot appears only after the dig.
// By day the dig glyph shows from afar while the dig tutorial hint is up; otherwise it shows in
// lantern range like any other target. Digging is never the objective, so no beacon marks a mound.

import { useEffect } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { DRACO_PATH, propModelUrl } from '../../data/assets'
import '../assets/preloadModels'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { MOUND_DAY_RUNE_RANGE_M } from '../../game/systems/digGuidance'
import { currentTutorialStep } from '../../game/systems/tutorial'
import { DIG_STEP_ID } from '../../data/tutorialSteps'
import { useSettingsStore } from '../../game/state/settingsStore'
import { useDigStore, diggableGraves, DIG_ID_PREFIX } from '../../game/state/digStore'
import { useWorldStore } from '../../game/state/worldStore'
import { useToastStore } from '../../game/state/toastStore'
import { subscribeToType } from '../../game/events'
import { graveBurstRuntime } from '../effects/graveBurstRuntime'
import { Interactable } from './Interactable'

const GRAVES = diggableGraves()

/** Fresh earth heaped over a grave, or the dark open pit once it has been dug today. */
function Mound({ dug }: { dug: boolean }) {
  // Mound-local, head (cross) at -Z, like the old primitives. Both models are preloaded.
  const model = useGLTF(propModelUrl(dug ? 'grave-dug' : 'grave-mound'), DRACO_PATH).scene
  return <Clone object={model} />
}

export function GraveMounds() {
  const day = useWorldStore((s) => s.nightNumber)
  const dugOnDay = useDigStore((s) => s.dig.dugOnDay)

  // Soil kicked up when a dig finishes.
  useEffect(
    () =>
      subscribeToType('digCompleted', (e) => {
        const g = GRAVES.find((p) => p.id === e.graveId)
        if (g) graveBurstRuntime.queue.push({ x: g.position[0], z: g.position[2] })
      }),
    [],
  )

  const digStep = useGuidanceStore((s) => currentTutorialStep(s.tutorialDone) === DIG_STEP_ID)
  const prompts = useSettingsStore((s) => s.tutorialPrompts)
  const firstDay = useWorldStore((s) => s.phase === 'day' && s.nightNumber === 1)
  const digHint = digStep && prompts && firstDay

  return (
    <>
      {GRAVES.map((g, i) => (
        <group key={g.id} position={[g.position[0], 0, g.position[2]]} rotation={[0, i * 0.4, 0]}>
          <Interactable
            id={`${DIG_ID_PREFIX}${g.id}`}
            kind="grave-mound"
            subject={g.id}
            runeHeight={1.9}
            runeScale={0.5}
            dayRuneRange={digHint ? MOUND_DAY_RUNE_RANGE_M : undefined}
            onInteract={() => {
              // Holding E digs (digStore); this rising edge only explains why it can't start.
              const why = useDigStore.getState().blockedReason(g.id)
              if (why) useToastStore.getState().push(why)
            }}
          >
            <Mound dug={dugOnDay[g.id] === day} />
            {/* Generous invisible target: raycasts ignore `visible`, so aim need not be exact. */}
            <mesh position={[0, 0.5, -0.2]} visible={false}>
              <boxGeometry args={[1.8, 1.0, 3.0]} />
              <meshBasicMaterial side={THREE.DoubleSide} />
            </mesh>
          </Interactable>
        </group>
      ))}
    </>
  )
}
