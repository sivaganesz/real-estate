/**
 * Matching customers — who should hear about this property, why, and what to do next (spec-system-wireframe propMatches).
 * Same matching rules as the lead pages. Recommend = the buyer was told (call, WhatsApp, in person): it's logged on their
 * timeline and moves the lead on. Booking a visit comes with the Appointments section. Readiness ("ready to buy") is the
 * lead's 100-point purchase-readiness score, kept separate from the fit score.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, Check, MessageSquareText, TriangleAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/app/callout'
import { Segmented } from '@/components/app/segmented'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import { toneText } from '@/components/app/tone'
import { UserAvatar } from '@/components/app/user-avatar'
import { inrShort, num } from '@/lib/format'
import { closeOnBudget, leadsForProperty, type Match, type MatchLabel } from '@/lib/matching'
import { isOnOffer } from '@/lib/property'
import { BAND_TONE, readiness } from '@/lib/readiness'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import type { Property } from '@/data/types'
import { MATCH_TONE } from '../components/property-bits'
import { pitchFor, type Point } from '../pitch'

export function MatchingTab({ p }: { p: Property }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const leads = useVisibleLeads()
  const [sort, setSort] = useState<'fit' | 'ready'>('fit')
  const live = isOnOffer(p)
  const list = useMemo(() => {
    const m = leadsForProperty(p, leads, db.settings).map((x) => ({ ...x, ready: readiness(x.lead, db) }))
    return sort === 'ready' ? [...m].sort((a, b) => b.ready.total - a.ready.total || b.score - a.score) : m
  }, [p, leads, db, sort])
  const close = useMemo(() => closeOnBudget(p, leads, db.settings), [p, leads, db.settings])
  const count = (l: MatchLabel) => list.filter((m) => m.label === l).length
  const purposes = [...new Set(list.map((m) => m.lead.purpose).filter(Boolean))] as string[]

  if (!live) return <Callout tone="warning">{t('props.match.notOffered', { status: p.archived ? t('props.archived').toLowerCase() : t(`status.${p.status}`).toLowerCase() })}</Callout>

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title={list.length ? t('props.match.title', { count: list.length }) : t('props.match.none')}
        action={list.length > 1 && <Segmented variant="pill" label={t('sort.label')} value={sort} onChange={setSort}
          segments={[{ value: 'fit', label: t('props.match.bestFit') }, { value: 'ready', label: t('props.match.mostReady') }]} />}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {(['strong', 'good', 'weak', 'conditional'] as MatchLabel[]).filter(count).map((l) => (
            <StatusChip key={l} tone={MATCH_TONE[l]}>{t('props.match.count', { count: count(l), label: t(`match.${l}`).toLowerCase() })}</StatusChip>
          ))}
          {close.length > 0 && <StatusChip tone="neutral" variant="outline">{t('props.match.closeCount', { count: close.length })}</StatusChip>}
          {purposes.length > 0 && <span className="text-sm text-muted-foreground">{purposes.map((x) => `${list.filter((m) => m.lead.purpose === x).length} ${t(`purpose.buyer.${x}`).toLowerCase()}`).join(' · ')}</span>}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t('props.match.rule')}</p>
        {list.length ? (
          <ul className="flex flex-col gap-2">{list.map((m) => <BuyerCard key={m.lead.id} m={m} ready={m.ready} p={p} />)}</ul>
        ) : <p className="text-sm text-muted-foreground">{t('props.match.noneHint')}</p>}
      </SectionCard>

      {close.length > 0 && (
        <SectionCard title={t('props.match.closeTitle')} description={t('props.match.closeHint')}>
          <ul className="flex flex-col divide-y">
            {close.map((m) => {
              const gap = p.price - m.lead.budget.max
              return (
                <li key={m.lead.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <UserAvatar name={m.lead.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2"><Link to={`/leads/${m.lead.id}`} className="font-medium text-primary hover:underline">{m.lead.name}</Link> <StatusChip tone="neutral">{t(`stage.${m.lead.stage}`)}</StatusChip></p>
                    <p className="text-xs text-muted-foreground">
                      {t('share.budgetUpTo', { amount: inrShort(m.lead.budget.max) })}{m.lead.budget.flexPct ? ` (${t('props.match.flexible', { pct: m.lead.budget.flexPct })})` : ''} ·{' '}
                      <span className="font-medium text-warning">{t('props.match.over', { amount: inrShort(gap), pct: Math.round((gap / m.lead.budget.max) * 100) })}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" asChild><Link to={`/leads/${m.lead.id}`}>{t('props.match.openLead')} →</Link></Button>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}

function BuyerCard({ m, ready, p }: { m: Match; ready: ReturnType<typeof readiness>; p: Property }) {
  const { t } = useTranslation()
  const { db, recommendProperty } = useStore()
  const can = useCan()
  const [open, setOpen] = useState(false)
  const l = m.lead
  const recommended = l.recommendedPropertyIds.includes(p.id)
  const visit = l.visits.filter((v) => v.propertyId === p.id && v.status === 'scheduled')[0]
  const points = pitchFor(l, p, db)
  const want = [l.requirement.sizeSqft ? `${num(l.requirement.sizeSqft)} sq.ft.` : '', `${t('props.match.in')} ${(l.requirement.localities.length ? l.requirement.localities.slice(0, 2) : l.requirement.cities).join(', ')}`].filter(Boolean).join(' ')
  const warnings = m.reasons.filter((r) => r.ok === null)
  const say = (pt: Point) => {
    const v = { ...pt.values }
    if (pt.key === 'pitch.place') v.place = t(`place.${v.place}`)
    if (pt.key === 'pitch.approvals') v.list = String(v.list).split(',').map((a) => t(`approval.${a}`, { defaultValue: a })).join(' + ')
    if (pt.key === 'pitch.upcoming') {
      const status = t(`infra.${v.status}`)
      return String(v.name).toLowerCase().includes(String(status).toLowerCase()) ? `${v.name} ~${v.km} km` : t(pt.key, { ...v, status })
    }
    return t(pt.key, v)
  }
  const toggle = () => {
    recommendProperty(p.id, l.id, !recommended)
    toast.success(t(recommended ? 'props.match.unrecommended' : 'props.match.recommended', { name: l.name }), { description: recommended ? undefined : t('share.logged') })
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        <UserAvatar name={l.name} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/leads/${l.id}`} className="font-medium text-primary hover:underline">{l.name}</Link>
            {l.purpose && <StatusChip tone="neutral" variant="outline" title={l.purposeNote}>{t(`purpose.buyer.${l.purpose}`)}</StatusChip>}
            <span className="text-sm text-muted-foreground">
              {t(`stage.${l.stage}`)} · {t('props.match.readyToBuy')} <b className={toneText[BAND_TONE[ready.band]]} title={t(`readiness.${ready.band}`)}>{ready.total}</b>
            </span>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {inrShort(l.budget.min)} – {inrShort(l.budget.max)} · {want}{can('lead.seeAll') && l.ownerId ? ` · ${userName(db, l.ownerId)}` : ''}
          </p>
          {points.length > 0 && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm" title={t('props.match.sayTitle', { name: l.name.split(' ')[0] })}>
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> <span>{points.map(say).join(' · ')}</span>
            </p>
          )}
          {warnings.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {warnings.map((w) => <StatusChip key={w.key} tone="warning" icon={<TriangleAlert />} className="h-auto py-0.5 whitespace-normal">{t(`reason.${w.key}`, { ...w.values, list: String(w.values?.list ?? '').split(',').filter(Boolean).map((a) => t(`approval.${a}`, { defaultValue: a })).join(', ') })}</StatusChip>)}
            </p>
          )}
          {open && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {m.reasons.filter((r) => r.ok !== null).map((r, i) => (
                <li key={i}><StatusChip tone={r.ok ? 'success' : 'danger'} icon={r.ok ? <Check /> : <X />}>{t(`reason.${r.key}`, { ...r.values })}</StatusChip></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-12 sm:flex-col sm:items-end sm:pl-0">
        <p className="flex items-baseline gap-1.5">
          <span className={cn('text-2xl font-semibold tabular-nums', toneText[MATCH_TONE[m.label]])}>{m.score}</span>
          <span className="text-sm text-muted-foreground">{t(`match.long.${m.label}`)}</span>
        </p>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm text-primary hover:underline">
          {open ? t('props.match.hideWhy') : t('props.match.why', { score: m.score })}
        </button>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant={recommended ? 'secondary' : 'outline'} onClick={toggle} title={recommended ? t('props.match.undoHint') : t('props.match.recommendHint')}>
            <Check /> {recommended ? t('props.match.isRecommended') : t('props.match.recommend')}
          </Button>
          {visit ? <StatusChip tone="info" icon={<CalendarPlus />}>{visit.date}</StatusChip>
            : <Button size="sm" variant="outline" onClick={() => toast(t('property.comingNext', { what: t('property.bookVisitModule') }))}><CalendarPlus /> {t('props.match.visit')}</Button>}
        </div>
      </div>
    </li>
  )
}
