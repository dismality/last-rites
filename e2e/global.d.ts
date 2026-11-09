// Types the dev-only hook for specs; the real definition lives in src/debug/debugHook.ts.
import type { LastRitesHook } from '../src/debug/debugHook'

declare global {
  interface Window {
    __lastRites?: LastRitesHook
  }
}

export {}
