/**
 * Paste and fill (master prompt §12.3, DESIGN_SYSTEM §11.9 inline module assistant): paste a WhatsApp message, a
 * portal enquiry or an owner's listing, speak it, or drop a .txt file; "Extract" reads it with the AI service and
 * hands the Extraction to the form through `onFill`. The form fills and marks the fields; nothing is saved here.
 * Shows the Demo AI badge from the result's mode, the effort-saved line, notes, duplicate warnings and the
 * missing-field questions.
 */
import { useRef, useState } from 'react'
import { FileText, Loader2, Sparkles, Wand2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAI } from '@/ai'
import type { Extraction } from '@/ai/types'
import { paths } from '@/app/paths'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AppointmentInput, LeadInput, PropertyInput } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { cn } from '@/lib/utils'
import { DemoAIBadge } from './demo-ai-badge'
import { EffortSaved } from './effort-saved'
import { MissingQuestions } from './missing-questions'
import { VoiceButton } from './voice-button'

type KindMap = { lead: LeadInput; property: PropertyInput; appointment: AppointmentInput }
type Kind = keyof KindMap

const MAX_TXT_BYTES = 200_000

export function PasteAndFillBox<K extends Kind>({ kind, onFill, onAnswer, answered, onFocusField, className, defaultText }: {
  kind: K
  onFill: (x: Extraction<KindMap[K]>) => void
  /** Answer a missing-field question (the form sets that field). Without it the questions are not shown here. */
  onAnswer?: (field: string, value: unknown) => void
  answered?: ReadonlySet<string>
  onFocusField?: (field: string) => void
  className?: string
  defaultText?: string
}) {
  const { t } = useTranslation('ai')
  const { ai, context } = useAI()
  const [text, setText] = useState(defaultText ?? '')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Extraction<KindMap[K]> | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const leads = useDb((db) => db.leads)
  const base = useRef('')

  const extract = async (input = text) => {
    const clean = input.trim()
    if (!clean || busy) return
    setBusy(true)
    try {
      const ctx = context()
      const x = (kind === 'lead' ? await ai.extractLead(clean, ctx) : kind === 'property' ? await ai.extractProperty(clean, ctx) : await ai.extractAppointment(clean, ctx)) as Extraction<KindMap[K]>
      setResult(x)
      onFill(x)
    } finally {
      setBusy(false)
    }
  }

  const readFile = async (file: File) => {
    setFileError(null)
    if (!/\.txt$/i.test(file.name) && file.type !== 'text/plain') return setFileError(t('paste.fileType'))
    if (file.size > MAX_TXT_BYTES) return setFileError(t('paste.fileSize'))
    const content = await file.text()
    setText(content)
    void extract(content)
  }

  const dups = result?.duplicates?.map((d) => leads.find((l) => l.id === d.leadId)).filter((l) => !!l) ?? []

  return (
    <section
      aria-label={t('paste.title')}
      className={cn('flex flex-col gap-3 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-4', className)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) void readFile(f)
      }}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground"><Sparkles className="size-3.5" /></span>
        <h3 className="flex-1 text-sm font-semibold">{t(`paste.heading.${kind as Kind}`)}</h3>
        <DemoAIBadge mode={result?.mode ?? ai.mode} />
      </header>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void extract() } }}
        placeholder={t(`paste.placeholder.${kind as Kind}`)}
        aria-label={t(`paste.heading.${kind as Kind}`)}
        rows={4}
        className="min-h-24 bg-card text-prompt"
        data-testid="paste-text"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ai" onClick={() => void extract()} disabled={!text.trim() || busy} aria-busy={busy || undefined} data-testid="paste-extract">
          {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {busy ? t('thinking') : t('paste.extract')}
        </Button>
        <VoiceButton
          onText={(heard, final) => {
            if (!base.current && !final) base.current = text ? `${text} ` : ''
            setText(`${base.current}${heard}`)
            if (final) {
              const full = `${base.current}${heard}`
              base.current = ''
              void extract(full)
            }
          }}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
          <FileText />
          {t('paste.file')}
        </Button>
        <input ref={fileInput} type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = '' }} />
        {text && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setText(''); setResult(null) }}>
            <X />
            {t('paste.clear')}
          </Button>
        )}
      </div>
      {fileError && <p role="alert" className="text-meta text-danger">{fileError}</p>}
      {result && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <EffortSaved count={result.filledCount} />
          {result.notes?.map((n) => <p key={n} className="text-meta text-muted-foreground">{t(n)}</p>)}
          {dups.length > 0 && (
            <p role="alert" className="rounded-md bg-warning-soft px-2.5 py-1.5 text-meta text-warning">
              {t('paste.duplicate', { count: dups.length })}{' '}
              {dups.map((l, i) => (
                <span key={l.id}>
                  {i > 0 && ', '}
                  <Link to={paths.lead(l.id)} className="font-semibold underline underline-offset-2">{l.name}</Link>
                </span>
              ))}
            </p>
          )}
          {onAnswer && <MissingQuestions questions={result.questions} answered={answered} onAnswer={onAnswer} onFocusField={onFocusField} />}
        </div>
      )}
    </section>
  )
}
