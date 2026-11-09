import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme/tokens.css'
import App from './App'
import { installNewDaySave } from './game/state/gameSave'
import { installRunStats } from './game/state/endingStore'
import { installCombatWatchers } from './game/state/combatWatchers'
import { installGuidanceWatchers } from './game/state/guidanceTick'
import { installDuskSnapshot } from './game/state/retryNight'

import { registerCombatSounds } from './audio/audioBoot'

registerCombatSounds()
installDuskSnapshot()
installCombatWatchers()
installGuidanceWatchers()
installNewDaySave()
installRunStats()

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
