/**
 * Price check (ported in behaviour from wireframe-rebuild tabs/price-tab.tsx over lib/property.priceCheck): this listing's
 * ₹/sq ft on a scale of similar listings (same type and city, ±25% area, last 12 months), neutral wording only, the
 * comparables, and the all-in cost with stamp duty and registration from Settings.
 */
import { Scale } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { SectionCard } from '@/components/shared/section-card'
import { ToneBadge } from '@/components/shared/badges'
import type { Property } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { inr, inrShort, num } from '@/lib/format'
import { priceCheck } from '@/lib/property'

export function PriceCheckCard({ p }: { p: Property }) {
  const { t } = useTranslation('properties')
  const db = useWholeDb()
  const now = useNow()
  const pc = useMemo(() => priceCheck(p, db, now), [p, db, now])
  const lo = pc.min !== undefined && pc.pricePerSqft ? Math.min(pc.min, pc.pricePerSqft) : 0
  const hi = pc.max !== undefined && pc.pricePerSqft ? Math.max(pc.max, pc.pricePerSqft) : 0
  const pos = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50)
  return (
    <SectionCard title={t('price.title')} icon={Scale} description={t('price.subtitle')} data-testid="price-check">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-kpi font-[650] tabular-nums">{pc.pricePerSqft ? `₹${num(pc.pricePerSqft)}` : '–'}</span>
          <span className="text-meta text-muted-foreground">{t('price.perSqft')}</span>
          {pc.position && <ToneBadge tone={pc.position === 'within' ? 'success' : 'warning'}>{t(`price.position.${pc.position}`)}</ToneBadge>}
        </div>
        {pc.count > 0 && pc.pricePerSqft && pc.min !== undefined && pc.max !== undefined && pc.avg !== undefined ? (
          <div className="flex flex-col gap-1.5" role="img" aria-label={t('price.scaleLabel', { min: num(pc.min), avg: num(pc.avg), max: num(pc.max), you: num(pc.pricePerSqft) })}>
            <div className="relative h-2.5 rounded-full bg-muted">
              <span className="absolute inset-y-0 rounded-full bg-primary-soft" style={{ left: `${pos(pc.min)}%`, right: `${100 - pos(pc.max)}%` }} />
              <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-muted-foreground" style={{ left: `${pos(pc.avg)}%` }} />
              <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm" style={{ left: `${pos(pc.pricePerSqft)}%` }} />
            </div>
            <div className="flex justify-between text-micro text-muted-foreground tabular-nums">
              <span>{t('price.min', { v: num(pc.min) })}</span>
              <span>{t('price.avg', { v: num(pc.avg) })}</span>
              <span>{t('price.max', { v: num(pc.max) })}</span>
            </div>
            <p className="text-meta text-muted-foreground">{t('price.basedOn', { count: pc.count })}{pc.soldAvg ? ` · ${t('price.soldAvg', { v: num(pc.soldAvg) })}` : ''}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('price.noComparables')}</p>
        )}
        {pc.comparables.length > 0 && (
          <ul className="flex flex-col divide-y rounded-md border">
            {pc.comparables.slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Link to={paths.property(c.id)} className="min-w-0 flex-1 truncate font-medium hover:underline">{c.title}</Link>
                <span className="text-meta text-muted-foreground max-sm:hidden">{c.locality}</span>
                <span className="tabular-nums">₹{num(c.pricePerSqft)}</span>
                <ToneBadge tone={c.kind === 'transaction' ? 'info' : 'neutral'}>{t(`price.kind.${c.kind}`)}</ToneBadge>
              </li>
            ))}
          </ul>
        )}
        {p.price > 0 && p.purpose === 'sale' && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-muted/60 p-3 text-meta sm:grid-cols-4">
            <div><dt className="text-muted-foreground">{t('price.stampDuty')}</dt><dd className="font-semibold tabular-nums">{inrShort(pc.costs.stampDuty)}</dd></div>
            <div><dt className="text-muted-foreground">{t('price.registration')}</dt><dd className="font-semibold tabular-nums">{inrShort(pc.costs.registration)}</dd></div>
            <div><dt className="text-muted-foreground">{t('price.other')}</dt><dd className="font-semibold tabular-nums">{inrShort(pc.costs.other)}</dd></div>
            <div><dt className="text-muted-foreground">{t('price.allIn', { pct: pc.costs.pct })}</dt><dd className="font-semibold tabular-nums" title={inr(pc.allIn)}>{inrShort(pc.allIn)}</dd></div>
          </dl>
        )}
      </div>
    </SectionCard>
  )
}
