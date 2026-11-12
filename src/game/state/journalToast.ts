// "Added to your journal (J)": the toast for a journal page or clue that has just been filed.
// The key is the player's current Journal binding, not a hard-coded letter.

import { keyLabel } from '../systems/interaction'
import { useSettingsStore } from './settingsStore'
import { useToastStore } from './toastStore'

export function journalAddedText(journalKeyCode: string | undefined): string {
  return `Added to your journal (${keyLabel(journalKeyCode ?? 'KeyJ')})`
}

export function pushJournalAddedToast(): void {
  useToastStore.getState().push(journalAddedText(useSettingsStore.getState().bindings.Journal))
}
