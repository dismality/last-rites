// App routes between screens: ContentWarning -> Loading -> Title -> Game -> Ending
// Screen state is driven by useGameStore; this component just renders the active screen.
// The 3D Game screen is mounted by a later task; until then it renders a placeholder.
//
// HTML overlays that must be reachable from any screen are mounted here:
//   - PauseMenu   (gated by gameStore.paused on the game screen)
//   - RecipeBook  (crafting overlay, gated by worldStore.workbenchOpen)
//   - RepairUI    (chapel repair overlay, gated by worldStore.chapelRepairOpen)
import { useGameStore } from './game/state/gameStore'
import { ContentWarning } from './ui/menus/ContentWarning'
import { LoadingScreen } from './ui/menus/LoadingScreen'
import { TitleScreen } from './ui/menus/TitleScreen'
import { PauseMenu } from './ui/menus/PauseMenu'
import { Hud } from './ui/hud/Hud'
import { RecipeBook } from './ui/workbench/RecipeBook'
import { RepairUI } from './ui/chapel/RepairUI'
import { ExamineOverlay } from './ui/examine/ExamineOverlay'
import { MapOverlay } from './ui/journal/MapOverlay'
import { Satchel } from './ui/satchel/Satchel'

function ActiveScreen() {
  const screen = useGameStore((s) => s.screen)
  switch (screen) {
    case 'content-warning':
      return <ContentWarning />
    case 'loading':
      return <LoadingScreen />
    case 'title':
      return <TitleScreen />
    default:
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            background: 'var(--ink)',
            color: 'var(--parchment)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-body)',
            fontSize: '1.5rem',
          }}
        >
          Last Rites: game screen placeholder
        </div>
      )
  }
}

export default function App() {
  return (
    <>
      <ActiveScreen />
      <Hud />
      <PauseMenu />
      {/* HTML overlays rendered above the canvas; always mounted, self-hide when not needed */}
      <RecipeBook />
      <RepairUI />
      <ExamineOverlay />
      <MapOverlay />
      <Satchel />
    </>
  )
}
