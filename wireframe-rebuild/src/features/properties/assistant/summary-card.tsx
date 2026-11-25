import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, MapPin, Paperclip, Pencil, Sparkles, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusChip } from '@/components/app/status-chip'
import { PROPERTY_TYPES } from '@/data/catalogue'
import type { PropertyStatus } from '@/data/types'
import { type Draft, isSet, missingKeys } from '@/lib/assistant'
import { inrShort, sqft } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CompletionRing, PropertyStatusChip } from '../components/property-bits'
import { useFactText } from './use-fact-text'

/** What a checklist row's button does: ask for a fact in the chat, add photos, or tick approvals. */
export type AddTarget = string

type Props = {
  draft: Draft
  score: number
  /** Approval documents already uploaded (by approval id) and other legal documents. */
  docs: { uploaded: string[]; any: boolean }
  /** Sent to a manager for approval. */
  submitted: boolean
  publishLabel: string
  /** Edit with AI: the published property's status, shown instead of "Draft". */
  status?: PropertyStatus
  /** Replaces the Publish / Submit button: Approve & publish / Send back, "Waiting for approval", or Edit with AI's "Done". */
  footer?: ReactNode
  canWrite: boolean
  onTitle: (title: string) => void
  onAdd: (target: AddTarget) => void
  /** "Review all details": open the drawer. */
  onReview: () => void
  onPublish: () => void
  className?: string
}

/**
 * The right column: the listing taking shape. Completion ring and title, then one row per part of the listing —
 * ✓ done, ! required to publish, ○ optional (with the % it adds) — and what's still needed to publish.
 */
export function SummaryCard({ draft: d, score, docs, submitted, publishLabel, status, footer, canWrite, onTitle, onAdd, onReview, onPublish, className }: Props) {
  const { t } = useTranslation()
  const ft = useFactText()
  const [editing, setEditing] = useState(false)
  const missing = missingKeys(d).filter((k) => !k.startsWith('spec:?'))
  const byAi = (...keys: string[]) => keys.some((k) => d.sources?.[k] === 'ai')
  const add = (target: AddTarget, label = t('action.add'), icon?: ReactNode) =>
    canWrite && <Button size="sm" variant="outline" className="shrink-0" onClick={() => onAdd(target)}>{icon}{label}</Button>
  const muted = (text: string) => <span className="text-muted-foreground"> · {text}</span>

  const rows: ReactNode[] = []
  // purpose and type (required)
  if (d.purpose && d.type) rows.push(<Row key="pt" state="done" ai={byAi('purpose', 'type')}>{ft.value('purpose', d.purpose)} · {ft.value('type', d.type)}</Row>)
  else rows.push(
    <Row key="pt" state="req" action={add(d.purpose ? 'type' : 'purpose')}>
      {!d.purpose && !d.type ? t('assistant.row.purposeAndType')
        : !d.purpose ? <>{ft.label('purpose')}{muted(ft.value('type', d.type))}</> : <>{ft.label('type')}{muted(ft.value('purpose', d.purpose))}</>}
    </Row>,
  )
  // location (required: city and locality); the exact map location is optional
  if (d.city && d.locality) rows.push(
    <Row key="loc" state="done" ai={byAi('city', 'locality')} action={!d.exactLocation && add('exactLocation', t('assistant.row.exactBtn'), <MapPin />)}>
      {d.locality}, {d.city}{muted(d.exactLocation ? t('assistant.row.exact') : t('assistant.row.approx'))}
    </Row>,
  )
  else rows.push(<Row key="loc" state="req" action={add(d.city ? 'locality' : 'city')}>{d.city ? <>{ft.label('locality')}{muted(d.city)}</> : t('assistant.row.cityAndLocality')}</Row>)
  // price and area (both required)
  const pr = d.price ? inrShort(d.price) + (d.priceOnRequest ? ` ${t('assistant.row.priceHidden')}` : '') : '', ar = d.areaSqft ? sqft(d.areaSqft) : ''
  if (pr && ar) rows.push(<Row key="pa" state="done" ai={byAi('price', 'area')}>{pr} · {ar}</Row>)
  else rows.push(
    <Row key="pa" state="req" action={add(pr ? 'area' : 'price')}>
      {pr || ar ? <>{pr || ar}{muted(pr ? t('assistant.row.areaNeeded') : t('assistant.row.priceNeeded'))}</> : t('assistant.row.priceAndArea')}
    </Row>,
  )
  // the type's details: the two required ones first, then how many of the key details are in
  if (d.type) {
    const def = PROPERTY_TYPES[d.type]
    const core = def.core.filter((k) => def.facts.some((f) => f.key === k))
    const coreIn = core.filter((k) => isSet(d, `spec:${k}`)).length
    const reqLeft = def.required.filter((k) => !isSet(d, `spec:${k}`))
    const filled = def.facts.filter((f) => isSet(d, `spec:${f.key}`))
    const short = (key: string) => {
      const f = def.facts.find((x) => x.key === key)!
      const v = ft.value(`spec:${key}`, d.specs[key], d.type)
      return f.kind === 'number' ? `${ft.label(`spec:${key}`).replace(/\s*\(.*\)$/, '').toLowerCase()} ${v}` : v
    }
    const enough = core.length > 0 && coreIn === core.length
    rows.push(
      <Row key="det" state={reqLeft.length ? 'req' : enough ? 'done' : 'todo'} pts={reqLeft.length ? undefined : 15}
        ai={filled.some((f) => byAi(`spec:${f.key}`))} action={!enough && add(reqLeft.length ? `spec:${reqLeft[0]}` : 'details')}>
        {reqLeft.length ? <>{reqLeft.map((k) => ft.label(`spec:${k}`)).join(t('assistant.and'))}{muted(t('assistant.row.required'))}</>
          : filled.length ? <>{filled.slice(0, 3).map((f) => short(f.key)).join(' · ')}{muted(t('assistant.row.keyDetails', { n: coreIn, total: core.length }))}</>
            : t('props.typeDetails', { type: ft.value('type', d.type) })}
      </Row>,
    )
  }
  // amenities
  rows.push(
    <Row key="am" state={d.amenities.length ? 'done' : 'todo'} pts={5} ai={byAi('amenities')} action={!d.amenities.length && add('amenities')}>
      {d.amenities.length ? ft.value('amenities', d.amenities.slice(0, 3)) + (d.amenities.length > 3 ? ` +${d.amenities.length - 3}` : '') : ft.label('amenities')}
    </Row>,
  )
  // photos
  rows.push(
    <Row key="ph" state={d.photos ? 'done' : 'todo'} pts={10} action={!d.photos && add('photos', t('action.add'), <Paperclip />)}>
      {d.photos ? t('assistant.row.photos', { count: d.photos }) : t('assistant.row.photosNone')}
    </Row>,
  )
  // approvals and legal documents
  if (d.approvals.length) {
    const up = d.approvals.filter((a) => docs.uploaded.includes(a)).length
    rows.push(
      <Row key="legal" state={up === d.approvals.length ? 'done' : 'todo'} pts={10} action={up < d.approvals.length && add('legal', t('assistant.row.upload'), <Paperclip />)}>
        {d.approvals.map(ft.approval).join(', ')}{muted(t('assistant.row.docsOf', { n: up, count: d.approvals.length }))}
      </Row>,
    )
  } else rows.push(<Row key="legal" state={docs.any ? 'done' : 'todo'} pts={10} action={!docs.any && add('legal')}>{t('assistant.row.legal')}</Row>)

  const saveTitle = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = String(new FormData(e.currentTarget).get('title') ?? '').trim()
    if (v) onTitle(v)
    setEditing(false)
  }

  return (
    <section aria-label={t('assistant.summary')} className={cn('rounded-xl border bg-card p-4 shadow-card', className)}>
      <div className="flex items-start gap-3 border-b pb-3">
        <CompletionRing score={score} size={60} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveTitle} className="flex items-center gap-1.5">
              <Input name="title" autoFocus defaultValue={d.title} aria-label={t('assistant.titleLabel')} placeholder={t('assistant.titleLabel')}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} className="h-8 min-w-0 flex-1" />
              <Button type="submit" size="sm">{t('action.save')}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('action.cancel')}</Button>
            </form>
          ) : (
            <h2 className="flex items-start gap-1.5 text-base leading-snug font-semibold">
              <span className="min-w-0">{d.title || t('assistant.newProperty')}</span>
              {canWrite && d.title && (
                <button type="button" onClick={() => setEditing(true)} aria-label={t('props.changeTitle')} title={t('props.changeTitle')}
                  className="mt-0.5 shrink-0 rounded text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
              )}
            </h2>
          )}
          {!editing && d.title && d.sources?.title === 'ai' && (
            <p className="mt-0.5 flex items-center gap-1 text-meta text-muted-foreground"><Sparkles className="size-3 text-violet" /> {t('assistant.suggestedTitle')}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {status ? <PropertyStatusChip property={{ status }} />
              : submitted ? <StatusChip tone="info">{t('assistant.waiting')}</StatusChip> : <StatusChip tone="neutral" variant="outline">{t('status.draft')}</StatusChip>}
            {d.approvals.filter((a) => !docs.uploaded.includes(a)).map((a) => (
              <StatusChip key={a} tone="warning" icon={<TriangleAlert />} title={t('approvalState.pendingHint')}>{ft.approval(a)} · {t('approvalState.pending')}</StatusChip>
            ))}
          </div>
        </div>
      </div>

      <ul className="flex flex-col py-1">{rows}</ul>

      {missing.length ? (
        <p className="mb-3 text-sm text-danger">{t('assistant.needed', { list: missing.map((k) => ft.label(k, d.type)).join(', ') })}</p>
      ) : !status && (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> {t('assistant.allIn')}</p>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="w-full" onClick={onReview}>{t('drawer.review')}</Button>
        {footer ?? <Button size="lg" className="w-full" disabled={missing.length > 0 || !canWrite} onClick={onPublish}>{publishLabel}</Button>}
      </div>
    </section>
  )
}

/** One checklist row: ✓ done · ! required to publish · ○ optional, with the % it adds and a button. */
function Row({ state, ai, pts, action, children }: { state: 'done' | 'req' | 'todo'; ai?: boolean; pts?: number; action?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <li className="flex min-h-11 items-center gap-2.5 border-b border-dashed py-1.5 text-sm last:border-0">
      <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold',
        state === 'done' ? 'bg-success-soft text-success' : state === 'req' ? 'bg-danger-soft text-danger' : 'border text-muted-foreground')}>
        {state === 'done' ? <Check className="size-3" /> : state === 'req' ? '!' : ''}
      </span>
      <span className="sr-only">{t(`assistant.row.state.${state}`)}</span>
      <span className={cn('min-w-0 flex-1', state === 'req' && 'text-danger')}>
        {children}
        {ai && <span title={t('assistant.aiTagHint')} className="ml-1.5 inline-flex h-4 items-center rounded bg-violet-soft px-1 align-[1px] text-micro font-semibold text-violet">AI</span>}
      </span>
      {pts && state !== 'done' ? <span className="shrink-0 text-meta text-warning tabular-nums">+{pts}%</span> : null}
      {action}
    </li>
  )
}
