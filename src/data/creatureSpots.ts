// Where Pale Crawlers lie hidden (spec 11 H2): the grounds' grave mounds and broken coffins.
// Derived from the material spawn points so a mound or coffin that exists in the world is the
// only kind of place a crawler can hide.
import { SPAWN_POINTS } from './zones'

export interface CrawlerSpotDef {
  id: string
  x: number
  z: number
}

export const CRAWLER_SPOT_DEFS: readonly CrawlerSpotDef[] = SPAWN_POINTS.filter(
  (p) => p.zone === 'grounds' && (p.lootTable === 'grave-dig' || p.lootTable === 'broken-coffin'),
).map((p) => ({ id: p.id, x: p.position[0], z: p.position[2] }))

/** Never closer than this to the player's start (the hut), so the first minutes stay calm (m). */
export const CRAWLER_MIN_HUT_DIST_M = 6
