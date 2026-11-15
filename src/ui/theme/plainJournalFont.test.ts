import { afterEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '../../game/state/settingsStore'
import { installPlainJournalFont, PLAIN_JOURNAL_ATTRIBUTE } from './plainJournalFont'

describe('installPlainJournalFont', () => {
  afterEach(() => useSettingsStore.getState().setSetting('plainJournalFont', false))

  it('sets the attribute from the saved value and follows changes', () => {
    const attrs = new Map<string, string>()
    const stop = installPlainJournalFont({ setAttribute: (k, v) => void attrs.set(k, v) })
    expect(attrs.get(PLAIN_JOURNAL_ATTRIBUTE)).toBe('false')
    useSettingsStore.getState().setSetting('plainJournalFont', true)
    expect(attrs.get(PLAIN_JOURNAL_ATTRIBUTE)).toBe('true')
    stop()
  })
})
