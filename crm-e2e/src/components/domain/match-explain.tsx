/** Why a property matches a lead: the percentage, the label, ✓ reasons, ✗ gaps and amber notes (lib/matching reasons, i18n). */
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { matchSummary, reasonText, type Match } from '@/lib/matching'
import { MatchLabelBadge } from './property-pills'

export function MatchExplain({ match }: { match: Match }) {
  const { t } = useTranslation(['matching', 'domain'])
  const s = matchSummary(match)
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold tabular-nums">{t('domain:property.matchPct', { pct: Math.round(match.score) })}</span>
        <MatchLabelBadge label={match.label} />
      </div>
      <ul className="flex flex-col gap-1">
        {s.good.map((r) => <li key={r.key} className="flex items-start gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-label={t('domain:property.ok')} />{reasonText(r, t)}</li>)}
        {s.missing.map((r) => <li key={r.key} className="flex items-start gap-1.5"><X className="mt-0.5 size-3.5 shrink-0 text-danger" aria-label={t('domain:property.missing')} />{reasonText(r, t)}</li>)}
        {s.notes.map((r) => <li key={r.key} className="flex items-start gap-1.5 text-warning"><span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />{reasonText(r, t)}</li>)}
      </ul>
    </div>
  )
}
