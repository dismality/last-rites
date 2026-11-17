// Reads the design bible's horror-pass section (spec 11) as typed tables, so data tests can compare
// `src/data/` with the bible row by row (Req 8.2). Spec 11 calls the section "§12"; in the bible it
// is "## 14. Horror pass" because §12 and §13 were already taken (see the note at its top).

// Raw text through Vite, as the other tests in tests/ read files (no Node types in this project).
const BIBLE_TEXT = Object.values(
  import.meta.glob<string>('../../docs/game-design.md', { query: '?raw', import: 'default', eager: true }),
)[0]

export interface BibleTable {
  /** Header cells, trimmed. */
  readonly header: readonly string[]
  /** One record per row, keyed by header cell. */
  readonly rows: readonly Readonly<Record<string, string>>[]
}

export interface BibleSubsection {
  /** "14.1" ... "14.9". */
  readonly number: string
  /** The heading text after the number, e.g. "Screen jumpscares (11, H1)". */
  readonly title: string
  /** Marked cut under the freeze: "(cut)" or ", cut)" in the heading (Req 8.3). */
  readonly cut: boolean
  readonly tables: readonly BibleTable[]
  /** The subsection's markdown body, heading excluded. */
  readonly body: string
}

export interface HorrorPass {
  /** The top-level heading's number (14 today). */
  readonly sectionNumber: number
  readonly subsections: readonly BibleSubsection[]
}

const CUT_MARK = /[(,]\s*cut\s*\)/i

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

const isTableLine = (line: string): boolean => line.trim().startsWith('|')
const isSeparator = (line: string): boolean => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line.trim())

/** Every markdown table in a block of text, in order. A malformed row throws, naming the line. */
export function parseTables(body: string): BibleTable[] {
  const lines = body.split(/\r?\n/)
  const tables: BibleTable[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!isTableLine(lines[i]) || i + 1 >= lines.length || !isSeparator(lines[i + 1])) continue
    const header = cells(lines[i])
    const rows: Record<string, string>[] = []
    let j = i + 2
    for (; j < lines.length && isTableLine(lines[j]); j++) {
      const row = cells(lines[j])
      if (row.length !== header.length) {
        throw new Error(`table row has ${row.length} cells, header has ${header.length}: ${lines[j].trim()}`)
      }
      rows.push(Object.fromEntries(header.map((h, k) => [h, row[k]])))
    }
    tables.push({ header, rows })
    i = j - 1
  }
  return tables
}

/** Splits the horror-pass section of a bible text into its numbered subsections. */
export function parseHorrorPass(bible: string): HorrorPass {
  const top = /^## (\d+)\. Horror pass\b.*$/m.exec(bible)
  if (!top) throw new Error('the design bible has no "Horror pass" section')
  const sectionNumber = Number(top[1])
  const rest = bible.slice(top.index + top[0].length)
  const next = /^## \d+\. /m.exec(rest)
  const section = next ? rest.slice(0, next.index) : rest

  const heading = new RegExp(`^### (${sectionNumber}\\.\\d+) (.+)$`, 'gm')
  const marks = [...section.matchAll(heading)]
  const subsections = marks.map((m, k) => {
    const start = m.index! + m[0].length
    const end = k + 1 < marks.length ? marks[k + 1].index! : section.length
    // A non-numbered ### heading (e.g. "Waiting list and placeholders") ends the subsection too.
    const tail = section.slice(start, end)
    const stop = /^### (?!\d)/m.exec(tail)
    const body = stop ? tail.slice(0, stop.index) : tail
    return { number: m[1], title: m[2].trim(), cut: CUT_MARK.test(m[2]), tables: parseTables(body), body }
  })
  return { sectionNumber, subsections }
}

/** The live (not cut) subsections only: tests mirroring data skip a cut feature. */
export const liveSubsections = (h: HorrorPass): BibleSubsection[] => h.subsections.filter((s) => !s.cut)

/** The real bible, parsed. */
export const readHorrorPass = (): HorrorPass => parseHorrorPass(BIBLE_TEXT)

/** One subsection by its spec 11 number ("12.6") or its bible number ("14.6"). */
export function subsection(h: HorrorPass, n: string): BibleSubsection {
  const local = `${h.sectionNumber}.${n.split('.')[1]}`
  const s = h.subsections.find((x) => x.number === local)
  if (!s) throw new Error(`no subsection ${local} in the horror pass`)
  return s
}

/** The first table of a subsection whose header starts with `firstColumn`. */
export function tableOf(s: BibleSubsection, firstColumn: string): BibleTable {
  const t = s.tables.find((x) => x.header[0] === firstColumn)
  if (!t) throw new Error(`${s.number} has no table starting with "${firstColumn}"`)
  return t
}
