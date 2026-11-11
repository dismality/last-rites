// Vitest setup: force audio on so audio tests keep checking real behaviour while the app ships muted.
// The mute test (audioMuted.test.ts) switches it off explicitly.
import { setAudioEnabledForTests } from './audioEnabled'

setAudioEnabledForTests(true)
