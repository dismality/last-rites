import { useEffect, useRef } from 'react'
import { HEALTH_BAR } from '../../data/healthBar'
import {
  chunkFraction,
  healthFraction,
  healthText,
  initHealthDisplay,
  lowFrame,
  stepHealthDisplay,
  type HealthDisplayState,
} from '../../game/systems/healthDisplay'
import { useGameStore } from '../../game/state/gameStore'
import { usePlayerStore } from '../../game/state/playerStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import './HealthBar.css'

const MAX_STEP_S = 0.1

const isAnimating = (s: HealthDisplayState): boolean =>
  s.fx !== 'none' || s.holdLeft > 0 || s.chunk > s.fill || s.easeT < HEALTH_BAR.easeS

function HealthBarInner() {
  const rootRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const chunkRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const tagRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const fillEl = fillRef.current
    const chunkEl = chunkRef.current
    const textEl = textRef.current
    const tagEl = tagRef.current
    if (!root || !fillEl || !chunkEl || !textEl || !tagEl) return

    const p0 = usePlayerStore.getState()
    let state = initHealthDisplay(p0.health, p0.maxHealth)
    let raf = 0
    let last = 0
    let lastText = ''
    let lastFrame = ''

    // Direct DOM writes: a per-frame React render for a HUD bar would waste the frame budget.
    const paint = () => {
      fillEl.style.width = `${(healthFraction(state) * 100).toFixed(2)}%`
      chunkEl.style.width = `${(chunkFraction(state) * 100).toFixed(2)}%`
      const flashing = useSettingsStore.getState().flashingLights
      const low = lowFrame(state.hp, flashing)
      const text = healthText(state.hp, state.maxHp)
      if (text !== lastText) {
        textEl.textContent = text
        lastText = text
      }
      const frame = `${state.fx}|${low.low}|${low.pulse}|${low.thick}`
      if (frame !== lastFrame) {
        lastFrame = frame
        root.dataset.fx = state.fx
        root.dataset.low = String(low.low)
        root.dataset.pulse = String(low.pulse)
        root.dataset.thick = String(low.thick)
        tagEl.hidden = !low.low
        root.setAttribute('aria-valuenow', String(Math.round(state.hp)))
      }
    }

    const frame = (now: number) => {
      const dt = last ? Math.min(MAX_STEP_S, (now - last) / 1000) : 0
      last = now
      const p = usePlayerStore.getState()
      state = stepHealthDisplay(
        state,
        { hp: p.health, maxHp: p.maxHealth },
        useSettingsStore.getState().flashingLights,
        dt,
      )
      paint()
      if (isAnimating(state)) {
        raf = requestAnimationFrame(frame)
      } else {
        raf = 0
        last = 0
      }
    }

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    paint()
    const unsubPlayer = usePlayerStore.subscribe((s, prev) => {
      if (s.health !== prev.health || s.maxHealth !== prev.maxHealth) wake()
    })
    const unsubSettings = useSettingsStore.subscribe((s, prev) => {
      if (s.flashingLights !== prev.flashingLights) wake()
    })
    wake()

    return () => {
      unsubPlayer()
      unsubSettings()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="health-bar">
      <div
        ref={rootRef}
        className="health-bar__frame"
        role="meter"
        aria-label="Health"
        aria-valuemin={0}
        aria-valuemax={usePlayerStore.getState().maxHealth}
        aria-valuenow={usePlayerStore.getState().health}
        data-fx="none"
      >
        <div ref={chunkRef} className="health-bar__chunk" />
        <div ref={fillRef} className="health-bar__fill" />
      </div>
      <span ref={textRef} className="health-bar__text" />
      <span ref={tagRef} className="health-bar__tag" hidden>
        ✚ Low
      </span>
    </div>
  )
}

/** Health bar (design bible §11). Keyed on retryEpoch so Retry Night restarts without a drain. */
export function HealthBar() {
  const epoch = useGameStore((s) => s.retryEpoch)
  return <HealthBarInner key={epoch} />
}
