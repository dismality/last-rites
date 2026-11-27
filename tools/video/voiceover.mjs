#!/usr/bin/env node
// Voice-over for the trailer (tools/video/trailer.mjs), in the intro's narrator voice.
//   node tools/video/voiceover.mjs            make any line not made yet (needs ELEVENLABS_API_KEY)
//   node tools/video/voiceover.mjs --dry-run  list the lines and the character count; nothing sent
// Files go to tools/video/raw/<name>.mp3 (not committed). The key is only read from the environment.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VOICES } from '../audio/prompts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const VO_DIR = join(HERE, 'raw')

/**
 * The trailer's narration (tools/video/trailer.mjs). vo-5 and vo-9 were made for the first demo
 * cut and are reused as they are; the trailer-* lines are new. Lines already in raw/ are skipped.
 */
export const LINES = [
  { name: 'trailer-1', text: 'By day, follow his notes. Read the stones, check the ledger, find the bell that was cut. Three cases, and every one leads to the same family.' },
  { name: 'vo-5', text: "At dusk the bell tolls. The lantern's flame is your oil, and the dead come in waves until you name the truth at the altar." },
  { name: 'trailer-2', text: 'Find the five relics. Lay the last rite, and let the sun rise on Hollowmere.' },
  { name: 'vo-9', text: 'Last Rites. Play it in your browser tonight.' },
  { name: 'trailer-hook', text: 'Can you lift the curse?' },
]

async function main() {
  const dry = process.argv.includes('--dry-run')
  const todo = LINES.filter((l) => !existsSync(join(VO_DIR, `${l.name}.mp3`)))
  const chars = todo.reduce((n, l) => n + l.text.length, 0)
  if (dry) {
    LINES.forEach((l) => console.log(`${todo.includes(l) ? '[ ]' : '[x]'} ${l.name}  ${l.text}`))
    console.log(`${todo.length} lines to make, ${chars} characters. Nothing sent.`)
    return
  }
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set.')
  const v = VOICES.narrator
  const id = process.env[v.env] || v.fallbackId
  mkdirSync(VO_DIR, { recursive: true })
  for (const { name, text } of LINES) {
    const out = join(VO_DIR, `${name}.mp3`)
    if (existsSync(out)) {
      console.log(`${name} already made`)
      continue
    }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: v.settings ?? { stability: 0.55, similarity_boost: 0.75, style: 0.25, speed: 0.9 },
      }),
    })
    if (!res.ok) throw new Error(`${name}: ElevenLabs said ${res.status}: ${(await res.text()).slice(0, 200)}`)
    writeFileSync(out, Buffer.from(await res.arrayBuffer()))
    console.log(`${name} ok`)
  }
}

// Only when run directly: trailer.mjs imports LINES, and that must never send anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
