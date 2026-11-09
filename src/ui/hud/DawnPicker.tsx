import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useProgressionStore } from '../../game/state/progressionStore'
import { musicRuntime } from '../../game/state/musicRuntime'
import { simClock } from '../../game/state/simClock'
import { majorScareActive } from '../../game/systems/scareSilence'
import { MenuDialog } from '../menus/MenuDialog'
import { dawnPickerView, nextCardIndex, pickCard } from './dawnView'
import './DawnPicker.css'

const POLL_MS = 200

/** Re-reads the scare schedule, which lives outside React, a few times a second. */
function useMajorScareActive(): boolean {
  const [active, setActive] = useState(() => majorScareActive(musicRuntime.silence, simClock.now))
  useEffect(() => {
    const id = window.setInterval(() => setActive(majorScareActive(musicRuntime.silence, simClock.now)), POLL_MS)
    return () => window.clearInterval(id)
  }, [])
  return active
}

/** Modal dawn upgrade pick. No onEscape: Esc reaches the pause trigger. */
export function DawnPicker() {
  const ranks = useProgressionStore((s) => s.ranks)
  const pendingPick = useProgressionStore((s) => s.pendingPick)
  const scare = useMajorScareActive()
  const rowRef = useRef<HTMLDivElement>(null)
  const view = dawnPickerView({ ranks, pendingPick, majorScareActive: scare })

  if (!view.open) return null

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(rowRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = nextCardIndex(Math.max(at, 0), e.key, buttons.length)
    if (next === null) return
    e.preventDefault()
    buttons[next]?.focus()
  }

  return (
    <MenuDialog titleId="dawn-picker-title">
      <h2 id="dawn-picker-title" className="menu__title">
        Choose a boon
      </h2>
      <p className="menu__text">The night is over. Take one gift from the dawn.</p>
      <div ref={rowRef} className="dawn-picker__row" role="group" aria-label="Upgrades" onKeyDown={onKeyDown}>
        {view.cards.map((c) => (
          <button key={c.id} type="button" className="dawn-picker__card" onClick={() => pickCard(c.id)}>
            <span className="dawn-picker__rune" aria-hidden="true">
              {c.rune}
            </span>
            <span className="dawn-picker__name">{c.name}</span>
            <span className="dawn-picker__rank">{c.rankText}</span>
            <ul className="dawn-picker__lines">
              {c.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </MenuDialog>
  )
}
