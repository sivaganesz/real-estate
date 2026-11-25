/**
 * Leads — "Today" design (prototype at /leads?design=new, 26 Nov), after Attio / Twenty / HubSpot's Today queue:
 * four summary tiles that filter, saved views instead of a wall of pills, the list grouped by follow-up
 * (Overdue · Today · This week · Later · No date), calm two-line rows with actions on hover, and a preview panel
 * beside the list (a sheet on a phone). The same rules as the current Leads list (lead-list.ts).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight, Building2, Check, Flame, MessageCircle, Phone, Search, SlidersHorizontal, Sparkles, UserRound, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Page } from '@/components/app/page-header'
import { SidePanel } from '@/components/app/side-panel'
import { type Tone, toneFill, toneSoft, toneText } from '@/components/app/tone'
import { UserAvatar } from '@/components/app/user-avatar'
import { useCrumbs } from '@/components/layout/crumbs'
import { CITIES, STAGE_ORDER, TYPE_ORDER } from '@/data/catalogue'
import type { Lead, LeadStage } from '@/data/types'
import { useIsPhone } from '@/hooks/use-media-query'
import { isHni } from '@/lib/classification'
import { daysBetween, fmtDate, inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { propertiesForLead } from '@/lib/matching'
import { BAND_TONE } from '@/lib/readiness'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import { MATCH_TONE, PropertyPhoto } from '../properties/components/property-bits'
import { isActive, type LeadFilters, type LeadItem, leadItems, matchesLead, parseLeadSentence } from './lead-list'
import { STAGE_TONE } from './leads-page'

type View = 'all' | 'hot' | 'investors' | 'hni' | 'closed'
type Tile = 'overdue' | 'today' | 'hot' | 'new'
type Group = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'closed'
const STROKE: Record<Tone, string> = { neutral: 'stroke-neutral', primary: 'stroke-primary', success: 'stroke-success', warning: 'stroke-warning', danger: 'stroke-danger', info: 'stroke-info', violet: 'stroke-violet' }
const RING: Record<Tone, string> = { neutral: 'ring-neutral', primary: 'ring-primary', success: 'ring-success', warning: 'ring-warning', danger: 'ring-danger', info: 'ring-info', violet: 'ring-violet' }
const GROUP_TONE: Record<Group, Tone> = { overdue: 'danger', today: 'warning', week: 'info', later: 'neutral', none: 'neutral', closed: 'neutral' }

/** Which follow-up section a lead sits in. */
function groupOf(l: Lead, today: string): Group {
  if (!isActive(l)) return 'closed'
  if (!l.nextFollowUp) return 'none'
  if (l.nextFollowUp < today) return 'overdue'
  if (l.nextFollowUp === today) return 'today'
  return daysBetween(today, l.nextFollowUp) <= 7 ? 'week' : 'later'
}
const isHot = (x: LeadItem) => isActive(x.lead) && x.ready.band === 'high'
const isNew = (x: LeadItem, today: string) => daysBetween(x.lead.enquiryDate, today) <= 7

/** Kept while a lead is open and you come back. */
let saved: { view: View; tile: Tile | null; f: LeadFilters; ask: boolean; sel: string | null } = { view: 'all', tile: null, f: {}, ask: false, sel: null }

export function LeadsToday() {
  const { t } = useTranslation()
  const { db, today } = useStore()
  const can = useCan()
  const manager = can('lead.seeAll')
  const phone = useIsPhone()
  const leads = useVisibleLeads()
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.leads') }])

  const [view, setViewState] = useState<View>(saved.view)
  const [tile, setTileState] = useState<Tile | null>(saved.tile)
  const [f, setFState] = useState<LeadFilters>(saved.f)
  const [ask, setAskState] = useState(saved.ask)
  const [sel, setSelState] = useState<string | null>(saved.sel)
  const [sheet, setSheet] = useState(false)
  useEffect(() => { saved = { view, tile, f, ask, sel } }, [view, tile, f, ask, sel])
  const setView = (v: View) => { setViewState(v); setTileState(null) }
  const setTile = setTileState
  const setF = setFState
  const setAsk = setAskState
  const select = (id: string) => { setSelState(id); if (phone) setSheet(true) }

  const items = useMemo(() => leadItems(leads, db), [leads, db])
  const counts = {
    overdue: items.filter((x) => groupOf(x.lead, today) === 'overdue').length,
    today: items.filter((x) => groupOf(x.lead, today) === 'today').length,
    hot: items.filter(isHot).length,
    new: items.filter((x) => isNew(x, today)).length,
  }
  const inView = (x: LeadItem) =>
    view === 'closed' ? !isActive(x.lead)
      : !isActive(x.lead) ? false
        : view === 'hot' ? isHot(x)
          : view === 'investors' ? x.cls === 'investor' || x.lead.purpose === 'investment' || x.lead.purpose === 'rentalIncome'
            : view === 'hni' ? isHni(x.cls) : true
  const inTile = (x: LeadItem) =>
    !tile ? true : tile === 'hot' ? isHot(x) : tile === 'new' ? isNew(x, today) : groupOf(x.lead, today) === tile
  const list = items.filter((x) => inView(x) && inTile(x) && matchesLead(x, f, today))
    .sort((a, b) => (a.lead.nextFollowUp ?? '9999').localeCompare(b.lead.nextFollowUp ?? '9999') || b.ready.total - a.ready.total)
  const groups = (['overdue', 'today', 'week', 'later', 'none', 'closed'] as Group[])
    .map((g) => ({ g, rows: list.filter((x) => groupOf(x.lead, today) === g) })).filter((x) => x.rows.length)
  const current = list.find((x) => x.lead.id === sel) ?? (phone ? undefined : list[0])

  const views: { v: View; n: number }[] = [
    { v: 'all', n: items.filter((x) => isActive(x.lead)).length },
    { v: 'hot', n: counts.hot },
    { v: 'investors', n: items.filter((x) => isActive(x.lead) && (x.cls === 'investor' || x.lead.purpose === 'investment' || x.lead.purpose === 'rentalIncome')).length },
    ...(manager ? [{ v: 'hni' as View, n: items.filter((x) => isActive(x.lead) && isHni(x.cls)).length }] : []),
    { v: 'closed', n: items.filter((x) => !isActive(x.lead)).length },
  ]
  const runAsk = (text: string) => {
    const p = parseLeadSentence(text)
    setF({ ...p, aiText: text, aiRan: text })
    if (!Object.keys(p).length) toast(t('leads.aiMiss'))
  }

  return (
    <Page full>
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('leads.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('today.subtitle', { date: fmtDate(today) })}</p>
        </div>
        <Link to="/leads" className="text-sm text-muted-foreground hover:text-foreground">{t('today.backToTable')}</Link>
        <Button asChild><Link to="/leads/new">＋ {t('leads.add')}</Link></Button>
      </div>

      {/* summary tiles: today at a glance; each filters the list */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile on={tile === 'overdue'} onClick={() => setTile(tile === 'overdue' ? null : 'overdue')} tone="danger" n={counts.overdue} label={t('today.tile.overdue')} hint={t('today.tile.overdueHint')} />
        <StatTile on={tile === 'today'} onClick={() => setTile(tile === 'today' ? null : 'today')} tone="warning" n={counts.today} label={t('today.tile.today')} hint={t('today.tile.todayHint')} />
        <StatTile on={tile === 'hot'} onClick={() => setTile(tile === 'hot' ? null : 'hot')} tone="success" n={counts.hot} label={t('today.tile.hot')} hint={t('today.tile.hotHint')} icon={<Flame />} />
        <StatTile on={tile === 'new'} onClick={() => setTile(tile === 'new' ? null : 'new')} tone="violet" n={counts.new} label={t('today.tile.new')} hint={t('today.tile.newHint')} icon={<Sparkles />} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23.75rem]">
        <section className="min-w-0 rounded-2xl border bg-card shadow-card">
          {/* saved views, search / ask, filter */}
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:px-4">
            <nav aria-label={t('today.views')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
              {views.map((x) => (
                <button key={x.v} type="button" onClick={() => setView(x.v)} aria-current={view === x.v ? 'page' : undefined}
                  className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors',
                    view === x.v ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                  {t(`today.view.${x.v}`)} <span className={cn('text-xs tabular-nums', view === x.v ? 'opacity-70' : 'opacity-60')}>{x.n}</span>
                </button>
              ))}
            </nav>
            <SearchAsk f={f} ask={ask} onAsk={setAsk} onChange={setF} onRun={runAsk} />
            <FilterButton f={f} onChange={setF} manager={manager} />
          </div>

          {(tile || f.aiRan) && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm">
              {tile && <Pill onClear={() => setTile(null)}>{t(`today.tile.${tile}`)}</Pill>}
              {f.aiRan && <Pill onClear={() => setF({})}><Sparkles className="size-3.5 text-violet" /> “{f.aiRan}”</Pill>}
              <span className="text-muted-foreground">{t('today.showing', { count: list.length })}</span>
            </div>
          )}

          {/* the list, in follow-up sections */}
          {groups.length ? groups.map(({ g, rows }) => (
            <div key={g}>
              <h2 className="sticky top-[calc(3rem+1px)] z-[1] flex items-center gap-2 border-b bg-card/95 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                <span className={cn('size-2 rounded-full', toneFill[GROUP_TONE[g]])} />
                {t(`today.group.${g}`)} <span className="font-normal tabular-nums">{rows.length}</span>
              </h2>
              <ul>
                {rows.map((x) => <LeadRow key={x.lead.id} x={x} selected={current?.lead.id === x.lead.id} onSelect={() => select(x.lead.id)} />)}
              </ul>
            </div>
          )) : (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success"><Check className="size-6" /></span>
              <p className="font-medium">{t('today.emptyTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('today.emptyBody')}</p>
            </div>
          )}
        </section>

        {/* preview beside the list (desktop) */}
        {!phone && (
          <aside className="sticky top-[4.0625rem]">
            {current ? <Preview x={current} /> : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('today.pick')}</div>}
          </aside>
        )}
      </div>

      {phone && (
        <SidePanel open={sheet && !!current} onOpenChange={setSheet} title={current?.lead.name ?? ''}>
          {current && <div className="pb-4 [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none"><Preview x={current} bare /></div>}
        </SidePanel>
      )}
    </Page>
  )
}

/* ---------- pieces ---------- */

function StatTile({ on, onClick, tone, n, label, hint, icon }: { on: boolean; onClick: () => void; tone: Tone; n: number; label: string; hint: string; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn('group relative flex flex-col items-start gap-0.5 overflow-hidden rounded-2xl border bg-card p-3 text-left shadow-card transition-all hover:-translate-y-px hover:shadow-md sm:gap-1 sm:p-4',
        on && 'ring-2 ring-offset-2 ring-offset-background', on && RING[tone])}>
      <span className={cn('absolute -top-6 -right-6 size-20 rounded-full opacity-60', toneSoft[tone])} aria-hidden />
      <span className={cn('relative flex items-center gap-1.5 text-sm font-medium [&_svg]:size-4', toneText[tone])}>
        {icon ?? <span className={cn('size-2 rounded-full', toneFill[tone])} />}{label}
      </span>
      <span className="relative text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{n}</span>
      <span className="relative text-meta text-muted-foreground max-sm:hidden">{hint}</span>
    </button>
  )
}

function Pill({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pr-1 pl-2.5 text-sm">
      {children}
      <button type="button" onClick={onClear} className="grid size-5 place-items-center rounded-full hover:bg-muted" aria-label="✕"><X className="size-3" /></button>
    </span>
  )
}

/** Keyword search, or ✨ a sentence ("investors in Madurai under 50 lakh"). */
function SearchAsk({ f, ask, onAsk, onChange, onRun }: { f: LeadFilters; ask: boolean; onAsk: (x: boolean) => void; onChange: (f: LeadFilters) => void; onRun: (text: string) => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState(f.aiText ?? '')
  return (
    <form className={cn('relative flex h-8 items-center rounded-lg border bg-background transition-all', ask ? 'order-last w-full basis-full border-violet/40' : 'w-full sm:w-40 sm:focus-within:w-56')}
      onSubmit={(e) => { e.preventDefault(); if (ask) onRun(text) }}>
      {ask ? <Sparkles className="ml-2.5 size-4 shrink-0 text-violet" /> : <Search className="ml-2.5 size-4 shrink-0 text-muted-foreground" />}
      <input value={ask ? text : f.q ?? ''} aria-label={ask ? t('leads.aiPlaceholder') : t('leads.searchPlaceholder')}
        placeholder={ask ? t('today.askPlaceholder') : t('today.searchPlaceholder')}
        onChange={(e) => (ask ? setText(e.target.value) : onChange({ ...f, q: e.target.value || undefined }))}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
      <button type="button" onClick={() => onAsk(!ask)} title={ask ? t('today.toSearch') : t('leads.aiTitle')}
        className={cn('mr-1 grid size-6 place-items-center rounded-md', ask ? 'bg-violet text-violet-foreground' : 'text-violet hover:bg-violet-soft')}>
        <Sparkles className="size-3.5" />
      </button>
    </form>
  )
}

/** One button for the detailed filters (they used to be six pills). */
function FilterButton({ f, onChange, manager }: { f: LeadFilters; onChange: (f: LeadFilters) => void; manager: boolean }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { db } = useStore()
  const n = (['stage', 'owner', 'purpose', 'type', 'city', 'band', 'cls'] as const).filter((k) => f[k]).length
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick}
      className={cn('rounded-full border px-2.5 py-1 text-sm', on ? 'border-primary bg-accent font-medium text-primary' : 'hover:bg-muted')}>{label}</button>
  )
  const row = (label: string, children: ReactNode) => (
    <div><p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p><div className="flex flex-wrap gap-1.5">{children}</div></div>
  )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <SlidersHorizontal /> {t('today.filter')}{n > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{n}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[min(26.25rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl p-4">
        {row(t('leads.pill.stage'), [...STAGE_ORDER, 'lost' as LeadStage].map((s) => chip(f.stage === s, t(`stage.${s}`), () => onChange({ ...f, stage: f.stage === s ? undefined : s }))))}
        {row(t('leads.pill.type'), TYPE_ORDER.map((x) => chip(f.type === x, L.type(x), () => onChange({ ...f, type: f.type === x ? undefined : x }))))}
        {row(t('leads.city'), Object.keys(CITIES).map((c) => chip(f.city === c, c, () => onChange({ ...f, city: f.city === c ? undefined : c }))))}
        {row(t('leads.pill.band'), (['high', 'qualified', 'developing', 'early'] as const).map((b) => chip(f.band === b, t(`readiness.${b}`), () => onChange({ ...f, band: f.band === b ? undefined : b }))))}
        {manager && row(t('leads.pill.owner'), db.users.filter((u) => u.role === 'executive').map((u) => chip(f.owner === u.id, u.name, () => onChange({ ...f, owner: f.owner === u.id ? undefined : u.id }))))}
        {n > 0 && <button type="button" onClick={() => onChange({ q: f.q })} className="self-start text-sm font-medium text-primary">{t('ps.clearAll')}</button>}
      </PopoverContent>
    </Popover>
  )
}

/** "Plot · Madurai · 1,200 sq.ft. · 2 BHK" */
function useWants() {
  const L = useLabels()
  return (l: Lead) => {
    const r = l.requirement
    return [L.type(r.type), (r.localities.length ? r.localities : r.cities).slice(0, 2).join(' / '), r.sizeSqft && `${num(r.sizeSqft)} sq.ft.`, r.bhk].filter(Boolean).join(' · ')
  }
}

/** A calm two-line row: who and what they want on the left; stage and when on the right; actions on hover. */
function LeadRow({ x, selected, onSelect }: { x: LeadItem; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation()
  const { today } = useStore()
  const can = useCan()
  const wants = useWants()
  const l = x.lead
  const g = groupOf(l, today)
  const hniHidden = isHni(x.cls) && !can('lead.seeAll')
  const when = !isActive(l) ? '' : !l.nextFollowUp ? t('today.noDate')
    : g === 'today' ? t('leads.today')
      : new Date(l.nextFollowUp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return (
    <li className="group relative">
      <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined}
        className={cn('flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0',
          selected ? 'bg-accent/70' : 'hover:bg-muted/50')}>
        {selected && <span className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-primary" aria-hidden />}
        <UserAvatar name={l.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{l.name}</span>
            {isHot(x) && <Flame className="size-3.5 shrink-0 text-success" aria-label={t('today.tile.hot')} />}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {wants(l)} · <span className="text-foreground/80">{inrShort(l.budget.min)}–{inrShort(l.budget.max)}</span>
            {' · '}{hniHidden ? t('leads.restricted') : t(`class.${x.cls}`)}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-sm sm:hidden">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className={cn('size-2 rounded-full', toneFill[STAGE_TONE[l.stage]])} />{t(`stage.${l.stage}`)}</span>
            {when && <span className={cn('tabular-nums', g === 'overdue' ? 'font-medium text-danger' : g === 'today' ? 'font-medium text-warning' : 'text-muted-foreground')}>· {when}</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-sm transition-opacity group-hover:opacity-0 max-sm:hidden">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className={cn('size-2 rounded-full', toneFill[STAGE_TONE[l.stage]])} />{t(`stage.${l.stage}`)}</span>
          {when && <span className={cn('tabular-nums', g === 'overdue' ? 'font-medium text-danger' : g === 'today' ? 'font-medium text-warning' : 'text-muted-foreground')}>{g === 'overdue' ? `⚠ ${when}` : when}</span>}
        </span>
      </button>
      {/* actions on hover (desktop) */}
      <span className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 max-sm:hidden">
        <QuickActions lead={l} />
      </span>
    </li>
  )
}

/** 📞 Call · 💬 WhatsApp · ✓ Done (logs the follow-up and asks when the next one is). */
function QuickActions({ lead: l, big }: { lead: Lead; big?: boolean }) {
  const { t } = useTranslation()
  const { today, updateLead } = useStore()
  const done = (days: number | null) => {
    const next = days === null ? undefined : new Date(new Date(today).getTime() + days * 864e5).toISOString().slice(0, 10)
    updateLead(l.id, (x) => { x.nextFollowUp = next }, next ? t('today.doneNote', { date: fmtDate(next) }) : t('today.doneNoteNone'))
    toast.success(t('today.doneToast', { name: l.name }), { description: next ? t('today.nextOn', { date: fmtDate(next) }) : undefined })
  }
  const size = big ? 'default' : 'icon-sm'
  return (
    <>
      <Button size={size} variant="outline" className={cn(big && 'flex-1', 'bg-card')} title={t('leads.call')} onClick={() => toast(t('leads.calling', { name: l.name, phone: l.phone }), { description: t('leads.demoHint') })}>
        <Phone />{big && t('leads.call')}
      </Button>
      <Button size={size} variant="outline" className={cn(big && 'flex-1', 'bg-card')} title={t('leads.whatsapp')} onClick={() => toast(t('leads.whatsapping', { name: l.name }), { description: t('leads.demoHint') })}>
        <MessageCircle />{big && t('leads.whatsappShort')}
      </Button>
      {isActive(l) && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size={size} variant={big ? 'default' : 'outline'} className={cn(big && 'flex-1', !big && 'bg-card')} title={t('today.done')}><Check />{big && t('today.done')}</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 rounded-xl p-2">
            <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">{t('today.nextWhen')}</p>
            {([[1, 'tomorrow'], [3, 'in3'], [7, 'nextWeek'], [null, 'none']] as const).map(([d, k]) => (
              <button key={k} type="button" onClick={() => done(d)} className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">{t(`today.when.${k}`)}</button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}

/** A ring for the 100-point "ready to buy" score. */
function ReadyRing({ score, tone }: { score: number; tone: Tone }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          className={STROKE[tone]} />
      </svg>
      <span className="text-lg font-semibold tabular-nums">{score}</span>
    </span>
  )
}

/** The preview beside the list: how ready, what they want, the next step, their best properties, the last contact. */
function Preview({ x, bare }: { x: LeadItem; bare?: boolean }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { db, today } = useStore()
  const can = useCan()
  const wants = useWants()
  const l = x.lead
  const tone = BAND_TONE[x.ready.band]
  const best = propertiesForLead(l, db.properties.filter((p) => p.status === 'available' && !p.archived), db.settings).slice(0, 3)
  const last = l.activity[0]
  const g = groupOf(l, today)
  const hniHidden = isHni(x.cls) && !can('lead.seeAll')
  const block = (label: string, children: ReactNode) => (
    <div className="border-t px-5 py-4"><p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>{children}</div>
  )
  return (
    <section className={cn('overflow-hidden rounded-2xl border bg-card shadow-card', bare && 'rounded-none')}>
      {!bare && (
        <div className="flex items-center gap-3 px-5 pt-5">
          <UserAvatar name={l.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{l.name}</p>
            <p className="truncate text-sm text-muted-foreground"><span className="font-mono">{l.id}</span> · {l.source}</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 px-5 py-4">
        <ReadyRing score={x.ready.total} tone={tone} />
        <div className="min-w-0">
          <p className={cn('font-medium', toneText[tone])}>{t(`readiness.${x.ready.band}`)}</p>
          <p className="text-sm text-muted-foreground">{t('props.match.readyToBuy')} · {hniHidden ? t('leads.restricted') : t(`class.${x.cls}`)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm"><span className={cn('size-2 rounded-full', toneFill[STAGE_TONE[l.stage]])} />{t(`stage.${l.stage}`)}</p>
        </div>
      </div>

      {block(t('today.wants'), (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{wants(l)}</p>
          <p className="text-muted-foreground">{inrShort(l.budget.min)} – {inrShort(l.budget.max)}{l.purpose ? ` · ${t(`purpose.buyer.${l.purpose}`)}` : ''}</p>
          {can('lead.seeAll') && <p className="flex items-center gap-1.5 text-muted-foreground"><UserRound className="size-3.5" />{userName(db, l.ownerId) || t('leads.unassigned')}</p>}
        </div>
      ))}

      {isActive(l) && block(t('today.next'), (
        <p className={cn('text-sm', g === 'overdue' ? 'font-medium text-danger' : g === 'today' ? 'font-medium text-warning' : '')}>
          {!l.nextFollowUp ? t('today.noNext') : g === 'overdue' ? t('today.overdueSince', { date: fmtDate(l.nextFollowUp), days: daysBetween(l.nextFollowUp, today) })
            : g === 'today' ? t('today.dueToday') : t('today.followUpOn', { date: fmtDate(l.nextFollowUp) })}
        </p>
      ))}

      {block(t('today.best', { count: best.length }), best.length ? (
        <ul className="flex flex-col gap-2">
          {best.map((m) => (
            <li key={m.property.id}>
              <Link to={`/properties/${m.property.id}`} className="flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-muted">
                <PropertyPhoto type={m.property.type} media={m.property.media.find((x) => x.isCover) ?? m.property.media[0]} alt="" className="size-11 shrink-0 rounded-lg" iconClassName="size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.property.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{inrShort(m.property.price)} · {L.type(m.property.type)}</span>
                </span>
                <span className={cn('text-sm font-semibold tabular-nums', toneText[MATCH_TONE[m.label]])}>{m.score}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="size-4" />{t('today.noMatches')}</p>)}

      {last && block(t('today.last'), (
        <div className="text-sm">
          <p className="line-clamp-2">{last.text}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(last.at)} · {userName(db, last.by)}</p>
        </div>
      ))}

      <div className="flex gap-2 border-t bg-muted/30 px-5 py-3"><QuickActions lead={l} big /></div>
      <Link to={`/leads/${l.id}`} className="flex items-center justify-center gap-1 border-t py-2.5 text-sm font-medium text-primary hover:bg-muted/40">
        {t('today.openFull')} <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
