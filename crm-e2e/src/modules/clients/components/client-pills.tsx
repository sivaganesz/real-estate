/** Client status pill (journey colour + dot + word) and the five-step journey bar used in the list and the page. */
import { useTranslation } from 'react-i18next'
import { DotBadge } from '@/components/shared/badges'
import type { Client } from '@/domain/types'
import { TONE, stageTone, type ToneClasses } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { CLIENT_FLOW, flowStep } from '../lib/client-queries'

const STATUS_TONE: Record<Client['status'], ToneClasses> = {
  booked: stageTone.booked,
  agreement: stageTone.negotiation,
  loanProcessing: TONE.warning,
  registered: TONE.info,
  converted: stageTone.converted,
  cancelled: stageTone.lost,
}

export function ClientStatusPill({ status, className }: { status: Client['status']; className?: string }) {
  const { t } = useTranslation('clients')
  return <DotBadge classes={STATUS_TONE[status]} className={className}>{t(`status.${status}`)}</DotBadge>
}

export function JourneyBar({ status, className }: { status: Client['status']; className?: string }) {
  const { t } = useTranslation('clients')
  const step = flowStep(status)
  return (
    <span role="img" aria-label={t('journey.aria', { step: step + 1, total: CLIENT_FLOW.length, status: t(`status.${status}`) })} className={cn('flex gap-0.5', className)}>
      {CLIENT_FLOW.map((s, i) => (
        <span key={s} className={cn('h-1.5 flex-1 rounded-full', status === 'cancelled' ? 'bg-danger/30' : i <= step ? STATUS_TONE[status].solid : 'bg-muted')} />
      ))}
    </span>
  )
}
