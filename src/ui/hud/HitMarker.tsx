import { useFeedbackStore } from '../../game/state/feedbackStore'
import { markerShape } from '../../game/systems/hitMarker'
import './HitMarker.css'

/**
 * Cross that appears on the crosshair for one attack. A headshot adds a dot and a ring, so the
 * cue is a shape and never colour alone. The store holds the lifetime (0.15 s, or 0.3 s steady
 * with Flashing lights off), so this only draws what the store says.
 */
export function HitMarker() {
  const marker = useFeedbackStore((s) => s.marker)
  if (!marker) return null
  const shape = markerShape(marker)

  return (
    <svg
      className="hit-marker"
      viewBox="-16 -16 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      data-kind={marker.kind}
      data-headshot={marker.headshot}
      style={{ transform: `translate(-50%, -50%) scale(${shape.scale})` }}
    >
      <path d="M-9 -9L-4 -4M9 -9L4 -4M-9 9L-4 4M9 9L4 4" />
      {shape.ring && <circle className="hit-marker__ring" r="13" />}
      {shape.dot && <circle className="hit-marker__dot" r="1.8" />}
    </svg>
  )
}
