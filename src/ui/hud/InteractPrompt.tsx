import { useEffect } from 'react'
import { CUE_FADE_S } from '../../data/interactables'
import { useInteractionStore } from '../../game/state/interactionStore'
import { useCinematic } from '../../game/state/menuState'
import { ACTION_RUNE } from '../../game/systems/interaction'
import { iconUrl } from '../../data/assets'
import { PixelIcon } from '../PixelIcon'

/** The rune image is 64 px art shown at 32 px. */
const RUNE_PX = 32

/**
 * "E: Dig" with the action's rune, so the cue is a shape and text, not only colour. The text comes
 * from the one cue rule (systems/interactionCue.ts) via the hover target: a thing that cannot be
 * used shows what it needs ("Needs a shovel in hand: press 1") and never "Hold E". A target that
 * was just used up keeps its prompt for CUE_FADE_S while it fades (a steady linear fade, which
 * is also the reduced-motion and Flashing-lights-off behaviour).
 */
export function InteractPrompt() {
  const hover = useInteractionStore((s) => s.hover)
  const fading = useInteractionStore((s) => s.fading)
  const clearFading = useInteractionStore((s) => s.clearFading)
  const cinematic = useCinematic()

  useEffect(() => {
    if (!fading) return
    const timer = setTimeout(clearFading, CUE_FADE_S * 1000)
    return () => clearTimeout(timer)
  }, [fading, clearFading])

  if (cinematic) return null
  if (hover?.prompt) {
    return (
      <p className="hud-prompt" role="status" data-actionable={hover.actionable ?? true}>
        <span className="hud-prompt__rune" aria-hidden="true">
          <PixelIcon
            url={iconUrl('interact-rune', hover.action)}
            fallback={ACTION_RUNE[hover.action]}
            sizePx={RUNE_PX}
            className="hud-prompt__rune-img"
          />
        </span>
        {hover.prompt}
      </p>
    )
  }
  if (!hover && fading) {
    return (
      <p
        key={fading.serial}
        className="hud-prompt hud-prompt--fading"
        aria-hidden="true"
        data-testid="prompt-fading"
      >
        <span className="hud-prompt__rune">
          <PixelIcon
            url={iconUrl('interact-rune', fading.action)}
            fallback={ACTION_RUNE[fading.action]}
            sizePx={RUNE_PX}
            className="hud-prompt__rune-img"
          />
        </span>
        {fading.prompt}
      </p>
    )
  }
  return null
}
