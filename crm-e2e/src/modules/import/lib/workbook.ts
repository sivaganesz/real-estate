/**
 * SheetJS in and out (master prompt §15: real parsing, real downloadable templates). Reading keeps the sheet's own row
 * numbers (blank rows included) so errors can say "row 7" as Excel does; CSVs are read as text so "24/11/2026" stays an
 * Indian date and "09885…" keeps its digits. Templates are generated at runtime as .xlsx (with an Instructions tab)
 * and .csv. Works in the browser and in Node (unit tests).
 */
import * as XLSX from 'xlsx'
import type { SheetKind } from './fields'
import type { RawSheet } from './sheet'
import { instructionsAoa, templateAoa, TEMPLATES } from './templates'
import type { Cell } from './values'

export type SheetFileType = 'xlsx' | 'csv'
export const isCsvName = (name: string) => /\.(csv|tsv|txt)$/i.test(name)

export function readWorkbook(data: ArrayBuffer | Uint8Array, fileName: string): RawSheet[] {
  const csv = isCsvName(fileName)
  const wb = csv
    ? XLSX.read(new TextDecoder().decode(data), { type: 'string', raw: true })
    : XLSX.read(data, { type: 'array', cellDates: true })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    if (!ws?.['!ref']) return { name, rows: [] }
    const range = XLSX.utils.decode_range(ws['!ref'])
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true })
    // sheet_to_json starts at the used range; pad so index 0 is Excel row 1 and column A
    const pad = (r: Cell[]) => (range.s.c ? [...Array<Cell>(range.s.c).fill(null), ...r] : r)
    return { name: csv ? fileName.replace(/\.[^.]+$/, '') : name, rows: [...Array.from({ length: range.s.r }, () => [] as Cell[]), ...rows.map(pad)] }
  })
}

const sheetName: Record<SheetKind, string> = { apartments: 'Apartments', villas: 'Villas & Houses', plots: 'Plots & Land', commercial: 'Commercial', leads: 'Leads' }

/** The default template as a file: .xlsx (data tab first, then Instructions) or .csv (headings + examples). */
export function templateFile(kind: SheetKind, type: SheetFileType): { name: string; mime: string; data: Uint8Array | string } {
  const aoa = templateAoa(kind)
  const base = TEMPLATES[kind].fileBase
  if (type === 'csv') {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    return { name: `${base}.csv`, mime: 'text/csv;charset=utf-8', data: `﻿${XLSX.utils.sheet_to_csv(ws)}` }
  }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = aoa[0].map((h) => ({ wch: Math.max(12, String(h).length + 2) }))
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws, sheetName[kind])
  const info = XLSX.utils.aoa_to_sheet(instructionsAoa(kind))
  info['!cols'] = [{ wch: 34 }, { wch: 10 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, info, 'Instructions')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return { name: `${base}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: new Uint8Array(out) }
}
