import ExcelJS from 'exceljs';
import { HttpError } from '../../lib/http';

export type Cell = string | number | boolean | null;
export type Sheet = { name: string; headers: string[]; rows: Cell[][]; skipped: string[] };

/**
 * Reads .xlsx or .csv the way owners actually send them: a title above the
 * headings, blank lines, totals at the bottom, several tabs (we take the one
 * that looks like a property list).
 */
export async function readSheet(buffer: Buffer, fileName: string): Promise<Sheet> {
  const tables = /\.csv$/i.test(fileName) || looksLikeText(buffer) ? [{ name: 'CSV', cells: parseCsv(buffer.toString('utf8')) }] : await readXlsx(buffer);
  const candidates = tables.map((t) => ({ ...t, ...findHeader(t.cells) })).filter((t) => t.headerRow >= 0);
  if (!candidates.length) throw new HttpError(422, 'I could not find a row of column headings in this file');
  const best = candidates.sort((a, b) => b.dataRows - a.dataRows)[0];
  const headers = best.cells[best.headerRow].map((h, i) => (h === null || h === '' ? `Column ${i + 1}` : String(h).trim()));
  const skipped: string[] = [];
  if (best.headerRow > 0) skipped.push(`Skipped ${best.headerRow} line${best.headerRow > 1 ? 's' : ''} above the headings`);
  const rows: Cell[][] = [];
  for (const r of best.cells.slice(best.headerRow + 1)) {
    const filled = r.filter((c) => c !== null && c !== '');
    if (!filled.length) continue;
    if (filled.length <= 2 && /^(grand\s*)?total|^sub\s*total|^sum$/i.test(String(filled[0]))) {
      skipped.push('Skipped a totals row');
      continue;
    }
    rows.push(headers.map((_, i) => r[i] ?? null));
  }
  if (rows.length > 2000) throw new HttpError(422, `This sheet has ${rows.length} rows. Import up to 2,000 at a time.`);
  return { name: best.name, headers, rows, skipped };
}

function looksLikeText(buf: Buffer) {
  return !(buf[0] === 0x50 && buf[1] === 0x4b); // xlsx files are zip archives ("PK")
}

async function readXlsx(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new HttpError(422, 'This file could not be opened as an Excel sheet. Save it as .xlsx or .csv and try again.');
  }
  return wb.worksheets
    .filter((ws) => !/^(instructions?|lists?|help|readme|dropdowns?)$/i.test(ws.name.trim()))
    .map((ws) => {
      const cells: Cell[][] = [];
      ws.eachRow({ includeEmpty: true }, (row, n) => {
        const out: Cell[] = [];
        const values = row.values as unknown[];
        for (let i = 1; i < values.length; i++) out.push(cellValue(values[i]));
        cells[n - 1] = out;
      });
      return { name: ws.name, cells: Array.from(cells, (r) => r ?? []) };
    });
}

function cellValue(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string; hyperlink?: string; error?: string };
    if (o.richText) return o.richText.map((t) => t.text).join('').trim() || null;
    if ('result' in o) return cellValue(o.result);
    if (o.text) return String(o.text);
    if (o.hyperlink) return o.hyperlink;
    if (o.error) return null;
  }
  return String(v);
}

/** The header row is the first row with at least 3 short text cells, followed by data. */
function findHeader(cells: Cell[][]) {
  for (let i = 0; i < Math.min(cells.length, 15); i++) {
    const r = cells[i] ?? [];
    const texts = r.filter((c) => typeof c === 'string' && c.length > 0 && c.length < 60 && !/^\d+([.,]\d+)?$/.test(c));
    const filled = r.filter((c) => c !== null && c !== '');
    if (texts.length >= 3 && texts.length >= filled.length * 0.7) {
      const dataRows = cells.slice(i + 1).filter((row) => row?.some((c) => c !== null && c !== '')).length;
      return { headerRow: i, dataRows };
    }
  }
  return { headerRow: -1, dataRows: 0 };
}

export function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cur = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  const push = () => {
    const t = cur.trim();
    row.push(t === '' ? null : t);
    cur = '';
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') push();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      push();
      rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur || row.length) {
    push();
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: unknown[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const v = c === null || c === undefined ? '' : String(c);
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(','),
    )
    .join('\r\n');
}
