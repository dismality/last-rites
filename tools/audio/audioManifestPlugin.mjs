// Vite plugin: lists the recorded audio files in public/assets/audio as
// /assets/audio/manifest.json, so the game knows which sounds have a file (src/audio/samples.ts).
// The dev server answers fresh on every request, so a file dropped in is picked up on reload;
// the build writes the list into dist. No file to keep in step by hand.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const FOLDERS = ['sfx', 'voice', 'music', 'ambience']
const EXTENSIONS = ['.ogg', '.mp3', '.wav', '.m4a']
const URL_PATH = '/assets/audio/manifest.json'

/** Relative paths ("sfx/revolver-shot.ogg") of every playable file under `root`. */
export function listAudioFiles(root) {
  const out = []
  for (const folder of FOLDERS) {
    let names = []
    try {
      names = readdirSync(join(root, folder))
    } catch {
      continue // folder not made yet
    }
    for (const name of names) {
      if (EXTENSIONS.some((e) => name.toLowerCase().endsWith(e))) out.push(`${folder}/${name}`)
    }
  }
  return out.sort()
}

export function audioManifestPlugin() {
  let root = ''
  return {
    name: 'audio-manifest',
    configResolved(config) {
      root = join(config.publicDir, 'assets', 'audio')
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (!path.endsWith(URL_PATH)) return next()
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(listAudioFiles(root)))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'assets/audio/manifest.json', source: JSON.stringify(listAudioFiles(root)) })
    },
  }
}
