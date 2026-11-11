import { useEffect, useState } from 'react'
import { readTutorialPrompt } from '../../game/state/guidanceTick'
import { useGameStore } from '../../game/state/gameStore'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { composeSecondLine } from '../../game/systems/objective'
import { PinnedRecipe } from './PinnedRecipe'
import './objectiveTracker.css'

/** Countdown and prompt refresh once per second (Req 3.7, 3.8, 3.9). */
const SECOND_LINE_REFRESH_MS = 1000

/**
 * Top-left objective: one main goal plus a smaller second line. The main line sits in a
 * polite live region and only changes when the objective does, so it is announced once
 * per change. The second line (countdown or tutorial prompt) is outside the region, so
 * its ticks are never announced.
 */
export function ObjectiveTracker() {
  const screen = useGameStore((s) => s.screen)
  const objective = useGuidanceStore((s) => s.objective)
  const [prompt, setPrompt] = useState<string | null>(() => readTutorialPrompt())

  // A finished step, a toggled setting or a rebound key changes the prompt at once; the
  // interval only covers the phase changes that the tracker does not otherwise see.
  const tutorialDone = useGuidanceStore((s) => s.tutorialDone)
  const promptsOn = useSettingsStore((s) => s.tutorialPrompts)
  const bindings = useSettingsStore((s) => s.bindings)

  useEffect(() => {
    const read = () => setPrompt(readTutorialPrompt())
    read()
    const id = window.setInterval(read, SECOND_LINE_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [tutorialDone, promptsOn, bindings])

  if (screen !== 'game' || objective === null) return null

  return (
    <div className="hud-objective">
      <div className="hud-objective__live" role="status" aria-live="polite" aria-atomic="true">
        {/* Keyed so a new objective remounts the span and replays the fade-in. */}
        <span key={`${objective.rule}:${objective.main}`} className="hud-objective__main">
          {objective.main}
        </span>
      </div>
      <p className="hud-objective__second">{composeSecondLine(objective, prompt)}</p>
      <PinnedRecipe />
    </div>
  )
}
