import { Component, type ReactNode } from 'react'
import './crashScreen.css'
import { CRASH_LINES, CRASH_TITLE } from './crashScreenText'

// What a player sees when the game cannot run (playtest, 2026-11-28): before this, a crash or a
// browser without WebGL left a blank page. The keeper's voice, a little mischief, and one clear
// thing to do next.

/** The crash card: a line in the keeper's voice, what happened, and a Reload button. */
export function CrashCard({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <div className="crash" role="alertdialog" aria-labelledby="crash-title">
      <div className="crash__card">
        <h1 id="crash-title" className="crash__title">
          {title}
        </h1>
        {lines.map((l) => (
          <p key={l} className="crash__line">
            {l}
          </p>
        ))}
        <button type="button" className="crash__button" onClick={() => location.reload()} autoFocus>
          Light the lantern again (reload)
        </button>
      </div>
    </div>
  )
}

/** Catches a render crash anywhere below it and shows the crash card instead of a blank page. */
export class CrashBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[last-rites] crash', error)
  }

  render() {
    return this.state.crashed ? <CrashCard title={CRASH_TITLE} lines={CRASH_LINES} /> : this.props.children
  }
}
