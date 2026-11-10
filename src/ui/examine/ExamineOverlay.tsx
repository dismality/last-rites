// HTML overlay for examine mode. Esc or E closes; the close button is focused on open.
import { useEffect, useRef } from 'react'
import { ITEM_MAP } from '../../data/items'
import { journalPageForItem } from '../../data/journal'
import { useExamineStore } from '../../game/state/examineStore'
import { useGameStore } from '../../game/state/gameStore'
import { ExamineScene } from '../../scene/examine/ExamineScene'
import './examine.css'

export function ExamineOverlay() {
  const item = useExamineStore((s) => s.item)
  const clueRevealed = useExamineStore((s) => s.clueRevealed)
  const close = useExamineStore((s) => s.close)
  const setClueRevealed = useExamineStore((s) => s.setClueRevealed)
  const screen = useGameStore((s) => s.screen)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!item) return
    // Free the cursor so the mouse can rotate the item.
    if (document.pointerLockElement) document.exitPointerLock()
    closeRef.current?.focus()
    // Capture phase so the pause trigger and other window handlers never see these keys.
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyE') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [item, close])

  if (!item || screen !== 'game') return null
  const def = ITEM_MAP[item]
  const clue = def.clue
  // A journal page is read here: the 3D page alone showed a blank slab (spec 09, B7).
  const page = journalPageForItem(item)

  return (
    <div className="examine" role="dialog" aria-modal="true" aria-label={`Examine ${def.name}`}>
      <div className="examine__canvas">
        <ExamineScene itemId={item} />
      </div>
      <div className="examine__panel">
        <h2 className="examine__title">{def.name}</h2>
        {page && (
          <section className="examine__page" aria-label={`Journal page ${page.id}: ${page.title}`}>
            <h3 className="examine__page-title">{page.title}</h3>
            <p className="examine__page-text">{page.text}</p>
          </section>
        )}
        <p className="examine__hint">Drag to turn. Scroll to zoom. Esc or E to put it away.</p>
        <p className="examine__clue" role="status" aria-live="polite">
          {clue && clueRevealed ? clue.text : ''}
        </p>
        <div className="examine__actions">
          {clue && !clueRevealed && (
            <button type="button" className="examine__btn" onClick={setClueRevealed}>
              ✎ Inspect markings
            </button>
          )}
          <button ref={closeRef} type="button" className="examine__btn" onClick={close}>
            Put away (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
