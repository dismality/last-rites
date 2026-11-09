import { useEffect } from 'react'
import { useToastStore } from '../../game/state/toastStore'

import { TOAST_DURATION_MS } from '../../game/state/toastStore'

export { TOAST_DURATION_MS }

/** Parchment toasts shown one at a time, 2 s by default or the toast's own duration. The live region stays mounted so screen readers announce changes. */
export function Toast() {
  const current = useToastStore((s) => s.queue[0])
  const shift = useToastStore((s) => s.shift)

  useEffect(() => {
    if (!current) return
    const t = setTimeout(shift, current.durationMs)
    return () => clearTimeout(t)
  }, [current, shift])

  return (
    <div className="hud-toast-region" role="status" aria-live="polite">
      {current && (
        <p key={current.id} className="hud-toast">
          {current.text}
        </p>
      )}
    </div>
  )
}
