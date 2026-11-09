// Queue of short HUD toasts (pickup results etc.). Pure zustand.

import { create } from 'zustand'

/** Default time a toast stays up. Long messages (contracts) pass their own. */
export const TOAST_DURATION_MS = 2000
/** Contract and reward toasts stay at least 3 s (Req 6.6, 12.9). */
export const CONTRACT_TOAST_MS = 3000

export interface ToastMessage {
  id: number
  text: string
  durationMs: number
}

interface ToastState {
  queue: ToastMessage[]
  push: (text: string, durationMs?: number) => void
  /** Drop the toast at the head of the queue once it has been shown. */
  shift: () => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  queue: [],
  push: (text, durationMs = TOAST_DURATION_MS) =>
    set((s) => ({ queue: [...s.queue, { id: nextId++, text, durationMs }] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}))
