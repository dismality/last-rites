// What the world save keeps of the new creatures (spec 11 H2). Pure TypeScript.
// Crawlers and the bride are saved; hound packs are not (like a fleeing bat, a pack in mid-chase has
// no saved path, so it is simply gone and the next wave brings new ones).
import { CRAWLER } from '../../data/creatures'
import type { CrawlerPhase } from './crawler'

export interface CrawlerSave {
  id: string
  phase: CrawlerPhase
  x: number
  z: number
  grabCooldown: number
  /** Seconds the crawler has been out of the ground (0 while hidden). */
  emergedS: number
  /** True for a crawler a wave placed; false for the night's seeded ambush crawlers. */
  wave: boolean
}

export interface BrideSave {
  alive: boolean
  x: number
  z: number
  returnIn: number
}

export interface CreatureSave {
  /** Night the seeded crawlers belong to, or null when none are out. */
  seededNight: number | null
  crawlers: CrawlerSave[]
  bride: BrideSave
}

export const freshCreatureSave = (): CreatureSave => ({
  seededNight: null,
  crawlers: [],
  bride: { alive: false, x: 0, z: 0, returnIn: 0 },
})

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const MAX_CRAWLERS = CRAWLER.spotsMax * 2
const MAX_RETURN_S = 120

function sanitizeCrawler(v: unknown): CrawlerSave | null {
  if (typeof v !== 'object' || v === null) return null
  const c = v as Record<string, unknown>
  if (typeof c.id !== 'string' || c.id === '' || !isNum(c.x) || !isNum(c.z)) return null
  if (c.phase !== 'hidden' && c.phase !== 'emerged') return null
  return {
    id: c.id,
    phase: c.phase,
    x: c.x,
    z: c.z,
    grabCooldown: isNum(c.grabCooldown) ? Math.min(CRAWLER.grabCooldownS, Math.max(0, c.grabCooldown)) : 0,
    emergedS: isNum(c.emergedS) ? Math.max(0, c.emergedS) : 0,
    wave: c.wave === true,
  }
}

/** Bad blocks load as no creatures; bad crawlers are dropped one by one; ids stay unique. */
export function sanitizeCreatureSave(raw: unknown): CreatureSave {
  if (typeof raw !== 'object' || raw === null) return freshCreatureSave()
  const r = raw as Record<string, unknown>
  const crawlers: CrawlerSave[] = []
  const used = new Set<string>()
  for (const item of Array.isArray(r.crawlers) ? r.crawlers : []) {
    if (crawlers.length >= MAX_CRAWLERS) break
    const c = sanitizeCrawler(item)
    if (!c || used.has(c.id)) continue
    used.add(c.id)
    crawlers.push(c)
  }
  const b = typeof r.bride === 'object' && r.bride !== null ? (r.bride as Record<string, unknown>) : {}
  const alive = b.alive === true && isNum(b.x) && isNum(b.z)
  return {
    seededNight: isNum(r.seededNight) ? r.seededNight : null,
    crawlers,
    bride: {
      alive,
      x: alive ? (b.x as number) : 0,
      z: alive ? (b.z as number) : 0,
      returnIn: isNum(b.returnIn) ? Math.min(MAX_RETURN_S, Math.max(0, b.returnIn)) : 0,
    },
  }
}
