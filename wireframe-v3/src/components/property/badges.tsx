import { BadgeCheck, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { useStore } from '@/store/db'
import { cn } from '@/lib/utils'
import type { MatchLabel } from '@/lib/matching'
import type { Property, PropertyStatus } from '@/data/types'

/* Tones are placeholders until the design system defines status colours as tokens. */
const STATUS_TONE: Record<PropertyStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-300 border-dashed',
  available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  negotiation: 'bg-violet-100 text-violet-800 border-violet-200',
  reserved: 'bg-sky-100 text-sky-800 border-sky-200',
  booked: 'bg-sky-100 text-sky-800 border-sky-200',
  onHold: 'bg-amber-100 text-amber-800 border-amber-200',
  sold: 'bg-zinc-200 text-zinc-700 border-zinc-300',
}

export function StatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className={cn(STATUS_TONE[status], className)}>
      {t(`status.${status}`)}
    </Badge>
  )
}

/** Approval badges: ✓ once the document is uploaded, ⚠ "document pending" until then. */
export function ApprovalBadges({ property, className }: { property: Property; className?: string }) {
  const { t } = useTranslation()
  const { db } = useStore()
  if (!property.approvals.length) return null
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {property.approvals.map((a) => {
        const type = db.settings.approvalTypes.find((x) => x.id === a.approvalId)
        const label = t(`approval.${a.approvalId}`, { defaultValue: type?.label ?? a.approvalId })
        return a.status === 'pending' ? (
          <Badge key={a.approvalId} variant="outline" className="border-amber-300 bg-amber-50 text-amber-800" title={t('approvalState.pendingHint')}>
            <TriangleAlert /> {label} · {t('approvalState.pending')}
          </Badge>
        ) : (
          <Badge key={a.approvalId} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <BadgeCheck /> {label}
          </Badge>
        )
      })}
    </span>
  )
}

const MATCH_TONE: Record<MatchLabel, string> = {
  strong: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  good: 'bg-sky-100 text-sky-800 border-sky-200',
  weak: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  conditional: 'bg-amber-100 text-amber-800 border-amber-200',
  budgetMismatch: 'bg-rose-100 text-rose-800 border-rose-200',
  excluded: 'bg-rose-100 text-rose-800 border-rose-200',
}

export function MatchBadge({ label, score }: { label: MatchLabel; score: number }) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className={MATCH_TONE[label]}>
      {t(`match.${label}`)} · {score}
    </Badge>
  )
}
