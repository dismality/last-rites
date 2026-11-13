// Journal overlay: Pages / Clues / Relics / Map. The Journal key (default J) toggles it;
// Esc closes it. Opening freezes the simulation (gameStore.journalOpen) so nothing
// scares the player while they read, and the pause menu stays out of the way.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CLUES } from '../../data/clues'
import { JOURNAL_PAGES } from '../../data/journal'
import { emit } from '../../game/events'
import { RELICS } from '../../data/relics'
import {
  useGameStore,
  useInventoryStore,
  useMapStore,
  useMysteryStore,
  usePlayerStore,
  useSettingsStore,
} from '../../game/state'
import type { PageNumber } from '../../game/types'
import { NamedItemIcon } from '../satchel/NamedItemIcon'
import { CaseBoard } from './CaseBoard'
import { ContractsTab } from './ContractsTab'
import { JournalMap } from './Map'
import './journal.css'

const TABS = [
  { id: 'pages', label: 'Pages' },
  { id: 'clues', label: 'Clues' },
  { id: 'case', label: 'Case' },
  { id: 'relics', label: 'Relics' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'map', label: 'Map' },
] as const
type TabId = (typeof TABS)[number]['id']

const ZONE_LABEL: Record<string, string> = {
  grounds: 'the Grounds',
  'mausoleum-row': 'Mausoleum Row',
  chapel: 'the Chapel',
  catacombs: 'the Catacombs',
}

function PagesTab() {
  const keyItems = useInventoryStore((s) => s.inventory.keyItems)
  const pages = useMysteryStore((s) => s.mystery.pages)
  const found = (n: PageNumber) => pages.has(n) || keyItems.includes(`journal-page-${n}`)
  const [selected, setSelected] = useState<PageNumber>(() => JOURNAL_PAGES.find((p) => found(p.id))?.id ?? 1)
  const page = JOURNAL_PAGES.find((p) => p.id === selected) ?? JOURNAL_PAGES[0]
  const have = found(page.id)

  return (
    <div className="journal-pages">
      <ul className="journal-pages__list" aria-label="Journal pages">
        {JOURNAL_PAGES.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="journal-pages__item"
              aria-current={p.id === selected ? 'page' : undefined}
              onClick={() => setSelected(p.id)}
            >
              {p.id}. {found(p.id) ? p.title : 'Missing page'}
            </button>
          </li>
        ))}
      </ul>
      <article className="journal-pages__sheet" aria-live="polite">
        {have ? (
          <>
            <h3 className="journal__subtitle">{page.title}</h3>
            <p className="journal__hand">{page.text}</p>
          </>
        ) : (
          <p className="journal__empty">This page has not been found yet.</p>
        )}
      </article>
    </div>
  )
}

function CluesTab() {
  const clues = useMysteryStore((s) => s.mystery.clues)
  const found = CLUES.filter((c) => clues.has(c.id))
  return (
    <div className="journal-clues">
      <p className="journal__count">
        Clues noted: {found.length} of {CLUES.length}
      </p>
      {found.length === 0 ? (
        <p className="journal__empty">Nothing noted yet. Read the stones and look closely.</p>
      ) : (
        <ul className="journal-clues__list">
          {found.map((c, i) => (
            <li key={c.id} className="journal-clues__item">
              {/* Staggered so entries appear to be underlined by hand one after another. */}
              <span className="journal-clues__text" style={{ animationDelay: `${i * 120}ms` }}>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RelicsTab() {
  const owned = useInventoryStore((s) => s.inventory.relics)
  const mysteryRelics = useMysteryStore((s) => s.mystery.relics)
  const has = (id: (typeof RELICS)[number]['id']) => owned.includes(id) || mysteryRelics.has(id)
  const count = RELICS.filter((r) => has(r.id)).length
  return (
    <div className="journal-relics">
      <p className="journal__count">
        Relics gathered: {count} of {RELICS.length}
      </p>
      <ul className="journal-relics__grid">
        {RELICS.map((r) => {
          const found = has(r.id)
          return (
            <li
              key={r.id}
              className={`journal-relic ${found ? 'journal-relic--found' : 'journal-relic--missing'}`}
            >
              {found && <NamedItemIcon id={r.id} />}
              {!found && <svg className="journal-relic__icon" viewBox="0 0 48 48" aria-hidden="true">
                {/* Same outline either way; found relics are inked in. */}
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill={found ? 'currentColor' : 'none'}
                  fillOpacity={found ? 0.25 : 0}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={found ? undefined : '4 4'}
                />
                <path
                  d="M24 12v24M14 22h20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity={found ? 1 : 0.4}
                />
              </svg>}
              <span className="journal-relic__name">{found ? r.name : 'Unknown relic'}</span>
              <span className="journal-relic__state">{found ? 'Found' : 'Not found'}</span>
              <span className="journal-relic__desc">
                {found ? r.description : `Somewhere in ${ZONE_LABEL[r.zone] ?? r.zone}.`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function JournalBody({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabId>('pages')
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    pages: null,
    clues: null,
    case: null,
    relics: null,
    contracts: null,
    map: null,
  })

  useEffect(() => {
    tabRefs.current.pages?.focus()
  }, [])

  const onTabKey = (e: ReactKeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab)
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[TABS[next].id]?.focus()
  }

  return (
    <div className="journal" role="dialog" aria-modal="true" aria-label="Journal">
      <div className="journal__page journal__page--book">
        <h2 className="journal__title">Keeper&apos;s Journal</h2>
        <div className="journal-tabs" role="tablist" aria-label="Journal sections" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el
              }}
              type="button"
              role="tab"
              id={`journal-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="journal-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className="journal-tabs__tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          id="journal-panel"
          role="tabpanel"
          aria-labelledby={`journal-tab-${tab}`}
          className="journal__panel"
        >
          {tab === 'pages' && <PagesTab />}
          {tab === 'clues' && <CluesTab />}
          {tab === 'case' && <CaseBoard />}
          {tab === 'relics' && <RelicsTab />}
          {tab === 'contracts' && <ContractsTab />}
          {tab === 'map' && <JournalMap />}
        </div>
        <button type="button" className="journal__close" onClick={onClose}>
          Close journal (J)
        </button>
      </div>
    </div>
  )
}

export function Journal() {
  const open = useGameStore((s) => s.journalOpen)
  const screen = useGameStore((s) => s.screen)

  useEffect(() => {
    if (screen !== 'game') return
    const onKey = (e: KeyboardEvent) => {
      const gs = useGameStore.getState()
      if (e.code === useSettingsStore.getState().bindings.Journal && !e.repeat) {
        if (gs.paused || gs.examining || gs.mapOpen) return
        e.preventDefault()
        if (gs.journalOpen) gs.setJournalOpen(false)
        else {
          // Ink the cell the player is standing in even if they haven't moved yet.
          useMapStore.getState().reveal(usePlayerStore.getState().position)
          gs.setJournalOpen(true)
          emit({ type: 'journalOpened' })
        }
      } else if (e.code === 'Escape' && gs.journalOpen) {
        // Capture phase so the pause trigger never sees it.
        e.preventDefault()
        e.stopPropagation()
        gs.setJournalOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [screen])

  if (!open || screen !== 'game') return null
  return <JournalBody onClose={() => useGameStore.getState().setJournalOpen(false)} />
}
