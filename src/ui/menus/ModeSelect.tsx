import { useId, useState } from 'react'
import type { ModeId } from '../../game/types'
import { MenuDialog } from './MenuDialog'
import { beginMode, initialChoice, modeOptions } from './modeSelectModel'

interface ModeSelectProps {
  onBegin: (mode: ModeId) => void
  onBack: () => void
}

/** New Game mode picker. Native radios give arrow-key selection for free. */
export function ModeSelect({ onBegin, onBack }: ModeSelectProps) {
  const titleId = useId()
  const [choice, setChoice] = useState<ModeId>(initialChoice())
  const options = modeOptions()

  return (
    <MenuDialog titleId={titleId} onEscape={onBack}>
      <h2 id={titleId} className="menu__title">
        Choose Your Vigil
      </h2>
      <fieldset className="mode__group">
        <legend className="mode__legend">Mode</legend>
        {options.map((o) => (
          <label key={o.id} className="mode__option">
            <input
              type="radio"
              name="mode"
              value={o.id}
              checked={choice === o.id}
              onChange={() => setChoice(o.id)}
              data-autofocus={o.id === initialChoice() ? '' : undefined}
            />
            <span className="mode__body">
              <span className="mode__label">{o.label}</span>
              <ul className="mode__lines">
                {o.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={() => beginMode(choice, onBegin)}>
          Begin
        </button>
        <button type="button" className="menu__button" onClick={onBack}>
          Back
        </button>
      </div>
    </MenuDialog>
  )
}
