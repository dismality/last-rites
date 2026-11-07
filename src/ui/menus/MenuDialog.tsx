/*
  MenuDialog: shared modal shell for every menu screen.
  Why shared: role/aria-modal, focus trap, Escape handling and focus restore must
  behave identically on every menu (accessibility steering doc), so they live once.
*/
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import './menus.css'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface MenuDialogProps {
  titleId: string
  /** Called on Escape. Omit when Escape should do nothing (e.g. the title screen). */
  onEscape?: () => void
  children: ReactNode
  /** Extra class on the backdrop, e.g. a full-screen variant. */
  variant?: 'overlay' | 'screen'
}

export function MenuDialog({ titleId, onEscape, children, variant = 'overlay' }: MenuDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus the first control on open and give focus back on close, so keyboard
  // players never lose their place when a nested panel closes.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()
    return () => previous?.focus?.()
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && onEscape) {
      e.stopPropagation()
      onEscape()
      return
    }
    if (e.key !== 'Tab') return
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={`menu__backdrop menu__backdrop--${variant}`}>
      <div
        ref={panelRef}
        className="menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  )
}
