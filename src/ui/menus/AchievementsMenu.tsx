import { useEffect, useState } from 'react'
import { useAchievementStore } from '../../game/state/achievementStore'
import { musicRuntime } from '../../game/state/musicRuntime'
import { simClock } from '../../game/state/simClock'
import { majorScareActive } from '../../game/systems/scareSilence'
import { MenuDialog } from './MenuDialog'
import { achievementsMenuModel } from './achievementsMenuModel'
import './menus.css'

const POLL_MS = 250

/** The scare schedule lives outside React, so re-read it a few times a second. */
function useMajorScare(): boolean {
  const [active, setActive] = useState(() => majorScareActive(musicRuntime.silence, simClock.now))
  useEffect(() => {
    const id = window.setInterval(
      () => setActive(majorScareActive(musicRuntime.silence, simClock.now)),
      POLL_MS,
    )
    return () => window.clearInterval(id)
  }, [])
  return active
}

interface AchievementsMenuProps {
  onClose: () => void
}

export function AchievementsMenu({ onClose }: AchievementsMenuProps) {
  const unlocked = useAchievementStore((s) => s.unlocked)
  const scare = useMajorScare()
  const model = achievementsMenuModel(unlocked, scare)

  if (!model.open) {
    return (
      <p className="achievements__notnow" role="status">
        {model.notNow}
      </p>
    )
  }

  return (
    <MenuDialog titleId="achievements-title" onEscape={onClose}>
      <h2 id="achievements-title" className="menu__title">
        Achievements
      </h2>
      <ul className="achievements__list">
        {model.entries.map((e) => (
          <li
            key={e.id}
            className={`achievements__entry ${e.unlocked ? 'achievements__entry--unlocked' : 'achievements__entry--locked'}`}
          >
            <span className="achievements__name">{e.unlocked ? `✦ ${e.name}` : '◇ ???'}</span>
            <span className="achievements__goal">{e.goal}</span>
            {e.tag && <span className="achievements__tag">{e.tag}</span>}
          </li>
        ))}
      </ul>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={onClose} data-autofocus="">
          Close
        </button>
      </div>
    </MenuDialog>
  )
}
