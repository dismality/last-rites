// The clue reveal queue (spec 09 task 11q). Fed from the two places a clue is really found
// (mysteryStore.discoverClue, caseStore.findClue), never from a save restore, so Continue and
// Retry never replay it. The HUD's ClueReveal ticks it on animation frames.
import { create } from 'zustand'
import { CLUE_MAP } from '../../data/clues'
import { CLUE_REVEAL_CAPTION, cluePicture, clueTitle } from '../../data/clueReveal'
import { playPageTurn } from '../../audio/AudioManager'
import { emit } from '../events'
import { emptyReveal, enqueueReveal, tickReveal, type RevealState } from '../systems/clueReveal'

/** Seconds the "[quill scratches]" caption stays up. */
const CAPTION_S = 2

interface ClueRevealStore extends RevealState {
  /** A journal clue (clues.ts) was found. */
  revealClue: (clueId: string) => void
  /** A case clue was found outside a minigame (the minigames say "Pinned to the case board" themselves). */
  revealCaseClue: (key: string, title: string, text: string) => void
  /** A line with no picture, title or journal line (the ledger refusal). */
  revealPlain: (text: string) => void
  /** Advance to `now` (ms, performance.now()); `blocked` while a menu, journal, examine or cutscene is open. */
  tick: (now: number, blocked: boolean) => void
  reset: () => void
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export const useClueRevealStore = create<ClueRevealStore>((set, get) => ({
  ...emptyReveal(),
  revealClue: (clueId) => {
    const def = CLUE_MAP[clueId]
    if (!def) return
    set(enqueueReveal(get(), {
      key: clueId,
      kind: 'clue',
      title: clueTitle(clueId),
      text: def.text,
      image: cluePicture(clueId),
      queuedAt: now(),
    }))
  },
  revealCaseClue: (key, title, text) =>
    set(enqueueReveal(get(), { key, kind: 'clue', title, text, queuedAt: now() })),
  revealPlain: (text) =>
    set(enqueueReveal(get(), { key: `plain:${text}:${Math.floor(now() / 1000)}`, kind: 'plain', text, queuedAt: now() })),
  tick: (t, blocked) => {
    const before = get()
    const next = tickReveal(before, t, blocked)
    if (next === before) return
    set({ queue: next.queue, current: next.current })
    if (next.current && next.current !== before.current && next.current.item.kind === 'clue') {
      playPageTurn()
      emit({ type: 'subtitleShown', text: CLUE_REVEAL_CAPTION, duration: CAPTION_S })
    }
  },
  reset: () => set(emptyReveal()),
}))
