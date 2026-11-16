import { useNameTheDeadStore } from '../../game/state/nameTheDeadStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { NAME_THE_DEAD } from '../../data/nameTheDead'
import { keyLabel } from '../../game/systems/interaction'

/**
 * Name the Dead (spec 10 task 11): the hold ring while Interact is held at a glowing grave, with
 * its caption (Req 28.5). The seconds sit beside the ring, so it never reads by colour alone.
 */
export function NameHold() {
  const progress = useNameTheDeadStore((s) => s.progress)
  const naming = useNameTheDeadStore((s) => s.naming)
  const key = useSettingsStore((s) => keyLabel(s.bindings.Interact ?? 'KeyE'))
  if (naming === null || progress <= 0) return null
  const pct = Math.round(progress * 100)
  const deg = Math.round(progress * 360)
  return (
    <div className="hud-name" data-testid="name-hold">
      <div
        className="hud-name__ring"
        role="progressbar"
        aria-label={`Naming ${naming}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ background: `conic-gradient(var(--ember) ${deg}deg, var(--ink-mid) ${deg}deg)` }}
      >
        <span className="hud-name__rune" aria-hidden="true">
          ᛞ
        </span>
      </div>
      <p className="hud-name__caption">
        Naming {naming}… hold {key}
      </p>
      <p className="hud-name__time">
        {(progress * NAME_THE_DEAD.holdS).toFixed(1)} / {NAME_THE_DEAD.holdS} s
      </p>
    </div>
  )
}
