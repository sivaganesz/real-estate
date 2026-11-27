/** Browser helpers for the import pages: saving a generated file, and loading a sample from public/samples. */

export function downloadFile(name: string, data: Uint8Array | string, mime: string) {
  const part: BlobPart = typeof data === 'string' ? data : new Uint8Array(data)
  const url = URL.createObjectURL(new Blob([part], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const MIME: Record<string, string> = {
  csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
}

/** Fetches /samples/<file> as a File, exactly as if the user had picked it. */
export async function loadSample(file: string): Promise<File> {
  const res = await fetch(`${import.meta.env.BASE_URL}samples/${file}`)
  if (!res.ok) throw new Error(`Sample not found: ${file}`)
  const blob = await res.blob()
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  return new File([blob], file, { type: MIME[ext] ?? blob.type })
}
