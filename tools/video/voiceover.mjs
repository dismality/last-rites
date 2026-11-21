#!/usr/bin/env node
// Voice-over for the demo video (docs/submission-kit.md), in the intro's narrator voice.
//   node tools/video/voiceover.mjs            make any line not made yet (needs ELEVENLABS_API_KEY)
//   node tools/video/voiceover.mjs --dry-run  list the lines and the character count; nothing sent
// Files go to tools/video/raw/vo-<n>.mp3 (not committed). The key is only read from the environment.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VOICES } from '../audio/prompts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const VO_DIR = join(HERE, 'raw')

export const LINES = [
  "You are the new gravekeeper of Hollowmere. The last one vanished, and the dead won't stay buried.",
  'By day the graveyard is empty and quiet. Your lantern, the objective and the map show you where to look. The interface is part of the world.',
  'Every clue comes from a puzzle you solve with your own eyes. Pin them on the case board, tie them with red string, and every true link weakens the curse.',
  'At the workbench, whatever you can make glows. Bones, nails and grave salt become weapons.',
  "At dusk the bell tolls. The lantern's flame is your oil, and the dead come in waves until you name the truth at the altar.",
  'The map inks itself in as you explore, and a pin you place stands in the world.',
  'Every scare is warned by a flicker, a creak or a silence, and you choose how strong they are. Horror for everyone.',
  'Built spec-first with Kiro: specs, hooks and property tests from the first day.',
  'Last Rites. Play it in your browser tonight.',
]

async function main() {
  const dry = process.argv.includes('--dry-run')
  const chars = LINES.reduce((n, l) => n + l.length, 0)
  if (dry) {
    LINES.forEach((l, i) => console.log(`vo-${i + 1}  ${l}`))
    console.log(`${LINES.length} lines, ${chars} characters. Nothing sent.`)
    return
  }
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set.')
  const v = VOICES.narrator
  const id = process.env[v.env] || v.fallbackId
  mkdirSync(VO_DIR, { recursive: true })
  for (const [i, text] of LINES.entries()) {
    const out = join(VO_DIR, `vo-${i + 1}.mp3`)
    if (existsSync(out)) {
      console.log(`vo-${i + 1} already made`)
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
    if (!res.ok) throw new Error(`vo-${i + 1}: ElevenLabs said ${res.status}: ${(await res.text()).slice(0, 200)}`)
    writeFileSync(out, Buffer.from(await res.arrayBuffer()))
    console.log(`vo-${i + 1} ok`)
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
