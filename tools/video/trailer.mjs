#!/usr/bin/env node
// Cuts the trailer: the recorded game shots (tools/video/shots.spec.ts), the narration, big
// subtitles, the title and the closing question, over a bed of the game's own sounds.
//   node tools/video/trailer.mjs           tools/video/out/trailer.mp4
//   node tools/video/trailer.mjs --kiro    the same, then a "Built with Kiro" slate (trailer-kiro.mp4)
// Needs ffmpeg on PATH and the shots recorded. Narration comes from tools/video/raw/<line>.mp3
// (made by voiceover.mjs) or the game's own voice files. A line not made yet gets a stand-in
// from the Windows voice, and the video says "placeholder voice" in its corner until it's replaced.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { LINES, VO_DIR } from './voiceover.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const CLIPS = join(HERE, 'clips')
const OUT = join(HERE, 'out')
const TMP = join(OUT, 'trailer-work')
const AUDIO = join(ROOT, 'public', 'assets', 'audio')
const KIRO = process.argv.includes('--kiro')
const W = 1920
const H = 1080
const FPS = 30

// ── The cut ────────────────────────────────────────────────────────────────────────────────
// A beat is one narration line over one or more shots (or a card). Its length is the line plus
// `lead` before and `tail` after, or `min`, whichever is longer. Subtitle text splits at '|'.
// sfx: [file, seconds into the beat, volume].
const BEATS = [
  { shots: ['gate'], voice: 'intro-1', text: 'Hollowmere, October 1891.', lead: 1.6, tail: 1.4, sfx: [['sfx/toll.ogg', 0.3, 0.9]] },
  { shots: ['graves'], voice: 'intro-2', text: 'Three weeks ago, the keeper Elias Thorne | walked out into these graves.', lead: 0.3, tail: 0.8, sfx: [['sfx/crow-caw-2.ogg', 0.6, 0.5]] },
  { shots: ['hut'], voice: 'intro-3', text: 'He never came back. | Now the keeping falls to you.', lead: 0.3, tail: 0.7, sfx: [['sfx/door-creak.ogg', 2.2, 0.6]] },
  { shots: ['page'], voice: 'intro-5', text: 'Whatever he knew, he wrote it down.', lead: 0.2, tail: 0.9, sfx: [['sfx/page-turn.ogg', 0.4, 0.8]] },
  {
    shots: ['stone', 'hymns', 'row'],
    voice: 'trailer-1',
    text: 'By day, follow his notes. | Read the stones, check the ledger, | find the bell that was cut. | Three cases, and every one | leads to the same family.',
    lead: 0.3,
    tail: 0.8,
    sfx: [['ambience/strange-hand-bell.ogg', 2.4, 0.5], ['sfx/stone-grind.ogg', 6.5, 0.5]],
  },
  {
    shots: ['night-yard', 'dead', 'fight'],
    voice: 'vo-5',
    text: "At dusk the bell tolls. | The lantern's flame is your oil, | and the dead come in waves | until you name the truth at the altar.",
    lead: 0.8,
    tail: 0.8,
    night: true,
    sfx: [['sfx/toll.ogg', 0, 1], ['sfx/zombie-groan-1.ogg', 3.4, 0.7], ['sfx/zombie-groan-3.ogg', 5.2, 0.6], ['sfx/shotgun-blast.ogg', 8.6, 0.8], ['sfx/shotgun-blast.ogg', 9.8, 0.8]],
  },
  {
    shots: ['chapel', 'crane', 'altar'],
    voice: 'trailer-2',
    text: 'Find the five relics. | Lay the last rite, | and let the sun rise on Hollowmere.',
    lead: 0.4,
    tail: 0.9,
    night: true,
    sfx: [['sfx/boss-rise.ogg', 2.2, 0.7], ['sfx/relic-placed.ogg', 5.4, 0.8]],
  },
  { shots: ['scare'], min: 2.0, night: true, sfx: [['voice/whisper-keeper.ogg', 0.1, 1.1], ['sfx/screen-scare-sting.ogg', 1.33, 1]], cut: true }, // the face shows 1.37 s in
  { card: 'title', voice: 'vo-9', lead: 0.9, tail: 1.6, sfx: [['sfx/bell-all-souls.ogg', 0.1, 0.8]] },
  { card: 'hook', voice: 'trailer-hook', lead: 0.8, tail: 3.2, sfx: [['sfx/toll.ogg', 0.2, 1]] },
]
const KIRO_BEAT = { card: 'kiro', min: 7, sfx: [] }

// ── Helpers ────────────────────────────────────────────────────────────────────────────────
function ff(args, what) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20 })
  if (r.status !== 0) throw new Error(`ffmpeg (${what}) failed:\n${(r.stderr ?? '').slice(-2000)}`)
}
function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  const d = Number(r.stdout.trim())
  if (!Number.isFinite(d)) throw new Error(`Could not read the length of ${file}`)
  return d
}
const posix = (p) => p.replace(/\\/g, '/')

/** Where a narration line's audio is: an ElevenLabs take, the game's own file, or a stand-in. */
function voiceFile(name, text) {
  const made = join(VO_DIR, `${name}.mp3`)
  if (existsSync(made)) return { file: made, placeholder: false }
  const game = join(AUDIO, 'voice', `${name}.ogg`)
  if (existsSync(game)) return { file: game, placeholder: false }
  const stand = join(TMP, `placeholder-${name}.wav`)
  if (!existsSync(stand)) {
    const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = -2; $s.SetOutputToWaveFile('${stand}'); $s.Speak('${text.replace(/'/g, "''")}'); $s.Dispose()`
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`The Windows voice could not make a stand-in for ${name}: ${r.stderr}`)
  }
  return { file: stand, placeholder: true }
}

/** One recorded shot as a steady 30 fps clip (frames.json holds each frame's time). */
function shotClip(name) {
  const dir = join(CLIPS, name)
  const list = join(dir, 'frames.json')
  if (!existsSync(list)) throw new Error(`Shot "${name}" is not recorded. Run: npx playwright test -c tools/video/playwright.video.config.ts`)
  const out = join(TMP, `shot-${name}.mp4`)
  if (existsSync(out) && statSync(out).mtimeMs > statSync(list).mtimeMs) return out
  const frames = JSON.parse(readFileSync(list, 'utf8'))
  const lines = ['ffconcat version 1.0']
  frames.forEach((f, i) => {
    const next = frames[i + 1]
    const d = next ? Math.max(0.001, next.t - f.t) : 1 / FPS
    lines.push(`file '${posix(join(dir, f.file))}'`, `duration ${d.toFixed(4)}`)
  })
  lines.push(`file '${posix(join(dir, frames[frames.length - 1].file))}'`)
  const txt = join(TMP, `shot-${name}.txt`)
  writeFileSync(txt, lines.join('\n'))
  ff(['-safe', '0', '-f', 'concat', '-i', txt, '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', out], `shot ${name}`)
  return out
}

// ── Cards and subtitles, drawn by Chrome in the game's own fonts ─────────────────────────────
const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=block">'
const BASE_CSS = `
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
  body { font-family: 'IM Fell English', Georgia, serif; color: #efe4cc; }
  .card { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, #1a120c 0%, #070504 62%, #000 100%);
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .sc { font-family: 'IM Fell English SC', Georgia, serif; }
`
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function subtitleHtml(text) {
  return `<style>${BASE_CSS}
    body { background: transparent; }
    .sub { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); max-width: 1680px; width: max-content;
           font-size: 76px; line-height: 1.12; text-align: center; padding: 14px 40px 20px; border-radius: 10px;
           background: rgba(0, 0, 0, 0.58); color: #fbf3e2;
           text-shadow: 0 0 10px #000, 0 4px 10px #000; }
  </style><div class="sub">${esc(text)}</div>`
}

function cardHtml(kind, kiro) {
  if (kind === 'title')
    return `<style>${BASE_CSS}
      h1 { font-size: 230px; margin: 0; letter-spacing: 0.06em; color: #f1e3c4; text-shadow: 0 0 40px rgba(200, 120, 40, 0.35); }
      .rule { width: 760px; height: 2px; margin: 26px 0 34px; background: linear-gradient(90deg, transparent, #9a6b3a, transparent); }
      .tag { font-size: 52px; font-style: italic; color: #d9c7a3; }
      .url { font-size: 46px; margin-top: 30px; color: #e8b46a; }
      .kiro { position: absolute; bottom: 70px; font-size: 34px; color: #a8987c; }
    </style><div class="card"><h1 class="sc">Last Rites</h1><div class="rule"></div>
      <div class="tag">A survival-horror mystery. Free in your browser.</div>
      <div class="url">last-rites.vercel.app</div>
      <div class="kiro">Built spec-first with Kiro · ${kiro.specs.length} specs · ${kiro.hooks.length} agent hooks · ${kiro.steering.length} steering docs</div></div>`
  if (kind === 'hook')
    return `<style>${BASE_CSS}
      .q { font-size: 168px; line-height: 1.05; color: #f6ead2; text-shadow: 0 0 50px rgba(160, 30, 20, 0.55), 0 6px 16px #000; }
      .rule { width: 520px; height: 3px; margin-top: 46px; background: linear-gradient(90deg, transparent, #8c1f17, transparent); }
    </style><div class="card"><div class="q sc">Can you lift<br>the curse?</div><div class="rule"></div></div>`
  // The Kiro slate: the real .kiro folder, a requirement from a spec and a hook.
  const col = (title, items) =>
    `<div class="col"><div class="h sc">${title}</div>${items.map((i) => `<div class="f">${esc(i)}</div>`).join('')}</div>`
  return `<style>${BASE_CSS}
    .card { justify-content: flex-start; padding-top: 70px; }
    h2 { font-size: 92px; margin: 0 0 10px; }
    .sub { font-size: 36px; color: #bfae8d; margin-bottom: 40px; font-style: italic; }
    .cols { display: flex; gap: 70px; text-align: left; }
    .col { min-width: 420px; }
    .h { font-size: 40px; color: #e8b46a; margin-bottom: 10px; }
    .f { font-family: Consolas, monospace; font-size: 25px; line-height: 1.45; color: #e6dcc6; }
    .req { margin-top: 44px; max-width: 1560px; text-align: left; font-family: Consolas, monospace; font-size: 26px; line-height: 1.5;
           color: #e6dcc6; background: rgba(255, 255, 255, 0.05); border-left: 4px solid #e8b46a; padding: 18px 28px; }
    .req b { color: #e8b46a; font-weight: normal; }
  </style><div class="card"><h2 class="sc">Built with Kiro</h2><div class="sub">Everything below is in /.kiro at the root of the repo</div>
    <div class="cols">${col('Specs', kiro.specs)}${col('Agent hooks', kiro.hooks)}${col('Steering', kiro.steering)}</div>
    <div class="req"><b>.kiro/specs/10-curse-stages/requirements.md</b><br>${kiro.req.map(esc).join('<br>')}</div></div>`
}

function kiroFacts() {
  const k = join(ROOT, '.kiro')
  const names = (d, ext) => readdirSync(join(k, d)).filter((n) => !ext || n.endsWith(ext)).map((n) => (ext ? n.slice(0, -ext.length) : n))
  const req = readFileSync(join(k, 'specs', '10-curse-stages', 'requirements.md'), 'utf8')
    .split('\n')
    .filter((l) => /^\d+\. (WHILE|WHEN) .*(producing waves without end|stop spawning)/.test(l))
    .map((l) => l.replace(/^\d+\. /, ''))
  return { specs: names('specs'), hooks: names('hooks', '.json'), steering: names('steering', '.md'), req }
}

async function renderPngs(jobs) {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  for (const { html, out, transparent } of jobs) {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}</head><body>${html}</body></html>`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: out, omitBackground: transparent })
  }
  await browser.close()
}

// ── Build ──────────────────────────────────────────────────────────────────────────────────
async function main() {
  rmSync(join(TMP), { recursive: true, force: true, maxRetries: 2 })
  mkdirSync(TMP, { recursive: true })
  const beats = KIRO ? [...BEATS, KIRO_BEAT] : BEATS
  const textOf = (name) => LINES.find((l) => l.name === name)?.text ?? ''

  // Times: each beat's start and length from its narration.
  let t = 0
  let placeholders = []
  for (const b of beats) {
    if (b.voice) {
      const v = voiceFile(b.voice, b.text ? b.text.replace(/ \| /g, ' ') : textOf(b.voice))
      b.voiceFile = v.file
      if (v.placeholder) placeholders.push(b.voice)
      b.voiceLen = duration(v.file)
    }
    b.lead ??= 0
    b.tail ??= 0
    b.len = Math.max(b.min ?? 0, b.lead + (b.voiceLen ?? 0) + b.tail)
    b.start = t
    t += b.len
  }
  const total = t
  console.log(`Trailer: ${total.toFixed(1)} s, ${beats.length} beats.`)

  // Overlays: subtitles split at '|' and timed by their share of the line's letters.
  const kiro = kiroFacts()
  const pngs = []
  const subs = []
  for (const [i, b] of beats.entries()) {
    if (b.card) {
      b.png = join(TMP, `card-${b.card}.png`)
      pngs.push({ html: cardHtml(b.card, kiro), out: b.png, transparent: false })
    }
    if (b.text && b.voiceLen) {
      const parts = b.text.split(' | ')
      const letters = parts.reduce((n, p) => n + p.length, 0)
      let at = b.start + b.lead
      parts.forEach((p, j) => {
        const len = (b.voiceLen * p.length) / letters
        const out = join(TMP, `sub-${i}-${j}.png`)
        pngs.push({ html: subtitleHtml(p), out, transparent: true })
        subs.push({ out, from: at - 0.1, to: j === parts.length - 1 ? Math.min(b.start + b.len - 0.15, at + len + 0.6) : at + len })
        at += len
      })
    }
  }
  if (placeholders.length) {
    const out = join(TMP, 'placeholder-tag.png')
    pngs.push({
      html: `<style>body{margin:0;background:transparent}div{position:absolute;top:24px;right:30px;font:28px Consolas,monospace;color:#ff6a5a;background:rgba(0,0,0,.6);padding:6px 14px}</style><div>placeholder voice</div>`,
      out,
      transparent: true,
    })
    subs.push({ out, from: 0, to: total })
  }
  await renderPngs(pngs)

  // Picture: one segment per shot or card, each the exact length it fills in the cut.
  const segs = []
  for (const [i, b] of beats.entries()) {
    const fadeIn = i === 0 ? 1.2 : b.card ? 0.5 : 0
    const fadeOut = i === beats.length - 1 ? 1.5 : b.card || beats[i + 1]?.card ? 0.35 : 0
    if (b.card) {
      const out = join(TMP, `seg-${i}.mp4`)
      const fx = [`fps=${FPS}`, 'format=yuv420p']
      if (fadeIn) fx.push(`fade=in:st=0:d=${fadeIn}`)
      if (fadeOut) fx.push(`fade=out:st=${(b.len - fadeOut).toFixed(3)}:d=${fadeOut}`)
      ff(['-loop', '1', '-framerate', String(FPS), '-t', b.len.toFixed(3), '-i', b.png, '-vf', fx.join(','), '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], `card ${b.card}`)
      segs.push(out)
      continue
    }
    const each = b.len / b.shots.length
    for (const [j, name] of b.shots.entries()) {
      const src = shotClip(name)
      const have = duration(src) - 0.25
      const speed = have < each ? have / each : 1 // stretch a short shot rather than freeze it
      const out = join(TMP, `seg-${i}-${j}.mp4`)
      const fx = [`trim=start=0.25`, 'setpts=PTS-STARTPTS', speed < 1 ? `setpts=PTS/${speed.toFixed(4)}` : null, `fps=${FPS}`, `trim=duration=${each.toFixed(3)}`, 'setpts=PTS-STARTPTS']
      if (b.night) fx.push('eq=gamma=1.35:contrast=1.05:saturation=0.92')
      if (i === 0 && j === 0) fx.push(`fade=in:st=0:d=${fadeIn}`)
      if (j === b.shots.length - 1 && fadeOut) fx.push(`fade=out:st=${(each - fadeOut).toFixed(3)}:d=${fadeOut}`)
      if (b.cut) fx.push(`fade=out:st=${(each - 0.08).toFixed(3)}:d=0.08`)
      ff(['-i', src, '-vf', fx.filter(Boolean).join(','), '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], `segment ${name}`)
      segs.push(out)
    }
  }
  const list = join(TMP, 'segments.txt')
  writeFileSync(list, segs.map((s) => `file '${posix(s)}'`).join('\n'))
  const picture = join(TMP, 'picture.mp4')
  ff(['-safe', '0', '-f', 'concat', '-i', list, '-c', 'copy', picture], 'joining segments')

  // Subtitles over the picture.
  const subIn = subs.flatMap((s) => ['-i', s.out])
  let chain = '[0:v]'
  const graph = subs.map((s, k) => {
    const outLabel = k === subs.length - 1 ? '[v]' : `[s${k}]`
    const line = `${chain}[${k + 1}:v]overlay=0:0:enable='between(t,${s.from.toFixed(3)},${s.to.toFixed(3)})'${outLabel}`
    chain = outLabel
    return line
  })
  const subbed = join(TMP, 'subbed.mp4')
  ff(['-i', picture, ...subIn, '-filter_complex', graph.join(';'), '-map', '[v]', '-c:v', 'libx264', '-crf', '19', '-maxrate', '14M', '-bufsize', '28M', '-preset', 'slow', '-pix_fmt', 'yuv420p', subbed], 'subtitles')

  // Sound: narration, the beat sfx, and beds (wind throughout, rain and a heartbeat at night).
  const inputs = []
  const parts = []
  const add = (file, at, vol, extra = '') => {
    inputs.push('-i', file)
    const k = inputs.length / 2 - 1
    const ms = Math.max(0, Math.round(at * 1000))
    parts.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo${extra},volume=${vol},adelay=${ms}|${ms}[a${k}]`)
  }
  const nightStart = beats.find((b) => b.night).start
  const nightEnd = beats.filter((b) => b.night).at(-1).start + beats.filter((b) => b.night).at(-1).len
  add(join(AUDIO, 'ambience', 'wind-night.ogg'), 0, 0.32, `,aloop=loop=-1:size=2e9,atrim=duration=${total.toFixed(2)},afade=in:d=2,afade=out:st=${(total - 2.5).toFixed(2)}:d=2.5`)
  add(join(AUDIO, 'ambience', 'strange-music-box.ogg'), beats[1].start, 0.22, `,aloop=loop=-1:size=2e9,atrim=duration=${(nightStart - beats[1].start).toFixed(2)},afade=in:d=1.5,afade=out:st=${(nightStart - beats[1].start - 1.5).toFixed(2)}:d=1.5`)
  add(join(AUDIO, 'ambience', 'rain.ogg'), nightStart, 0.35, `,aloop=loop=-1:size=2e9,atrim=duration=${(nightEnd - nightStart).toFixed(2)},afade=in:d=1,afade=out:st=${(nightEnd - nightStart - 0.4).toFixed(2)}:d=0.4`)
  add(join(AUDIO, 'sfx', 'heartbeat.ogg'), nightEnd - 7, 0.5, `,aloop=loop=-1:size=2e9,atrim=duration=7,afade=in:d=2`)
  for (const b of beats) {
    if (b.voiceFile) add(b.voiceFile, b.start + b.lead, 1.25)
    for (const [file, at, vol] of b.sfx ?? []) add(join(AUDIO, file), b.start + at, vol)
  }
  const n = inputs.length / 2
  const mix = `${parts.join(';')};${Array.from({ length: n }, (_, k) => `[a${k}]`).join('')}amix=inputs=${n}:normalize=0:duration=longest,atrim=duration=${total.toFixed(3)},alimiter=limit=0.89[mix]`
  const sound = join(TMP, 'sound.wav')
  ff([...inputs, '-filter_complex', mix, '-map', '[mix]', '-ar', '48000', sound], 'sound')

  mkdirSync(OUT, { recursive: true })
  const final = join(OUT, KIRO ? 'trailer-kiro.mp4' : 'trailer.mp4')
  ff(['-i', subbed, '-i', sound, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final], 'final mux')
  console.log(`Wrote ${final}`)
  if (placeholders.length)
    console.log(`Placeholder voice for: ${placeholders.join(', ')}. Make them with: node tools/video/voiceover.mjs (needs ELEVENLABS_API_KEY), then run this again.`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
