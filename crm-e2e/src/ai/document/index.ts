/**
 * File → text for document extraction (foundation-plan §2: ai/document, owned by M5). Text PDFs are read with pdf.js;
 * scanned PDFs (no text layer) and images (JPG, PNG, WebP) go through tesseract.js OCR; .txt is read as is. Both
 * libraries load lazily. The text then runs through the same extractLead / extractProperty as paste-and-fill.
 */
import { ocrImages } from './ocr'
import { pdfPagesToCanvases, pdfToText } from './pdf-text'
import type { DocFileKind, DocProgress, DocText } from './types'

export type { DocFileKind, DocProgress, DocSource, DocText } from './types'
export { guessRecordKind, splitUnits, type KindGuess } from './classify'

export function fileKind(file: Pick<File, 'name' | 'type'>): DocFileKind {
  const n = file.name.toLowerCase()
  if (/\.(xlsx|xls|xlsm|csv|tsv)$/.test(n) || /sheet|excel|csv/.test(file.type)) return 'sheet'
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (/\.(png|jpe?g|webp|bmp|gif)$/.test(n) || file.type.startsWith('image/')) return 'image'
  if (n.endsWith('.txt') || file.type === 'text/plain') return 'text'
  return 'unsupported'
}

/** A text layer this short is a scan (page numbers, a stray header), not a document worth reading as text. */
const MIN_TEXT_CHARS = 40

export async function readDocument(file: File, onProgress?: (p: DocProgress) => void): Promise<DocText> {
  const kind = fileKind(file)
  if (kind === 'text') {
    const text = await file.text()
    onProgress?.({ stage: 'done', progress: 1 })
    return { text: text.trim(), source: 'text' }
  }
  if (kind === 'image') {
    const r = await ocrImages([file], onProgress)
    onProgress?.({ stage: 'done', progress: 1 })
    return { text: r.text, source: 'image', confidence: r.confidence }
  }
  if (kind === 'pdf') {
    const { text, pages, doc } = await pdfToText(await file.arrayBuffer(), onProgress)
    if (text.replace(/\s/g, '').length >= MIN_TEXT_CHARS) {
      onProgress?.({ stage: 'done', progress: 1 })
      return { text, source: 'pdf', pages }
    }
    const canvases = await pdfPagesToCanvases(doc)
    const r = await ocrImages(canvases, onProgress)
    onProgress?.({ stage: 'done', progress: 1 })
    return { text: r.text, source: 'scan', pages, confidence: r.confidence }
  }
  throw new Error(`Unsupported document: ${file.name}`)
}
