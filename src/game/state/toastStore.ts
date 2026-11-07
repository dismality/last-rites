// Queue of short HUD toasts (pickup results etc.). Pure zustand.

import { create } from 'zustand'

export interface ToastMessage {
  id: number
  text: string
}

interface ToastState {
  queue: ToastMessage[]
  push: (text: string) => void
  /** Drop the toast at the head of the queue once it has been shown. */
  shift: () => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  queue: [],
  push: (text) => set((s) => ({ queue: [...s.queue, { id: nextId++, text }] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}))
