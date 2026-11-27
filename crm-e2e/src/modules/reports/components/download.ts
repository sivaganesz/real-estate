/** Saves text as a CSV download (UTF-8 with a BOM, so Excel shows ₹ and Tamil correctly). */
import { CSV_BOM } from '../lib/csv'

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([CSV_BOM, text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
