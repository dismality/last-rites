// First: game keys must not fire while the player types into a text field.
import './ui/typingGuardBoot'
import { useSettingsStore } from './game/state/settingsStore'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme/tokens.css'
import App from './App'
import { installAutosave, installNewDaySave } from './game/state/gameSave'
import { installRunStats } from './game/state/endingStore'
import { installCase1Story } from './game/state/case1Story'
import { installCase2Story } from './game/state/case2Story'
import { installCase3Story } from './game/state/case3Story'
import { installCaseSolvedWatcher } from './game/state/caseSolvedWatcher'
import { installCombatWatchers } from './game/state/combatWatchers'
import { installGuidanceWatchers } from './game/state/guidanceTick'
import { installProgressionWatchers } from './game/state/progressionEvents'
import { installSpawnRespawn } from './game/state/spawnRespawn'
import { installVendingWatchers } from './game/state/vendingActions'
import { installDuskSnapshot, installMorningSnapshot } from './game/state/retryNight'

import { registerCombatSounds } from './audio/audioBoot'
import { installPlainJournalFont } from './ui/theme/plainJournalFont'

registerCombatSounds()
installPlainJournalFont()
installDuskSnapshot()
installCombatWatchers()
installGuidanceWatchers()
// Must run before the new-day save and run stats so their dawn/day handlers see progression state already updated.
installProgressionWatchers()
installCaseSolvedWatcher()
installCase1Story()
installCase2Story()
installCase3Story()
installNewDaySave()
installAutosave()
// After the progression watchers, like the new-day save, so the morning holds the dealt stock.
installMorningSnapshot()
installRunStats()
installSpawnRespawn()
installVendingWatchers()

// Dev only: a dynamic import behind the DEV constant, so production builds drop the hook entirely.
if (import.meta.env.DEV) void import('./debug/debugHook').then((m) => m.installDebugHook())
// Developer mode: its own chunk, fetched only with ?dev=1, in a DEV build, or once the player turns
// on Developer mode in Settings. Turning the setting off hides the panel and the skip key again.
const wantDev = () =>
  import.meta.env.DEV ||
  new URLSearchParams(location.search).get('dev') === '1' ||
  useSettingsStore.getState().developerMode
const syncDev = () => {
  if (wantDev()) void import('./dev/installDev').then((m) => m.installDev({ setting: useSettingsStore.getState().developerMode }))
  else void import('./dev/devPanelStore').then((m) => m.useDevPanelStore.getState().disable())
}
syncDev()
useSettingsStore.subscribe((s, prev) => {
  if (s.developerMode !== prev.developerMode) syncDev()
})
const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
