// Close-up parchment rubbing of a tombstone inscription. Esc, E or the button closes.
// The wrong-grave stamp pairs a text label with colour: never colour alone.
import { useEffect, useRef } from 'react'
import { TOMBSTONE_MAP } from '../../data/tombstones'
import { useGameStore } from '../../game/state/gameStore'
import { useTombstoneStore } from '../../game/state/tombstoneStore'
import './tombstone.css'

export function TombstoneOverlay() {
  const id = useTombstoneStore((s) => s.id)
  const wrongGrave = useTombstoneStore((s) => s.wrongGrave)
  const close = useTombstoneStore((s) => s.close)
  const screen = useGameStore((s) => s.screen)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!id) return
    if (document.pointerLockElement) document.exitPointerLock()
    closeRef.current?.focus()
    // Capture phase so the pause trigger never sees these keys.
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyE') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [id, close])

  if (!id || screen !== 'game') return null
  const stone = TOMBSTONE_MAP[id]
  const [title, ...rest] = stone.inscription

  return (
    <div className="rubbing" role="dialog" aria-modal="true" aria-label={`Tombstone: ${title}`}>
      <div className="rubbing__paper">
        <h2 className="rubbing__title">{title}</h2>
        {rest.map((line) => (
          <p key={line} className="rubbing__line">
            {line}
          </p>
        ))}
        {wrongGrave && (
          <p className="rubbing__stamp" role="status">
            ✎ Wrong grave: this date is entered in the parish ledger
          </p>
        )}
      </div>
      <button ref={closeRef} type="button" className="rubbing__close" onClick={close}>
        Step back (Esc)
      </button>
    </div>
  )
}
