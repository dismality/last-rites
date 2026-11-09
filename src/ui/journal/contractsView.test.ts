import { describe, expect, it } from 'vitest'
import { contractEntries } from './contractsView'

describe('contractEntries', () => {
  it('renders two entries for two contracts', () => {
    const e = contractEntries([
      { id: 'c-dig-3', progress: 1, done: false },
      { id: 'c-gather-8', progress: 0, done: false },
    ])
    expect(e).toHaveLength(2)
    expect(e[0].progressLabel).toBe('1/3')
    expect(e[0].rewardLabel).toBe('◎ 15')
    expect(e[0].text).toBe('Dig 3 graves')
  })

  it('renders one entry for one contract', () => {
    expect(contractEntries([{ id: 'c-dig-3', progress: 0, done: false }])).toHaveLength(1)
  })

  it('skips empty slots', () => {
    expect(contractEntries([null, undefined])).toHaveLength(0)
  })

  it('shows the Done tag on a done contract only', () => {
    const [done] = contractEntries([{ id: 'c-dig-3', progress: 3, done: true }])
    const [open] = contractEntries([{ id: 'c-dig-3', progress: 2, done: false }])
    expect(done.doneTag).toBe('Done ✓')
    expect(open.doneTag).toBeNull()
  })
})
