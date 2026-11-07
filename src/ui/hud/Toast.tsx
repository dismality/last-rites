import { useEffect } from 'react'
import { useToastStore } from '../../game/state/toastStore'

export const TOAST_DURATION_MS = 2000

/** Parchment toasts shown one at a time, 2 s each. The live region stays mounted so screen readers announce changes. */
export function Toast() {
  const current = useToastStore((s) => s.queue[0])
  const shift = useToastStore((s) => s.shift)

  useEffect(() => {
    if (!current) return
    const t = setTimeout(shift, TOAST_DURATION_MS)
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
