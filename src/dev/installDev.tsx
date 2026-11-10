// Entry point of developer mode. main.tsx loads this file with a dynamic import, and only when
// the page has ?dev=1 or is a DEV build. It checks the flag again, so importing it by mistake
// without the flag still installs nothing.

import { createRoot } from 'react-dom/client'
import { DebugOverlay, DevPanel } from './DevPanel'
import { startDebugViews } from './debugViews'
import { startCheatTicker } from './devCheats'
import { setDevCheatFlags } from '../game/state/devCheats'
import { isDevEnabled } from './devFlag'
import { installDevKeys } from './devKeys'
import { useDevPanelStore } from './devPanelStore'

let installed = false

export interface InstallDevOptions {
  /** `location.search`; defaults to the page's. */
  search?: string
  /** `import.meta.env.DEV`; defaults to the build's. */
  envDev?: boolean
}

/** Returns true when dev mode was switched on. */
export function installDev(opts: InstallDevOptions = {}): boolean {
  const search = opts.search ?? (typeof location === 'undefined' ? '' : location.search)
  if (!isDevEnabled(search, opts.envDev ?? import.meta.env.DEV)) return false
  if (installed) return true
  installed = true

  useDevPanelStore.getState().enable()
  // An open panel is an overlay: the game stops taking input and the cursor is freed so the
  // buttons can be clicked. Clicking the canvas after closing re-locks it as usual.
  useDevPanelStore.subscribe((s, prev) => {
    if (s.open === prev.open) return
    setDevCheatFlags({ panelOpen: s.open })
    if (s.open && document.pointerLockElement) document.exitPointerLock()
  })
  installDevKeys(window)
  startCheatTicker()
  startDebugViews()

  const host = document.createElement('div')
  host.id = 'dev-root'
  document.body.appendChild(host)
  createRoot(host).render(
    <>
      <DevPanel />
      <DebugOverlay />
    </>,
  )
  return true
}
