import { IMPORT_MAX_ROWS } from '@real-estate/shared';
import ExcelJS from 'exceljs';
import { AppError } from '../../lib/errors';
import type { FormDefinition } from '../propertyTypes/propertyTypes.service';
import type { CellValue, ImportColumn } from './columns';
import { headerKey } from './columns';

export const DATA_SHEET = 'Properties';
const NEED_LABEL = {
  import: 'Needed to import',
  publish: 'Needed to publish',
  optional: 'Optional',
} as const;

const columnLetter = (n: number) => {
  let s = '';
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

/**
 * Excel template for one subcategory: a "Properties" sheet with the columns and dropdowns,
 * an "Instructions" sheet (what each column means, with a sample row) and a hidden "Lists"
 * sheet holding the dropdown values.
 */
export async function buildTemplate(
  def: FormDefinition,
  columns: ImportColumn[],
  companyName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = new Date();

  const sheet = wb.addWorksheet(DATA_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const head = sheet.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: 'middle', wrapText: true };
  head.height = 30;
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: c.need === 'optional' ? 'FFF3F4F6' : c.need === 'import' ? 'FFFDE68A' : 'FFFEF3C7',
      },
    };
    cell.note = `${NEED_LABEL[c.need]}. ${c.help}`;
  });

  // Dropdown values live on a hidden sheet (Excel limits inline lists to 255 characters).
  const lists = wb.addWorksheet('Lists', { state: 'veryHidden' });
  let listCol = 0;
  columns.forEach((c, i) => {
    if (!c.options?.length || (c.kind !== 'list' && c.kind !== 'yes_no')) return;
    listCol += 1;
    c.options.forEach((option, r) => {
      lists.getCell(r + 1, listCol).value = option;
    });
    const range = `Lists!$${columnLetter(listCol)}$1:$${columnLetter(listCol)}$${c.options.length}`;
    const letter = columnLetter(i + 1);
    for (let r = 2; r <= IMPORT_MAX_ROWS + 1; r++) {
      sheet.getCell(`${letter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [range],
        showErrorMessage: true,
        errorTitle: c.header,
        error: `Choose from the list: ${c.options.join(', ').slice(0, 200)}`,
      };
    }
  });
  // Pincodes stay as text, so leading digits and formatting are kept.
  const pin = columns.findIndex((c) => c.key === 'pincode');
  if (pin >= 0) sheet.getColumn(pin + 1).numFmt = '@';

  const help = wb.addWorksheet('Instructions');
  help.columns = [
    { header: 'Column', key: 'column', width: 28 },
    { header: 'When', key: 'need', width: 20 },
    { header: 'What to enter', key: 'help', width: 80 },
    { header: 'Example', key: 'sample', width: 36 },
  ];
  help.getRow(1).font = { bold: true };
  help.insertRow(1, [`${def.category.name} › ${def.subcategory.name}: bulk import template`]);
  help.getRow(1).font = { bold: true, size: 14 };
  help.insertRow(2, [
    `Fill one property per row on the "${DATA_SHEET}" sheet (up to ${IMPORT_MAX_ROWS} rows). Keep the column names. Properties are checked before anything is imported; you can import them as Draft or Published.`,
  ]);
  help.insertRow(3, []);
  for (const c of columns) {
    help.addRow({
      column: c.header.replace(/\s*\*$/, ''),
      need: NEED_LABEL[c.need],
      help: c.help,
      sample: c.sample ?? '',
    });
  }
  help.getColumn(3).alignment = { wrapText: true, vertical: 'top' };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The value a person sees in a cell (rich text, links, formulas and errors reduced). */
function plainValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return plainValue(value.result as ExcelJS.CellValue);
    if ('error' in value) return null;
  }
  return String(value);
}

export interface SheetRow {
  /** Spreadsheet row number. */
  row: number;
  cells: Map<string, CellValue>;
}

/** Reads the uploaded file: matches columns by name and returns the filled rows. */
export async function readUpload(data: Buffer, columns: ImportColumn[]) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    throw new AppError(
      400,
      'INVALID_FILE',
      "This file can't be read. Upload the .xlsx template filled in Excel or Google Sheets.",
    );
  }
  const sheet = wb.getWorksheet(DATA_SHEET) ?? wb.worksheets.find((w) => w.state === 'visible');
  if (!sheet) throw new AppError(400, 'INVALID_FILE', 'The file has no sheet with properties.');

  const byHeader = new Map(columns.map((c) => [headerKey(c.header), c.key]));
  const keyAt = new Map<number, string>();
  const unknownColumns: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    const text = String(plainValue(cell.value) ?? '').trim();
    if (!text) return;
    const key = byHeader.get(headerKey(text));
    if (key) keyAt.set(col, key);
    else unknownColumns.push(text);
  });
  if (!keyAt.size || ![...keyAt.values()].includes('title')) {
    throw new AppError(
      400,
      'WRONG_TEMPLATE',
      'This file doesn\'t look like the template: the "Property name" column is missing. Download the template for this subcategory and use it.',
    );
  }

  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (r, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = new Map<string, CellValue>();
    for (const [col, key] of keyAt) {
      const v = plainValue(r.getCell(col).value);
      if (v !== null && v !== '') cells.set(key, v);
    }
    if (cells.size > 0) rows.push({ row: rowNumber, cells });
  });
  if (rows.length === 0)
    throw new AppError(400, 'EMPTY_FILE', 'The file has no properties filled in.');
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      400,
      'TOO_MANY_ROWS',
      `Up to ${IMPORT_MAX_ROWS} properties per file. This one has ${rows.length}; split it into smaller files.`,
    );
  }
  return { rows, unknownColumns };
}

/** The uploaded rows that need attention, with an "Errors" column added (to fix and re-upload). */
export async function buildErrorReport(
  data: Buffer,
  problems: Map<number, string>,
): Promise<Buffer> {
  const source = new ExcelJS.Workbook();
  await source.xlsx.load(data as unknown as ArrayBuffer);
  const sheet =
    source.getWorksheet(DATA_SHEET) ?? source.worksheets.find((w) => w.state === 'visible')!;
  const out = new ExcelJS.Workbook();
  const report = out.addWorksheet(DATA_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  const width = sheet.getRow(1).cellCount;
  const header = sheet.getRow(1).values as ExcelJS.CellValue[];
  report.addRow(['Errors', 'Row', ...header.slice(1).map((v) => plainValue(v))]);
  report.getRow(1).font = { bold: true };
  report.getColumn(1).width = 60;
  report.getColumn(1).alignment = { wrapText: true, vertical: 'top' };
  for (const [rowNumber, message] of [...problems].sort((a, b) => a[0] - b[0])) {
    const r = sheet.getRow(rowNumber);
    const values: CellValue[] = [];
    for (let c = 1; c <= width; c++) values.push(plainValue(r.getCell(c).value));
    report.addRow([message, rowNumber, ...values]);
  }
  return Buffer.from(await out.xlsx.writeBuffer());
}
