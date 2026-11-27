/** Property pills (DESIGN_SYSTEM §11.4): availability (dot + label), spec chips with icons, RERA tick, match label. */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import type { PropertyStatus } from '@/domain/types'
import type { MatchLabel } from '@/lib/matching'
import { ToneBadge } from '@/components/shared/badges'
import { propertyStatusTone, type Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'

export function AvailabilityPill({ status, overlay, className }: { status: PropertyStatus; overlay?: boolean; className?: string }) {
  const { t } = useTranslation('catalogue')
  const c = propertyStatusTone[status]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-meta font-medium', overlay ? 'bg-card/90 text-foreground shadow-sm backdrop-blur' : cn(c.soft, c.text), className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', c.solid)} />
      {t(`propertyStatus.${status}`)}
    </span>
  )
}

export function SpecChip({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-xs bg-muted px-1.5 text-meta font-medium whitespace-nowrap text-foreground/90 tabular-nums', className)}>
      {Icon && <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" strokeWidth={1.75} />}
      {children}
    </span>
  )
}

const LABEL_TONE: Record<MatchLabel, Tone> = { strong: 'success', good: 'primary', weak: 'neutral', conditional: 'warning', budgetMismatch: 'warning', excluded: 'danger' }
export function MatchLabelBadge({ label }: { label: MatchLabel }) {
  const { t } = useTranslation('matching')
  return <ToneBadge tone={LABEL_TONE[label]} variant="soft">{t(`label.${label}`)}</ToneBadge>
}
