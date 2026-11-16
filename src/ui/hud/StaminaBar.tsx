import { useEffect, useRef, useState } from 'react'
import { STAMINA_CAPTION } from '../../data/controlHints'
import { usePlayerStore } from '../../game/state/playerStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { formatValue } from './hudMath'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useStageStore } from '../../game/state/stageStore'
import { MODES } from '../../data/modes'
import { STAMINA_MAX } from '../../data/balance'
import { capFraction, staminaCap } from '../../game/systems/staminaCap'

/** How long the bar lingers after stamina stops draining. */
const LINGER_MS = 1000

/** Shown only while stamina is draining, then fades out 1 s after sprinting stops. */
export function StaminaBar() {
  const stamina = usePlayerStore((s) => s.stamina)
  const accessible = useSettingsStore((s) => s.accessibleHUD)
  const story = useProgressionStore((s) => MODES[s.mode].story)
  const stage = useStageStore((s) => s.stage)
  const cap = staminaCap(stage, story)
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
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity var(--transition-slow)',
        // The bar's length is the cap: 90 is nine tenths of the full bar (Req 26.5).
        width: `calc(var(--stamina-bar-w) * ${cap / STAMINA_MAX})`,
      }}
      role="meter"
      aria-label="Stamina"
      aria-hidden={!visible}
      aria-valuemin={0}
      aria-valuemax={cap}
      data-cap={cap}
      aria-valuenow={Math.round(stamina)}
    >
      <span className="hud-stamina__caption" aria-hidden="true">
        {STAMINA_CAPTION}
      </span>
      <div className="hud-stamina__fill" style={{ width: `${capFraction(stamina, cap) * 100}%` }} />
      {accessible && <span className="hud-num hud-stamina__num">{formatValue(stamina)}</span>}
      <span className="hud-stamina__cap" data-testid="stamina-cap">
        max {cap}
      </span>
    </div>
  )
}
