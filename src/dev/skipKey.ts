// Developer mode's "skip this step" key (]) and the short result line the chip shows after it.

import { create } from 'zustand'
import { useDevPanelStore } from './devPanelStore'
import { refreshGuidance } from '../game/state/guidanceTick'
import { skipStep } from './skipStep'

export const SKIP_STEP_CODE = 'BracketRight'
const TOAST_MS = 2600

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useSkipToast = create<{ line: string; show: (line: string) => void }>((set) => ({
  line: '',
  show: (line) => {
    set({ line })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ line: '' }), TOAST_MS)
  },
}))

function isTextField(target: unknown): boolean {
  const tag = (target as { tagName?: string } | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Runs one skip and shows its result on the chip. */
export function runSkip(): string {
  const line = skipStep()
  // Show the next objective at once, so a second press acts on it.
  refreshGuidance()
  useSkipToast.getState().show(line)
  return line
}

/** Listens for ] while developer mode is on. Returns the remover. */
export function installSkipKey(target: EventTarget): () => void {
  const onKeyDown = (e: Event) => {
    const key = e as KeyboardEvent
    if (key.code !== SKIP_STEP_CODE || key.repeat || isTextField(key.target)) return
    if (!useDevPanelStore.getState().enabled) return
    key.preventDefault?.()
    runSkip()
  }
  target.addEventListener('keydown', onKeyDown)
  return () => target.removeEventListener('keydown', onKeyDown)
}

