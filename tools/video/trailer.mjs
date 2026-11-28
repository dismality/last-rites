#!/usr/bin/env node
// Cuts the 2-minute video: the game played in order (Stage 1, 2, 3) from the shots filmed by
// tools/video/shots.spec.ts, each step with the keeper's own recorded line as a big subtitle,
// chapter titles, the narrator over the cold open and the nights, and a closing warning slide.
//   node tools/video/trailer.mjs        tools/video/out/last-rites.mp4 (about 2:20)
// Needs ffmpeg on PATH and the shots recorded. Narration comes from tools/video/raw/<line>.mp3
// (voiceover.mjs) or the game's own voice files; a line with no file gets a Windows-voice stand-in
// and the video says "placeholder voice" in its corner until it is replaced.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { AUDIO as SHEET } from '../audio/prompts.mjs'
import { LINES, VO_DIR } from './voiceover.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const CLIPS = join(HERE, 'clips')
const OUT = join(HERE, 'out')
const TMP = join(OUT, 'work')
const AUDIO = join(ROOT, 'public', 'assets', 'audio')
const W = 1920
const H = 1080
const FPS = 30
// The video runs as long as its beats need (well under 3:00); the last slide holds FINAL_LEN s.
const FINAL_LEN = 9
/** Seconds every scene fades out and the next fades in, through black. */
const FADE = 0.3
let TOTAL = 0

// ── The cut ────────────────────────────────────────────────────────────────────────────────
// A beat plays `shot` from `in` seconds (of the recorded shot), up to `out` if given (then holds
// that frame). Its sound is one of:
//   say: a narrator line (file name), with its text from LINES or the voice sheet;
//   keeper: the start of a line the keeper said during the shot, played from his recording at the
//           moment it came up (`pre` seconds into the beat, so the screen he is looking at shows first);
// or nothing. `keep` plays only those spans of the line (cut at its pauses), with `sub` as the words
// left. `hook` is a question put on screen after the line (or over a silent beat, from `hookAt`),
// for `hookLen` seconds. The keeper only says what he sees; the answers are never given (the names
// typed at the altar are blurred in the shots). `goals` are objective banners, [from, seconds,
// text], for what the player has to do. The beat lasts until the line and its hook end plus `tail`,
// or `len` seconds, whichever is longer; `speed` plays the picture faster. `chapter` puts a chapter
// title over the beat's first seconds. `bed` replaces the day or night sound bed ([file, volume]).
// sfx: [file, at, volume].
const BEATS = [
  { shot: 'open-gate', in: 0.3, say: 'intro-1', lead: 0.9, tail: 0.9, sfx: [['sfx/toll.ogg', 0.2, 0.9]] },
  { shot: 'open-graves', in: 0.3, say: 'intro-2', lead: 0.2, tail: 0.4, sfx: [['sfx/crow-caw-2.ogg', 0.6, 0.5]] },
  { shot: 'open-hut', in: 0.3, say: 'intro-3', lead: 0.1, tail: 0.4, sfx: [['sfx/door-creak.ogg', 2, 0.6]] },

  { chapter: ['I', 'Saved by the Bell'], shot: 's1-page', in: 0.8, say: 'keeper-page-1', lead: 0.8, tail: 0.0, sfx: [['sfx/page-turn.ogg', 0.5, 0.8]] },
  { shot: 's1-ledger', keeper: 'John Pell’s stone says', pre: 0.8, hook: 'Why would the ledger lie?' },
  { shot: 's1-bell', keeper: 'Nothing. John Pell’s cord', pre: 0.4, keep: [[0, 3.6]], sub: 'Nothing. John Pell’s cord hangs loose.', hook: 'Who cut his bell cord?', sfx: [['ambience/strange-hand-bell.ogg', 0.1, 0.35]] },
  { shot: 's1-journal', in: 1.6, len: 3.0, hook: 'And who is J.V.?', hookAt: 0.4, sfx: [['sfx/page-turn.ogg', 0.1, 0.7]] },
  { shot: 's1-dead', in: 0.4, len: 4.4, hook: 'Why won’t the dead stay down?', hookAt: 1.6, night: true, sfx: [['sfx/toll.ogg', 0, 1], ['sfx/zombie-groan-1.ogg', 1.0, 0.7], ['sfx/zombie-groan-3.ogg', 2.6, 0.6]] },
  { shot: 's1-fight', in: 0.2, len: 3.0, night: true, sfx: [['sfx/heavy-swing.ogg', 0.25, 0.7], ['sfx/melee-hit.ogg', 0.5, 0.8], ['sfx/heavy-swing.ogg', 1.2, 0.7], ['sfx/melee-hit.ogg', 1.45, 0.8]] },
  { shot: 's1-altar', in: 1.2, len: 6.0, night: true, goals: [[0.3, 2.9, 'Solve the case. Enter the name at the altar.'], [3.4, 2.5, 'The right name lifts the curse, and the next stage begins.']], sfx: [['sfx/altar-solved.ogg', 2.6, 0.7]] },

  { chapter: ['II', 'The Resurrection Men'], shot: 's2-gate', keeper: 'He thought bodies', pre: 1.6, keep: [[0, 3.2]], sub: 'He thought bodies were being stolen from new graves.', hook: 'Who is stealing the dead?', sfx: [['sfx/stone-grind.ogg', 0.3, 0.5]] },
  { shot: 's2-register', keeper: 'This doesn’t match', pre: 1.2, hook: 'Then where is Arthur Finch?' },
  { shot: 's2-boots', keeper: 'No. A broad, low heel', pre: 1.0, keep: [[0, 0.7], [4.47, 7.49]], sub: 'No. And no crack. Not Dale’s.', hook: 'Then whose boots were at his grave?' },
  { shot: 's2-crest', keeper: 'It opens', pre: 1.5, tail: 0.5, sfx: [['sfx/stone-grind.ogg', 1.4, 0.3]] },

  { chapter: ['III', 'The Sealed Catacombs'], shot: 's3-goal', in: 0.3, len: 4.2, goals: [[0.9, 3.0, 'The last stage. Find Elias Thorne.']], sfx: [['sfx/step-stone-1.ogg', 0.5, 0.4], ['sfx/step-stone-3.ogg', 1.2, 0.4], ['sfx/step-stone-2.ogg', 1.9, 0.4], ['sfx/step-stone-4.ogg', 2.6, 0.4]] },
  { shot: 's3-approach', in: 0.3, len: 5.6, bed: ['ambience/strange-chains.ogg', 0.22], sfx: [['sfx/heartbeat.ogg', 0.3, 0.8], ['sfx/breath-behind.ogg', 3.2, 0.5]] },
  { shot: 's3-elias', keeper: 'There’s a letter in his coat', pre: 0.9, keep: [[0, 3.5]], sub: 'There’s a letter in his coat that he never sent, and a note.', hook: 'Who lured him here?' },
  { shot: 's3-hymns', in: 1.0, out: 15.8, speed: 3 },
  { shot: 's3-stair', in: 0.2, len: 3.2, hook: 'What is under the chapel?', hookAt: 0.5, sfx: [['sfx/stone-grind.ogg', 0.1, 0.8]] },
  { shot: 's3-descend', in: 0.3, len: 6.4, bed: ['ambience/strange-knocks.ogg', 0.25], sfx: [['sfx/stair-footsteps.ogg', 0.2, 0.7], ['ambience/strange-organ.ogg', 2.4, 0.25]] },
  { shot: 's3-hands', in: 2.0, len: 4.0, hook: 'Whose hand wrote the lie?', hookAt: 0.6 },
  { shot: 's3-map', in: 0.6, len: 4.0, sfx: [['sfx/page-turn.ogg', 0.1, 0.7]] },
  { shot: 's3-rite', in: 1.0, out: 4.6, len: 4.6, night: true, goals: [[0.3, 4.0, 'One last name at the altar.']] },
  { shot: 's3-rite', in: 6.4, out: 11.4, speed: 1.25, night: true, goals: [[0.3, 3.5, 'Then lay the five relics, in order.']], sfx: [['sfx/relic-placed.ogg', 0.6, 0.7], ['sfx/relic-placed.ogg', 2.4, 0.7]] },

  { shot: 'end-scare', in: 0.25, len: 2.4, night: true, cut: true, sfx: [['voice/whisper-keeper.ogg', 0.1, 1.1], ['sfx/screen-scare-sting.ogg', 1.33, 1]] },
  { card: 'final', say: 'vo-9', lead: 1.0, fill: true, noSub: true, sfx: [['sfx/bell-all-souls.ogg', 0.1, 0.7]] },
]
// The last slide: LAST RITES, a question, where to play, and the content warning in small print.
const QUESTION = 'Three graves. Three lies. Can you solve the mystery?'
const WARNING = 'Contains jump scares, sudden loud sounds and flashing light. Not advised for players with epilepsy, photosensitivity, heart conditions or anxiety disorders. Scares and flashes can be turned down or off in Settings.'

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
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** The text of a line by its file name: the trailer's own lines, else the game's voice sheet. */
const textOf = (name) => LINES.find((l) => l.name === name)?.text ?? SHEET.find((e) => e.kind === 'voice' && e.name === name)?.text ?? null
/** The voice file that reads a keeper's line, by its exact words. */
const voiceForText = (text) => SHEET.find((e) => e.kind === 'voice' && e.text === text)?.name ?? null

/** Where a line's audio is: an ElevenLabs take in raw/, the game's own file, or a stand-in. */
function voiceFile(name, text) {
  const made = join(VO_DIR, `${name}.mp3`)
  if (existsSync(made)) return { file: made, placeholder: false }
  const game = join(AUDIO, 'voice', `${name}.ogg`)
  if (existsSync(game)) return { file: game, placeholder: false }
  const stand = join(TMP, `placeholder-${name}.wav`)
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = -2; $s.SetOutputToWaveFile('${stand}'); $s.Speak('${text.replace(/'/g, "''")}'); $s.Dispose()`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`The Windows voice could not make a stand-in for ${name}: ${r.stderr}`)
  return { file: stand, placeholder: true }
}

/** One recorded shot as a steady 30 fps clip, plus its frames' start time and the keeper's lines. */
function shotClip(name) {
  const dir = join(CLIPS, name)
  const list = join(dir, 'frames.json')
  if (!existsSync(list)) throw new Error(`Shot "${name}" is not recorded. Run: npx playwright test -c tools/video/playwright.video.config.ts`)
  const frames = JSON.parse(readFileSync(list, 'utf8'))
  const linesFile = join(dir, 'lines.json')
  const t0 = frames[0].t
  const lines = existsSync(linesFile) ? JSON.parse(readFileSync(linesFile, 'utf8')).map((l) => ({ at: l.t - t0, text: l.text })) : []
  const out = join(OUT, 'clips', `${name}.mp4`)
  mkdirSync(dirname(out), { recursive: true })
  if (!(existsSync(out) && statSync(out).mtimeMs > statSync(list).mtimeMs)) {
    const txt = [`ffconcat version 1.0`]
    frames.forEach((f, i) => {
      const next = frames[i + 1]
      txt.push(`file '${posix(join(dir, f.file))}'`, `duration ${(next ? Math.max(0.001, next.t - f.t) : 1 / FPS).toFixed(4)}`)
    })
    txt.push(`file '${posix(join(dir, frames.at(-1).file))}'`)
    const listTxt = join(TMP, `shot-${name}.txt`)
    writeFileSync(listTxt, txt.join('\n'))
    ff(['-safe', '0', '-f', 'concat', '-i', listTxt, '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', out], `shot ${name}`)
  }
  return { file: out, length: frames.at(-1).t - t0, lines }
}

/** Splits a line into subtitle chunks of up to two lines (about 96 letters), breaking only between
 *  sentences, or at a comma or colon near the middle of a sentence too long for one chunk. */
function chunks(text, max = 96) {
  const sentences = text.match(/[^.!?]+[.!?]+[’"]?\s*|[^.!?]+$/g).map((x) => x.trim())
  const pieces = sentences.flatMap((x) => {
    if (x.length <= max) return [x]
    const breaks = [...x.matchAll(/[,:;—] /g)].map((m) => m.index + 1)
    const at = breaks.sort((p, q) => Math.abs(p - x.length / 2) - Math.abs(q - x.length / 2))[0]
    return at ? [x.slice(0, at), x.slice(at + 1)] : [x]
  })
  const out = []
  for (const x of pieces) {
    if (out.length && `${out.at(-1)} ${x}`.length <= max) out[out.length - 1] += ` ${x}`
    else out.push(x)
  }
  return out
}

// ── Cards and overlays, drawn by Chrome in the game's own fonts ──────────────────────────────
const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=block">'
const BASE_CSS = `
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: transparent; }
  body { font-family: 'IM Fell English', Georgia, serif; color: #efe4cc; }
  .card { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, #1a120c 0%, #070504 62%, #000 100%);
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .sc { font-family: 'IM Fell English SC', Georgia, serif; }
`
const subtitleHtml = (text) => `<style>${BASE_CSS}
  .sub { position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); max-width: 1500px; width: max-content;
         font-size: 66px; line-height: 1.14; text-align: center; padding: 12px 36px 18px; border-radius: 10px;
         background: rgba(8, 5, 3, 0.72); color: #fbf3e2; text-shadow: 0 0 10px #000, 0 4px 10px #000; }
</style><div class="sub">${esc(text)}</div>`
const hookHtml = (text) => `<style>${BASE_CSS}
  .hk { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); max-width: 1500px; width: max-content;
        text-align: center; font-size: 92px; line-height: 1.1; font-style: italic; color: #fff4df; padding: 30px 80px 40px;
        background: radial-gradient(ellipse, rgba(0,0,0,.7) 0%, rgba(0,0,0,.45) 55%, transparent 75%);
        text-shadow: 0 0 34px rgba(170, 30, 20, .75), 0 4px 14px #000; }
</style><div class="hk">${esc(text)}</div>`
const goalHtml = (text) => `<style>${BASE_CSS}
  .gl { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); max-width: 1560px; width: max-content;
        text-align: center; padding: 16px 54px 24px; border-radius: 10px; background: rgba(8, 5, 3, 0.8);
        border: 2px solid rgba(232, 180, 106, 0.55); box-shadow: 0 0 40px rgba(0,0,0,.8); }
  .gl .k { font-size: 34px; letter-spacing: .3em; color: #e8b46a; }
  .gl .x { font-size: 66px; line-height: 1.12; color: #fbf3e2; text-shadow: 0 0 10px #000, 0 4px 10px #000; }
</style><div class="gl"><div class="k sc">Objective</div><div class="x">${esc(text)}</div></div>`
const chapterHtml = ([num, title]) => `<style>${BASE_CSS}
  .ch { position: absolute; top: 150px; left: 50%; transform: translateX(-50%); text-align: center;
        padding: 18px 60px 24px; background: radial-gradient(ellipse, rgba(0,0,0,.72) 0%, rgba(0,0,0,.5) 60%, transparent 100%); }
  .n { font-size: 44px; color: #e8b46a; letter-spacing: .3em; }
  .t { font-size: 96px; color: #f6ead2; text-shadow: 0 0 30px rgba(0,0,0,.9), 0 4px 12px #000; }
</style><div class="ch"><div class="n sc">Stage ${num} of III</div><div class="t sc">${esc(title)}</div></div>`
const placeholderHtml = `<style>${BASE_CSS} div{position:absolute;top:24px;right:30px;font:28px Consolas,monospace;color:#ff6a5a;background:rgba(0,0,0,.6);padding:6px 14px}</style><div>placeholder voice</div>`

function cardHtml(kind) {
  if (kind === 'hook')
    return `<style>${BASE_CSS}
      .q { font-size: 168px; line-height: 1.05; color: #f6ead2; text-shadow: 0 0 50px rgba(160, 30, 20, 0.55), 0 6px 16px #000; }
      .rule { width: 520px; height: 3px; margin-top: 46px; background: linear-gradient(90deg, transparent, #8c1f17, transparent); }
    </style><div class="card"><div class="q sc">Can you lift<br>the curse?</div><div class="rule"></div></div>`
  return `<style>${BASE_CSS}
    h1 { font-size: 230px; margin: 0; letter-spacing: 0.06em; color: #f1e3c4; text-shadow: 0 0 40px rgba(200, 120, 40, 0.35); }
    .rule { width: 760px; height: 2px; margin: 22px 0 38px; background: linear-gradient(90deg, transparent, #9a6b3a, transparent); }
    .q { font-size: 76px; color: #f3e6cc; font-style: italic; max-width: 1600px; text-shadow: 0 0 40px rgba(160, 30, 20, 0.5), 0 4px 12px #000; }
    .url { margin-top: 54px; font-size: 52px; color: #e8b46a; }
    .warn { position: absolute; bottom: 46px; left: 50%; transform: translateX(-50%); width: 1500px; text-align: center;
            font-size: 27px; line-height: 1.35; color: #b9a888; padding-top: 18px; border-top: 1px solid rgba(194, 56, 43, .45); }
    .warn b { color: #d9463a; letter-spacing: .22em; font-weight: normal; margin-right: 14px; }
  </style><div class="card"><h1 class="sc">Last Rites</h1><div class="rule"></div>
    <div class="q">${esc(QUESTION)}</div>
    <div class="url">Play free in your browser · last-rites.vercel.app</div>
    <div class="warn"><b class="sc">Warning</b>${esc(WARNING)}</div></div>`
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
  rmSync(TMP, { recursive: true, force: true, maxRetries: 2 })
  mkdirSync(TMP, { recursive: true })
  const placeholders = []

  // Sound and length of each beat.
  for (const b of BEATS) {
    b.lead ??= 0
    b.tail ??= 0
    if (b.shot) b.clip = shotClip(b.shot)
    if (b.keeper) {
      const line = b.clip.lines.find((l) => l.text.startsWith(b.keeper) && (b.pre !== undefined || l.at >= b.in - 0.3))
      if (!line) throw new Error(`${b.shot}: the keeper never said "${b.keeper}…" (lines: ${b.clip.lines.map((l) => l.text.slice(0, 30)).join(' | ')})`)
      b.text = line.text
      b.voiceName = voiceForText(line.text)
      if (b.pre !== undefined) b.in = Math.max(0, line.at - b.pre)
      b.lead = Math.max(0, line.at - b.in)
    } else if (b.say) {
      b.voiceName = b.say
      b.text = textOf(b.say)
    }
    if (b.voiceName) {
      const v = voiceFile(b.voiceName, b.text ?? '')
      if (v.placeholder) placeholders.push(b.voiceName)
      b.voiceFile = v.file
      if (b.keep) {
        // Only these spans of the line, joined with short fades so the cuts don't click.
        const cut = join(TMP, `voice-${BEATS.indexOf(b)}.wav`)
        const parts = b.keep.map(([a, z], k) => `[0:a]atrim=${a}:${z},asetpts=PTS-STARTPTS,afade=in:d=0.02,afade=out:st=${Math.max(0, z - a - 0.06).toFixed(3)}:d=0.06[k${k}]`)
        const graph = `${parts.join(';')};${b.keep.map((_, k) => `[k${k}]`).join('')}concat=n=${b.keep.length}:v=0:a=1[out]`
        ff(['-i', v.file, '-filter_complex', graph, '-map', '[out]', '-ar', '48000', cut], `cutting ${b.voiceName}`)
        b.voiceFile = cut
        b.text = b.sub ?? b.text
      }
      b.voiceLen = duration(b.voiceFile)
    }
    b.hookLen = b.hook ? (b.hookLen ?? 1.7) : 0
    b.len = b.speed ? (b.out - b.in) / b.speed : Math.max(b.len ?? 0, b.voiceLen !== undefined ? b.lead + b.voiceLen + b.tail + b.hookLen : 0)
  }
  const filler = BEATS.find((b) => b.fill)
  filler.len = Math.max(FINAL_LEN, filler.lead + (filler.voiceLen ?? 0) + 1.5)
  TOTAL = BEATS.reduce((n, b) => n + b.len, 0)
  if (TOTAL > 175) throw new Error(`The cut runs ${TOTAL.toFixed(1)} s; Devpost allows 3:00. Trim some beats.`)
  let t = 0
  for (const b of BEATS) {
    b.start = t
    t += b.len
  }
  console.log(`Cut: ${BEATS.length} beats, last slide ${filler.len.toFixed(1)} s, ${t.toFixed(1)} s in all.`)
  for (const b of BEATS) console.log(`  ${b.start.toFixed(1).padStart(6)}  ${(b.shot ?? b.card).padEnd(12)} ${b.len.toFixed(1)} s  ${b.voiceName ?? ''}`)

  // Overlays: subtitles (timed by each chunk's share of the line's letters), chapter titles.
  const pngs = []
  const overlays = []
  for (const [i, b] of BEATS.entries()) {
    if (b.card) {
      b.png = join(TMP, `card-${b.card}.png`)
      pngs.push({ html: cardHtml(b.card), out: b.png, transparent: false })
    }
    if (b.chapter) {
      const out = join(TMP, `chapter-${i}.png`)
      pngs.push({ html: chapterHtml(b.chapter), out, transparent: true })
      overlays.push({ out, from: b.start + 0.2, to: b.start + Math.min(3.2, b.len - 0.2) })
    }
    for (const [j, [from, len, text]] of (b.goals ?? []).entries()) {
      const out = join(TMP, `goal-${i}-${j}.png`)
      pngs.push({ html: goalHtml(text), out, transparent: true })
      overlays.push({ out, from: b.start + from, to: Math.min(b.start + b.len - 0.05, b.start + from + len) })
    }
    if (b.hook) {
      const out = join(TMP, `hook-${i}.png`)
      pngs.push({ html: hookHtml(b.hook), out, transparent: true })
      const from = b.start + (b.voiceLen !== undefined ? b.lead + b.voiceLen + 0.05 : (b.hookAt ?? 0.3))
      overlays.push({ out, from, to: b.start + b.len - 0.05 })
    }
    if (b.text && b.voiceLen && !b.noSub) {
      const parts = chunks(b.text)
      const letters = parts.reduce((n, p) => n + p.length, 0)
      const speak = b.cutLine ? Math.min(b.voiceLen, b.len - b.lead) : b.voiceLen
      let at = b.start + b.lead
      parts.forEach((p, j) => {
        const len = (b.voiceLen * p.length) / letters
        if (at - b.start - b.lead > speak) return
        const out = join(TMP, `sub-${i}-${j}.png`)
        pngs.push({ html: subtitleHtml(p), out, transparent: true })
        overlays.push({ out, from: at - 0.08, to: Math.min(b.tail < 0 ? TOTAL : b.start + b.len - 0.05, at + len + (j === parts.length - 1 && !b.hook ? 0.4 : 0.05)) })
        at += len
      })
    }
  }
  if (placeholders.length) {
    const out = join(TMP, 'placeholder.png')
    pngs.push({ html: placeholderHtml, out, transparent: true })
    overlays.push({ out, from: 0, to: TOTAL })
  }
  await renderPngs(pngs)

  // Picture: one segment per beat, each exactly as long as it fills in the cut.
  const segs = []
  for (const [i, b] of BEATS.entries()) {
    const out = join(TMP, `seg-${i}.mp4`)
    const first = i === 0
    const last = i === BEATS.length - 1
    const nextCard = BEATS[i + 1]?.card
    const fx = []
    let input
    if (b.card) {
      input = ['-loop', '1', '-framerate', String(FPS), '-t', b.len.toFixed(3), '-i', b.png]
      fx.push(`fps=${FPS}`, 'format=yuv420p', `fade=in:st=0:d=0.5`)
    } else {
      input = ['-i', b.clip.file]
      const have = (b.out ?? b.clip.length) - b.in
      const play = b.speed ? b.out - b.in : b.len
      fx.push(`trim=start=${b.in.toFixed(3)}`, 'setpts=PTS-STARTPTS')
      if (b.out && !b.speed) fx.push(`trim=duration=${have.toFixed(3)}`)
      if (b.speed) fx.push(`trim=duration=${play.toFixed(3)}`, `setpts=PTS/${b.speed}`)
      if (!b.speed && have < play) fx.push(`tpad=stop_mode=clone:stop_duration=${(play - have + 0.1).toFixed(3)}`)
      fx.push(`fps=${FPS}`, `trim=duration=${b.len.toFixed(3)}`, 'setpts=PTS-STARTPTS')
      if (b.night) fx.push('eq=gamma=1.35:contrast=1.05:saturation=0.92')
      fx.push(`fade=in:st=0:d=${first ? 1.2 : FADE}`)
      if (b.cut) fx.push(`fade=out:st=${(b.len - 0.08).toFixed(3)}:d=0.08`)
      else if (!last) fx.push(`fade=out:st=${(b.len - (nextCard ? 0.35 : FADE)).toFixed(3)}:d=${nextCard ? 0.35 : FADE}`)
    }
    if (last) fx.push(`fade=out:st=${(b.len - 1.2).toFixed(3)}:d=1.2`)
    ff([...input, '-vf', fx.join(','), '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], `beat ${i} ${b.shot ?? b.card}`)
    segs.push(out)
  }
  const list = join(TMP, 'segments.txt')
  writeFileSync(list, segs.map((s) => `file '${posix(s)}'`).join('\n'))
  const picture = join(TMP, 'picture.mp4')
  ff(['-safe', '0', '-f', 'concat', '-i', list, '-c', 'copy', picture], 'joining')

  // Overlays on the picture, in passes of 40 (ffmpeg's input limit is generous, the command line less so).
  let current = picture
  for (let p = 0; p * 40 < overlays.length; p++) {
    const group = overlays.slice(p * 40, p * 40 + 40)
    let chain = '[0:v]'
    const graph = group.map((o, k) => {
      const label = k === group.length - 1 ? '[v]' : `[o${k}]`
      const line = `${chain}[${k + 1}:v]overlay=0:0:enable='between(t,${o.from.toFixed(3)},${o.to.toFixed(3)})'${label}`
      chain = label
      return line
    })
    const next = join(TMP, `overlaid-${p}.mp4`)
    ff(['-i', current, ...group.flatMap((o) => ['-i', o.out]), '-filter_complex', graph.join(';'), '-map', '[v]', '-c:v', 'libx264', '-crf', '15', '-pix_fmt', 'yuv420p', next], `overlays ${p}`)
    current = next
  }

  // Sound: voices, the beats' sfx, and beds (wind throughout, a music box by day, rain at night).
  const inputs = []
  const parts = []
  const add = (file, at, vol, extra = '') => {
    inputs.push('-i', file)
    const k = inputs.length / 2 - 1
    const ms = Math.max(0, Math.round(at * 1000))
    parts.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo${extra},volume=${vol},adelay=${ms}|${ms}[a${k}]`)
  }
  const loop = (d, fin = 1.5, fout = 1.5) => `,aloop=loop=-1:size=2e9,atrim=duration=${d.toFixed(2)},afade=in:d=${fin},afade=out:st=${Math.max(0, d - fout).toFixed(2)}:d=${fout}`
  add(join(AUDIO, 'ambience', 'wind-night.ogg'), 0, 0.3, loop(TOTAL, 2, 2.5))
  // Day beds and night beds follow the beats.
  for (const b of BEATS.filter((x) => x.shot)) {
    const bed = b.bed !== undefined ? b.bed : b.night ? ['ambience/rain.ogg', 0.3] : ['ambience/strange-music-box.ogg', 0.16]
    if (bed) add(join(AUDIO, bed[0]), b.start, bed[1], loop(b.len, 0.25, 0.25))
  }
  for (const b of BEATS) {
    if (b.voiceFile) {
      const cut = b.cutLine ? `,atrim=duration=${(b.len - b.lead).toFixed(2)},afade=out:st=${Math.max(0, b.len - b.lead - 0.4).toFixed(2)}:d=0.4` : ''
      add(b.voiceFile, b.start + b.lead, 1.2, cut)
    }
    for (const [file, at, vol] of b.sfx ?? []) add(join(AUDIO, file), b.start + at, vol)
  }
  const n = inputs.length / 2
  const mix = `${parts.join(';')};${Array.from({ length: n }, (_, k) => `[a${k}]`).join('')}amix=inputs=${n}:normalize=0:duration=longest,atrim=duration=${TOTAL},alimiter=limit=0.89[mix]`
  const sound = join(TMP, 'sound.wav')
  ff([...inputs, '-filter_complex', mix, '-map', '[mix]', '-ar', '48000', sound], 'sound')

  const final = join(OUT, 'last-rites.mp4')
  ff(['-i', current, '-i', sound, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '19', '-maxrate', '14M', '-bufsize', '28M', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', String(TOTAL), '-movflags', '+faststart', final], 'final')
  console.log(`Wrote ${final} (${duration(final).toFixed(2)} s)`)
  if (placeholders.length) console.log(`Placeholder voice for: ${placeholders.join(', ')}. Make them with: node tools/video/voiceover.mjs`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
