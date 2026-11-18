// Runs scripts/checkEnemyModels.mjs against tiny generated GLB files (spec 11 Req 3.8).
// This project has no Node typings, so the Node modules are loaded by computed specifier and typed
// with only the calls used here (see tests/helpers/fileSizes.ts). Vitest runs this in Node.
import { afterEach, describe, expect, it } from 'vitest'

interface Fs {
  mkdtempSync(prefix: string): string
  rmSync(path: string, options: { recursive: true; force: true }): void
  writeFileSync(path: string, data: Uint8Array): void
}
interface Spawned {
  status: number | null
  stdout: string
}
interface Cp {
  spawnSync(cmd: string, args: string[], options: { encoding: 'utf8' }): Spawned
}
const load = async <T>(name: string): Promise<T> => (await import(/* @vite-ignore */ ['node', name].join(':'))) as T

const SCRIPT = 'scripts/checkEnemyModels.mjs'
const dirs: string[] = []

function glb(json: object): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json))
  const padded = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20)
  padded.set(text)
  const out = new Uint8Array(20 + padded.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, out.length, true)
  view.setUint32(12, padded.length, true)
  view.setUint32(16, 0x4e4f534a, true)
  out.set(padded, 20)
  return out
}

function model(triangles: number, skins = 1) {
  return {
    asset: { version: '2.0' },
    skins: Array.from({ length: skins }, () => ({ joints: [0] })),
    accessors: [{ count: triangles * 3 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 0 }] }],
    nodes: [{ name: 'body', mesh: 0, skin: 0 }],
  }
}

async function run(files: Record<string, object>): Promise<Spawned> {
  const fs = await load<Fs>('fs')
  const os = await load<{ tmpdir(): string }>('os')
  const dir = fs.mkdtempSync(`${os.tmpdir()}/enemy-models-`)
  dirs.push(dir)
  for (const [name, json] of Object.entries(files)) fs.writeFileSync(`${dir}/${name}`, glb(json))
  return (await load<Cp>('child_process')).spawnSync('node', [SCRIPT, dir], { encoding: 'utf8' })
}

afterEach(async () => {
  const fs = await load<Fs>('fs')
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true })
})

describe('checkEnemyModels script', () => {
  it('skips missing files and passes', async () => {
    const r = await run({})
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('skip  crawler.glb')
  })

  it('accepts one skin under 15,000 triangles', async () => {
    expect((await run({ 'crawler.glb': model(14999) })).status).toBe(0)
  })

  it('fails at 15,000 triangles or with two skins', async () => {
    expect((await run({ 'hound.glb': model(15000) })).status).toBe(1)
    expect((await run({ 'bride.glb': model(100, 2) })).status).toBe(1)
  })
})
