/**
 * Listing health and the "find missing data" checklist (lib/property.listingScore + missingRequired + attentionFor),
 * and the AI listing copy: a title and description written only from the record's facts, shown with the Demo AI badge;
 * nothing changes until the user clicks "Use title" / "Use description".
 */
import { useState } from 'react'
import { CheckCircle2, Circle, ClipboardCheck, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { ProgressRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import type { Property } from '@/domain/types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { listingScore, missingRequired, propertyCopy, type Attention } from '@/lib/property'
import { scoreTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { updateProperty } from '@/services/properties'

export function ListingHealthCard({ p, attention, editable }: { p: Property; attention: Attention[]; editable: boolean }) {
  const { t } = useTranslation('properties')
  const sc = listingScore(p)
  const required = missingRequired(p)
  return (
    <SectionCard title={t('health.title')} icon={ClipboardCheck} data-testid="listing-health">
      <div className="flex items-center gap-3">
        <ProgressRing value={sc.score} size={56} tone={scoreTone(sc.score)} label={t('health.ringLabel', { score: sc.score })} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{sc.score >= 80 ? t('health.good') : t('health.needsWork')}</p>
          <p className="text-meta text-muted-foreground">{t('health.line', { score: sc.score })}</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5" aria-label={t('health.checklist')}>
        {sc.items.map((i) => {
          const done = i.points >= i.max
          return (
            <li key={i.key} className="flex items-start gap-2 text-sm">
              {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />}
              <span className={cn('min-w-0 flex-1', done && 'text-muted-foreground')}>
                {t(`health.item.${i.key}`)}
                {!done && i.missing && i.missing.length > 0 && <span className="block text-meta text-muted-foreground">{t('health.missingList', { list: i.missing.map((k) => t(`catalogue:spec.${k}`, { defaultValue: t(`field.${k}`, { defaultValue: k }) })).join(', ') })}</span>}
              </span>
              <span className="text-meta text-muted-foreground tabular-nums">{i.points}/{i.max}</span>
            </li>
          )
        })}
      </ul>
      {(required.length > 0 || attention.length > 0) && (
        <ul className="mt-3 flex flex-col gap-1 rounded-md bg-warning-soft px-3 py-2 text-meta text-warning">
          {required.map((k) => <li key={k}>{t('health.required', { field: t(`field.${k}`) })}</li>)}
          {attention.map((a) => <li key={a.key}>{t(`attention.${a.key}`, { ...a.values, context: a.key === 'price' ? String(a.values?.dir) : undefined })}</li>)}
        </ul>
      )}
      {editable && sc.score < 100 && (
        <Button asChild variant="secondary" size="sm" className="mt-3"><Link to={paths.editProperty(p.id)}>{t('health.fill')}</Link></Button>
      )}
    </SectionCard>
  )
}

export function ListingCopyCard({ p, editable }: { p: Property; editable: boolean }) {
  const { t } = useTranslation('properties')
  const reduced = useReducedMotion()
  const [busy, setBusy] = useState(false)
  const [copy, setCopy] = useState<ReturnType<typeof propertyCopy> | null>(null)
  const generate = () => {
    setBusy(true)
    // the simulated AI "thinks" briefly so the user sees a result arrive, as with every other AI action
    window.setTimeout(() => { setCopy(propertyCopy(p)); setBusy(false) }, reduced ? 0 : 400)
  }
  const use = (field: 'title' | 'description') => {
    if (!copy) return
    try {
      const { undoToken } = updateProperty(p.id, { [field]: copy[field] }, { via: 'ai', fieldMeta: { [field]: { origin: 'ai', confidence: 0.8 } }, undoable: true })
      toastUndo(t(field === 'title' ? 'copy.titleUsed' : 'copy.descriptionUsed'), undoToken)
    } catch (e) { toastError(e) }
  }
  const copyText = async () => {
    if (!copy) return
    try {
      await navigator.clipboard.writeText(`${copy.title}\n\n${copy.description}`)
      toast.success(t('copy.copied'))
    } catch { toast.error(t('copy.copyFailed')) }
  }
  return (
    <SectionCard
      title={t('copy.title')} icon={Sparkles} data-testid="listing-copy"
      action={<DemoAIBadge mode="simulated" />}
      className="border-ai-border/60"
    >
      <p className="text-meta text-muted-foreground">{t('copy.body')}</p>
      {copy && (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-ai-border/60 bg-ai-soft/30 p-3" aria-live="polite">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="text-sm text-foreground/85">{copy.description}</p>
          <p className="text-micro text-ai">{t('copy.basedOn', { count: copy.facts })}</p>
          <div className="flex flex-wrap gap-1.5">
            {editable && <Button size="sm" variant="secondary" onClick={() => use('title')} disabled={copy.title === p.title}>{t('copy.useTitle')}</Button>}
            {editable && <Button size="sm" variant="secondary" onClick={() => use('description')} disabled={copy.description === p.description}>{t('copy.useDescription')}</Button>}
            <Button size="sm" variant="ghost" onClick={() => void copyText()}>{t('copy.copy')}</Button>
          </div>
        </div>
      )}
      <Button variant="ai" size="sm" className="mt-3" onClick={generate} disabled={busy} aria-busy={busy || undefined} data-testid="listing-copy-generate">
        {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}{copy ? t('copy.again') : t('copy.generate')}
      </Button>
    </SectionCard>
  )
}
