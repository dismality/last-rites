/*
  Settings panel: every setting from the accessibility steering doc.
  Each change goes through useSettingsStore.setSetting, which applies it
  immediately and persists it via saveSettings (Req 6.2), so there is no Save button.
*/
import { useId } from 'react'
import { useSettingsStore } from '../../game/state/settingsStore'
import { SETTINGS_RANGES } from '../../game/systems/settings'
import type { Settings as SettingsValues } from '../../game/types'
import { Controls } from './Controls'
import { MenuDialog } from './MenuDialog'

type BooleanSetting =
  | 'flashingLights'
  | 'cameraShake'
  | 'headBob'
  | 'invertY'
  | 'subtitles'
  | 'accessibleHUD'
  | 'tutorialPrompts'
  | 'damageNumbers'
  | 'showMinimap'
  | 'showPinsInWorld'
type RangeSetting = keyof typeof SETTINGS_RANGES

const TOGGLES: ReadonlyArray<{ key: BooleanSetting; label: string }> = [
  { key: 'flashingLights', label: 'Flashing lights' },
  { key: 'cameraShake', label: 'Camera shake' },
  { key: 'headBob', label: 'Head bob' },
  { key: 'invertY', label: 'Invert Y' },
  { key: 'subtitles', label: 'Subtitles' },
  { key: 'accessibleHUD', label: 'Accessible HUD (numeric values)' },
  { key: 'tutorialPrompts', label: 'Tutorial prompts' },
  { key: 'damageNumbers', label: 'Damage numbers' },
  { key: 'showMinimap', label: 'Show minimap' },
  { key: 'showPinsInWorld', label: 'Show pins in the world' },
]

const SLIDERS: ReadonlyArray<{ key: RangeSetting; label: string; step: number }> = [
  { key: 'fov', label: 'Field of view', step: 1 },
  { key: 'mouseSensitivity', label: 'Mouse sensitivity', step: 0.1 },
  { key: 'masterVolume', label: 'Master volume', step: 1 },
  { key: 'musicVolume', label: 'Music volume', step: 1 },
  { key: 'sfxVolume', label: 'SFX volume', step: 1 },
  { key: 'brightness', label: 'Brightness (gamma)', step: 0.05 },
]

function ToggleRow({ setting, label }: { setting: BooleanSetting; label: string }) {
  const id = useId()
  const value = useSettingsStore((s) => s[setting])
  const setSetting = useSettingsStore((s) => s.setSetting)
  return (
    <div className="settings__row">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => setSetting(setting, e.target.checked)}
      />
    </div>
  )
}

function SliderRow({ setting, label, step }: { setting: RangeSetting; label: string; step: number }) {
  const id = useId()
  const value = useSettingsStore((s) => s[setting])
  const setSetting = useSettingsStore((s) => s.setSetting)
  const { min, max } = SETTINGS_RANGES[setting]
  return (
    <div className="settings__row">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id} className="settings__value">
        {Number.isInteger(step) ? value : value.toFixed(2)}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setSetting(setting, Number(e.target.value))}
      />
    </div>
  )
}

/** The form fields only; reused inline by the pause menu. */
export function SettingsFields() {
  const scareId = useId()
  const scare = useSettingsStore((s) => s.scareIntensity)
  const setSetting = useSettingsStore((s) => s.setSetting)
  return (
    <form className="settings__group" onSubmit={(e) => e.preventDefault()}>
      <div className="settings__row">
        <label htmlFor={scareId}>Scare intensity</label>
        <select
          id={scareId}
          value={scare}
          onChange={(e) =>
            setSetting('scareIntensity', e.target.value as SettingsValues['scareIntensity'])
          }
        >
          <option value="full">Full</option>
          <option value="reduced">Reduced</option>
          <option value="off">Off</option>
        </select>
      </div>
      {TOGGLES.map((t) => (
        <ToggleRow key={t.key} setting={t.key} label={t.label} />
      ))}
      {SLIDERS.map((s) => (
        <SliderRow key={s.key} setting={s.key} label={s.label} step={s.step} />
      ))}
      <Controls />
    </form>
  )
}

interface SettingsProps {
  onClose: () => void
  /** Render inside a parent dialog (pause menu) instead of as its own dialog. */
  inline?: boolean
  /** Heading id, so a parent dialog can reference it via aria-labelledby. */
  titleId?: string
}

export function Settings({ onClose, inline = false, titleId: titleIdProp }: SettingsProps) {
  const ownId = useId()
  const titleId = titleIdProp ?? ownId
  const body = (
    <>
      <h2 id={titleId} className="menu__title">
        Settings
      </h2>
      <SettingsFields />
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={onClose}>
          Back
        </button>
      </div>
    </>
  )
  if (inline) return body
  return (
    <MenuDialog titleId={titleId} onEscape={onClose}>
      {body}
    </MenuDialog>
  )
}
