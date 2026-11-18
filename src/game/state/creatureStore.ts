// The new creatures (spec 11 H2): Pale Crawlers, the Hollow Bride and Corpse Hound packs.
// Rules: systems/crawler.ts, bride.ts, hounds.ts; the step is creatureStep.ts.
// The crawlers, the bride and the seen set are saved (gameSave.ts, progressionPersistence.ts);
// New Game replaces the whole store (resetRun.ts); a night's end or a Retry clears all but `seen`.
import { create } from 'zustand'
import { createBride, type BrideState } from '../systems/bride'
import { createCrawler, type CrawlerState } from '../systems/crawler'
import type { CreatureSave } from '../systems/creatureSave'
import type { PackState } from '../systems/hounds'
import { normalizeSeen, type SeenCreatures } from '../systems/bestiary'

export interface CrawlerEntry {
  id: string
  c: CrawlerState
  /** Seconds out of the ground; the crawler sinks back after CREATURE_LIFETIME_S.crawlerEmerged. */
  emergedS: number
  /** Placed by a wave rather than seeded at night start. */
  wave: boolean
  /** Player HP when this crawler's warning began, for the 1 HP floor (hurtGuard). Not saved. */
  hpAtEvent: number
}

export interface PackEntry {
  id: string
  pack: PackState
  /** Player HP when the current growl began, for the 1 HP floor. */
  hpAtEvent: number
}

interface CreatureStore {
  seededNight: number | null
  crawlers: CrawlerEntry[]
  bride: BrideState
  /** Light multiplier from the bride (1 = none, 0.7 near her) and how far the flame bends (0..1). */
  brideDim: number
  brideBend: number
  /** True while she is drawn: in the lantern cone or within 3 m. */
  brideVisible: boolean
  packs: PackEntry[]
  /** Damaged creatures' remaining HP by crawler id or 'bride' (full HP when absent). Not saved. */
  hp: Record<string, number>
  /** Counts lead hits that did nothing to the bride (the no-effect cue). Not saved. */
  noEffectCount: number
  seen: SeenCreatures
  /** Creature sim clock (s) and the lantern fuel of the previous step (to catch the oil running out). */
  simTime: number
  prevFuel: number | null
  /** Restores a sanitised save block. */
  restore: (save: CreatureSave) => void
  /** Removes everything that belongs to one night. The seen set stays. */
  clearNight: () => void
}

const base = {
  seededNight: null,
  crawlers: [] as CrawlerEntry[],
  bride: createBride(),
  brideDim: 1,
  brideBend: 0,
  brideVisible: false,
  packs: [] as PackEntry[],
  hp: {} as Record<string, number>,
  noEffectCount: 0,
  simTime: 0,
  prevFuel: null as number | null,
}

export const useCreatureStore = create<CreatureStore>((set) => ({
  ...base,
  seen: [],
  restore: (save) =>
    set({
      ...base,
      seededNight: save.seededNight,
      crawlers: save.crawlers.map((c) => ({
        id: c.id,
        c: { ...createCrawler(c), phase: c.phase, grabCooldown: c.grabCooldown },
        emergedS: c.emergedS,
        wave: c.wave,
        // A loaded crawler has no recorded start: treat the player as healthy, so the 1 HP floor holds.
        hpAtEvent: 1e9,
      })),
      bride: { alive: save.bride.alive, x: save.bride.x, z: save.bride.z, returnIn: save.bride.returnIn, tellLeft: null },
    }),
  clearNight: () => set({ ...base, crawlers: [], packs: [], bride: createBride() }),
}))

export function captureCreatureSave(): CreatureSave {
  const s = useCreatureStore.getState()
  return {
    seededNight: s.seededNight,
    crawlers: s.crawlers.map((e) => ({
      id: e.id,
      phase: e.c.phase,
      x: e.c.x,
      z: e.c.z,
      grabCooldown: e.c.grabCooldown,
      emergedS: e.emergedS,
      wave: e.wave,
    })),
    bride: { alive: s.bride.alive, x: s.bride.x, z: s.bride.z, returnIn: s.bride.returnIn },
  }
}

/** The seen set as saved with the progression block. */
export const captureCreaturesSeen = (): string[] => [...useCreatureStore.getState().seen]

/** Puts a saved seen set back (unknown ids are dropped). */
export const restoreCreaturesSeen = (raw: unknown): void =>
  useCreatureStore.setState({ seen: normalizeSeen(raw) })

/** Alive creatures that count against the wave's alive cap: emerged crawlers and every hound. */
export function creatureLiveCount(): number {
  const s = useCreatureStore.getState()
  return (
    s.crawlers.filter((e) => e.c.phase === 'emerged').length +
    s.packs.reduce((n, p) => n + p.pack.hounds.length, 0)
  )
}
