import { useEffect, useState } from 'react'
import { readTutorialPrompt } from '../../game/state/guidanceTick'
import { STORY_GOAL_LINE } from '../../data/objectiveRules'
import { MODES } from '../../data/modes'
import { useGameStore } from '../../game/state/gameStore'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useStageStore } from '../../game/state/stageStore'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { composeSecondLine, journalKeyWord } from '../../game/systems/objective'
import { hintKeyLabel } from '../../game/systems/controlHints'
import { CurseMeter } from './CurseMeter'
import { PinnedRecipe } from './PinnedRecipe'
import { InfoDot } from '../theme/InfoDot'
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
  const near = useGuidanceStore((s) => s.hintNear)
  // The story's one goal sits above every step (playtest story pass): each case is one trail.
  const story = useProgressionStore((s) => MODES[s.mode].story)
  const stage = useStageStore((s) => s.stage)

  useEffect(() => {
    const read = () => setPrompt(readTutorialPrompt())
    read()
    const id = window.setInterval(read, SECOND_LINE_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [tutorialDone, promptsOn, bindings, near])

  if (screen !== 'game' || objective === null) return null

  const second = composeSecondLine(objective, prompt)
  const journalWord = journalKeyWord(objective)

  return (
    <div className="hud-objective">
      {story && <p className="hud-objective__goal">{STORY_GOAL_LINE.replace('{n}', String(stage))}</p>}
      <div className="hud-objective__live" role="status" aria-live="polite" aria-atomic="true">
        {/* Keyed so a new objective remounts the span and replays the fade-in. */}
        <span key={`${objective.rule}:${objective.main}`} className="hud-objective__main">
          {objective.main}
        </span>
      </div>
      {objective.why && <p className="hud-objective__why">{objective.why}</p>}
      {journalWord && (
        <p className="hud-objective__key">
          <kbd className="hud-objective__kbd">{hintKeyLabel(bindings.Journal)}</kbd> {journalWord}
        </p>
      )}
      {second !== '' && <p className="hud-objective__second">{second}</p>}
      {objective.curse && (
        <div className="info-row">
          <CurseMeter value={objective.curse.value} max={objective.curse.max} />
          <InfoDot tipKey="hud-curse" label="About the Curse meter" />
        </div>
      )}
      <PinnedRecipe />
    </div>
  )
}
