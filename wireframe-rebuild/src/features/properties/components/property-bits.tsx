/**
 * Small property building blocks used across the list, the property page and the share panel:
 * the status chip, the approval chips, the photo (or its placeholder), and the completion ring.
 */
import { Building2, Factory, House, LandPlot, Store, Tractor, TriangleAlert, BadgeCheck, Archive, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Meter } from '@/components/app/meter'
import { StatusChip } from '@/components/app/status-chip'
import { type Tone, toneSoft, toneText } from '@/components/app/tone'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'
import type { Media, Property, PropertyStatus, PropertyTypeKey } from '@/data/types'
import type { MatchLabel } from '@/lib/matching'

export const STATUS_TONE: Record<PropertyStatus, Tone> = {
  draft: 'neutral', available: 'success', negotiation: 'violet', reserved: 'info', booked: 'info', onHold: 'warning', sold: 'neutral',
}
export const MATCH_TONE: Record<MatchLabel, Tone> = {
  strong: 'success', good: 'info', weak: 'neutral', conditional: 'warning', budgetMismatch: 'danger', excluded: 'danger',
}

export function PropertyStatusChip({ property: p, className }: { property: Pick<Property, 'status' | 'archived'>; className?: string }) {
  const { t } = useTranslation()
  if (p.archived) return <StatusChip tone="neutral" variant="outline" icon={<Archive />} className={className}>{t('props.archived')}</StatusChip>
  return (
    <StatusChip tone={STATUS_TONE[p.status]} variant={p.status === 'draft' ? 'outline' : 'soft'} className={className}>
      {t(`status.${p.status}`)}
    </StatusChip>
  )
}

/** Approval badges: ✓ once the document is uploaded (verified or not), ⚠ "document pending" until then. */
export function ApprovalChips({ property, className }: { property: Property; className?: string }) {
  const { t } = useTranslation()
  const { db } = useStore()
  if (!property.approvals.length) return null
  return (
    <span className={cn('inline-flex flex-wrap gap-1.5', className)}>
      {property.approvals.map((a) => {
        const label = t(`approval.${a.approvalId}`, { defaultValue: db.settings.approvalTypes.find((x) => x.id === a.approvalId)?.label ?? a.approvalId })
        return a.status === 'pending'
          ? <StatusChip key={a.approvalId} tone="warning" icon={<TriangleAlert />} title={t('approvalState.pendingHint')}>{label} · {t('approvalState.pending')}</StatusChip>
          : <StatusChip key={a.approvalId} tone="info" icon={a.status === 'verified' ? <BadgeCheck /> : undefined}>{label}</StatusChip>
      })}
    </span>
  )
}

/* ---------- photos ---------- */

const TYPE_LOOK: Record<PropertyTypeKey, { icon: LucideIcon; tone: Tone }> = {
  plot: { icon: LandPlot, tone: 'success' },
  flat: { icon: Building2, tone: 'info' },
  house: { icon: House, tone: 'warning' },
  commercial: { icon: Store, tone: 'violet' },
  agri: { icon: Tractor, tone: 'success' },
  industrial: { icon: Factory, tone: 'neutral' },
}
export const typeIcon = (t: PropertyTypeKey) => TYPE_LOOK[t].icon

/** A property photo. With no photo, or one that fails to load, it draws a soft placeholder with the type's icon. */
export function PropertyPhoto({ type, media, alt, className, iconClassName }: {
  type: PropertyTypeKey; media?: Media; alt: string; className?: string; iconClassName?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  if (media?.url && failed !== media.url) {
    return <img src={media.url} alt={alt} loading="lazy" onError={() => setFailed(media.url)} className={cn('object-cover', className)} />
  }
  const { icon: Icon, tone } = TYPE_LOOK[type]
  return (
    <div role="img" aria-label={alt} className={cn('flex items-center justify-center', toneSoft[tone], className)}>
      <Icon className={cn('size-10 opacity-50', toneText[tone], iconClassName)} strokeWidth={1.25} />
    </div>
  )
}

/* ---------- completion ---------- */

/** The listing's completion score as a ring, coloured by how far along it is. */
/** A listing's completion colour: green from 80%, amber from 50%, red below. */
const scoreTone = (score: number): Tone => (score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger')

/** A thin bar with the % beside it: the table's compact form of the completion ring. */
export function CompletionBar({ score, className }: { score: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Meter value={score} tone={scoreTone(score)} label={t('props.complete', { pct: score })} className="w-14" />
      <span aria-hidden className="w-8 text-right text-meta tabular-nums">{score}%</span>
    </span>
  )
}

/** The card's smallest form: a coloured dot and the %, in the same colours as the ring and the bar. */
export function CompletionPill({ score, className }: { score: number; className?: string }) {
  const { t } = useTranslation()
  const tone = scoreTone(score)
  return (
    <span title={t('props.complete', { pct: score })} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold tabular-nums', toneSoft[tone], toneText[tone], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />{score}%<span className="sr-only"> {t('props.complete', { pct: score })}</span>
    </span>
  )
}

export function CompletionRing({ score, size = 40, className }: { score: number; size?: number; className?: string }) {
  const { t } = useTranslation()
  const stroke = size > 50 ? 7 : 4
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const tone = scoreTone(score)
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}
      role="img" aria-label={t('props.complete', { pct: score })}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className={cn('transition-[stroke-dashoffset]', toneStroke[tone])} />
      </svg>
      {/* the % is sized to fit the ring, so it stays outside the type scale */}
      {/* three digits ("100%") take a size smaller to stay inside the ring */}
      <span className={cn('absolute tabular-nums', size > 50 ? (score >= 100 ? 'text-[0.8125rem] font-medium tracking-tight' : 'text-[0.9375rem] font-medium')
        : score >= 100 ? 'text-[0.5625rem] tracking-tighter' : 'text-[0.6563rem] tracking-tight')}>{score}%</span>
    </span>
  )
}
const toneStroke: Record<Tone, string> = {
  neutral: 'stroke-neutral', primary: 'stroke-primary', success: 'stroke-success', warning: 'stroke-warning', danger: 'stroke-danger', info: 'stroke-info', violet: 'stroke-violet',
}

/** The property type's icon as a component (so screens don't pick a component during render). */
export function TypeIcon({ type, className }: { type: PropertyTypeKey; className?: string }) {
  const Icon = TYPE_LOOK[type].icon
  return <Icon className={className} aria-hidden />
}
