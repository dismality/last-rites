// Journal "Closed cases" tab (spec 10 task 2.5, Req 10.3 and 10.4): every solved case with its
// "what really happened" page. Read-only. The list comes from `caseStore.closed`, which is saved,
// so it survives Continue. Pure display: no actions.
import { CASES } from '../../data/cases'
import { CLOSED_CASE_PAGES } from '../../data/caseText'
import { useCaseStore } from '../../game/state/caseStore'

export function ClosedCases() {
  const closed = useCaseStore((s) => s.closed)
  // Case order, not the order they were closed in, so the pages read as a series.
  const solved = CASES.filter((c) => closed.includes(c.id))

  return (
    <section className="closed-cases" aria-label="Closed cases">
      <p className="journal__count">
        Cases closed: {solved.length} of {CASES.length}
      </p>
      {solved.length === 0 ? (
        <p className="journal__empty">No case is closed yet. Answer one at the altar by night.</p>
      ) : (
        <ul className="closed-cases__list">
          {solved.map((c) => (
            <li key={c.id}>
              <article className="closed-case" aria-labelledby={`closed-${c.id}`}>
                <h3 id={`closed-${c.id}`} className="journal__subtitle">
                  <span aria-hidden="true">✓ </span>
                  {c.title} <span className="closed-case__tag">(closed)</span>
                </h3>
                {/* tabIndex 0 so a keyboard reader can scroll a long page. */}
                <div className="closed-case__page journal__hand" tabIndex={0}>
                  {CLOSED_CASE_PAGES[c.id].map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
