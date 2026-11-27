/** Legal and approvals: RERA (verified or not), each authority with its document status, khata / patta, bank approvals, loan. */
import { BadgeCheck, CircleDashed, FileCheck2, FileClock, Landmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ToneBadge } from '@/components/shared/badges'
import { SectionCard } from '@/components/shared/section-card'
import type { Property } from '@/domain/types'
import type { Tone } from '@/lib/tones'

const DOC_TONE: Record<Property['approvals'][number]['docStatus'], Tone> = { pending: 'warning', uploaded: 'info', verified: 'success' }

export function LegalCard({ p }: { p: Property }) {
  const { t } = useTranslation('properties')
  const nothing = !p.rera && !p.approvals.length && !p.khata && !p.pattaAvailable && !p.bankApprovals.length && p.loanEligible === undefined
  return (
    <SectionCard title={t('legal.title')} icon={Landmark} data-testid="legal-card">
      {nothing ? <p className="text-sm text-muted-foreground">{t('legal.none')}</p> : (
        <div className="flex flex-col gap-3">
          {p.rera && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{t('legal.rera')}</span>
              <span className="min-w-0 truncate font-mono text-meta">{p.rera.number}</span>
              <ToneBadge tone={p.rera.verified ? 'success' : 'warning'} icon={p.rera.verified ? BadgeCheck : CircleDashed}>{p.rera.verified ? t('legal.verified') : t('legal.notVerified')}</ToneBadge>
            </div>
          )}
          {p.approvals.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {p.approvals.map((a) => (
                <li key={a.authority} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  {a.docStatus === 'pending' ? <FileClock className="size-4 text-warning" aria-hidden="true" /> : <FileCheck2 className="size-4 text-success" aria-hidden="true" />}
                  <span className="flex-1 font-medium">{t('legal.approvedBy', { authority: a.authority })}</span>
                  <ToneBadge tone={DOC_TONE[a.docStatus]}>{t(`docStatus.${a.docStatus}`)}</ToneBadge>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            {p.khata && <ToneBadge tone="primary">{t('form.khataValue', { k: p.khata })}</ToneBadge>}
            {p.pattaAvailable && <ToneBadge tone="primary">{t('legal.patta')}</ToneBadge>}
            {p.loanEligible && <ToneBadge tone="success">{t('legal.loanEligible')}</ToneBadge>}
            {p.bankApprovals.map((b) => <ToneBadge key={b} tone="neutral">{b}</ToneBadge>)}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
