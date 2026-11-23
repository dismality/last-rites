// A page that writes itself in the keeper's hand, a few letters at a time (playtest story pass: the
// solved case is summed up as it is written). A click, or "Show it all", finishes it at once;
// with reduced motion it is all there from the start. Display only.
import { useEffect, useState } from 'react'
import './handwritten.css'

/** Letters written per second. */
const LETTERS_PER_S = 45

const reduced = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function HandwrittenPage({ lines, className = '' }: { lines: readonly string[]; className?: string }) {
  const total = lines.reduce((n, l) => n + l.length, 0)
  const [shown, setShown] = useState(() => (reduced() ? total : 0))

  useEffect(() => {
    if (shown >= total) return
    const t = window.setTimeout(() => setShown((n) => Math.min(total, n + 2)), 2000 / LETTERS_PER_S)
    return () => window.clearTimeout(t)
  }, [shown, total])

  const done = shown >= total
  // Where each line starts in the whole page, so each shows only the letters written so far.
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + l.length, 0))
  return (
    <div className={`handwritten ${className}`} onClick={() => setShown(total)}>
      {/* The full text for screen readers; the drawn letters are decoration. */}
      <div className="minigame-shell__sr">{lines.join(' ')}</div>
      <div aria-hidden="true">
        {lines.map((line, i) => {
          const part = line.slice(0, Math.max(0, shown - starts[i]))
          if (part === '') return null
          return (
            <p key={i} className="handwritten__line">
              {part}
              {part.length < line.length && <span className="handwritten__pen">▍</span>}
            </p>
          )
        })}
      </div>
      {!done && (
        <button type="button" className="handwritten__skip" onClick={() => setShown(total)}>
          Show it all
        </button>
      )}
    </div>
  )
}
