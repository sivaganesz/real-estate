/** Small pieces shared by the hub, the history and the summary: status badge, counts bar, file icon. */
import { useTranslation } from 'react-i18next'
import type { ImportJob } from '@/domain/types'
import { ToneBadge } from '@/components/shared/badges'
import { TONE } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { COUNT_KEYS, COUNT_TONE, JOB_STATUS_TONE } from '../lib/kinds'

export function JobStatusBadge({ status }: { status: ImportJob['status'] }) {
  const { t } = useTranslation('import')
  return <ToneBadge tone={JOB_STATUS_TONE[status]}>{t(`jobStatus.${status}`)}</ToneBadge>
}

/** A thin stacked bar of what happened to the rows, with an accessible summary. */
export function JobCountsBar({ counts, className }: { counts: ImportJob['counts']; className?: string }) {
  const { t } = useTranslation('import')
  const total = Math.max(1, counts.total)
  const label = COUNT_KEYS.filter((k) => counts[k]).map((k) => t(`count.${k}`, { count: counts[k] })).join(' · ')
  return (
    <div className={cn('flex min-w-24 flex-col gap-1', className)}>
      <div role="img" aria-label={label || t('count.none')} className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {COUNT_KEYS.map((k) => (counts[k] ? <span key={k} className={TONE[COUNT_TONE[k]].solid} style={{ width: `${(counts[k] / total) * 100}%` }} /> : null))}
      </div>
      <span className="truncate text-meta text-muted-foreground tabular-nums">{label || t('count.none')}</span>
    </div>
  )
}
