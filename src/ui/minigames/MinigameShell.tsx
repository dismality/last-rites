// The shared frame of every case Minigame (spec 10 task 3.2, Req 11). It marks the overlay open in
// `overlayStore` (so `isMenuOpen()` is true: the cursor is freed and no scare begins), traps Tab,
// closes on Esc and shows a caption line for each sound. There is no timer. Closing never clears
// anything: the Minigame owns its draft (placed tiles, lines, order) in the Case_Store, so a
// reopened overlay shows partial progress again.
// Pure rules live in `systems/minigameShell`; this file only wires them to the DOM.
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import type { MinigameId } from '../../data/cases'
import { useGameStore } from '../../game/state/gameStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { resultView, shellKeyAction, shellView, type ResultKind } from '../../game/systems/minigameShell'
import './minigameShell.css'

const FOCUSABLE =
  'button:not([disabled]), select, input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export interface MinigameShellProps {
  id: MinigameId
  title: string
  children: ReactNode
  /** Closes the overlay; the default clears the store flag. */
  onClose?: () => void
  /** Recent sound captions, e.g. "[a bell tolls, wrongly]". */
  captions?: readonly string[]
  /** The latest verdict, shown as glyph + words (never colour alone). */
  result?: { kind: ResultKind; text: string } | null
}

const closeStore = () => useOverlayStore.getState().setMinigameOpen(null)

export function MinigameShell({ id, title, children, onClose = closeStore, captions = [], result = null }: MinigameShellProps) {
  const root = useRef<HTMLDivElement>(null)
  const screen = useGameStore((s) => s.screen)
  const taken = useGameStore((s) => s.taken)
  const view = shellView(title, captions)
  const res = result ? resultView(result.kind, result.text) : null

  // Register as an open overlay while mounted; clear only our own flag on unmount.
  useEffect(() => {
    useOverlayStore.getState().setMinigameOpen(id)
    return () => {
      if (useOverlayStore.getState().minigameOpen === id) useOverlayStore.getState().setMinigameOpen(null)
    }
  }, [id])

  // Focus the first control so the keyboard works at once.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [])

  // Being taken or leaving the game closes it, so no stale flag holds the cursor.
  useEffect(() => {
    if (screen !== 'game' || taken) onClose()
  }, [screen, taken, onClose])

  // Esc closes and goes no further; capture phase so the pause trigger never sees it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const trapTab = (e: ReactKeyboardEvent) => {
    const items = [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    const current = items.indexOf(document.activeElement as HTMLElement)
    const action = shellKeyAction(e.code, e.shiftKey, current, items.length)
    if (action?.kind === 'focus') {
      e.preventDefault()
      items[action.index]?.focus()
    }
  }

  return (
    <div className="minigame-shell" onKeyDown={trapTab}>
      <div ref={root} className="minigame-shell__sheet" role="dialog" aria-modal="true" aria-labelledby="minigame-shell-title">
        <header className="minigame-shell__head">
          <h2 id="minigame-shell-title" className="minigame-shell__title">
            {view.title}
          </h2>
          <button type="button" className="minigame-shell__close" onClick={onClose}>
            Close (Esc)
          </button>
        </header>

        <div className="minigame-shell__body">{children}</div>

        <p className="minigame-shell__result" role="status" aria-live="polite">
          {res && (
            <>
              <span aria-hidden="true">{res.glyph} </span>
              <span className="minigame-shell__sr">{res.label}: </span>
              {res.text}
            </>
          )}
        </p>
        <ul className="minigame-shell__captions" aria-label="Sound captions">
          {view.captions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="minigame-shell__note">Your progress is kept if you close this.</p>
      </div>
    </div>
  )
}
