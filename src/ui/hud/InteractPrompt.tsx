import { DIG_ID_PREFIX, useDigStore } from '../../game/state/digStore'
import { useWorldStore } from '../../game/state/worldStore'
import { digPromptNote } from '../../game/systems/digGuidance'
import { useDoorStore } from '../../game/state/doorStore'
import { useInteractionStore } from '../../game/state/interactionStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useCinematic } from '../../game/state/menuState'
import { useSettingsStore } from '../../game/state/settingsStore'
import { nailPrompt } from '../../game/systems/barricade'
import { ACTION_RUNE, promptText } from '../../game/systems/interaction'
import type { DoorId } from '../../game/types'

const NAIL_PREFIX = 'nail-'

/** "E: Dig" with the action's rune, so the cue is a shape and text, not only colour. */
export function InteractPrompt() {
  const hover = useInteractionStore((s) => s.hover)
  const key = useSettingsStore((s) => s.bindings.Interact) ?? 'KeyE'
  const built = useDoorStore((s) => s.built)
  const doors = useDoorStore((s) => s.doors)
  const inventory = useInventoryStore((s) => s.inventory)
  const cinematic = useCinematic()
  const equippedSlot = useInventoryStore((s) => s.equippedSlot)
  const bindings = useSettingsStore((s) => s.bindings)
  const day = useWorldStore((s) => s.nightNumber)
  const dugOnDay = useDigStore((s) => s.dig.dugOnDay)
  if (!hover || cinematic) return null

  // A door that cannot take a board says why: full, or the first missing material (Req 16.4).
  let note: string | null = null
  if (hover.action === 'nail' && hover.id.startsWith(NAIL_PREFIX)) {
    const door = hover.id.slice(NAIL_PREFIX.length) as DoorId
    if (door in doors) {
      const p = nailPrompt({ built, doors }, inventory, door)
      if (!p.canStart) note = p.text
    }
  }

  let label = promptText(hover.action, key)
  if (hover.action === 'dig' && hover.id.startsWith(DIG_ID_PREFIX)) {
    label = `Hold ${label}`
    note = digPromptNote({
      inventory,
      equippedSlot,
      bindings,
      dugToday: dugOnDay[hover.id.slice(DIG_ID_PREFIX.length)] === day,
    })
  }

  return (
    <p className="hud-prompt" role="status">
      <span className="hud-prompt__rune" aria-hidden="true">
        {ACTION_RUNE[hover.action]}
      </span>
      {label}
      {note && <span className="hud-prompt__note">{` (${note})`}</span>}
    </p>
  )
}
