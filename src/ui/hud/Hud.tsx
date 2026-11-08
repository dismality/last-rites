import { useGameStore } from '../../game/state/gameStore'
import { LanternHealth } from './LanternHealth'
import { FuelReservoir } from './FuelReservoir'
import { StaminaBar } from './StaminaBar'
import { DamageFeedback } from './DamageFeedback'
import { Crosshair } from './Crosshair'
import { InteractPrompt } from './InteractPrompt'
import { Subtitles } from './Subtitles'
import { Toast } from './Toast'
import { DuskHint } from './DuskHint'
import { WaveTally } from './WaveTally'
import { RiteMeter } from './RiteMeter'
import { DigBar } from './DigBar'
import { Hotbar } from '../satchel/Hotbar'
import './hud.css'

/** HTML overlay above the canvas; only shown on the game screen. */
export function Hud() {
  const screen = useGameStore((s) => s.screen)
  if (screen !== 'game') return null
  return (
    <div className="hud">
      <DamageFeedback />
      <Crosshair />
      <InteractPrompt />
      <div className="hud-corner">
        <LanternHealth />
        <FuelReservoir />
      </div>
      <Hotbar />
      <StaminaBar />
      <WaveTally />
      <RiteMeter />
      <DigBar />
      <Subtitles />
      <Toast />
      <DuskHint />
    </div>
  )
}
