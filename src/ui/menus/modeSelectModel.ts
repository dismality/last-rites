import { DEFAULT_MODE } from '../../data/modes'
import { useSettingsStore } from '../../game/state/settingsStore'
import type { ModeId } from '../../game/types'

/**
 * The New Game choices (playtest, 2026-11-28): Normal, or Normal with the developer tools on.
 * Easy, Hard, Short Vigil and Endless are off the menu; their data stays in data/modes.ts so
 * older saves still load.
 */
export type VigilChoice = 'normal' | 'developer'

export interface ModeOption {
  id: VigilChoice
  label: string
  /** One text line per point, so nothing is conveyed by colour alone. */
  lines: string[]
}

const CHOICES: readonly VigilChoice[] = ['normal', 'developer']

export function modeOptions(): ModeOption[] {
  return [
    {
      id: 'normal',
      label: 'Normal',
      lines: ['The three stages and the rite', 'Developer tools off'],
    },
    {
      id: 'developer',
      label: 'Developer mode',
      lines: ['The same game as Normal', '] skips the current step, ` opens the dev panel'],
    },
  ]
}

export function initialChoice(): VigilChoice {
  return 'normal'
}

/** Mirrors native radio-group arrow behaviour (wraps at both ends). */
export function moveChoice(current: VigilChoice, key: string): VigilChoice {
  const i = CHOICES.indexOf(current)
  const n = CHOICES.length
  if (key === 'ArrowDown' || key === 'ArrowRight') return CHOICES[(i + 1) % n]
  if (key === 'ArrowUp' || key === 'ArrowLeft') return CHOICES[(i - 1 + n) % n]
  return current
}

/** Both choices play Normal; Developer mode also switches the developer tools on (and Normal off). */
export function beginMode(chosen: VigilChoice, onBegin: (mode: ModeId) => void): void {
  useSettingsStore.getState().setSetting('developerMode', chosen === 'developer')
  onBegin(DEFAULT_MODE)
}
