import { useInteractionStore } from '../../game/state/interactionStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { ACTION_RUNE, promptText } from '../../game/systems/interaction'

/** "E: Dig" with the action's rune, so the cue is a shape and text, not only colour. */
export function InteractPrompt() {
  const hover = useInteractionStore((s) => s.hover)
  const key = useSettingsStore((s) => s.bindings.Interact) ?? 'KeyE'
  if (!hover) return null
  return (
    <p className="hud-prompt" role="status">
      <span className="hud-prompt__rune" aria-hidden="true">
        {ACTION_RUNE[hover.action]}
      </span>
      {promptText(hover.action, key)}
    </p>
  )
}
