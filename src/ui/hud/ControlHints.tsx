import { useEffect, useRef, useState } from 'react'
import { CONTROL_HINT_FADE_S, type ControlHintId } from '../../data/controlHints'
import { useGameStore } from '../../game/state/gameStore'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useIntroStore } from '../../game/state/introStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { hintLines, hintsHidden, type HintLine } from '../../game/systems/controlHints'
import { hotbarItem } from '../../game/systems/satchel'
import './ControlHints.css'

/**
 * Bottom-left panel naming the keys for move, sprint and the heavy charge. Sits in the same
 * column as the health bar and oil gauge, above them, so it can never overlap them. A line
 * fades out once its action has been done; a line that merely stops applying (axe put away)
 * goes at once.
 */
export function ControlHints() {
  const enabled = useSettingsStore((s) => s.showControlHints)
  const bindings = useSettingsStore((s) => s.bindings)
  const used = useGuidanceStore((s) => s.hintsUsed)
  const inventory = useInventoryStore((s) => s.inventory)
  const equipped = useInventoryStore((s) => s.equippedSlot)
  const screen = useGameStore((s) => s.screen)
  const intro = useIntroStore((s) => s.playing)
  const mapOpen = useGameStore((s) => s.mapOpen)
  const examining = useGameStore((s) => s.examining)
  const paused = useGameStore((s) => s.paused)
  const journal = useGameStore((s) => s.journalOpen)
  const satchel = useGameStore((s) => s.satchelOpen)
  const taken = useGameStore((s) => s.taken)
  const workbenchOpen = useUiWorldStore((s) => s.workbenchOpen)
  const repairOpen = useUiWorldStore((s) => s.chapelRepairOpen)
  const merchant = useOverlayStore((s) => s.merchantOpen)
  const altar = useOverlayStore((s) => s.altarPanelOpen)
  const modes = useOverlayStore((s) => s.modeSelectOpen || s.achievementsOpen)

  const hidden = hintsHidden({
    screen,
    cinematic: intro,
    menuOpen: paused || journal || satchel || taken || repairOpen || merchant || altar || modes,
    workbenchOpen,
    mapOpen,
    examining,
  })
  const lines = hintLines({ enabled, used, bindings, heldItem: equipped === null ? null : hotbarItem(inventory, equipped) })

  // Lines that just cleared stay for the fade, then go.
  const [leaving, setLeaving] = useState<HintLine[]>([])
  const prev = useRef<HintLine[]>([])
  useEffect(() => {
    const gone = prev.current.filter((p) => used.has(p.id) && !lines.some((l) => l.id === p.id))
    prev.current = lines
    if (gone.length === 0) return
    setLeaving((cur) => [...cur.filter((c) => !gone.some((g) => g.id === c.id)), ...gone])
    const t = window.setTimeout(
      () => setLeaving((cur) => cur.filter((c) => !gone.some((g) => g.id === c.id))),
      CONTROL_HINT_FADE_S * 1000,
    )
    return () => window.clearTimeout(t)
    // `lines` is a fresh array each render; its content follows these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, used, bindings, inventory, equipped])

  if (hidden) return null
  const shown: { line: HintLine; leaving: boolean }[] = [
    ...lines.map((line) => ({ line, leaving: false })),
    ...leaving
      .filter((l) => !lines.some((x) => x.id === l.id))
      .map((line) => ({ line, leaving: true })),
  ].sort((a, b) => order(a.line.id) - order(b.line.id))
  if (shown.length === 0) return null

  return (
    <ul className="control-hints" aria-label="Controls">
      {shown.map(({ line, leaving: out }) => (
        <li
          key={line.id}
          className="control-hints__line"
          data-hint={line.id}
          data-leaving={out ? 'true' : undefined}
          style={{ ['--hint-fade' as string]: `${CONTROL_HINT_FADE_S}s` }}
        >
          {line.prefix ? <span className="control-hints__prefix">{line.prefix}</span> : null}
          <span className="control-hints__keys">
            {line.keys.map((k, i) => (
              <kbd key={`${k}-${i}`} className="control-hints__key">
                {k}
              </kbd>
            ))}
          </span>
          <span className="control-hints__word">{line.word}</span>
        </li>
      ))}
    </ul>
  )
}

const ORDER: readonly ControlHintId[] = ['move', 'sprint', 'charge']
const order = (id: ControlHintId): number => ORDER.indexOf(id)
