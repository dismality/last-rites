import { useEffect, useRef, useState } from 'react'
import { useHunchStore } from '../../game/state/hunchStore'
import { useLanternStore } from '../../game/state/lanternStore'
import { usePlayerStore } from '../../game/state/playerStore'
import { easeLean, flameLean, flameSkewDeg } from '../../game/systems/keeperHunch'
import { useSettingsStore } from '../../game/state/settingsStore'
import { flameBrightness, flameSize, gutterActive, oilLabel } from '../../game/systems/lanternGauge'
import { LANTERN_FLICKER_BELOW } from '../../data/balance'
import './LanternGauge.css'

const FLAME_BASE = 56
/** The drawn skew is rounded to this many degrees, so React re-renders only when it visibly moves. */
const SKEW_STEP_DEG = 0.5

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Keeper's hunch (spec 10, Req 24.1-24.2): while it is on, the flame leans toward the nearest
 * unfound clue, by its bearing from where the player faces. A change of shape (a skew about the
 * flame's base), never of brightness. The sway follows the Head bob setting; reduced motion sets
 * the lean without easing or sway.
 */
function useHunchSkew(): number {
  const [skew, setSkew] = useState(0)
  const lean = useRef(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const target = useHunchStore.getState().target
      const { position, yaw } = usePlayerStore.getState()
      const want = target ? flameLean(position, yaw, target.position) : 0
      const reduced = reducedMotion()
      lean.current = easeLean(lean.current, want, dt, reduced)
      const deg = flameSkewDeg(
        lean.current,
        now / 1000,
        useSettingsStore.getState().headBob,
        reduced,
      )
      setSkew(Math.round(deg / SKEW_STEP_DEG) * SKEW_STEP_DEG)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])
  return skew
}

/**
 * Lantern fuel as a flame: height and brightness follow fuel only, never health.
 * The gutter is a CSS animation applied only when it can vary (low oil, flashing lights on),
 * so no per-frame JS is needed.
 */
export function LanternGauge() {
  const fuel = useLanternStore((s) => s.fuel)
  const flashing = useSettingsStore((s) => s.flashingLights)
  const label = oilLabel(fuel)
  // Probing gutterFactor at one fixed time missed the flame: that instant can sit on the
  // wave's trough where the factor is 1, so the rule is asked directly.
  const gutters = gutterActive(fuel, flashing)
  const low = !Number.isFinite(fuel) || fuel < LANTERN_FLICKER_BELOW
  const skew = useHunchSkew()

  return (
    <div
      className="lantern-gauge"
      role="meter"
      aria-label="Lantern oil"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fuel)}
      aria-valuetext={label}
      data-hunch-skew={skew}
    >
      <svg viewBox="0 0 40 64" width="32" height="50" aria-hidden="true">
        <rect
          x="6"
          y="2"
          width="28"
          height="58"
          rx="4"
          fill="none"
          stroke="var(--parchment-dark)"
          strokeWidth="1.5"
        />
        <g
          className={
            gutters ? 'lantern-gauge__flame lantern-gauge__flame--gutter' : 'lantern-gauge__flame'
          }
          style={{
            transform: `scaleY(${flameSize(fuel)})`,
            transformOrigin: `20px ${FLAME_BASE}px`,
            opacity: flameBrightness(fuel),
          }}
        >
          {/* Skewed about the base: a positive lean (clue to the right) tips the top right. */}
          <g style={{ transform: `skewX(${-skew}deg)`, transformOrigin: `20px ${FLAME_BASE}px` }}>
            <path
              d={`M20 4 C30 20 34 32 30 44 C28 52 24 ${FLAME_BASE} 20 ${FLAME_BASE} C16 ${FLAME_BASE} 12 52 10 44 C6 32 12 22 20 4 Z`}
              fill="var(--ember)"
              stroke="var(--ember-glow)"
              strokeWidth="2"
            />
            <path
              d="M20 30 C25 38 25 48 20 52 C15 48 15 38 20 30 Z"
              fill="var(--parchment)"
              opacity="0.8"
            />
          </g>
        </g>
      </svg>
      <span
        className={low ? 'lantern-gauge__label lantern-gauge__label--low' : 'lantern-gauge__label'}
      >
        {label}
      </span>
    </div>
  )
}
