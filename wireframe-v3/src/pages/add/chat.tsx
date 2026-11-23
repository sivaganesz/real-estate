import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, Check, FileSpreadsheet, FileText, Mic, Paperclip, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { Change, Fact, Question } from '@/lib/assistant'
import { cn } from '@/lib/utils'
import type { PropertyTypeKey } from '@/data/types'
import { useFactText } from './use-fact-text'

/** Chat messages hold keys and data, never finished sentences, so switching language re-renders them. */
export type Msg =
  | { id: number; from: 'user'; text: string; file?: string }
  | { id: number; from: 'ai'; kind: 'text'; key: string; values?: Record<string, string | number>; examples?: string[]; samples?: boolean }
  | { id: number; from: 'ai'; kind: 'read'; facts: Fact[]; source?: string }
  | { id: number; from: 'ai'; kind: 'ask'; q: Question }
  | { id: number; from: 'ai'; kind: 'ready' }
  | { id: number; from: 'ai'; kind: 'import'; file: string; rows: number }
  | { id: number; from: 'ai'; kind: 'confirm'; changes: Change[]; facts: Fact[]; state: 'open' | 'applied' | 'cancelled' }

/** A message before it gets its id (Omit spread over each kind of message). */
export type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, 'id'> : never) : never

export type SampleFile = 'brochure' | 'sheet' | 'photos'

type Handlers = {
  onSend: (text: string) => void
  onAnswer: (q: Question, value: string | number, label: string) => void
  onSample: (s: SampleFile) => void
  onPublish: () => void
  onSaveDraft: () => void
  onOpenImport: () => void
  onConfirm: (id: number, apply: boolean) => void
}

export function Message({ m, latest, type, h }: { m: Msg; latest: boolean; type?: PropertyTypeKey; h: Handlers }) {
  const { t } = useTranslation()
  const ft = useFactText()

  if (m.from === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {m.file && <span className="mb-1 flex items-center gap-1.5 font-medium"><FileText className="size-4" /> {m.file}</span>}
          {m.text}
        </div>
      </div>
    )
  }

  const bubble = (children: React.ReactNode) => (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-3.5" /></span>
      <div className="min-w-0 max-w-[90%] flex-1 text-sm">{children}</div>
    </div>
  )

  switch (m.kind) {
    case 'text':
      return bubble(
        <>
          <p className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 whitespace-pre-line">{t(m.key, m.values ?? {})}</p>
          {m.examples && latest && (
            <div className="mt-2 flex flex-col items-start gap-1.5">
              <span className="text-xs text-muted-foreground">{t('assistant.tryExample')}</span>
              {m.examples.map((e) => (
                <button key={e} type="button" onClick={() => h.onSend(e)} className="rounded-xl border px-3 py-1.5 text-left hover:bg-muted">“{e}”</button>
              ))}
            </div>
          )}
          {m.samples && latest && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="w-full text-xs text-muted-foreground">{t('assistant.orSample')}</span>
              <Button size="sm" variant="outline" onClick={() => h.onSample('brochure')}><FileText /> {t('assistant.sample.brochure')}</Button>
              <Button size="sm" variant="outline" onClick={() => h.onSample('sheet')}><FileSpreadsheet /> {t('assistant.sample.sheet')}</Button>
            </div>
          )}
        </>,
      )
    case 'read':
      return bubble(
        <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
          <p className="mb-1.5">{m.source ? t('assistant.readFrom', { source: m.source }) : t('assistant.gotIt')}</p>
          <ul className="flex flex-col gap-1">
            {m.facts.map((f) => (
              <li key={f.key} className="flex flex-wrap items-baseline gap-x-1.5">
                <Check className="size-3.5 shrink-0 translate-y-0.5 text-emerald-600" />
                <span className="text-muted-foreground">{ft.label(f.key)}:</span>
                <span className="font-medium">{ft.value(f.key, f.value, type)}</span>
                {f.note && <span className={cn('w-full pl-5 text-xs', f.note.k === 'onwards' ? 'text-amber-700' : 'text-muted-foreground')}>{ft.note(f)}</span>}
              </li>
            ))}
          </ul>
        </div>,
      )
    case 'ask':
      return bubble(
        <>
          <p className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2">
            {t(`assistant.ask.${m.q.key.replace('spec:', 'spec_')}`, { defaultValue: t('assistant.ask.generic', { fact: ft.label(m.q.key) }) })}
            {m.q.hint && <span className="block text-xs text-muted-foreground">{t(`assistant.hint.${m.q.key.replace('spec:', '')}`, { defaultValue: '' })}</span>}
          </p>
          {m.q.options && latest && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('assistant.quickAnswers')}>
              {m.q.options.map((o) => {
                const label = o.i18n ? t(o.label) : m.q.key === 'spec:floor' && o.value === 0 ? t('assistant.groundFloor') : o.label
                return <Button key={String(o.value)} size="sm" variant="outline" className="rounded-full" onClick={() => h.onAnswer(m.q, o.value, label)}>{label}</Button>
              })}
            </div>
          )}
        </>,
      )
    case 'ready':
      return bubble(
        <>
          <p className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2">{t('assistant.ready')}</p>
          {latest && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" onClick={h.onPublish}>{t('assistant.publishNow')}</Button>
              <Button size="sm" variant="outline" onClick={h.onSaveDraft}>{t('assistant.saveDraft')}</Button>
            </div>
          )}
        </>,
      )
    case 'import':
      return bubble(
        <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
          <p>{t('assistant.manyFound', { file: m.file, count: m.rows })}</p>
          <Button size="sm" className="mt-2" onClick={h.onOpenImport}><FileSpreadsheet /> {t('assistant.openImport')}</Button>
        </div>,
      )
    case 'confirm':
      return bubble(
        <div className="rounded-2xl rounded-tl-md border bg-card px-3.5 py-2.5">
          <p className="mb-1.5 font-medium">{t('assistant.confirmTitle')}</p>
          <ul className="mb-2 flex flex-col gap-1">
            {m.changes.map((c) => (
              <li key={c.key} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-muted-foreground">{ft.label(c.key)}:</span>
                {ft.value(c.key, c.from, type) && <span className="line-through decoration-muted-foreground/60">{ft.value(c.key, c.from, type)}</span>}
                <span>{Array.isArray(c.to) ? '+' : '→'}</span>
                <span className="font-medium">{ft.value(c.key, c.to, type)}</span>
              </li>
            ))}
          </ul>
          {m.state === 'open' ? (
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => h.onConfirm(m.id, true)}><Check /> {t('assistant.apply')}</Button>
              <Button size="sm" variant="outline" onClick={() => h.onConfirm(m.id, false)}><X /> {t('action.cancel')}</Button>
            </div>
          ) : (
            <p className={cn('text-xs', m.state === 'applied' ? 'text-emerald-700' : 'text-muted-foreground')}>{t(`assistant.${m.state}`)}</p>
          )}
        </div>,
      )
  }
}

/** Type, paste a link, speak (simulated) or attach files. Enter sends; Shift+Enter adds a line. */
export function Composer({ onSend, onFiles, placeholder, voiceSample }: {
  onSend: (text: string) => void; onFiles: (files: File[]) => void; placeholder: string; voiceSample: string
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const send = () => { if (text.trim()) { onSend(text.trim()); setText('') } }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <div className="rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
      <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} rows={2} placeholder={placeholder} aria-label={t('assistant.messageLabel')}
        className="w-full resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground md:text-sm" />
      <div className="flex items-center gap-1">
        <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.xlsx,.xls,.csv"
          onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
        <Button type="button" variant="ghost" size="icon" aria-label={t('assistant.attach')} onClick={() => fileRef.current?.click()}><Paperclip /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label={t('search.voice')} onClick={() => setText(voiceSample)}><Mic /></Button>
        <span className="ml-1 truncate text-xs text-muted-foreground max-sm:hidden">{t('assistant.composerHint')}</span>
        <Button type="button" size="icon" className="ml-auto rounded-full" disabled={!text.trim()} onClick={send} aria-label={t('assistant.send')}><ArrowUp /></Button>
      </div>
    </div>
  )
}
