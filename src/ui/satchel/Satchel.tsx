// Satchel overlay: a leather bag with 12 stitched pockets (4x3) laid over the
// live game. Tab toggles it with a creak; the world keeps running behind it.
//
// Keyboard: arrows move between pockets (roving tabindex), 1-4 bind the focused
// stack to that hotbar slot, Backspace clears its binding, Delete drops it, Esc closes.
// Outside the overlay the same number keys equip the bound item.
import { useEffect, useRef, useState } from 'react'
import { playSatchelCreak } from '../../audio/AudioManager'
import { ITEM_MAP } from '../../data/items'
import { currentModifiers } from '../../game/state/derivedStats'
import { clampCellIndex, satchelCellCount } from './satchelCells'
import {
  useGameStore,
  useInventoryStore,
  usePlayerStore,
  useSettingsStore,
  useUiWorldStore,
} from '../../game/state'
import { useIntroStore } from '../../game/state/introStore'
import { useSpawnStore } from '../../game/state/spawnStore'
import { emit } from '../../game/events'
import { assignHotbar } from '../../game/systems/inventory'
import { dropPosition, hotbarSlotOf } from '../../game/systems/satchel'
import { playerPositionRef } from '../../scene/world/playerPositionRef'
import { itemGlyph } from './itemGlyph'
import './satchel.css'

const COLUMNS = 4
const HOTBAR_ACTIONS = ['Hotbar1', 'Hotbar2', 'Hotbar3', 'Hotbar4'] as const

export function Satchel() {
  const open = useGameStore((s) => s.satchelOpen)
  const screen = useGameStore((s) => s.screen)
  const slots = useInventoryStore((s) => s.inventory.slots)
  const hotbar = useInventoryStore((s) => s.inventory.hotbar)
  const [focusIdx, setFocusIdx] = useState(0)
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  // Latest focus for the window listener without re-subscribing on every move.
  const focusRef = useRef(0)
  useEffect(() => {
    focusRef.current = focusIdx
  }, [focusIdx])

  useEffect(() => {
    if (screen !== 'game') return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const gs = useGameStore.getState()
      const bindings = useSettingsStore.getState().bindings
      const ui = useUiWorldStore.getState()
      // The intro and the death screen hold their own buttons. Tab must keep moving focus
      // there, so the key is left alone (found in the spec 06 playtest: Tab was swallowed
      // in the pause menu and could not reach the Skip button or the Settings toggle).
      const blocked =
        gs.paused ||
        gs.examining ||
        gs.journalOpen ||
        gs.taken ||
        useIntroStore.getState().playing ||
        ui.workbenchOpen ||
        ui.chapelRepairOpen

      if (e.code === bindings.Satchel) {
        if (blocked) return
        e.preventDefault()
        playSatchelCreak(!gs.satchelOpen)
        gs.setSatchelOpen(!gs.satchelOpen)
        return
      }
      if (gs.satchelOpen && e.code === 'Escape') {
        // Capture phase so the pause trigger never sees it.
        e.preventDefault()
        e.stopPropagation()
        playSatchelCreak(false)
        gs.setSatchelOpen(false)
        return
      }
      if (blocked) return

      const slot = HOTBAR_ACTIONS.findIndex((a) => e.code === bindings[a])
      if (slot === -1) return
      const inv = useInventoryStore.getState()
      if (gs.satchelOpen) {
        // Assign the focused pocket's stack to this hotbar slot.
        const stack = inv.inventory.slots[focusRef.current]
        if (!stack) return
        e.preventDefault()
        const next = assignHotbar(inv.inventory, slot, stack.item)
        inv.setInventory(next)
        // assignHotbar returns the same object when the request is refused.
        if (next !== inv.inventory) emit({ type: 'hotbarBound', slot: slot as 0 | 1 | 2 | 3 })
      } else {
        inv.equipSlot(slot as 0 | 1 | 2 | 3)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [screen])

  useEffect(() => {
    if (!open) return
    if (document.pointerLockElement) document.exitPointerLock()
    // Wait a frame so the cells exist before taking focus.
    const raf = requestAnimationFrame(() => {
      setFocusIdx(0)
      cells.current[0]?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  if (!open || screen !== 'game') return null

  const cellCount = satchelCellCount(currentModifiers().satchelSlots)

  const moveFocus = (idx: number) => {
    const next = clampCellIndex(idx, cellCount)
    setFocusIdx(next)
    cells.current[next]?.focus()
  }

  const drop = (idx: number) => {
    const stack = slots[idx]
    if (!stack) return
    const pos = playerPositionRef.current
    const yaw = usePlayerStore.getState().yaw
    useSpawnStore.getState().dropFromSatchel(stack.item, dropPosition([pos.x, pos.y, pos.z], yaw))
    // Stacks shift left when one empties, so keep focus on a real pocket.
    moveFocus(Math.min(idx, Math.max(0, slots.length - 2)))
  }

  const clearBinding = (idx: number) => {
    const stack = slots[idx]
    if (!stack) return
    const slot = hotbarSlotOf(useInventoryStore.getState().inventory, stack.item)
    if (slot !== null) {
      const inv = useInventoryStore.getState()
      inv.setInventory(assignHotbar(inv.inventory, slot, null))
    }
  }

  const onCellKey = (e: React.KeyboardEvent, idx: number) => {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = idx + 1
    else if (e.key === 'ArrowLeft') next = idx - 1
    else if (e.key === 'ArrowDown') next = idx + COLUMNS
    else if (e.key === 'ArrowUp') next = idx - COLUMNS
    if (next !== null) {
      e.preventDefault()
      moveFocus(next)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      drop(idx)
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      clearBinding(idx)
    }
  }

  const focused = slots[focusIdx]

  return (
    <div className="satchel" role="dialog" aria-modal="true" aria-label="Satchel">
      <div className="satchel__bag">
        <h2 className="satchel__title">Satchel</h2>
        <ul className="satchel__grid" role="grid" aria-label="Satchel pockets">
          {Array.from({ length: cellCount }, (_, i) => {
            const stack = slots[i]
            const def = stack ? ITEM_MAP[stack.item] : null
            const bound = stack ? hotbar.indexOf(stack.item) : -1
            return (
              <li key={i} role="gridcell">
                <button
                  ref={(el) => {
                    cells.current[i] = el
                  }}
                  type="button"
                  className={`satchel__cell${stack ? '' : ' satchel__cell--empty'}`}
                  tabIndex={i === focusIdx ? 0 : -1}
                  onFocus={() => setFocusIdx(i)}
                  onKeyDown={(e) => onCellKey(e, i)}
                  aria-label={
                    stack && def
                      ? `${def.name}, quantity ${stack.qty}${bound >= 0 ? `, hotbar ${bound + 1}` : ''}`
                      : `Empty pocket ${i + 1}`
                  }
                >
                  {stack && def && (
                    <>
                      <span className="satchel__glyph" aria-hidden="true">
                        {itemGlyph(def.kind)}
                      </span>
                      <span className="satchel__name">{def.name}</span>
                      <span className="satchel__count">×{stack.qty}</span>
                      {bound >= 0 && (
                        <span className="satchel__badge" aria-hidden="true">
                          {bound + 1}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="satchel__help">
          Arrows: move &middot; 1-4: bind to hotbar &middot; Backspace: unbind &middot; Delete: drop &middot; Tab / Esc: close
        </p>
        <div className="satchel__actions">
          <button
            type="button"
            className="satchel__btn"
            disabled={!focused}
            onClick={() => drop(focusIdx)}
          >
            Drop stack
          </button>
          <button
            type="button"
            className="satchel__btn"
            onClick={() => {
              playSatchelCreak(false)
              useGameStore.getState().setSatchelOpen(false)
            }}
          >
            Close satchel
          </button>
        </div>
      </div>
    </div>
  )
}
