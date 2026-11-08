// App routes between screens: ContentWarning -> Loading -> Title -> Game -> Ending
// Screen state is driven by useGameStore; this component just renders the active screen.
// The Game screen mounts the R3F <Canvas> with every scene system (see GameScreen).
//
// HTML overlays that must be reachable from any screen are mounted here:
//   - PauseMenu   (gated by gameStore.paused on the game screen)
//   - RecipeBook  (crafting overlay, gated by worldStore.workbenchOpen)
//   - RepairUI    (chapel repair overlay, gated by worldStore.chapelRepairOpen)
import { Canvas } from '@react-three/fiber'
import { useGameStore } from './game/state/gameStore'
import { useSettingsStore } from './game/state'
import { useEndingStore } from './game/state/endingStore'
import { EndingScreen } from './ui/menus/EndingScreen'
import { EndingCamera } from './scene/effects/EndingCamera'
import { FinalRite } from './scene/world/FinalRite'
import { ContentWarning } from './ui/menus/ContentWarning'
import { LoadingScreen } from './ui/menus/LoadingScreen'
import { TitleScreen } from './ui/menus/TitleScreen'
import { PauseMenu } from './ui/menus/PauseMenu'
import { TakenScreen } from './ui/menus/TakenScreen'
import { Hud } from './ui/hud/Hud'
import { RecipeBook } from './ui/workbench/RecipeBook'
import { RepairUI } from './ui/chapel/RepairUI'
import { ExamineOverlay } from './ui/examine/ExamineOverlay'
import { Journal } from './ui/journal/Journal'
import { TombstoneOverlay } from './ui/tombstone/TombstoneOverlay'
import { Satchel } from './ui/satchel/Satchel'
import { GameLoop } from './scene/GameLoop'
import { PostEffects } from './scene/effects/PostEffects'
import { DustBurst } from './scene/effects/DustBurst'
import { GraveBurst } from './scene/effects/GraveBurst'
import { EnemyDirector } from './scene/enemies/EnemyDirector'
import { WaveDirector } from './scene/enemies/WaveDirector'
import { FirstPersonController } from './scene/player/FirstPersonController'
import { Lantern } from './scene/player/Lantern'
import { MeleeAttack } from './scene/player/MeleeAttack'
import { ThrowControls } from './scene/player/ThrowControls'
import { Viewmodel } from './scene/player/Viewmodel'
import { ScareProps } from './scene/scares/ScareProps'
import { ScareStager } from './scene/scares/ScareStager'
import { ScareZoneVolumes } from './scene/scares/ScareZoneVolumes'
import { Cemetery } from './scene/world/Cemetery'
import { Chapel } from './scene/world/Chapel'
import { ClueSpots } from './scene/world/ClueSpots'
import { FixedSpawns } from './scene/world/FixedSpawns'
import { Tombstones } from './scene/world/Tombstones'
import { LanternTraps } from './scene/world/LanternTraps'
import { GraveMounds } from './scene/world/GraveMounds'
import { MaterialPickups } from './scene/world/MaterialPickups'
import { SaltCircles } from './scene/world/SaltCircles'
import { SkyAndFog } from './scene/world/SkyAndFog'
import { ThrownItems } from './scene/world/ThrownItems'
import { Workbench } from './scene/world/Workbench'

/** The 3D game: one Canvas, physics, fixed-step loop, then every system that reads the stores. */
function GameScreen() {
  const fov = useSettingsStore((s) => s.fov)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--ink)' }}>
      <Canvas shadows camera={{ fov, near: 0.1, far: 200 }} dpr={[1, 1.5]}>
        <SkyAndFog />
        <GameLoop>
          <FirstPersonController />
          <Lantern />
          <Cemetery />
          <Chapel />
          <FixedSpawns />
          <Tombstones />
          <ClueSpots />
          <MaterialPickups />
          <GraveMounds />
          <Workbench />
          <EnemyDirector />
          <WaveDirector />
          <FinalRite />
          <ScareZoneVolumes />
          <ScareProps />
          <ScareStager />
          <MeleeAttack />
          <ThrowControls />
          <ThrownItems />
          <LanternTraps />
          {/* After EnemyDirector so salt reads this frame's enemy positions. */}
          <SaltCircles />
          <DustBurst />
          <GraveBurst />
        </GameLoop>
        {/* Viewmodel (priority 2) draws over the composer (priority 1); no weapon durability store yet. */}
        <Viewmodel weaponState={null} />
        {/* After the controller so the ending path wins the camera. */}
        <EndingCamera />
        <PostEffects />
      </Canvas>
    </div>
  )
}

function ActiveScreen() {
  const screen = useGameStore((s) => s.screen)
  const runId = useEndingStore((s) => s.runId)
  switch (screen) {
    case 'content-warning':
      return <ContentWarning />
    case 'loading':
      return <LoadingScreen />
    case 'title':
      return <TitleScreen />
    default:
      return <GameScreen key={runId} />
  }
}

export default function App() {
  return (
    <>
      <ActiveScreen />
      <Hud />
      <PauseMenu />
      <TakenScreen />
      <EndingScreen />
      {/* HTML overlays rendered above the canvas; always mounted, self-hide when not needed */}
      <RecipeBook />
      <RepairUI />
      <ExamineOverlay />
      <TombstoneOverlay />
      <Journal />
      <Satchel />
    </>
  )
}
