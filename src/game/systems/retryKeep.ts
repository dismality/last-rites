// What a Retry never takes back (spec 09 F5): journal pages and the recipes they taught.
// Pure helpers; the stores apply them in state/retryNight.ts.

/** Key item ids of the form `journal-page-N`. */
export const isJournalPage = (id: string): boolean => /^journal-page-[1-5]$/.test(id)

/** Snapshot entries first, then anything from `kept` not already there. No duplicates. */
export function mergeKept<T>(snapshot: readonly T[], kept: readonly T[]): T[] {
  return Array.from(new Set([...snapshot, ...kept]))
}
