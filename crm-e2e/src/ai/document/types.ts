/** Shared shapes of the document readers (file → text). */

/** Where reading a document stands. `progress` is 0–1 and comes from the library itself (pdf pages, tesseract's logger). */
export type DocProgress = {
  stage: 'loading' | 'pdf' | 'ocrEngine' | 'ocrLanguage' | 'ocrInit' | 'ocr' | 'done'
  progress: number
  page?: number
  pages?: number
}

export type DocSource = 'pdf' | 'scan' | 'image' | 'text'

export type DocText = {
  text: string
  source: DocSource
  pages?: number
  /** OCR mean confidence 0–1 (images and scans only). */
  confidence?: number
}

export type DocFileKind = 'sheet' | 'pdf' | 'image' | 'text' | 'unsupported'
