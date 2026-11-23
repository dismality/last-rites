// Developer mode's on-screen reminder: what the keys do, and the result of the last skip for a
// moment. Hidden while developer mode is off.

import { useDevPanelStore } from './devPanelStore'
import { useSkipToast } from './skipKey'

export function DevSkipChip() {
  const enabled = useDevPanelStore((s) => s.enabled)
  const line = useSkipToast((t) => t.line)
  if (!enabled) return null
  return (
    <div className="dev-skip-chip" role="status" aria-live="polite">
      <span>
        Developer mode · <kbd>]</kbd> skip step · <kbd>`</kbd> dev panel
      </span>
      {line && <strong>{line}</strong>}
    </div>
  )
}
