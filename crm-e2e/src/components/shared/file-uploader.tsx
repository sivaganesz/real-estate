/**
 * File uploader: a dropzone (drag and drop, click, or keyboard) with type and size checks, and a preview list
 * (image thumbnails, file icon + size otherwise) with remove buttons. Refuses clearly instead of failing silently
 * (Known limitation K3: images are capped). The page decides what to do with the files.
 */
import { useCallback, useId, useRef, useState } from 'react'
import { FileSpreadsheet, FileText, ImageIcon, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type UploadRejection = { file: string; reason: 'type' | 'size' | 'count' }

const kb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const iconFor = (f: File) => (f.type.startsWith('image/') ? ImageIcon : /sheet|excel|csv/.test(f.type) || /\.(xlsx?|csv)$/i.test(f.name) ? FileSpreadsheet : FileText)

function matches(file: File, accept: string[]): boolean {
  if (!accept.length) return true
  return accept.some((a) => (a.startsWith('.') ? file.name.toLowerCase().endsWith(a.toLowerCase()) : a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a))
}

/** The object URL lives exactly as long as the <img> (a ref cleanup), so Strict Mode's double effects never leave it revoked. */
function Thumb({ file }: { file: File }) {
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (!el) return
    const url = URL.createObjectURL(file)
    el.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <img ref={ref} alt="" className="size-10 rounded-md object-cover" />
}

export function FileUploader({ files, onFilesChange, accept = [], maxSizeMb = 10, maxFiles = 1, hint, disabled, className, label }: {
  files: File[]
  onFilesChange: (files: File[]) => void
  /** Extensions or MIME types: ['.xlsx', '.csv', 'image/*', 'application/pdf'] */
  accept?: string[]
  maxSizeMb?: number
  maxFiles?: number
  hint?: string
  disabled?: boolean
  className?: string
  /** Accessible name of the dropzone. */
  label?: string
}) {
  const { t } = useTranslation('ui')
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState<UploadRejection[]>([])

  const add = (list: FileList | File[]) => {
    const incoming = Array.from(list)
    const bad: UploadRejection[] = []
    const ok: File[] = []
    for (const f of incoming) {
      if (!matches(f, accept)) bad.push({ file: f.name, reason: 'type' })
      else if (f.size > maxSizeMb * 1_048_576) bad.push({ file: f.name, reason: 'size' })
      else ok.push(f)
    }
    const room = Math.max(0, maxFiles - (maxFiles === 1 ? 0 : files.length))
    const taken = ok.slice(0, room)
    ok.slice(room).forEach((f) => bad.push({ file: f.name, reason: 'count' }))
    setRejected(bad)
    if (taken.length) onFilesChange(maxFiles === 1 ? taken.slice(0, 1) : [...files, ...taken])
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined} aria-label={label ?? t('upload.drop')} aria-describedby={hintId}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); input.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) add(e.dataTransfer.files) }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-(--dur-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          over ? 'border-primary bg-primary-soft' : 'border-border-strong bg-muted/40 hover:bg-muted/70',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary"><Upload className="size-5" aria-hidden="true" /></span>
        <p className="text-sm font-medium">{t('upload.drop')} <span className="text-primary underline underline-offset-2">{t('upload.browse')}</span></p>
        <p id={hintId} className="text-meta text-muted-foreground">{hint ?? t('upload.limits', { types: accept.join(', ') || t('upload.anyType'), size: maxSizeMb })}</p>
        <input
          ref={input} type="file" hidden multiple={maxFiles > 1} accept={accept.join(',')}
          onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = '' }}
        />
      </div>
      {rejected.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-md bg-danger-soft px-3 py-2 text-meta text-danger">
          {rejected.map((r, i) => <li key={i}>{t(`upload.rejected.${r.reason}`, { file: r.file, size: maxSizeMb, max: maxFiles })}</li>)}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f, i) => {
            const Icon = iconFor(f)
            return (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 shadow-xs">
                {f.type.startsWith('image/') ? <Thumb file={f} /> : <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-5" aria-hidden="true" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-meta text-muted-foreground tabular-nums">{kb(f.size)}</span>
                </span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onFilesChange(files.filter((_, j) => j !== i))} aria-label={t('upload.remove', { file: f.name })}>
                  <X />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
