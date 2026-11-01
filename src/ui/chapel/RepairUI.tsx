/*
  RepairUI — chapel repair overlay.

  Visible when `chapelRepairOpen` is true in worldStore.
  Shows the next stage's cost and effect, or an all-complete message.

  Accessibility:
  - Focus trap while open (first focusable element receives focus on open).
  - Esc closes the panel.
  - Cost rows in --blood when the player cannot afford an item.
  - aria-disabled on the Confirm button when not affordable.
  - Keyboard navigable; visible focus rings on all interactive elements.
*/

import { useEffect, useRef, useId } from 'react'
import { useWorldStore } from '../../game/state/worldStore'
import { useChapelStore } from '../../game/state/chapelStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { canRepair } from '../../game/systems/repairs'
import type { ItemId } from '../../game/types'
import './RepairUI.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable item names — a subset; key items don't appear in repair costs. */
const ITEM_NAMES: Partial<Record<ItemId, string>> = {
  'bone':       'Bone',
  'iron-nail':  'Iron Nails',
  'candle-wax': 'Candle Wax',
  'holy-water': 'Holy Water',
  'cloth':      'Cloth',
  'lamp-oil':   'Lamp Oil',
  'grave-salt': 'Grave Salt',
}

function itemName(id: ItemId): string {
  return ITEM_NAMES[id] ?? id
}

// ---------------------------------------------------------------------------
// RepairUI
// ---------------------------------------------------------------------------

/**
 * Modal overlay for chapel repairs.
 * Mount once at the app level; visibility is gated by `chapelRepairOpen`.
 */
export function RepairUI() {
  const chapelRepairOpen = useWorldStore((s) => s.chapelRepairOpen)
  const closeChapelRepair = useWorldStore((s) => s.closeChapelRepair)
  const applyRepair = useChapelStore((s) => s.applyRepair)
  const chapel = useChapelStore((s) => s.chapel)
  const inventory = useInventoryStore((s) => s.inventory)

  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  // Focus the confirm button (or cancel if confirm is disabled) when opened.
  useEffect(() => {
    if (!chapelRepairOpen) return
    // Defer so the animation has started and the element is in the DOM.
    const id = requestAnimationFrame(() => {
      if (confirmRef.current && !confirmRef.current.disabled) {
        confirmRef.current.focus()
      } else {
        cancelRef.current?.focus()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [chapelRepairOpen])

  // Esc closes; Tab cycles focus within the panel (focus trap).
  useEffect(() => {
    if (!chapelRepairOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeChapelRepair()
        return
      }

      // Trap Tab within the panel.
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [tabindex="0"]',
          ),
        ).filter((el) => el.offsetParent !== null)

        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chapelRepairOpen, closeChapelRepair])

  if (!chapelRepairOpen) return null

  // Compute affordability using the pure system.
  const checkResult = canRepair(inventory, chapel)
  const { nextStage, ok: affordable, missing } = checkResult
  const allComplete = nextStage === null

  const missingMap = new Map(missing.map((m) => [m.item, m.qty]))

  const handleConfirm = () => {
    if (!affordable) return
    applyRepair()
    closeChapelRepair()
  }

  return (
    <div
      className="repair-ui__backdrop"
      // Click outside panel closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) closeChapelRepair()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={panelRef}
        className="repair-ui"
        // Prevent events leaking to the 3D world.
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <h2 id={titleId} className="repair-ui__title">
          Chapel Repairs
        </h2>
        <div className="repair-ui__divider" aria-hidden="true">
          ✦ · · ✦ · · ✦
        </div>

        {allComplete ? (
          /* All three stages complete */
          <p className="repair-ui__complete">
            All repairs are complete. The chapel stands firm.
          </p>
        ) : (
          <>
            {/* Stage label */}
            <p className="repair-ui__stage-label">
              Stage {nextStage.stage}: {nextStage.label}
            </p>

            {/* Effect description */}
            <p className="repair-ui__effect">{nextStage.description}</p>

            {/* Cost list */}
            <div>
              <p className="repair-ui__cost-heading">Materials required</p>
              <ul className="repair-ui__cost-list" aria-label="Repair cost">
                {nextStage.cost.map((req) => {
                  const lack = missingMap.get(req.item) ?? 0
                  const hasMissing = lack > 0
                  return (
                    <li
                      key={req.item}
                      className={[
                        'repair-ui__cost-item',
                        hasMissing ? 'repair-ui__cost-item--missing' : '',
                      ].join(' ')}
                    >
                      <span className="repair-ui__cost-qty">{req.qty}</span>
                      <span>{itemName(req.item)}</span>
                      {hasMissing && (
                        <span
                          className="repair-ui__cost-missing-label"
                          aria-label={`Missing ${lack}`}
                        >
                          missing {lack}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="repair-ui__actions">
          {!allComplete && (
            <button
              ref={confirmRef}
              type="button"
              className="repair-ui__btn repair-ui__btn--confirm"
              disabled={!affordable}
              aria-disabled={!affordable}
              onClick={handleConfirm}
            >
              ✦ Confirm Repair
            </button>
          )}
          <button
            ref={cancelRef}
            type="button"
            className="repair-ui__btn repair-ui__btn--cancel"
            onClick={closeChapelRepair}
          >
            {allComplete ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
