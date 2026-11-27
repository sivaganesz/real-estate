/**
 * Text PDFs through pdf.js (master prompt §15.3: "text PDFs via a PDF text library"). The library and its worker are
 * loaded only when a PDF is opened. Text items are regrouped into lines by their baseline so table rows stay together
 * ("3 BHK  1,740 sq ft  Rs. 1.45 Cr"). A PDF with (almost) no text is a scan: its first pages are rendered to canvases
 * for OCR.
 */
import type { DocProgress } from './types'

type PdfDoc = Awaited<ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']>

async function open(data: ArrayBuffer): Promise<PdfDoc> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise
}

type Item = { str: string; x: number; y: number; eol: boolean }

/** Items → lines: same baseline (±2 pt) is one line, left to right; lines top to bottom. */
export function itemsToLines(items: Item[]): string[] {
  const rows: { y: number; parts: Item[] }[] = []
  for (const it of items) {
    if (!it.str.trim()) continue
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 2)
    if (row) row.parts.push(it)
    else rows.push({ y: it.y, parts: [it] })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.str.trim()).join('  ').replace(/\s{3,}/g, '  ').trim())
    .filter(Boolean)
}

export async function pdfToText(data: ArrayBuffer, onProgress?: (p: DocProgress) => void): Promise<{ text: string; pages: number; doc: PdfDoc }> {
  onProgress?.({ stage: 'loading', progress: 0 })
  const doc = await open(data)
  const out: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    const items: Item[] = []
    for (const raw of content.items) {
      if (!('str' in raw)) continue
      items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5], eol: raw.hasEOL })
    }
    out.push(itemsToLines(items).join('\n'))
    onProgress?.({ stage: 'pdf', progress: n / doc.numPages, page: n, pages: doc.numPages })
  }
  return { text: out.join('\n\n').trim(), pages: doc.numPages, doc }
}

/** Renders the first `max` pages of a scanned PDF to canvases (2× scale, which OCR reads far better). */
export async function pdfPagesToCanvases(doc: PdfDoc, max = 3): Promise<HTMLCanvasElement[]> {
  const canvases: HTMLCanvasElement[] = []
  for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, viewport }).promise
    canvases.push(canvas)
  }
  return canvases
}
