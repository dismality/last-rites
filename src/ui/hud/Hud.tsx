import { useGameStore } from '../../game/state/gameStore'
import { useIntroStore } from '../../game/state/introStore'
import { IntroOverlay } from './IntroOverlay'
import { HealthBar } from './HealthBar'
import { LanternGauge } from './LanternGauge'
import { ObjectiveTracker } from './ObjectiveTracker'
import { Compass } from './Compass'
import { ZoneCard } from './ZoneCard'
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
import { AmmoReadout } from './AmmoReadout'
import { EffectIcons } from './EffectIcons'
import { ChargeMeter } from './ChargeMeter'
import { ControlHints } from './ControlHints'
import { DoorStatus } from './DoorStatus'
import { BossBar } from './BossBar'
import { BossNameCard } from './BossNameCard'
import { ScorePanel } from './ScorePanel'
import { Minimap, MinimapHotkey } from './Minimap'
import { AchievementToasts } from './AchievementToasts'
import { DawnCard } from './DawnCard'
import { MerchantMenu } from '../merchant/MerchantMenu'
import { Hotbar } from '../satchel/Hotbar'
import './hud.css'

/** HTML overlay above the canvas; only shown on the game screen. */
export function Hud() {
  const screen = useGameStore((s) => s.screen)
  const introPlaying = useIntroStore((s) => s.playing)
  if (screen !== 'game') return null
  // The cutscene shows only its own overlay plus captions and toasts.
  if (introPlaying) {
    return (
      <div className="hud">
        <IntroOverlay />
        <Subtitles />
        <Toast />
      </div>
    )
  }
  return (
    <div className="hud">
      <DamageFeedback />
      <Crosshair />
      <InteractPrompt />
      <ObjectiveTracker />
      <Compass />
      <ZoneCard />
      {/* Below the compass, wave tally and rite meter so none of them overlap. */}
      <div className="hud-top-stack">
        <BossBar />
        <DoorStatus />
      </div>
      <BossNameCard />
      <ChargeMeter />
      <EffectIcons />
      <AmmoReadout />
      {/* Health over lantern, bottom left; stamina is bottom centre and the hotbar bottom right. */}
      <div className="hud-corner">
        <ControlHints />
        <HealthBar />
        <LanternGauge />
      </div>
      <Hotbar />
      <StaminaBar />
      <WaveTally />
      <RiteMeter />
      <DigBar />
      <Subtitles />
      <Toast />
      <DuskHint />
      {/* Score on top, minimap beneath it: one column, so the map never lands on the score. */}
      <div className="hud-right-stack">
        <ScorePanel />
        <Minimap />
      </div>
      <MinimapHotkey />
      <AchievementToasts />
      <DawnCard />
      <MerchantMenu />
    </div>
  )
}
