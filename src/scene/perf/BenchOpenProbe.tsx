// Dev-only probe: logs the longest frame in the 2 s after the workbench opens, so the
// first-open freeze can be checked from the browser console. Mounted only when import.meta.env.DEV.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { longestFrame } from '../../game/systems/lightRamp'

const WINDOW_MS = 2000

export function BenchOpenProbe({ open }: { open: boolean }) {
  const wasOpen = useRef(false)
  const startedAt = useRef<number | null>(null)
  const last = useRef(0)
  const frames = useRef<number[]>([])

  useFrame(() => {
    const now = performance.now()
    if (open && !wasOpen.current) {
      startedAt.current = now
      frames.current = []
    }
    wasOpen.current = open
    const dt = last.current ? now - last.current : 0
    last.current = now
    if (startedAt.current === null) return
    frames.current.push(dt)
    if (now - startedAt.current >= WINDOW_MS) {
      console.info(
        `[perf] longest frame in 2 s after workbench open: ${longestFrame(frames.current).toFixed(1)} ms`,
      )
      startedAt.current = null
    }
  })
  return null
}
