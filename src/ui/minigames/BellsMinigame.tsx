// Minigame 1b, the Bell Posts (spec 10 task 3.5, Req 13). A safety-bell post stands at each of the
// three candidate graves. Here the player turns the view round one post (bell, rope, tag), inspects
// each side, and once all three posts are examined answers "Which bell was cut?". The verdict is the
// pure `bellPosts` rule; a wrong post adds Doubt through the Case_Store and shows a message. A right
// one solves 1b and the case system pins the three clue cards. Keyboard only: arrows turn, Enter
// inspects, Tab changes post, C marks the post as the cut bell. Progress is kept in the Case_Store.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CASE_1_BELLS, CASE_1_STONES, type BellPostDef, type BellPostId } from '../../data/cases'
import { playPageTurn } from '../../audio/AudioManager'
import { useCaseStore } from '../../game/state/caseStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import {
  BELL_FACETS,
  cutQuestionOpen,
  cyclePost,
  facetText,
  facetYaw,
  FACET_LABEL,
  isPostExamined,
  NO_FACETS_READ,
  PINNED_NOTE,
  POST_IDS,
  readFacet,
  turnFacet,
  type BellFacet,
  type FacetsRead,
} from '../../game/systems/bellsMinigame'
import { bellPosts } from '../../game/systems/caseMinigames'
import type { ResultKind } from '../../game/systems/minigameShell'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'saved-by-the-bell'
const FACET_GLYPH: Record<BellFacet, string> = { bell: '🔔', rope: '➰', tag: '🏷' }
const FACET_CAPTION: Partial<Record<BellFacet, string>> = { tag: '[a page turns]' }
const stoneName = (post: BellPostDef) => CASE_1_STONES.find((s) => s.id === post.stone)?.name ?? post.stone

export function BellsMinigame() {
  const examined = useCaseStore((s) => s.cases[CASE_ID].bellsExamined)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('1b'))
  const focus = useOverlayStore((s) => s.bellPostFocus)
  const [postIndex, setPostIndex] = useState(() => Math.max(0, POST_IDS.findIndex((id) => id === focus)))
  const [facetIndex, setFacetIndex] = useState(0)
  const [read, setRead] = useState<FacetsRead>(NO_FACETS_READ)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const view = useRef<HTMLDivElement>(null)

  const post = CASE_1_BELLS[postIndex]
  const facet = BELL_FACETS[facetIndex]
  // A post examined earlier (saved) shows every side read.
  const readOf = (id: BellPostId): readonly BellFacet[] => (examined.includes(id) ? BELL_FACETS : read[id])
  const say = (kind: ResultKind, text: string) => setResult({ kind, text })

  // The shell focuses its close button first, so take focus on the next tick.
  useEffect(() => {
    const t = window.setTimeout(() => view.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [])

  const goPost = (index: number) => {
    setPostIndex(index)
    setFacetIndex(0)
    view.current?.focus()
  }

  const inspect = () => {
    if (readOf(post.id).includes(facet)) return say('info', facetText(post, facet))
    const next = readFacet(read, post.id, facet)
    setRead(next)
    const caption = FACET_CAPTION[facet]
    if (caption) {
      playPageTurn()
      setCaptions((c) => [...c, caption])
    }
    if (isPostExamined(next[post.id])) {
      useCaseStore.getState().examineBell(post.id)
      const done = useCaseStore.getState().cases[CASE_ID].bellsExamined
      say('info', cutQuestionOpen(done) ? 'All three posts examined. Which bell was cut?' : `${facetText(post, facet)} This post is examined.`)
    } else {
      say('info', facetText(post, facet))
    }
  }

  const markCut = () => {
    if (solved) return
    const done = useCaseStore.getState().cases[CASE_ID].bellsExamined
    if (!cutQuestionOpen(done)) return say('info', 'Examine all three bells first.')
    const verdict = bellPosts({ examined: done, cutAnswer: post.id })
    if (verdict.ok) {
      useCaseStore.getState().submitMinigame('1b', true)
      say('right', 'This is the cut bell. The rope, the rusted bell and the tag are pinned to the case board.')
    } else {
      useCaseStore.getState().submitMinigame('1b', false)
      say('wrong', verdict.message ?? 'Not that one.')
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code.startsWith('Arrow')) {
      e.preventDefault()
      setFacetIndex((i) => turnFacet(i, e.code))
    } else if (e.code === 'Tab') {
      // Tab changes post here; Esc and the Close button still leave the overlay.
      e.preventDefault()
      e.stopPropagation()
      goPost(cyclePost(postIndex, e.shiftKey))
    } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault()
      inspect()
    } else if (e.code === 'KeyC') {
      e.preventDefault()
      markCut()
    }
  }

  const questionOpen = cutQuestionOpen(examined)
  const readHere = readOf(post.id)

  return (
    <MinigameShell id="1b" title="The Bell Posts" captions={captions} result={result}>
      <div onKeyDown={onKeyDown}>
        <p className="bells__intro">
          Turn the view round each post, then inspect the bell, the rope and the tag. Arrow keys turn, Enter
          inspects, Tab changes post{questionOpen ? ', C marks the cut bell' : ''}.
        </p>

        <div className="bells__posts" role="group" aria-label="Bell posts">
          {CASE_1_BELLS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="bells__post-tab"
              aria-pressed={i === postIndex}
              tabIndex={-1}
              onClick={() => goPost(i)}
            >
              {i === postIndex ? '◉' : '○'} {stoneName(p)}
              {examined.includes(p.id) ? ' ✦ examined' : ''}
            </button>
          ))}
        </div>

        <div
          ref={view}
          className="bells__view"
          tabIndex={0}
          role="group"
          aria-label={`Post at ${stoneName(post)}: ${FACET_LABEL[facet]}`}
        >
          <div className="bells__stage" aria-hidden="true">
            {/* The post turns a third of a turn per side; with reduced motion it just jumps. */}
            <div className="bells__post" style={{ transform: `rotateY(${facetYaw(facetIndex)}rad)` }}>
              <span className="bells__post-glyph">{FACET_GLYPH[facet]}</span>
            </div>
          </div>
          <p className="bells__facet">
            <strong>
              {FACET_GLYPH[facet]} {FACET_LABEL[facet]}
            </strong>{' '}
            ({facetIndex + 1} of {BELL_FACETS.length})
          </p>
          <p className="bells__text" aria-live="polite">
            {readHere.includes(facet) ? facetText(post, facet) : 'Press Enter to look closely.'}
          </p>
        </div>

        <div className="bells__actions">
          <div role="group" aria-label="Side of the post">
            {BELL_FACETS.map((f, i) => (
              <button
                key={f}
                type="button"
                className="bells__facet-btn"
                aria-pressed={i === facetIndex}
                tabIndex={-1}
                onClick={() => setFacetIndex(i)}
              >
                {readHere.includes(f) ? '✦' : '○'} {FACET_LABEL[f]}
              </button>
            ))}
          </div>
          <button type="button" className="bells__act" tabIndex={-1} onClick={inspect}>
            Inspect (Enter)
          </button>
          <button type="button" className="bells__act" tabIndex={-1} disabled={solved || !questionOpen} onClick={markCut}>
            Which bell was cut? This one (C)
          </button>
        </div>

        {solved && <p className="bells__solved">✦ {PINNED_NOTE}</p>}
      </div>
    </MinigameShell>
  )
}
