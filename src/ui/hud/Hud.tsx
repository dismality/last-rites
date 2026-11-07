import { useGameStore } from '../../game/state/gameStore'
import { LanternHealth } from './LanternHealth'
import { FuelReservoir } from './FuelReservoir'
import { StaminaBar } from './StaminaBar'
import { Crosshair } from './Crosshair'
import { InteractPrompt } from './InteractPrompt'
import { Subtitles } from './Subtitles'
import { Toast } from './Toast'
import { Hotbar } from '../satchel/Hotbar'
import './hud.css'

/** HTML overlay above the canvas; only shown on the game screen. */
export function Hud() {
  const screen = useGameStore((s) => s.screen)
  if (screen !== 'game') return null
  return (
    <div className="hud">
      <Crosshair />
      <InteractPrompt />
      <div className="hud-corner">
        <LanternHealth />
        <FuelReservoir />
      </div>
      <Hotbar />
      <StaminaBar />
      <Subtitles />
      <Toast />
    </div>
  )
}
