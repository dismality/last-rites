// Minigame 1b, the Bell Posts (spec 10 task 3.5, Req 13). A safety-bell post stands at each of the
// three candidate graves. The player looks at each post's bell, rope and tag, and once all three
// posts are examined answers "Which bell was cut?". The verdict is the pure `bellPosts` rule; a
// wrong post adds Doubt through the Case_Store and shows a message. A right one solves 1b and the
// case system pins the three clue cards. Each post opens only its own bell: the player walks to all
// three. Keyboard: arrows pick the part, Enter inspects, C names this post as the cut bell. Mouse:
// click a part of the drawing or a notebook row. Progress is kept in the Case_Store.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CASE_1_BELLS, CASE_1_STONES, type BellPostDef, type BellPostId } from '../../data/cases'
import { playPageTurn } from '../../audio/AudioManager'
import { useCaseStore } from '../../game/state/caseStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import {
  BELL_FACETS,
  cutQuestionOpen,
  facetText,
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
/** Short names for the notebook rows; the buttons keep the full verbs. */
const FACET_NOUN: Record<BellFacet, string> = { bell: 'The bell', rope: 'The rope', tag: 'The tag' }
const stoneName = (post: BellPostDef) => CASE_1_STONES.find((s) => s.id === post.stone)?.name ?? post.stone
const surname = (post: BellPostDef) => stoneName(post).split(' ').pop() ?? stoneName(post)

/**
 * The post drawn in ink: a grave mound and headstone, a wooden post with a cross-arm, the bell, its
 * rope running down into the grave, and a paper tag tied to the post. A part shows what is wrong with
 * it (a cut rope, a rusted bell) only once the player has looked at it.
 */
function PostDrawing({
  post,
  current,
  read,
  onPick,
}: {
  post: BellPostDef
  current: BellFacet
  read: readonly BellFacet[]
  onPick: (f: BellFacet) => void
}) {
  const rusted = post.condition === 'rusted-solid' && read.includes('bell')
  const cut = post.condition === 'rope-cut' && read.includes('rope')
  // A post whose tag text says nothing is tied there shows only the loose string once read.
  const bareTag = read.includes('tag') && /^No certificate/.test(post.tag)
  const part = (f: BellFacet) =>
    `bells__part bells__part--${f}${current === f ? ' is-current' : ''}${read.includes(f) ? ' is-read' : ''}`
  return (
    <svg className="bells__drawing" viewBox="0 0 240 250" aria-hidden="true">
      {/* Ground and mound */}
      <path className="bells__ground" d="M0 214 Q120 204 240 214 L240 250 L0 250 Z" />
      <path className="bells__mound" d="M70 214 Q130 180 200 214 Z" />
      {/* Headstone with the name */}
      <path className="bells__stone" d="M150 214 L150 112 Q175 86 200 112 L200 214 Z" />
      <text className="bells__stone-name" x="175" y="140" textAnchor="middle">
        {surname(post).toUpperCase()}
      </text>
      <text className="bells__stone-rip" x="175" y="160" textAnchor="middle">
        R.I.P.
      </text>
      {/* Post and cross-arm */}
      <rect className="bells__wood" x="40" y="46" width="10" height="170" />
      <rect className="bells__wood" x="40" y="46" width="78" height="9" />

      {/* The rope: from the bell down into the grave. Cut, it ends in a clean slant with a gap. */}
      <g className={part('rope')} onClick={() => onPick('rope')}>
        <rect className="bells__hit" x="92" y="104" width="34" height="112" />
        {cut ? (
          <>
            <path className="bells__rope" d="M109 108 L109 150 L113 156" />
            <path className="bells__rope" d="M109 176 L113 170 M109 176 L109 205" />
            <path className="bells__cut-mark" d="M103 152 L119 160 M103 174 L119 166" />
          </>
        ) : (
          <path className="bells__rope" d="M109 108 Q112 160 109 205" />
        )}
      </g>

      {/* The bell hanging from the cross-arm. Rusted, it is dark and pitted with no clapper swing. */}
      <g className={part('bell')} onClick={() => onPick('bell')}>
        <rect className="bells__hit" x="88" y="52" width="42" height="58" />
        <line className="bells__wood-line" x1="109" y1="55" x2="109" y2="64" />
        <path
          className={`bells__bell${rusted ? ' bells__bell--rust' : ''}`}
          d="M96 100 Q96 70 109 64 Q122 70 122 100 L126 104 L92 104 Z"
        />
        {rusted && (
          <g className="bells__rust-pits">
            <circle cx="102" cy="88" r="2" />
            <circle cx="114" cy="80" r="1.6" />
            <circle cx="117" cy="95" r="2.2" />
            <circle cx="105" cy="98" r="1.4" />
          </g>
        )}
        <circle className="bells__clapper" cx="109" cy="107" r="3.5" />
      </g>

      {/* The tag tied to the post */}
      <g className={part('tag')} onClick={() => onPick('tag')}>
        <rect className="bells__hit" x="8" y="98" width="46" height="56" />
        {bareTag ? (
          <path className="bells__string" d="M45 104 Q36 116 34 132" />
        ) : (
          <>
            <path className="bells__string" d="M45 104 L30 116" />
            <path className="bells__tag" d="M14 116 L40 112 L44 142 L18 146 Z" />
            <path className="bells__tag-lines" d="M20 124 L38 121 M21 131 L39 128 M22 138 L34 136" />
          </>
        )}
      </g>
    </svg>
  )
}

export function BellsMinigame() {
  const examined = useCaseStore((s) => s.cases[CASE_ID].bellsExamined)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('1b'))
  const focus = useOverlayStore((s) => s.bellPostFocus)
  // Only the post the player used in the world: the others are examined at their own graves.
  const postIndex = Math.max(0, POST_IDS.findIndex((id) => id === focus))
  const [facetIndex, setFacetIndex] = useState(0)
  const [read, setRead] = useState<FacetsRead>(NO_FACETS_READ)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
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

  /** Look closely at one part of the current post. What it shows goes into the notebook. */
  const inspectFacet = (f: BellFacet) => {
    if (readOf(post.id).includes(f)) return
    const next = readFacet(read, post.id, f)
    setRead(next)
    if (f === 'tag') playPageTurn()
    // The verdict line under the drawing counts the posts done, so no extra message here.
    if (isPostExamined(next[post.id])) useCaseStore.getState().examineBell(post.id)
  }

  const pick = (f: BellFacet) => {
    setFacetIndex(BELL_FACETS.indexOf(f))
    inspectFacet(f)
    view.current?.focus()
  }

  const markCut = () => {
    if (solved) return
    const done = useCaseStore.getState().cases[CASE_ID].bellsExamined
    if (!cutQuestionOpen(done)) return say('info', 'Examine all three posts first.')
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
    } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault()
      inspectFacet(facet)
    } else if (e.code === 'KeyC') {
      e.preventDefault()
      markCut()
    }
  }

  const questionOpen = cutQuestionOpen(examined)
  const readHere = readOf(post.id)
  const left = CASE_1_BELLS.filter((p) => !examined.includes(p.id)).map(stoneName)

  return (
    <MinigameShell id="1b" title="The Bell Posts" result={result}>
      <div onKeyDown={onKeyDown}>
        <p className="bells__intro">
          A safety bell let someone buried by mistake ring for help from below. One of these three was
          silenced on purpose. Look at the bell, the rope and the tag on this post, then visit the other
          two graves.
        </p>

        <ul className="bells__posts" aria-label="Bell posts examined">
          {CASE_1_BELLS.map((p, i) => {
            const done = examined.includes(p.id)
            return (
              <li key={p.id} className="bells__post-tab" aria-current={i === postIndex ? 'location' : undefined}>
                <span className="bells__post-name">
                  {stoneName(p)}
                  {i === postIndex ? ' (here)' : ''}
                </span>
                <span className="bells__post-count">
                  {done ? '✓ examined' : i === postIndex ? `${readHere.length} of ${BELL_FACETS.length} looked at` : 'not yet visited'}
                </span>
              </li>
            )
          })}
        </ul>

        <div
          ref={view}
          className="bells__view"
          tabIndex={0}
          role="group"
          aria-label={`Post at ${stoneName(post)}: ${FACET_LABEL[facet]}`}
        >
          <div className="bells__figure">
            <PostDrawing post={post} current={facet} read={readHere} onPick={pick} />
            <p className="bells__figure-label">{stoneName(post)}&rsquo;s grave</p>
          </div>

          <div className="bells__notebook">
            <p className="bells__notebook-head">Notes</p>
            <ul className="bells__notes" aria-live="polite">
              {BELL_FACETS.map((f, i) => {
                const seen = readHere.includes(f)
                return (
                  <li key={f}>
                    <button
                      type="button"
                      className={`bells__facet-btn${seen ? ' is-read' : ''}`}
                      aria-pressed={i === facetIndex}
                      tabIndex={-1}
                      onClick={() => pick(f)}
                    >
                      <span className="bells__facet-label">
                        <span aria-hidden="true">{seen ? '✓' : '·'}</span> {FACET_NOUN[f]}
                        <span className="minigame-shell__sr"> ({FACET_LABEL[f]})</span>
                      </span>
                      <span className="bells__facet-note">{seen ? facetText(post, f) : `${FACET_LABEL[f]}: click, or Enter.`}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="bells__act bells__act--quiet" tabIndex={-1} onClick={() => inspectFacet(facet)}>
              Inspect {FACET_NOUN[facet].toLowerCase()} (Enter)
            </button>
          </div>
        </div>

        <div className="bells__verdict">
          <p className={`bells__verdict-text${solved ? ' bells__solved' : ''}`}>
            {solved
              ? `✓ ${PINNED_NOTE}`
              : questionOpen
                ? `All three posts are examined. If this is the cut bell, name it; if not, go to the one that is.`
                : isPostExamined(readHere)
                  ? `Done here (${examined.length} of ${POST_IDS.length}). Still to examine: ${left.join(' and ')}.`
                  : `Examine all three posts to name the cut bell (${examined.length} of ${POST_IDS.length} done).`}
          </p>
          <button
            type="button"
            className="bells__act bells__act--main"
            tabIndex={-1}
            disabled={solved || !questionOpen}
            onClick={markCut}
          >
            This one was cut: {surname(post)} (C)
          </button>
        </div>

        <p className="bells__keys">Arrows pick a part · Enter inspects · C names this bell as the cut one</p>
      </div>
    </MinigameShell>
  )
}
