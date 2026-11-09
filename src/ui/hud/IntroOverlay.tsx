import { useEffect, useRef } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { useIntroStore } from '../../game/state/introStore'
import { useSettingsStore } from '../../game/state'
import { introStateAt } from '../../game/systems/introTimeline'
import { introCameraRuntime } from '../../scene/effects/introCameraRuntime'
import './IntroOverlay.css'

/** "KeyF" -> "F", "Space" -> "Space", for the on-screen hint. */
function keyLabel(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '')
}

/**
 * Intro cutscene overlay: ink fade, handwritten card and a skip control.
 * The camera clock lives in introCameraRuntime; a rAF loop reads it and writes styles and
 * text straight to the DOM, so the cutscene causes no per-frame React renders.
 */
export function IntroOverlay() {
  const inkRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLParagraphElement>(null)
  const skipKey = useSettingsStore((s) => s.bindings.Skip)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const st = introStateAt(introCameraRuntime.time)
      if (inkRef.current) inkRef.current.style.opacity = String(st.fade)
      const card = cardRef.current
      if (card) {
        const text = st.card?.text ?? ''
        if (card.textContent !== text) card.textContent = text
        card.style.opacity = String(st.card?.opacity ?? 0)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      // Esc pauses (usePauseTriggers); while paused the pause menu owns every key.
      if (useGameStore.getState().paused) return
      if (!useIntroStore.getState().playing) return
      if (e.code === useSettingsStore.getState().bindings.Skip || e.code === 'Enter') {
        // Stops a focused Skip button from also firing a click on the same press.
        e.preventDefault()
        useIntroStore.getState().skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="intro-overlay">
      <div ref={inkRef} className="intro-overlay__ink" />
      <p ref={cardRef} className="intro-overlay__card" role="status" aria-live="polite" />
      <div className="intro-overlay__skip">
        <span className="intro-overlay__hint">{keyLabel(skipKey)} to skip</span>
        <button
          type="button"
          className="intro-overlay__button"
          autoFocus
          onClick={() => useIntroStore.getState().skip()}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
