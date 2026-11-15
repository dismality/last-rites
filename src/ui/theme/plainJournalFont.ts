// Mirrors the "Plain font for journal" setting onto <html> so tokens.css can swap --font-journal.
import { useSettingsStore } from '../../game/state/settingsStore'

export const PLAIN_JOURNAL_ATTRIBUTE = 'data-plain-journal-font'

export function applyPlainJournalFont(
  plain: boolean,
  root: Pick<HTMLElement, 'setAttribute'> = document.documentElement,
): void {
  root.setAttribute(PLAIN_JOURNAL_ATTRIBUTE, String(plain))
}

/** Applies the saved value now and follows later changes; returns the unsubscribe. */
export function installPlainJournalFont(root: Pick<HTMLElement, 'setAttribute'> = document.documentElement): () => void {
  applyPlainJournalFont(useSettingsStore.getState().plainJournalFont, root)
  return useSettingsStore.subscribe((s, prev) => {
    if (s.plainJournalFont !== prev.plainJournalFont) applyPlainJournalFont(s.plainJournalFont, root)
  })
}
