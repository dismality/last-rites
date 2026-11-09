/// <reference types="vite/client" />
// Install order check (Req 5.6, 14.5). Sources load via Vite's raw glob, so no Node typings are needed.
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>('../src/main.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const source = Object.values(sources)[0] ?? ''
const callIndex = (name: string): number => source.indexOf(`\n${name}()`)

describe('main.tsx install order', () => {
  it('installs progression watchers before the new-day save and run stats', () => {
    const progression = callIndex('installProgressionWatchers')
    expect(progression).toBeGreaterThan(-1)
    expect(callIndex('installNewDaySave')).toBeGreaterThan(progression)
    expect(callIndex('installRunStats')).toBeGreaterThan(progression)
  })

  it('installs the daily respawn watcher after the progression watchers', () => {
    const respawn = callIndex('installSpawnRespawn')
    expect(respawn).toBeGreaterThan(callIndex('installProgressionWatchers'))
  })
})
