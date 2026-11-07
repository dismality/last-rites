import { useId, useState } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { MenuDialog } from './MenuDialog'
import { Settings } from './Settings'

/** First screen on load: warns about scares and flashing, links to settings. */
export function ContentWarning() {
  const titleId = useId()
  const setScreen = useGameStore((s) => s.setScreen)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (settingsOpen) return <Settings onClose={() => setSettingsOpen(false)} />

  return (
    <MenuDialog titleId={titleId} variant="screen">
      <h1 id={titleId} className="menu__title">
        Content Warning
      </h1>
      <p className="menu__text">Last Rites is a horror game. It contains:</p>
      <ul className="menu__list">
        <li>Jumpscares and sudden loud sounds</li>
        <li>Flashing lights and flickering darkness</li>
        <li>Themes of death, burial and grief (little gore)</li>
      </ul>
      <p className="menu__text">
        You can reduce or turn off scares, flashing, camera shake and head bob in Settings.
      </p>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={() => setScreen('loading')}>
          Continue
        </button>
        <button type="button" className="menu__button" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </div>
    </MenuDialog>
  )
}
