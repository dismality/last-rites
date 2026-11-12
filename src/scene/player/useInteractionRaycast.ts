// Casts from the screen centre each frame against registered interactables,
// publishes the hovered one to the interaction store, and fires its handler
// on the Interact key's rising edge.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { INTERACT_RANGE_M } from '../../data/balance'
import { isMenuOpen } from '../../game/state/menuState'
import { useInteractionStore, type HoverTarget } from '../../game/state/interactionStore'
import { pickHoverTarget } from '../../game/systems/interaction'
import type { InteractionCue } from '../../game/systems/interactionCue'
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
  const wasMenuOpen = useRef(false)
  const prevHover = useRef<HoverTarget | null>(null)

  useFrame((state) => {
    const { setHover } = useInteractionStore.getState()
    // Menus own the keyboard and cursor: no hover, no interact. The frame a menu closes,
    // the key that closed it (E on the workbench) may still be held; treat it as already
    // handled so it can't count as a fresh press and reopen the thing under the crosshair.
    const menuOpen = isMenuOpen()
    if (menuOpen || wasMenuOpen.current) {
      wasMenuOpen.current = menuOpen
      wasDown.current = input.peek().interact
      prevHover.current = null
      setHover(null)
      return
    }
    const rc = raycaster.current
    rc.far = INTERACT_RANGE_M
    rc.setFromCamera(CENTRE, state.camera)

    // Used-up objects are never candidates. Interactable keeps `userData.targetable` current
    // for nearby ones; the cue is re-read below for whatever the ray actually hits.
    const objects: THREE.Object3D[] = []
    for (const e of interactableRegistry.values()) {
      if (e.object.userData.targetable !== false) objects.push(e.object)
    }
    const cues = new Map<string, InteractionCue>()
    const hits = rc.intersectObjects(objects, true).flatMap((h) => {
      const id = findTag(h.object)
      const entry = id ? interactableRegistry.get(id) : undefined
      if (!id || !entry) return []
      const cue = entry.cue()
      if (!cue.targetable) return []
      cues.set(id, cue)
      return [{ id, distance: h.distance }]
    })
    const target = pickHoverTarget(hits)
    const entry = target ? interactableRegistry.get(target.id) : undefined
    const cue = target ? cues.get(target.id) : undefined
    const next: HoverTarget | null =
      entry && cue
        ? { id: entry.id, action: entry.action, prompt: cue.prompt, actionable: cue.actionable }
        : null
    // A target that was just used up (taken, dug, examined, opened) fades its prompt out. Looking
    // away or stepping back leaves the entry targetable and cuts the prompt as before.
    const prev = prevHover.current
    if (!next && prev) {
      const was = interactableRegistry.get(prev.id)
      if (!was || !was.cue().targetable) useInteractionStore.getState().startFading(prev)
    }
    prevHover.current = next
    setHover(next)

    const down = input.peek().interact
    if (down && !wasDown.current && entry) entry.onInteract()
    wasDown.current = down
  })
}
