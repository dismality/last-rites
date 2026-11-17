// The runtime Waiting_List (spec 11, Req 8.16): art paths whose load failed this session.
// Rules are in systems/waitingList.ts. It belongs to the session, not the run, so New Game keeps
// it (the files are still missing).
import { create } from 'zustand'
import { emptyWaiting, list, register, type WaitingState } from '../systems/waitingList'

interface WaitingListStore {
  waiting: WaitingState
  register: (path: string) => void
}

export const useWaitingList = create<WaitingListStore>((set) => ({
  waiting: emptyWaiting(),
  register: (path) => set((s) => {
    const next = register(s.waiting, path)
    return next === s.waiting ? s : { waiting: next }
  }),
}))

/** Registers a missing art path once (safe to call from loaders and effects). */
export const registerMissingArt = (path: string): void => useWaitingList.getState().register(path)

/** The missing paths seen so far, sorted. */
export const waitingPaths = (): readonly string[] => list(useWaitingList.getState().waiting)
