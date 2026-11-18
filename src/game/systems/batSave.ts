// What the world save keeps of the bats (spec 11 H4). Pure TypeScript.
import { BAT } from '../../data/bats'
import type { Bat } from './bats'

export interface BatSave {
  /** Night number the current bats were seeded for, or null when none are out. */
  seededNight: number | null
  bats: Bat[]
  /** Bat sim clock (s) and the time of the last chitter, so the 20 s gap survives a reload. */
  simTime: number
  lastChitter: number | null
}

export function freshBatSave(): BatSave {
  return { seededNight: null, bats: [], simTime: 0, lastChitter: null }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function sanitizeBat(v: unknown, boxCount: number): Bat | null {
  if (typeof v !== 'object' || v === null) return null
  const b = v as Record<string, unknown>
  if (!isNum(b.boxIndex) || !Number.isInteger(b.boxIndex) || b.boxIndex < 0 || b.boxIndex >= boxCount) return null
  if (b.phase !== 'perched' && b.phase !== 'fleeing' && b.phase !== 'gone') return null
  const t = isNum(b.t) && b.t >= 0 ? b.t : 0
  const restYaw = isNum(b.restYaw) ? b.restYaw : 0
  const yaw = isNum(b.yaw) ? b.yaw : restYaw
  const previousBox =
    isNum(b.previousBox) && Number.isInteger(b.previousBox) && b.previousBox >= 0 && b.previousBox < boxCount
      ? b.previousBox
      : null
  // A bat mid-flight has no saved path: it is simply gone, and comes back on the usual timer.
  if (b.phase === 'fleeing') return { phase: 'gone', boxIndex: b.boxIndex, previousBox, t: 0, restYaw, yaw: restYaw }
  return { phase: b.phase, boxIndex: b.boxIndex, previousBox, t, restYaw, yaw }
}

/** Bad blocks load as no bats; bad entries are dropped one by one; duplicates on a box are dropped. */
export function sanitizeBatSave(raw: unknown, boxCount: number): BatSave {
  if (typeof raw !== 'object' || raw === null) return freshBatSave()
  const r = raw as Record<string, unknown>
  const list = Array.isArray(r.bats) ? r.bats : []
  const bats: Bat[] = []
  const used = new Set<number>()
  for (const item of list) {
    if (bats.length >= BAT.perchedMax) break
    const b = sanitizeBat(item, boxCount)
    if (!b || used.has(b.boxIndex)) continue
    used.add(b.boxIndex)
    bats.push(b)
  }
  const simTime = isNum(r.simTime) && r.simTime >= 0 ? r.simTime : 0
  return {
    seededNight: isNum(r.seededNight) ? r.seededNight : null,
    bats,
    simTime,
    lastChitter: isNum(r.lastChitter) && r.lastChitter <= simTime ? r.lastChitter : null,
  }
}
