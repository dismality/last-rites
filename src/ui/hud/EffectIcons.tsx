import { EFFECT_MAP } from '../../data/effects'
import { useEffectStore } from '../../game/state/effectStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { effectIcons } from '../../game/systems/effects'
import './EffectIcons.css'

const RADIUS = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Below this fraction of time left the ring pulses (only with Flashing lights on). */
const LOW_FRACTION = 0.25

/** Timed-effect icons: glyph, SVG countdown ring and seconds text (Req 12.9, 12.10). */
export function EffectIcons() {
  const effects = useEffectStore((s) => s.effects)
  const flashing = useSettingsStore((s) => s.flashingLights)
  const icons = effectIcons(effects)
  if (icons.length === 0) return null

  return (
    <ul className="effect-icons" aria-label="Active effects">
      {icons.map((icon) => {
        const name = EFFECT_MAP[icon.id].name
        const pulse = flashing && icon.fraction < LOW_FRACTION
        return (
          <li
            key={icon.id}
            className="effect-icons__item"
            data-pulse={pulse}
            aria-label={`${name}, ${icon.secondsText} left`}
          >
            <svg className="effect-icons__ring" viewBox="0 0 44 44" aria-hidden="true">
              <circle className="effect-icons__track" cx="22" cy="22" r={RADIUS} />
              <circle
                className="effect-icons__arc"
                cx="22"
                cy="22"
                r={RADIUS}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, icon.fraction)))}
                transform="rotate(-90 22 22)"
              />
            </svg>
            <span className="effect-icons__glyph" aria-hidden="true">
              {icon.glyph}
            </span>
            <span className="effect-icons__time">{icon.secondsText}</span>
          </li>
        )
      })}
    </ul>
  )
}
