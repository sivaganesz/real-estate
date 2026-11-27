/**
 * Finding the table inside a real-world sheet (docs/02-bulk-import "messy sheets are expected"):
 *  - Instructions, Lists, Help and ReadMe tabs are ignored; the tab with the most data rows wins;
 *  - title and contact lines above the headings are skipped (the heading row is the first one that looks like headings);
 *  - blank lines, totals rows ("Total", "Grand total") and lone note lines are skipped and reported, never silently lost.
 * Pure: works on arrays of cells (SheetJS `sheet_to_json(..., { header: 1 })`).
 */
import { fieldsFor, type SheetKind } from './fields'
import { cellText, isBlank, type Cell } from './values'
import { normHeader } from './mapping'

export type RawSheet = { name: string; rows: Cell[][] }
export type SkipReason = 'title' | 'blank' | 'total' | 'note'
export type DataRow = { rowNumber: number /* 1-based, as in Excel */; cells: Cell[] }
export type Table = {
  sheet: string
  headerRow: number
  headers: string[]
  rows: DataRow[]
  skipped: { rowNumber: number; reason: SkipReason; text: string }[]
}
export type SheetChoice = { name: string; ignored: boolean; reason?: 'instructions'; dataRows: number }

const IGNORED_TAB = /^(instructions?|how to( use| fill)?|help|read\s?me|lists?|dropdowns?|guide|notes|master|validation|options|lookup)$/i
const TOTAL_RE = /^(grand\s*)?(sub\s*)?total\b|^sum\b|^totals?:?$|^net total/i
const MAX_HEADER_SCAN = 20

const filled = (row: Cell[] | undefined) => (row ?? []).filter((c) => !isBlank(c))
const looksNumeric = (c: Cell) => typeof c === 'number' || c instanceof Date || /^[\d,.\s₹%/-]+$/.test(cellText(c))

/** How strongly a row looks like a heading row for this kind: known words count most, text cells next. */
function headerScore(row: Cell[], words: Set<string>): number {
  const cells = filled(row)
  if (cells.length < 2) return 0
  const text = cells.filter((c) => !looksNumeric(c))
  if (text.length < Math.ceil(cells.length * 0.6)) return 0
  const known = text.filter((c) => {
    const h = normHeader(cellText(c))
    return words.has(h) || [...words].some((w) => w.length > 3 && h.includes(w))
  }).length
  return known * 3 + text.length
}

export function detectTable(sheet: RawSheet, kind: SheetKind): Table {
  const words = new Set(fieldsFor(kind).flatMap((f) => [f.key.toLowerCase(), ...f.synonyms]))
  const rows = sheet.rows
  let headerIndex = -1
  let best = 0
  for (let i = 0; i < Math.min(rows.length, MAX_HEADER_SCAN); i++) {
    const s = headerScore(rows[i] ?? [], words)
    if (s > best) { best = s; headerIndex = i }
  }
  const skipped: Table['skipped'] = []
  if (headerIndex < 0) return { sheet: sheet.name, headerRow: 0, headers: [], rows: [], skipped }
  for (let i = 0; i < headerIndex; i++) {
    const txt = filled(rows[i]).map(cellText).join(' · ')
    skipped.push({ rowNumber: i + 1, reason: txt ? 'title' : 'blank', text: txt })
  }
  // headers: blank headings get a column letter so nothing is dropped; repeated ones get a suffix
  const raw = rows[headerIndex] ?? []
  const width = Math.max(raw.length, ...rows.slice(headerIndex + 1).map((r) => r?.length ?? 0))
  const seen = new Map<string, number>()
  const headers = Array.from({ length: width }, (_, c) => {
    const base = cellText(raw[c]) || `Column ${colLetter(c)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n > 1 ? `${base} (${n})` : base
  })
  const data: DataRow[] = []
  const headerFilled = filled(raw).length
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const cells = filled(row)
    const rowNumber = i + 1
    if (!cells.length) { skipped.push({ rowNumber, reason: 'blank', text: '' }); continue }
    const first = cellText(cells[0])
    if (TOTAL_RE.test(first) || TOTAL_RE.test(cellText(row[0])) || TOTAL_RE.test(cellText(row[1]))) {
      skipped.push({ rowNumber, reason: 'total', text: cells.map(cellText).join(' · ') })
      continue
    }
    // a lone text cell in a wide table is a note ("Prices subject to change"), not a record
    if (cells.length === 1 && headerFilled >= 4 && !looksNumeric(cells[0]) && first.length > 25) {
      skipped.push({ rowNumber, reason: 'note', text: first })
      continue
    }
    data.push({ rowNumber, cells: Array.from({ length: width }, (_, c) => row[c] ?? null) })
  }
  // blank rows at the very end are noise, not worth reporting
  while (skipped.length && skipped[skipped.length - 1].reason === 'blank' && skipped[skipped.length - 1].rowNumber > (data[data.length - 1]?.rowNumber ?? 0)) skipped.pop()
  return { sheet: sheet.name, headerRow: headerIndex + 1, headers, rows: data, skipped }
}

export function colLetter(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

/** Every tab with its data-row count; instruction-type tabs are ignored. The first non-ignored tab with most rows wins. */
export function chooseSheet(sheets: RawSheet[], kind: SheetKind): { choices: SheetChoice[]; best: string | null } {
  const choices: SheetChoice[] = sheets.map((s) => {
    const ignored = IGNORED_TAB.test(s.name.trim())
    return { name: s.name, ignored, reason: ignored ? 'instructions' : undefined, dataRows: ignored ? 0 : detectTable(s, kind).rows.length }
  })
  const usable = choices.filter((c) => !c.ignored && c.dataRows > 0)
  const best = usable.sort((a, b) => b.dataRows - a.dataRows)[0]?.name ?? choices.find((c) => !c.ignored)?.name ?? null
  return { choices, best }
}
