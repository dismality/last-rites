// Journal "Creatures" page (spec 11 H2, Req 2.18): one card per creature the keeper has seen, with
// a sketch, a field note and a "What works" line. Unseen creatures are not listed at all, so no
// name or picture leaks (the rules are in game/systems/bestiary.ts).
import { useState } from 'react'
import { bestiarySketchUrl } from '../../data/assets'
import type { BestiaryEntry } from '../../data/bestiary'
import { useCreatureStore } from '../../game/state/creatureStore'
import { registerMissingArt } from '../../game/state/waitingList'
import { visibleEntries } from '../../game/systems/bestiary'
import { InfoDot } from '../theme/InfoDot'

/** The sketch, or a plain text card when the drawing is missing or fails to load. */
export function Sketch({ id, name }: { id: BestiaryEntry['id']; name: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    // PLACEHOLDER: /assets/bestiary/crawler.webp (also bride.webp and hound.webp): a text card, no drawing
    return (
      <div className="bestiary__sketch bestiary__sketch--none" role="img" aria-label={`${name}: sketch not drawn yet`}>
        Sketch not drawn yet
      </div>
    )
  }
  return (
    <img
      className="bestiary__sketch"
      src={bestiarySketchUrl(id)}
      alt={`Sketch of the ${name}`}
      draggable={false}
      onError={() => {
        registerMissingArt(bestiarySketchUrl(id))
        setFailed(true)
      }}
    />
  )
}

export function Bestiary() {
  const seen = useCreatureStore((s) => s.seen)
  const entries = visibleEntries(seen)
  return (
    <div className="bestiary">
      <p className="journal__count">
        Creatures seen: {entries.length} of 3 <InfoDot tipKey="hud-bestiary" label="About the Bestiary" />
      </p>
      {entries.length === 0 ? (
        <p className="journal__empty">Nothing sketched yet. What you see in the dark is written down here.</p>
      ) : (
        <ul className="bestiary__list">
          {entries.map((e) => (
            <li key={e.id} className="bestiary__card">
              <Sketch id={e.id} name={e.name} />
              <div className="bestiary__words">
                <h3 className="journal__subtitle">{e.name}</h3>
                <p className="bestiary__note">{e.fieldNote}</p>
                <p className="bestiary__works">
                  <strong>What works:</strong> {e.whatWorks}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
