/**
 * CSV export for reports: RFC 4180 quoting (commas, quotes, line breaks), a UTF-8 BOM so Excel shows ₹ and Tamil
 * correctly, and a dated file name. Pure; the page turns the text into a download.
 */
export type Cell = string | number | null | undefined

export function csvCell(v: Cell): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** Several titled tables in one file, separated by a blank line. */
export function toCsvSections(sections: { title: string; header: string[]; rows: Cell[][] }[]): string {
  return sections.map((s) => `${csvCell(s.title)}\r\n${toCsv(s.header, s.rows)}`).join('\r\n\r\n')
}

export const CSV_BOM = '﻿'

export function csvFileName(tab: string, period: string, subject: string, now: Date): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `report-${tab}-${period}-${subject.replace(/[^a-z0-9-]+/gi, '-')}-${d}.csv`.toLowerCase()
}
