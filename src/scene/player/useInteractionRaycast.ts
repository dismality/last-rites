// Casts from the screen centre each frame against registered interactables,
// publishes the hovered one to the interaction store, and fires its handler
// on the Interact key's rising edge.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { INTERACT_RANGE_M } from '../../data/balance'
import { useGameStore } from '../../game/state/gameStore'
import { useInteractionStore } from '../../game/state/interactionStore'
import { pickHoverTarget } from '../../game/systems/interaction'
import { interactableRegistry } from '../world/interactableRegistry'
import { input } from './input'

const CENTRE = new THREE.Vector2(0, 0)

/** Walk up from a hit mesh to the group tagged with userData.interactable. */
function findTag(obj: THREE.Object3D | null): string | null {
  for (let o = obj; o; o = o.parent) {
    const tag = o.userData.interactable as string | undefined
    if (tag) return tag
  }
  return null
}

export function useInteractionRaycast(): void {
  const raycaster = useRef(new THREE.Raycaster())
  const wasDown = useRef(false)

  useFrame((state) => {
    const { setHover } = useInteractionStore.getState()
    if (useGameStore.getState().paused || useGameStore.getState().examining) {
      setHover(null)
      return
    }
    const rc = raycaster.current
    rc.far = INTERACT_RANGE_M
    rc.setFromCamera(CENTRE, state.camera)

    const objects = [...interactableRegistry.values()].map((e) => e.object)
    const hits = rc.intersectObjects(objects, true).flatMap((h) => {
      const id = findTag(h.object)
      return id ? [{ id, distance: h.distance }] : []
    })
    const target = pickHoverTarget(hits)
    const entry = target ? interactableRegistry.get(target.id) : undefined
    setHover(entry ? { id: entry.id, action: entry.action } : null)

    const down = input.peek().interact
    if (down && !wasDown.current && entry) entry.onInteract()
    wasDown.current = down
  })
}
