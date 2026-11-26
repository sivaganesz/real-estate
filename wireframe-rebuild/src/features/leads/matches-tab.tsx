/**
 * The lead's Matches tab: properties that pass the hard filters, best first, with what to do about each (recommend, share,
 * book a visit). "Why 95?" opens the score's breakdown — the five parts and their weights (spec, Matching:
 * M = 0.30B + 0.25L + 0.20S + 0.15A + 0.10P) — and the reasons. Below, "Not shown" lists every property the hard filters
 * left out and why, so nobody wonders whether a listing was missed; the ones that miss on price alone come first.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, Check, ChevronDown, Share2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/app/empty-state'
import { StatusChip } from '@/components/app/status-chip'
import { toneFill, toneText } from '@/components/app/tone'
import { Button } from '@/components/ui/button'
import type { Lead } from '@/data/types'
import { inrShort } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { excludedForLead, MATCH_PARTS, type Match } from '@/lib/matching'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'
import { MATCH_TONE, PropertyPhoto } from '../properties/components/property-bits'

export function MatchesTab({ l, matches, onBook }: { l: Lead; matches: Match[]; onBook: (propertyId: string) => void }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { db, recommendProperty } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const left = excludedForLead(l, db.properties, db.settings)
  return (
    <div className="flex flex-col gap-5">
      {matches.length ? (
        <>
          <p className="text-sm text-muted-foreground">{t('lead.matches.lead', { count: matches.length })}</p>
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {matches.slice(0, 9).map((m) => {
              const p = m.property
              const rec = l.recommendedPropertyIds.includes(p.id)
              return (
                <li key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                  <Link to={`/properties/${p.id}`} className="relative block h-32 overflow-hidden bg-muted">
                    <PropertyPhoto type={p.type} media={p.media.find((x) => x.isCover) ?? p.media[0]} alt={p.title} className="size-full" />
                    <span className="absolute top-2 right-2 rounded-full bg-card/95 px-2 py-0.5 text-sm font-semibold shadow-sm">
                      <span className={toneText[MATCH_TONE[m.label]]}>{m.score}</span> <span className="text-xs font-normal text-muted-foreground">{t(`match.${m.label}`)}</span>
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                    <Link to={`/properties/${p.id}`} className="truncate font-semibold hover:underline">{p.title}</Link>
                    <p className="truncate text-muted-foreground">{inrShort(p.price)} · {L.type(p.type)} · {p.location.locality}</p>
                    <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}
                      className="flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline">
                      {open === p.id ? t('props.match.hideWhy') : t('props.match.why', { score: m.score })}
                      <ChevronDown className={cn('size-3 transition-transform', open === p.id && 'rotate-180')} />
                    </button>
                    {open === p.id && <Breakdown m={m} />}
                  </div>
                  <div className="flex gap-1.5 border-t p-2.5">
                    <Button size="sm" variant={rec ? 'secondary' : 'outline'} className="flex-1" onClick={() => { recommendProperty(p.id, l.id, !rec); toast.success(t(rec ? 'props.match.unrecommended' : 'props.match.recommended', { name: l.name })) }}>
                      <Check /> {rec ? t('props.match.isRecommended') : t('props.match.recommend')}
                    </Button>
                    <Button size="icon-sm" variant="outline" className="size-8" asChild title={t('lead.shareBrochure')}><Link to={`/properties/${p.id}/share?lead=${l.id}`}><Share2 /></Link></Button>
                    <Button size="icon-sm" variant="outline" className="size-8" title={t('lead.bookVisit')} onClick={() => onBook(p.id)}><CalendarPlus /></Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      ) : <EmptyState title={t('lead.noMatches')}>{t('lead.noMatchesHint')}</EmptyState>}

      {left.length > 0 && <NotShown l={l} left={left} />}
    </div>
  )
}

/** The score, part by part: each part 0–100, its weight, and the points it adds. Then the reasons, for and against. */
function Breakdown({ m }: { m: Match }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const w = db.settings.matchWeights
  const tone = MATCH_TONE[m.label]
  return (
    <div className="mt-1 flex flex-col gap-2.5 rounded-lg bg-muted/40 p-2.5">
      <table className="w-full text-xs">
        <caption className="sr-only">{t('lead.matches.breakdown')}</caption>
        <tbody>
          {MATCH_PARTS.map((k) => (
            <tr key={k}>
              <th scope="row" className="w-24 py-0.5 pr-2 text-left font-normal text-muted-foreground">{t(`lead.matches.part.${k}`)}</th>
              <td className="py-0.5">
                <span className="block h-1.5 overflow-hidden rounded-full bg-muted" title={`${m.parts[k]}/100`}>
                  <span className={cn('block h-full rounded-full', toneFill[tone])} style={{ width: `${m.parts[k]}%` }} />
                </span>
              </td>
              <td className="w-16 py-0.5 pl-2 text-right text-muted-foreground tabular-nums">× {Math.round(w[k] * 100)}%</td>
              <td className="w-9 py-0.5 text-right font-semibold tabular-nums">{Math.round(w[k] * m.parts[k])}</td>
            </tr>
          ))}
          <tr className="border-t">
            <th scope="row" colSpan={3} className="pt-1 text-left font-medium">{t('lead.matches.total')}</th>
            <td className={cn('pt-1 text-right font-bold tabular-nums', toneText[tone])}>{m.score}</td>
          </tr>
        </tbody>
      </table>
      <ul className="flex flex-wrap gap-1">
        {m.reasons.map((r, i) => (
          <li key={i}>
            <StatusChip tone={r.ok === null ? 'warning' : r.ok ? 'success' : 'danger'} icon={r.ok ? <Check /> : r.ok === false ? <X /> : undefined} className="h-auto py-0.5 whitespace-normal">
              {t(`reason.${r.key}`, { ...r.values })}
            </StatusChip>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Every property the hard filters left out, with the reason — collapsed until asked for. */
function NotShown({ l, left }: { l: Lead; left: Match[] }) {
  const { t } = useTranslation()
  const L = useLabels()
  const [open, setOpen] = useState(false)
  // how many fail on each filter (a property can fail several)
  const counts = (['fail_budget', 'fail_city', 'fail_type', 'fail_available'] as const)
    .map((k) => ({ k, n: left.filter((m) => m.reasons.some((r) => r.key === k)).length })).filter((x) => x.n)
  return (
    <section className="rounded-xl border border-dashed">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-muted/40">
        <span className="font-medium">{t('lead.matches.notShown', { count: left.length })}</span>
        <span className="flex flex-wrap gap-1">
          {counts.map((c) => <StatusChip key={c.k} tone="neutral" variant="outline">{t(`reason.${c.k}`)} · {c.n}</StatusChip>)}
        </span>
        <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t px-4 pt-2 pb-3">
          <p className="mb-2 text-xs text-muted-foreground">{t('lead.matches.notShownHint')}</p>
          <ul className="divide-y text-sm">
            {left.map((m) => {
              const p = m.property
              const priceOnly = m.label === 'budgetMismatch'
              const over = p.price - m.ceiling
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 flex-1 basis-56">
                    <Link to={`/properties/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                    <span className="block text-xs text-muted-foreground">{p.id} · {inrShort(p.price)} · {L.type(p.type)} · {p.location.locality}, {p.location.city}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {priceOnly
                      ? <StatusChip tone={over <= m.ceiling * 0.15 ? 'warning' : 'neutral'} variant={over <= m.ceiling * 0.15 ? 'soft' : 'outline'}>{t('lead.matches.overBy', { amount: inrShort(over), pct: Math.round((over / m.ceiling) * 100) })}</StatusChip>
                      : m.reasons.map((r) => <StatusChip key={r.key} tone="neutral" variant="outline">{t(`reason.${r.key}`)}</StatusChip>)}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t('lead.matches.rule', { name: l.name })}</p>
        </div>
      )}
    </section>
  )
}
