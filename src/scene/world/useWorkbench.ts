// useWorkbench — wires player proximity + E keypress to the workbench store.
//
// Call this hook from the first-person controller or the scene root.
// It listens for KeyE while `nearWorkbench` is true and the workbench is not
// already open, then calls `openWorkbench`.  Closing is handled inside
// Workbench.tsx itself (Esc or E while open).

import { useEffect } from 'react'
import { useWorldStore } from '../../game/state/worldStore'

/**
 * @param nearWorkbench - true when the player is within interact range of the
 *   workbench (2.5 m, driven by proximity detection in the scene layer).
 */
export function useWorkbench(nearWorkbench: boolean) {
  const workbenchOpen = useWorldStore((s) => s.workbenchOpen)
  const openWorkbench = useWorldStore((s) => s.openWorkbench)

  useEffect(() => {
    if (!nearWorkbench || workbenchOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'KeyE') {
        e.preventDefault()
        openWorkbench()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nearWorkbench, workbenchOpen, openWorkbench])
}
