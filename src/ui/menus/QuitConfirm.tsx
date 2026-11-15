import { useEffect, useRef } from 'react'

interface QuitConfirmProps {
  titleId: string
  /** Why it matters: what the player loses by leaving. */
  detail: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Body for "Quit to Title?" inside a MenuDialog. Focus lands on the safe choice (Stay), Tab
 * and the dialog's focus trap cover the rest, and the host dialog maps Esc to onCancel.
 */
export function QuitConfirm({ titleId, detail, onConfirm, onCancel }: QuitConfirmProps) {
  const stayRef = useRef<HTMLButtonElement>(null)
  // The dialog only focuses on first open, so move focus here when this body replaces another.
  useEffect(() => stayRef.current?.focus(), [])
  return (
    <>
      <h2 id={titleId} className="menu__title">
        Quit to Title?
      </h2>
      <p className="menu__text">{detail}</p>
      <div className="menu__actions">
        <button ref={stayRef} type="button" className="menu__button" onClick={onCancel}>
          Stay
        </button>
        <button type="button" className="menu__button" onClick={onConfirm}>
          Quit to Title
        </button>
      </div>
    </>
  )
}
