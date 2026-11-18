#!/usr/bin/env node
// Make the game's audio files with ElevenLabs, then convert them for the game.
//
//   set ELEVENLABS_API_KEY=...            (your key; only read from the environment)
//   node tools/audio/generate.mjs --batch first
//
// Options:
//   --batch <first|halloween|sfx|voice|ambience|music|all>   which files (default: first)
//   --only <name>        just this entry, e.g. --only zombie-groan (all its variants)
//   --force              make it again even if the file already exists
//   --dry-run            list what would be made and roughly how much text; no key needed
//   --check              show which files the game has and which are missing
//   --sheet              write docs/audio-prompts.md from prompts.mjs
//   --no-convert         keep the raw downloads only (convert later with convert.mjs)
//
// Raw downloads go to tools/audio/raw/<folder>/<name>.mp3 (not committed); convert.mjs turns them
// into public/assets/audio/<folder>/<name>.ogg, which the game picks up on its own.
// Optional voices: ELEVENLABS_VOICE_NARRATOR, ELEVENLABS_VOICE_ELIAS (voice ids from your
// ElevenLabs Voices page). Without them two premade voices are used.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUDIO, SFX_STYLE, VOICES, fileNames, inBatch } from './prompts.mjs'
import { convertAll } from './convert.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
export const RAW_DIR = join(HERE, 'raw')
export const OUT_DIR = join(ROOT, 'public', 'assets', 'audio')
const API = 'https://api.elevenlabs.io'

function parseArgs(argv) {
  const args = { batch: 'first', only: null, force: false, dryRun: false, check: false, sheet: false, convert: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--batch') args.batch = argv[++i]
    else if (a === '--only') args.only = argv[++i]
    else if (a === '--force') args.force = true
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--check') args.check = true
    else if (a === '--sheet') args.sheet = true
    else if (a === '--no-convert') args.convert = false
    else if (a === '--help' || a === '-h') args.help = true
    else throw new Error(`Unknown option: ${a}`)
  }
  return args
}

/** Entries chosen by --only or --batch. */
function chosen(args) {
  if (args.only) {
    const e = AUDIO.filter((x) => x.name === args.only)
    if (e.length === 0) throw new Error(`No entry named "${args.only}" in tools/audio/prompts.mjs`)
    return e
  }
  const list = AUDIO.filter((e) => inBatch(e, args.batch))
  if (list.length === 0) throw new Error(`Unknown batch "${args.batch}". Use first, halloween, sfx, voice, ambience, music or all.`)
  return list
}

const finalPath = (entry, name) => join(OUT_DIR, entry.folder, `${name}.ogg`)
const rawPath = (entry, name) => join(RAW_DIR, entry.folder, `${name}.mp3`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** POST to ElevenLabs and return the audio bytes. Retries rate limits and brief outages. */
async function post(path, key, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    const text = await res.text().catch(() => '')
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = 5000 * attempt
      console.log(`    busy (${res.status}), trying again in ${wait / 1000} s`)
      await sleep(wait)
      continue
    }
    const err = new Error(`ElevenLabs said ${res.status}: ${text.slice(0, 300)}`)
    err.status = res.status
    throw err
  }
}

async function makeSfx(entry, key) {
  const body = {
    text: `${entry.prompt}. ${SFX_STYLE}`,
    duration_seconds: Math.min(30, Math.max(0.5, entry.seconds ?? 2)),
    prompt_influence: 0.6,
  }
  if (entry.loop) {
    try {
      return await post('/v1/sound-generation', key, { ...body, loop: true, model_id: 'eleven_text_to_sound_v2' })
    } catch (e) {
      // Older API versions refuse the loop fields; the prompt still asks for a seamless loop.
      if (e.status !== 400 && e.status !== 422) throw e
    }
  }
  return post('/v1/sound-generation', key, body)
}

async function makeVoice(entry, key) {
  const v = VOICES[entry.voice]
  const id = process.env[v.env] || v.fallbackId
  return post(`/v1/text-to-speech/${id}?output_format=mp3_44100_128`, key, {
    text: entry.text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, speed: 0.9 },
  })
}

async function makeMusic(entry, key) {
  return post('/v1/music', key, { prompt: entry.prompt, music_length_ms: Math.round((entry.seconds ?? 60) * 1000) })
}

function check() {
  let have = 0
  let total = 0
  for (const e of AUDIO) {
    for (const n of fileNames(e)) {
      total++
      const ok = existsSync(finalPath(e, n))
      if (ok) have++
      console.log(`${ok ? '  [x]' : '  [ ]'} ${e.folder}/${n}.ogg${e.wired === false ? '   (not played by the game yet)' : ''}`)
    }
  }
  console.log(`\n${have} of ${total} files in public/assets/audio.`)
}

function sheet() {
  const lines = [
    '# Audio prompts',
    '',
    'Generated from `tools/audio/prompts.mjs` by `node tools/audio/generate.mjs --sheet`. Edit the',
    '.mjs file, not this one. Each file goes in `public/assets/audio/<folder>/<name>.ogg`; a',
    '"×N" entry is N files named `<name>-1` to `<name>-N`, and the game picks one at random.',
    '',
    'To make them by hand on elevenlabs.io instead of with the script: paste the prompt into',
    'Sound Effects (with the house style below), Text to Speech (with the voice below) or Music,',
    'download, put the file in `tools/audio/raw/<folder>/<name>.mp3`, and run',
    '`node tools/audio/convert.mjs`.',
    '',
    `**Sound effect house style** (added to every effect prompt): ${SFX_STYLE}.`,
    '',
    `**Narrator voice:** ${VOICES.narrator.describe}.`,
    '',
    `**Elias's voice:** ${VOICES.elias.describe}.`,
    '',
    '"Not played yet" files are listed so the set is complete; the game does not use them yet.',
    '',
  ]
  const groups = [
    ['First batch', (e) => e.batch === 'first'],
    ['Sound effects', (e) => e.batch !== 'first' && e.folder === 'sfx'],
    ['Ambience loops', (e) => e.batch !== 'first' && e.folder === 'ambience'],
    ['Music', (e) => e.kind === 'music'],
    ['Narration', (e) => e.batch !== 'first' && e.kind === 'voice'],
  ]
  for (const [title, pick] of groups) {
    lines.push(`## ${title}`, '', '| File | Kind | Prompt or line | Length | Played |', '|---|---|---|---|---|')
    for (const e of AUDIO.filter(pick)) {
      const file = `${e.folder}/${e.name}.ogg${e.variants ? ` ×${e.variants}` : ''}`
      const what = e.kind === 'voice' ? `*${e.voice}:* ${e.text}` : `${e.prompt}${e.loop ? ' (loop)' : ''}`
      const len = e.kind === 'voice' ? '' : `${e.seconds} s`
      lines.push(`| \`${file}\` | ${e.kind} | ${what.replace(/\|/g, '\\|')} | ${len} | ${e.wired === false ? 'not yet' : 'yes'} |`)
    }
    lines.push('')
  }
  const out = join(ROOT, 'docs', 'audio-prompts.md')
  writeFileSync(out, lines.join('\n'))
  console.log(`Wrote ${out}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('See the top of tools/audio/generate.mjs for usage.')
    return
  }
  if (args.check) return check()
  if (args.sheet) return sheet()

  const jobs = []
  for (const e of chosen(args)) {
    for (const n of fileNames(e)) {
      if (!args.force && existsSync(finalPath(e, n))) continue
      jobs.push({ e, n })
    }
  }
  if (jobs.length === 0) {
    console.log('Nothing to make: every chosen file is already in public/assets/audio (use --force to redo).')
    return
  }

  if (args.dryRun) {
    let chars = 0
    for (const { e, n } of jobs) {
      if (e.kind === 'voice') chars += e.text.length
      console.log(`  ${e.kind.padEnd(5)} ${e.folder}/${n}  ${e.kind === 'voice' ? `"${e.text.slice(0, 60)}"` : e.prompt.slice(0, 70)}`)
    }
    console.log(`\n${jobs.length} files. Narration text: ${chars} characters. Nothing was sent (dry run).`)
    return
  }

  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    console.error('ELEVENLABS_API_KEY is not set.')
    console.error('Copy your key from elevenlabs.io (Profile > API keys), then in this terminal:')
    console.error('  Command Prompt:  set ELEVENLABS_API_KEY=your-key')
    console.error('  PowerShell:      $env:ELEVENLABS_API_KEY = "your-key"')
    console.error('  Git Bash:        export ELEVENLABS_API_KEY=your-key')
    process.exit(1)
  }

  console.log(`Making ${jobs.length} files with ElevenLabs...`)
  const failed = []
  let made = 0
  for (const [i, { e, n }] of jobs.entries()) {
    const raw = rawPath(e, n)
    const tag = `[${i + 1}/${jobs.length}] ${e.folder}/${n}`
    if (!args.force && existsSync(raw)) {
      console.log(`${tag}  already downloaded, will convert`)
      continue
    }
    try {
      const bytes = e.kind === 'voice' ? await makeVoice(e, key) : e.kind === 'music' ? await makeMusic(e, key) : await makeSfx(e, key)
      mkdirSync(dirname(raw), { recursive: true })
      writeFileSync(raw, bytes)
      made++
      console.log(`${tag}  ok (${Math.round(bytes.length / 1024)} KB)`)
    } catch (err) {
      failed.push(`${e.folder}/${n}`)
      console.log(`${tag}  FAILED: ${err.message}`)
      if (err.status === 401) {
        console.log('The key was refused. Check ELEVENLABS_API_KEY and try again.')
        break
      }
    }
  }
  console.log(`\nDownloaded ${made} new file(s).${failed.length ? ` Failed: ${failed.join(', ')}` : ''}`)

  if (args.convert) {
    console.log('\nConverting for the game...')
    await convertAll({ force: args.force })
  } else {
    console.log('Skipped converting (--no-convert). Run: node tools/audio/convert.mjs')
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
