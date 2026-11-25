/**
 * Matching customers — who should hear about this property, why, and what to do next (spec-system-wireframe propMatches).
 * Same matching rules as the lead pages. Recommend = the buyer was told (call, WhatsApp, in person): it's logged on their
 * timeline and moves the lead on. Booking a visit comes with the Appointments section. Readiness ("ready to buy") is the
 * lead's 100-point purchase-readiness score, kept separate from the fit score.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, Check, LayoutGrid, List, MapPin, MessageSquareText, TriangleAlert, UserRound, Wallet, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/app/callout'
import { Meter } from '@/components/app/meter'
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

/** List rows or profile cards, remembered per user in this browser (list by default). */
type MatchView = 'list' | 'cards'
const VIEW_KEY = 'realspec-rebuild-match-view'
function useMatchView(userId: string): [MatchView, (v: MatchView) => void] {
  const read = (): Record<string, MatchView> => { try { return JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') } catch { return {} } }
  const [views, setViews] = useState(read)
  const set = (v: MatchView) => {
    const next = { ...views, [userId]: v }
    setViews(next)
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)) } catch { /* storage blocked: the choice lasts until reload */ }
  }
  return [views[userId] ?? 'list', set]
}

export function MatchingTab({ p }: { p: Property }) {
  const { t } = useTranslation()
  const { db, user } = useStore()
  const leads = useVisibleLeads()
  const [sort, setSort] = useState<'fit' | 'ready'>('fit')
  const [view, setView] = useMatchView(user.id)
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
        action={list.length > 0 && (
          <>
            {list.length > 1 && <Segmented variant="pill" label={t('sort.label')} value={sort} onChange={setSort}
              segments={[{ value: 'fit', label: t('props.match.bestFit') }, { value: 'ready', label: t('props.match.mostReady') }]} />}
            <Segmented<MatchView> variant="pill" label={t('props.match.viewLabel')} value={view} onChange={setView}
              segments={[
                { value: 'list', label: <span className="max-sm:sr-only">{t('props.match.viewList')}</span>, icon: <List aria-hidden /> },
                { value: 'cards', label: <span className="max-sm:sr-only">{t('props.match.viewCards')}</span>, icon: <LayoutGrid aria-hidden /> },
              ]} />
          </>
        )}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {(['strong', 'good', 'weak', 'conditional'] as MatchLabel[]).filter(count).map((l) => (
            <StatusChip key={l} tone={MATCH_TONE[l]}>{t('props.match.count', { count: count(l), label: t(`match.${l}`).toLowerCase() })}</StatusChip>
          ))}
          {close.length > 0 && <StatusChip tone="neutral" variant="outline">{t('props.match.closeCount', { count: close.length })}</StatusChip>}
          {purposes.length > 0 && <span className="text-sm text-muted-foreground">{purposes.map((x) => `${list.filter((m) => m.lead.purpose === x).length} ${t(`purpose.buyer.${x}`).toLowerCase()}`).join(' · ')}</span>}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t('props.match.rule')}</p>
        {list.length ? (
          view === 'cards'
            ? <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{list.map((m) => <BuyerProfile key={m.lead.id} m={m} ready={m.ready} p={p} />)}</ul>
            : <ul className="flex flex-col gap-2">{list.map((m) => <BuyerCard key={m.lead.id} m={m} ready={m.ready} p={p} />)}</ul>
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

/** One buyer's facts, pitch and actions — shared by the list row and the profile card, so both say exactly the same. */
function useBuyer(m: Match, p: Property) {
  const { t } = useTranslation()
  const { db, recommendProperty } = useStore()
  const can = useCan()
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
  const warningText = (w: Match['reasons'][number]) =>
    t(`reason.${w.key}`, { ...w.values, list: String(w.values?.list ?? '').split(',').filter(Boolean).map((a) => t(`approval.${a}`, { defaultValue: a })).join(', ') })
  const owner = can('lead.seeAll') && l.ownerId ? userName(db, l.ownerId) : ''
  return { l, recommended, visit, pitch: points.map(say), want, warnings, warningText, owner, toggle }
}

/** "Recommend" / "Recommended" and "Visit" (or the booked date). */
function BuyerActions({ b, className, grow }: { b: ReturnType<typeof useBuyer>; className?: string; grow?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Button size="sm" variant={b.recommended ? 'secondary' : 'outline'} onClick={b.toggle} className={cn(grow && 'flex-1')}
        title={b.recommended ? t('props.match.undoHint') : t('props.match.recommendHint')}>
        <Check /> {b.recommended ? t('props.match.isRecommended') : t('props.match.recommend')}
      </Button>
      {b.visit ? <StatusChip tone="info" icon={<CalendarPlus />}>{b.visit.date}</StatusChip>
        : <Button size="sm" variant="outline" className={cn(grow && 'flex-1')} onClick={() => toast(t('property.comingNext', { what: t('property.bookVisitModule') }))}><CalendarPlus /> {t('props.match.visit')}</Button>}
    </div>
  )
}

/** The fit's reasons (✓ / ✕), shown with "Why 95?". */
function Reasons({ m }: { m: Match }) {
  const { t } = useTranslation()
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {m.reasons.filter((r) => r.ok !== null).map((r, i) => (
        <li key={i}><StatusChip tone={r.ok ? 'success' : 'danger'} icon={r.ok ? <Check /> : <X />}>{t(`reason.${r.key}`, { ...r.values })}</StatusChip></li>
      ))}
    </ul>
  )
}

/**
 * Profile card, compact: name and fit score on top (purpose and stage on one line below, the same in every card), how ready
 * they are, budget, what they want and their executive, a short "what to tell them", then Recommend / Visit level at the bottom.
 */
function BuyerProfile({ m, ready, p }: { m: Match; ready: ReturnType<typeof readiness>; p: Property }) {
  const { t } = useTranslation()
  const b = useBuyer(m, p)
  const [open, setOpen] = useState(false)
  const l = b.l
  const tell = b.pitch.join(' · ')
  const fact = (Icon: typeof Wallet, label: string, text: string) => (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="sr-only">{label}</dt>
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <dd className="truncate" title={text}>{text}</dd>
    </div>
  )
  return (
    <li className="flex flex-col rounded-xl border bg-card text-sm">
      <div className="flex items-start gap-2.5 p-3 pb-2">
        <UserAvatar name={l.name} />
        <div className="min-w-0 flex-1">
          <Link to={`/leads/${l.id}`} className="block truncate font-semibold text-primary hover:underline" title={l.name}>{l.name}</Link>
          <p className="truncate text-meta text-muted-foreground">
            {l.purpose && <span title={l.purposeNote}>{t(`purpose.buyer.${l.purpose}`)} · </span>}{t(`stage.${l.stage}`)}
          </p>
        </div>
        <div className="shrink-0 text-right leading-tight">
          <span className={cn('block text-xl font-semibold tabular-nums', toneText[MATCH_TONE[m.label]])}>{m.score}</span>
          <span className="text-micro text-muted-foreground">{t(`match.long.${m.label}`)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3">
        <div className="flex items-center gap-2 text-meta">
          <span className="shrink-0 text-muted-foreground first-letter:uppercase">{t('props.match.readyToBuy')}</span>
          <Meter value={ready.total} tone={BAND_TONE[ready.band]} label={t('props.match.readyToBuy')} className="flex-1" />
          <b className={cn('w-6 text-right tabular-nums', toneText[BAND_TONE[ready.band]])} title={t(`readiness.${ready.band}`)}>{ready.total}</b>
        </div>
        <dl className="flex flex-col gap-1 text-meta">
          {fact(Wallet, t('props.match.budget'), `${inrShort(l.budget.min)} – ${inrShort(l.budget.max)}`)}
          {fact(MapPin, t('props.match.wants'), b.want)}
          {b.owner && fact(UserRound, t('props.match.executive'), b.owner)}
        </dl>
        {tell && (
          // the padding sits outside the clamped text, so a fourth line never peeks out under the third
          <div className="rounded-md bg-muted/60 px-2 py-1.5 text-meta" title={`${t('props.match.tellThem')}: ${tell}`}>
            <p className="line-clamp-3">
              <MessageSquareText aria-hidden className="mr-1 inline size-3.5 -translate-y-px text-muted-foreground" />{tell}
            </p>
          </div>
        )}
        {b.warnings.length > 0 && (
          <p className="flex flex-wrap gap-1">
            {b.warnings.map((w) => <StatusChip key={w.key} tone="warning" icon={<TriangleAlert />} className="h-auto py-0.5 whitespace-normal">{b.warningText(w)}</StatusChip>)}
          </p>
        )}
        <div>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-meta text-primary hover:underline">
            {open ? t('props.match.hideWhy') : t('props.match.why', { score: m.score })}
          </button>
          {open && <Reasons m={m} />}
        </div>
      </div>
      <span className="flex-1" />
      <BuyerActions b={b} grow className="mt-2.5 border-t px-3 py-2.5" />
    </li>
  )
}

/** List row: the buyer, budget and wants on the left; the fit score and actions on the right. */
function BuyerCard({ m, ready, p }: { m: Match; ready: ReturnType<typeof readiness>; p: Property }) {
  const { t } = useTranslation()
  const b = useBuyer(m, p)
  const [open, setOpen] = useState(false)
  const l = b.l

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
            {inrShort(l.budget.min)} – {inrShort(l.budget.max)} · {b.want}{b.owner ? ` · ${b.owner}` : ''}
          </p>
          {b.pitch.length > 0 && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm" title={t('props.match.sayTitle', { name: l.name.split(' ')[0] })}>
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> <span>{b.pitch.join(' · ')}</span>
            </p>
          )}
          {b.warnings.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {b.warnings.map((w) => <StatusChip key={w.key} tone="warning" icon={<TriangleAlert />} className="h-auto py-0.5 whitespace-normal">{b.warningText(w)}</StatusChip>)}
            </p>
          )}
          {open && <Reasons m={m} />}
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
        <BuyerActions b={b} />
      </div>
    </li>
  )
}
