import { useEffect, useRef, useState } from 'react'
import { STAMINA_CAPTION } from '../../data/controlHints'
import { usePlayerStore } from '../../game/state/playerStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { formatValue, toFraction } from './hudMath'

/** How long the bar lingers after stamina stops draining. */
const LINGER_MS = 1000

/** Shown only while stamina is draining, then fades out 1 s after sprinting stops. */
export function StaminaBar() {
  const stamina = usePlayerStore((s) => s.stamina)
  const accessible = useSettingsStore((s) => s.accessibleHUD)
  const [visible, setVisible] = useState(false)
  const prev = useRef(stamina)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const draining = stamina < prev.current
    prev.current = stamina
    if (draining) {
      clearTimeout(timer.current)
      timer.current = undefined
      setVisible(true)
    } else if (timer.current === undefined) {
      timer.current = setTimeout(() => {
        timer.current = undefined
        setVisible(false)
      }, LINGER_MS)
    }
  }, [stamina])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div
      className="hud-stamina"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity var(--transition-slow)' }}
      role="meter"
      aria-label="Stamina"
      aria-hidden={!visible}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(stamina)}
    >
      <span className="hud-stamina__caption" aria-hidden="true">
        {STAMINA_CAPTION}
      </span>
      <div className="hud-stamina__fill" style={{ width: `${toFraction(stamina) * 100}%` }} />
      {accessible && <span className="hud-num hud-stamina__num">{formatValue(stamina)}</span>}
    </div>
  )
}
