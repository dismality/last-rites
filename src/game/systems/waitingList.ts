// Waiting_List: the art files the game has found missing this session (spec 11, Req 8.16).
// Pure TypeScript, no React / three.js / Howler. `register` is idempotent and `list` is sorted
// and unique, so the same path reported by several loaders shows once.

export interface WaitingState {
  readonly paths: readonly string[]
}

export const emptyWaiting = (): WaitingState => ({ paths: [] })

/** Adds a path once. A second call with the same path returns the same state object. */
export function register(s: WaitingState, path: string): WaitingState {
  const p = path.trim()
  if (p === '' || s.paths.includes(p)) return s
  return { paths: [...s.paths, p].sort() }
}

/** Every registered path, sorted and unique. */
export function list(s: WaitingState): readonly string[] {
  return [...new Set(s.paths)].sort()
}

/**
 * The build-time half: the declared art files that are not on disk. `present` holds paths as
 * found under public/ (with a leading slash, e.g. "/assets/scares/face-zombie-1.webp").
 */
export function missingFiles(declared: readonly string[], present: ReadonlySet<string>): string[] {
  return [...new Set(declared.filter((p) => !present.has(p)))].sort()
}
