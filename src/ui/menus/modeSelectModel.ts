import { DEFAULT_MODE, ENDLESS, MODE_IDS, MODES, SHORT_VIGIL } from '../../data/modes'
import { STAGE_COUNT } from '../../data/stages'
import type { ModeId } from '../../game/types'

export interface ModeOption {
  id: ModeId
  label: string
  /** One text line per modifier, so no value is conveyed by colour alone. */
  lines: string[]
}

function mult(n: number): string {
  return `×${n}`
}

export function modeOptions(): ModeOption[] {
  return MODE_IDS.map((id) => {
    const m = MODES[id]
    const lines = [
      `Zombie HP ${mult(m.hpMult)}`,
      `Zombie damage ${mult(m.damageMult)}`,
      `Lantern drain ${mult(m.lanternDrainMult)}`,
      `Elite chance ${Math.round(m.eliteChance * 100)}%`,
      `Score ${mult(m.scoreMult)}`,
    ]
    if (!m.story) lines.push(`${ENDLESS.dayS} s day, no relics or rite, no Retry Night`)
    else if (m.dayLengthS !== null)
      lines.push(`${STAGE_COUNT} stages, ${m.dayLengthS / 60}-minute days, ${SHORT_VIGIL.startOilPct}% oil: about 15 minutes`)
    return { id, label: m.label, lines }
  })
}

export function initialChoice(): ModeId {
  return DEFAULT_MODE
}

/** Mirrors native radio-group arrow behaviour (wraps at both ends). */
export function moveChoice(current: ModeId, key: string): ModeId {
  const i = MODE_IDS.indexOf(current)
  const n = MODE_IDS.length
  if (key === 'ArrowDown' || key === 'ArrowRight') return MODE_IDS[(i + 1) % n]
  if (key === 'ArrowUp' || key === 'ArrowLeft') return MODE_IDS[(i - 1 + n) % n]
  return current
}

export function beginMode(chosen: ModeId, onBegin: (mode: ModeId) => void): void {
  onBegin(chosen)
}
