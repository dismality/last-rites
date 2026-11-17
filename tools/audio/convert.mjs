#!/usr/bin/env node
// Turn raw audio into game-ready files with ffmpeg:
//   tools/audio/raw/<folder>/<name>.(mp3|wav|ogg|flac|m4a)  ->  public/assets/audio/<folder>/<name>.ogg
//
//   node tools/audio/convert.mjs           convert anything new
//   node tools/audio/convert.mjs --force   redo every file
//
// Works for files from anywhere (ElevenLabs, Freesound, your own recordings): put them in
// tools/audio/raw/sfx (or voice, ambience, music) under the name the game uses, e.g.
// raw/sfx/zombie-groan-1.wav, and run this.
//
// Per folder:
//   sfx       mono, silence trimmed from both ends, peak at -3 dB
//   voice     mono, silence trimmed (a short breath of room kept), peak at -3 dB
//   ambience  stereo, untouched length (loops), peak at -6 dB so beds sit under the action
//   music     stereo, untouched length, peak at -4 dB
// All Ogg Vorbis, 44.1 kHz, quality 5.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW_DIR = join(HERE, 'raw')
const OUT_DIR = join(HERE, '..', '..', 'public', 'assets', 'audio')
const INPUT_TYPES = ['.mp3', '.wav', '.ogg', '.flac', '.m4a']

const PROFILE = {
  sfx: { mono: true, trim: true, peakDb: -3 },
  voice: { mono: true, trim: true, peakDb: -3, padS: 0.15 },
  ambience: { mono: false, trim: false, peakDb: -6 },
  music: { mono: false, trim: false, peakDb: -4 },
}

/** Silence-trim filter: cut quiet lead-in and tail (reverse, cut, reverse back). */
const TRIM = [
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05',
  'areverse',
].join(',')

function ffmpegAvailable() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  return r.status === 0
}

function run(args) {
  return spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: 'utf8' })
}

/** Loudest sample in dB after the shaping filters (ffmpeg volumedetect). */
function peakDb(input, filters) {
  const r = run(['-i', input, ...(filters ? ['-af', `${filters},volumedetect`] : ['-af', 'volumedetect']), '-f', 'null', '-'])
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(r.stderr ?? '')
  return m ? Number(m[1]) : null
}

/** Convert one file. Returns a short status. */
export function convertFile(input, folder, output) {
  const p = PROFILE[folder]
  // Channel layout and rate first, so the peak is measured on what is actually encoded (a stereo
  // to mono downmix alone can add 3 dB).
  const shape = [
    `aformat=channel_layouts=${p.mono ? 'mono' : 'stereo'}`,
    'aresample=44100',
    p.trim ? TRIM : null,
    p.padS ? `adelay=${Math.round(p.padS * 1000)}:all=1,apad=pad_dur=${p.padS}` : null,
  ]
    .filter(Boolean)
    .join(',')
  const peak = peakDb(input, shape)
  if (peak === null) return 'could not read'
  const gain = (p.peakDb - peak).toFixed(2)
  const filters = [shape, `volume=${gain}dB`].filter(Boolean).join(',')
  mkdirSync(dirname(output), { recursive: true })
  const r = run([
    '-i', input,
    '-af', filters,
    '-c:a', 'libvorbis', '-q:a', '5',
    '-map_metadata', '-1',
    output,
  ])
  if (r.status !== 0) return `ffmpeg failed: ${(r.stderr ?? '').split('\n').filter(Boolean).slice(-1)[0] ?? ''}`
  return `ok (${gain >= 0 ? '+' : ''}${gain} dB)`
}

/** Convert every raw file whose .ogg is missing or older (or all of them with force). */
export async function convertAll({ force = false } = {}) {
  if (!ffmpegAvailable()) {
    console.error('ffmpeg was not found. Install it, open a new terminal, and run this again:')
    console.error('  winget install Gyan.FFmpeg')
    process.exitCode = 1
    return { converted: 0, failed: 0 }
  }
  let converted = 0
  let failed = 0
  let found = 0
  for (const folder of Object.keys(PROFILE)) {
    const dir = join(RAW_DIR, folder)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).sort()) {
      const ext = extname(file).toLowerCase()
      if (!INPUT_TYPES.includes(ext)) continue
      found++
      const input = join(dir, file)
      const output = join(OUT_DIR, folder, `${basename(file, extname(file))}.ogg`)
      if (!force && existsSync(output) && statSync(output).mtimeMs >= statSync(input).mtimeMs) continue
      const status = convertFile(input, folder, output)
      const ok = status.startsWith('ok')
      if (ok) converted++
      else failed++
      console.log(`  ${folder}/${basename(output)}  ${status}`)
    }
  }
  if (found === 0) console.log(`No raw files in ${RAW_DIR}. Put audio in raw/sfx, raw/voice, raw/ambience or raw/music.`)
  else console.log(`Converted ${converted} file(s)${failed ? `, ${failed} failed` : ''}. They are in public/assets/audio; reload the game to hear them.`)
  return { converted, failed }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const force = process.argv.includes('--force')
  convertAll({ force }).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
