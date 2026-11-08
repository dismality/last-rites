// Turns docs/CREDITS.md into plain lines for the credits roll. Pure string handling.

export interface CreditLine {
  kind: 'heading' | 'text'
  text: string
}

const stripMarkup = (s: string): string => s.replace(/[`*]/g, '').trim()

/** Headings stay headings; table rows become "a, b, c"; header and divider rows are dropped. */
export function parseCredits(markdown: string): CreditLine[] {
  const lines: CreditLine[] = []
  let headerRowPending = true
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      lines.push({ kind: 'heading', text: stripMarkup(heading[1]) })
      headerRowPending = true
      continue
    }
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(stripMarkup)
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue
      if (headerRowPending) {
        headerRowPending = false
        continue
      }
      lines.push({ kind: 'text', text: cells.filter(Boolean).join(', ') })
      continue
    }
    lines.push({ kind: 'text', text: stripMarkup(line.replace(/^[-*]\s+/, '')) })
  }
  return lines
}
