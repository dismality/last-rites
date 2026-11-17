// Byte sizes of files on disk, for the asset budget test. This project has no Node typings (the
// tests read files through Vite's `?raw` glob instead), so `node:fs` is loaded by a computed
// specifier and typed here with only the two calls it needs. Vitest runs these tests in Node.

interface MiniFs {
  readdirSync(path: string, options: { recursive: true }): string[]
  statSync(path: string): { size: number; isFile(): boolean }
}

const loadFs = async (): Promise<MiniFs> => {
  const spec = ['node', 'fs'].join(':')
  return (await import(/* @vite-ignore */ spec)) as MiniFs
}

const slashes = (p: string): string => p.split('\\').join('/')

/** Every file under `dir` (recursive) with its size in bytes; paths use forward slashes. */
export async function filesWithSizes(dir: string): Promise<{ path: string; bytes: number }[]> {
  const fs = await loadFs()
  const root = slashes(dir).replace(/\/$/, '')
  return fs
    .readdirSync(root, { recursive: true })
    .map((rel) => `${root}/${slashes(String(rel))}`)
    .map((path) => ({ path, stat: fs.statSync(path) }))
    .filter((f) => f.stat.isFile())
    .map((f) => ({ path: f.path, bytes: f.stat.size }))
}
