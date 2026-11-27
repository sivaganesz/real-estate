/**
 * In-browser OCR with tesseract.js (master prompt §15.3: "images / scans via in-browser OCR"). Loaded only when an
 * image is read. Progress is tesseract's own (loading the engine, the English language data, then recognising), so
 * the bar never runs ahead of the work. The engine and language data come from the library's CDN on first use and are
 * cached by the browser afterwards.
 */
import type { DocProgress } from './types'

const STAGE: Record<string, DocProgress['stage']> = {
  'loading tesseract core': 'ocrEngine',
  'initializing tesseract': 'ocrEngine',
  'loading language traineddata': 'ocrLanguage',
  'loading language traineddata (from cache)': 'ocrLanguage',
  'initializing api': 'ocrInit',
  'recognizing text': 'ocr',
}

export type OcrImage = File | Blob | HTMLCanvasElement

export async function ocrImages(images: OcrImage[], onProgress?: (p: DocProgress) => void): Promise<{ text: string; confidence: number }> {
  onProgress?.({ stage: 'ocrEngine', progress: 0 })
  const { createWorker } = (await import('tesseract.js/dist/tesseract.esm.min.js')).default
  let page = 0
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      const stage = STAGE[m.status]
      if (!stage) return
      const progress = stage === 'ocr' ? (page + m.progress) / images.length : m.progress
      onProgress?.({ stage, progress, page: page + 1, pages: images.length })
    },
  })
  try {
    const texts: string[] = []
    const confidences: number[] = []
    for (const img of images) {
      const { data } = await worker.recognize(img)
      texts.push(data.text.trim())
      confidences.push(data.confidence / 100)
      page++
    }
    return { text: texts.join('\n\n').trim(), confidence: confidences.reduce((a, b) => a + b, 0) / Math.max(1, confidences.length) }
  } finally {
    await worker.terminate()
  }
}
