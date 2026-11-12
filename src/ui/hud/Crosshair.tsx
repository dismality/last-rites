import { usePlayerStore } from '../../game/state/playerStore'
import { useInteractionStore } from '../../game/state/interactionStore'
import { useCinematic } from '../../game/state/menuState'
import { HitMarker } from './HitMarker'

/**
 * 4x4 px dot; becomes a hand icon when the player store reports an interact
 * target (the controller only sets it within the 2.5 m interact range).
 */
export function Crosshair() {
  const playerTarget = usePlayerStore((s) => s.interactTarget !== null)
  // The hand shows only when pressing Interact would start something: a "needs a shovel" or
  // "door is full" prompt keeps the dot.
  const hovering = useInteractionStore((s) => s.hover !== null && s.hover.actionable !== false)
  const cinematic = useCinematic()
  const hasTarget = (playerTarget || hovering) && !cinematic

  return (
    <div className="hud-crosshair" aria-hidden="true" data-interactable={hasTarget}>
      {hasTarget ? (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path
            d="M8 12V5a1.5 1.5 0 0 1 3 0v6h.5V3.5a1.5 1.5 0 0 1 3 0V11h.5V5a1.5 1.5 0 0 1 3 0v9c0 4-2.5 7-6.5 7S7 18.5 6 15l-1.5-3a1.4 1.4 0 0 1 2.3-1.5L8 12Z"
            fill="var(--parchment)"
            stroke="var(--ink)"
            strokeWidth="1"
          />
        </svg>
      ) : (
        <span className="hud-crosshair__dot" />
      )}
      <HitMarker />
    </div>
  )
}
