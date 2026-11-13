import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme/tokens.css'
import App from './App'
import { installNewDaySave } from './game/state/gameSave'
import { installRunStats } from './game/state/endingStore'
import { installCaseSolvedWatcher } from './game/state/caseSolvedWatcher'
import { installCombatWatchers } from './game/state/combatWatchers'
import { installGuidanceWatchers } from './game/state/guidanceTick'
import { installProgressionWatchers } from './game/state/progressionEvents'
import { installSpawnRespawn } from './game/state/spawnRespawn'
import { installDuskSnapshot, installMorningSnapshot } from './game/state/retryNight'

import { registerCombatSounds } from './audio/audioBoot'

registerCombatSounds()
installDuskSnapshot()
installCombatWatchers()
installGuidanceWatchers()
// Must run before the new-day save and run stats so their dawn/day handlers see progression state already updated.
installProgressionWatchers()
installCaseSolvedWatcher()
installNewDaySave()
// After the progression watchers, like the new-day save, so the morning holds the dealt stock.
installMorningSnapshot()
installRunStats()
installSpawnRespawn()

// Dev only: a dynamic import behind the DEV constant, so production builds drop the hook entirely.
if (import.meta.env.DEV) void import('./debug/debugHook').then((m) => m.installDebugHook())
// Developer mode: its own chunk, fetched only with ?dev=1 (or in a DEV build). See src/dev/.
if (import.meta.env.DEV || new URLSearchParams(location.search).get('dev') === '1')
  void import('./dev/installDev').then((m) => m.installDev())
const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
