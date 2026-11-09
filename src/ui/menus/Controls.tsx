/*
  Controls: lists every binding and captures the next key or mouse button for the
  chosen action. Esc cancels the capture and is never assignable (Req 21.7-21.10).
  Capture listens on window in the capture phase so neither the dialog's Escape
  handler nor the game input sees the keypress that is being assigned.
*/
import { useEffect, useState } from 'react'
import { CONTROL_ACTIONS, FIXED_CONTROL_LABEL, MOUSE_BUTTON_CODES } from '../../data/controls'
import { useSettingsStore } from '../../game/state/settingsStore'
import { rebind } from '../../game/systems/bindings'
import { keyLabel } from '../../game/systems/interaction'

const labelOf = (action: string): string =>
  CONTROL_ACTIONS.find((a) => a.action === action)?.label ?? action

export function Controls() {
  const bindings = useSettingsStore((s) => s.bindings)
  const setBinding = useSettingsStore((s) => s.setBinding)
  const [capturing, setCapturing] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!capturing) return
    const action = capturing
    const finish = (code: string) => {
      const result = rebind(useSettingsStore.getState().bindings, action, code)
      if (result.ok) {
        setBinding(action, code)
        setMessage('')
      } else if (result.reason === 'conflict') {
        // Both existing bindings stay as they were (Req 21.9).
        setMessage(
          `${keyLabel(code)} is already bound to ${labelOf(result.conflictingAction)}. Nothing changed.`,
        )
      } else {
        setMessage('Esc is reserved for pause and cannot be assigned.')
      }
      setCapturing(null)
    }
    const swallow = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const onKey = (e: KeyboardEvent) => {
      swallow(e)
      if (e.repeat) return
      if (e.code === 'Escape') {
        setMessage('')
        setCapturing(null)
        return
      }
      finish(e.code)
    }
    const onMouse = (e: MouseEvent) => {
      const code = MOUSE_BUTTON_CODES[e.button]
      if (!code) return
      swallow(e)
      finish(code)
    }
    const onContext = (e: Event) => swallow(e)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onMouse, true)
    window.addEventListener('contextmenu', onContext, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onMouse, true)
      window.removeEventListener('contextmenu', onContext, true)
    }
  }, [capturing, setBinding])

  return (
    <section className="controls" aria-label="Controls">
      <h3 className="controls__title">Controls</h3>
      <p className="controls__hint">
        Choose an action, then press a key or mouse button. Esc cancels.
      </p>
      <p className="controls__alert" role="alert">
        {message}
      </p>
      <ul className="controls__list">
        {CONTROL_ACTIONS.map(({ action, label }) => {
          const active = capturing === action
          return (
            <li key={action} className="settings__row">
              <span>{label}</span>
              <button
                type="button"
                className="menu__button controls__key"
                aria-label={`${label}: ${keyLabel(bindings[action] ?? '')}. Activate to rebind`}
                onClick={() => {
                  setMessage('')
                  setCapturing(action)
                }}
              >
                {active ? 'Press a key…' : keyLabel(bindings[action] ?? '')}
              </button>
            </li>
          )
        })}
        <li className="settings__row">
          <span>{FIXED_CONTROL_LABEL}</span>
          <span className="settings__value">Esc (fixed)</span>
        </li>
      </ul>
    </section>
  )
}
