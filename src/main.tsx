import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme/tokens.css'
import App from './App'
import { installNewDaySave } from './game/state/gameSave'
import { installRunStats } from './game/state/endingStore'
import { installDuskSnapshot } from './game/state/retryNight'

installDuskSnapshot()
installNewDaySave()
installRunStats()

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
