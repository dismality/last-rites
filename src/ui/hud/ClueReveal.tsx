// The clue reveal (spec 09 task 11q): a found clue's picture, title and text fade in a little
// below the crosshair, hold, then fade out, one at a time. It never takes focus or blocks input.
// Timing and queue rules: game/systems/clueReveal.ts; the queue: game/state/clueRevealStore.ts.
import { useEffect, useRef } from 'react'
import { useClueRevealStore } from '../../game/state/clueRevealStore'
import { isMenuOpen } from '../../game/state/menuState'
import { useSettingsStore } from '../../game/state/settingsStore'
import { keyLabel } from '../../game/systems/interaction'
import { revealLook } from '../../game/systems/clueReveal'
import './ClueReveal.css'

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export function ClueReveal() {
  const current = useClueRevealStore((s) => s.current)
  const journalKey = useSettingsStore((s) => s.bindings.Journal)
  const box = useRef<HTMLDivElement>(null)

  // Ticks the queue and sets the look straight on the element, so a frame costs no React render.
  useEffect(() => {
    let raf = 0
    const frame = () => {
      const t = performance.now()
      useClueRevealStore.getState().tick(t, isMenuOpen())
      const c = useClueRevealStore.getState().current
      const el = box.current
      if (c && el) {
        const look = revealLook((t - c.startedAt) / 1000, c.item.text, reducedMotion())
        el.style.opacity = String(look.opacity)
        el.style.transform = `translate(-50%, ${look.offsetY}px)`
        el.style.filter = look.blur > 0.05 ? `blur(${look.blur.toFixed(2)}px)` : ''
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!current) return null
  const { item } = current
  const plain = item.kind === 'plain'
  return (
    <div
      ref={box}
      key={item.key}
      className={plain ? 'clue-reveal clue-reveal--plain' : 'clue-reveal'}
      role="status"
      aria-live="polite"
      style={{ opacity: 0 }}
    >
      {item.image && (
        <div className="clue-reveal__picture" aria-hidden="true">
          <img src={item.image} alt="" draggable={false} />
        </div>
      )}
      <div className="clue-reveal__words">
        {!plain && item.title && <p className="clue-reveal__title">{item.title}</p>}
        <p className="clue-reveal__text">{item.text}</p>
        {!plain && <p className="clue-reveal__journal">Noted in your journal ({keyLabel(journalKey ?? 'KeyJ')})</p>}
      </div>
    </div>
  )
}
