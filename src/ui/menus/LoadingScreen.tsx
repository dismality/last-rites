import { useEffect, useId } from 'react'
import { useProgress } from '@react-three/drei'
import { useGameStore } from '../../game/state/gameStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { preloadAllModels } from '../../scene/assets/preloadModels'
import './menus.css'

// Start fetching at import time so the bar already has real items to count when
// the screen first renders (otherwise `active` is false and it would skip ahead).
preloadAllModels()

/** Shortest time the screen shows, so it never flashes by when assets are cached. */
const MIN_SHOW_MS = 1200

function LanternIcon() {
  return (
    <svg className="loading__lantern" viewBox="0 0 96 128" aria-hidden="true">
      <path d="M36 14 Q48 -2 60 14" fill="none" stroke="currentColor" strokeWidth="4" />
      <rect x="30" y="14" width="36" height="8" fill="currentColor" />
      <rect x="26" y="108" width="44" height="10" fill="currentColor" />
      <path d="M32 22 L28 108 M64 22 L68 108" stroke="currentColor" strokeWidth="4" />
      <g className="loading__flame">
        <path d="M48 40 Q64 66 56 88 Q48 100 40 88 Q32 66 48 40Z" fill="var(--ember)" />
        <path d="M48 62 Q55 76 50 90 Q46 92 44 88 Q42 74 48 62Z" fill="var(--ember-glow)" />
      </g>
    </svg>
  )
}

/** Real asset progress from drei's loading manager; leaves for Title when done. */
export function LoadingScreen() {
  const titleId = useId()
  const { progress, errors, active } = useProgress()
  const setScreen = useGameStore((s) => s.setScreen)
  const flashing = useSettingsStore((s) => s.flashingLights)

  // Done when everything loaded, or when nothing is loading at all (no assets
  // registered yet, so progress would otherwise sit at 0). Errors block advance.
  const done = errors.length === 0 && (progress >= 100 || !active)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setScreen('title'), MIN_SHOW_MS)
    return () => clearTimeout(t)
  }, [done, setScreen])

  return (
    <div
      className="loading"
      data-flicker={flashing ? 'on' : 'off'}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-live="polite"
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
    >
        <LanternIcon />
        <h1 id={titleId} className="menu__title" style={{ color: 'var(--parchment)' }}>
          Lighting the lantern…
        </h1>
        <div
          className="loading__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Asset loading progress"
        >
          <div className="loading__fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="loading__label">{Math.round(progress)}%</p>
        {errors.length > 0 && (
          <>
            <ul className="loading__errors">
              {errors.map((url) => (
                <li key={url}>Failed: {url}</li>
              ))}
            </ul>
            <button type="button" className="menu__button" onClick={() => window.location.reload()}>
              Retry
            </button>
          </>
        )}
    </div>
  )
}
