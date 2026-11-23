// The single switch for developer mode. Pure, so tests can pass any URL and build mode.

/**
 * Dev mode is on in a Vite DEV build, when the page URL has `?dev=1`, or when the player turned on
 * Developer mode in Settings. `search` is `location.search`; `envDev` is `import.meta.env.DEV`.
 */
export function isDevEnabled(search: string, envDev: boolean, setting = false): boolean {
  if (envDev || setting) return true
  return new URLSearchParams(search).get('dev') === '1'
}
