/**
 * Leads — the customer list, laid out like the Properties list (spec-system-wireframe views-customers.js, design agreed 26 Nov):
 * search and ✨ sentence search, filter pills, follow-up tabs (All · Overdue · Due today · Upcoming · Closed / Lost),
 * an on-demand "needs attention" strip, a table (two-line rows) or lead cards, and the pager.
 * Executives see their own leads; an HNI classification shows to them as "Restricted". Readiness and classification are
 * separate assessments — a high budget never makes someone an HNI.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowUpRight, LayoutGrid, List, MapPin, MessageCircle, MoreHorizontal, NotebookPen, Phone, Search, Sparkles, Tag, UserRound, Users, Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Chip } from '@/components/app/chip'
import { BREAKPOINT_PX, type Column, DataTable } from '@/components/app/data-table'
import { EmptyState } from '@/components/app/empty-state'
import { Meter } from '@/components/app/meter'
import { Page, PageHeader } from '@/components/app/page-header'
import { Segmented } from '@/components/app/segmented'
import { StatusChip } from '@/components/app/status-chip'
import { type Tone, toneFill, toneText } from '@/components/app/tone'
import { UserAvatar } from '@/components/app/user-avatar'
import { useCrumbs } from '@/components/layout/crumbs'
import { CITIES, STAGE_ORDER, TYPE_ORDER } from '@/data/catalogue'
import type { BuyerPurpose, Classification, Lead, LeadStage } from '@/data/types'
import { CLASS_TONE, CLASSIFICATIONS, isHni } from '@/lib/classification'
import { fmtDate, inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { BAND_TONE, type ReadinessBand } from '@/lib/readiness'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import { ListOptions, useListPrefs } from '../properties/components/list-options'
import { PAGE_SIZES } from '../properties/search/prop-search'
import { optCls, PillButton, Sub } from '../properties/search/search-bar'
import {
  attentionOf, filterCount, inTab, isActive, isOverdue, isDueToday, LEAD_ATTENTION, LEAD_EXAMPLES, LEAD_TABS, type LeadFilters, type LeadItem,
  leadItems, type LeadSort, type LeadTab, matchesLead, parseLeadSentence, sortLeads,
} from './lead-list'

export const STAGE_TONE: Record<LeadStage, Tone> = {
  new: 'neutral', contacted: 'neutral', qualified: 'info', recommended: 'primary', visitScheduled: 'violet', negotiation: 'warning', closed: 'success', lost: 'danger',
}
const PURPOSES: BuyerPurpose[] = ['ownUse', 'investment', 'rentalIncome', 'businessUse', 'secondHome', 'other']
const BANDS: ReadinessBand[] = ['high', 'qualified', 'developing', 'early']
const SORTS: LeadSort[] = ['ready', 'followUp', 'newest']
const GRID_SIZES = [12, 24, 48]

/** Filters, tab and paging kept while a lead is open and you come back. */
type ListState = { f: LeadFilters; tab: LeadTab; aiOpen: boolean; attnOpen: boolean; page: number; size: number; gridSize: number }
let saved: ListState = { f: {}, tab: 'all', aiOpen: false, attnOpen: false, page: 1, size: 10, gridSize: 12 }

/** Table or cards, remembered per user. With no choice yet: cards for executives and on phones, the table for managers. */
type View = 'table' | 'cards'
const VIEW_KEY = 'realspec-rebuild-lead-view'
function useLeadView(userId: string, manager: boolean): [View, (v: View) => void] {
  const fallback: View = !manager || (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) ? 'cards' : 'table'
  const read = (): Record<string, View> => { try { return JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') } catch { return {} } }
  const [views, setViews] = useState(read)
  const set = (v: View) => {
    const next = { ...views, [userId]: v }
    setViews(next)
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)) } catch { /* storage blocked: lasts until reload */ }
  }
  return [views[userId] ?? fallback, set]
}

type Pill = 'stage' | 'owner' | 'purpose' | 'type' | 'band' | 'cls' | 'sort'

export function LeadsPage() {
  const { t } = useTranslation()
  const L = useLabels()
  const navigate = useNavigate()
  const { db, user, today } = useStore()
  const can = useCan()
  const manager = can('lead.seeAll')
  const leads = useVisibleLeads()
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.leads') }])

  const [st, setSt] = useState<ListState>(saved)
  useEffect(() => { saved = st }, [st])
  const [open, setOpen] = useState<Pill | null>(null)
  const [view, setView] = useLeadView(user.id, manager)
  const cards = view === 'cards'
  const [prefs, setPrefs] = useListPrefs(`${user.id}:leads`)
  const compact = prefs.density === 'compact'
  const f = st.f
  const setF = (nf: LeadFilters) => setSt((s) => ({ ...s, f: nf, page: 1 }))
  const set = <K extends keyof LeadFilters>(k: K, v: LeadFilters[K] | undefined) => { setF({ ...f, [k]: v }); if (k !== 'q') setOpen(null) }

  const items = useMemo(() => leadItems(leads, db), [leads, db])
  const filtered = items.filter((x) => matchesLead(x, f, today))
  const tabs = LEAD_TABS.map((k) => ({ k, n: filtered.filter((x) => inTab(x.lead, k, today)).length }))
  const list = sortLeads(filtered.filter((x) => inTab(x.lead, st.tab, today)), f.sort)

  const size = cards ? st.gridSize : st.size
  const pages = Math.max(1, Math.ceil(list.length / size))
  const page = Math.min(Math.max(1, st.page), pages)
  const from = (page - 1) * size
  const shown = list.slice(from, from + size)

  /* needs attention: opened with its button */
  const attnGroups = LEAD_ATTENTION.map((k) => ({ k, n: items.filter((x) => attentionOf(x, today).includes(k)).length })).filter((g) => g.n)
  const flagged = items.filter((x) => attentionOf(x, today).length).length

  /* ✨ sentence search */
  const ask = (text: string) => {
    text = text.trim()
    if (!text) { toast(t('ps.typeOrSay')); return }
    const p = parseLeadSentence(text)
    setF(filterCount(p) ? { ...p, sort: f.sort, aiText: text, aiRan: text } : { sort: f.sort, aiText: text, aiRan: text, aiMiss: true })
    setOpen(null)
  }

  /* the filter pills */
  const owners = db.users.filter((u) => u.role === 'executive')
  const opt = (on: boolean, label: ReactNode, onClick: () => void, key: string) => (
    <button key={key} type="button" className={optCls(on, true)} onClick={onClick}>{label}{on && <span aria-hidden>✓</span>}</button>
  )
  const pills: { k: Exclude<Pill, 'sort'>; label: string; set: boolean; body: ReactNode; managerOnly?: boolean }[] = [
    { k: 'stage', label: f.stage ? t(`stage.${f.stage}`) : t('leads.pill.stage'), set: !!f.stage,
      body: [...STAGE_ORDER, 'lost' as LeadStage].map((s) => opt(f.stage === s, t(`stage.${s}`), () => set('stage', f.stage === s ? undefined : s), s)) },
    { k: 'owner', label: f.owner ? (f.owner === '__none' ? t('leads.unassigned') : userName(db, f.owner)) : t('leads.pill.owner'), set: !!f.owner, managerOnly: true,
      body: [...owners.map((u) => opt(f.owner === u.id, u.name, () => set('owner', f.owner === u.id ? undefined : u.id), u.id)),
        opt(f.owner === '__none', t('leads.unassigned'), () => set('owner', f.owner === '__none' ? undefined : '__none'), '__none')] },
    { k: 'purpose', label: f.purpose ? t(`purpose.buyer.${f.purpose}`) : t('leads.pill.purpose'), set: !!f.purpose,
      body: PURPOSES.map((x) => opt(f.purpose === x, t(`purpose.buyer.${x}`), () => set('purpose', f.purpose === x ? undefined : x), x)) },
    { k: 'type', label: [f.type && L.type(f.type), f.city].filter(Boolean).join(' · ') || t('leads.pill.type'), set: !!(f.type || f.city),
      body: (
        <>
          <Sub first>{t('leads.pill.type')}</Sub>
          {TYPE_ORDER.map((x) => opt(f.type === x, L.type(x), () => setF({ ...f, type: f.type === x ? undefined : x }), x))}
          <Sub>{t('leads.city')}</Sub>
          <div className="flex flex-wrap gap-1.5 px-0.5">
            {Object.keys(CITIES).map((c) => <button key={c} type="button" className={optCls(f.city === c)} onClick={() => setF({ ...f, city: f.city === c ? undefined : c })}>{c}</button>)}
          </div>
        </>
      ) },
    { k: 'band', label: f.band ? t(`readiness.${f.band}`) : t('leads.pill.band'), set: !!f.band,
      body: BANDS.map((b) => opt(f.band === b, <span className="flex items-center gap-2"><span className={cn('size-2 rounded-full', toneFill[BAND_TONE[b]])} />{t(`readiness.${b}`)}</span>, () => set('band', f.band === b ? undefined : b), b)) },
    { k: 'cls', label: f.cls ? t(`class.${f.cls}`) : t('leads.pill.cls'), set: !!f.cls,
      body: CLASSIFICATIONS.filter((c) => manager || !isHni(c)).map((c) => opt(f.cls === c, t(`class.${c}`), () => set('cls', f.cls === c ? undefined : c), c)) },
  ]
  const budgetSet = !!(f.maxBudget || f.minBudget)
  const anything = filterCount(f) > 0 || !!f.aiText

  return (
    <Page full className="pb-0">
      <PageHeader title={t('leads.title')} description={t('leads.subtitle')}
        actions={<>
          <Button variant="outline" asChild><Link to="/enquiry">📝 {t('leads.enquiryForm')}</Link></Button>
          <Button asChild><Link to="/leads/new">＋ {t('leads.add')}</Link></Button>
        </>} />

      {st.attnOpen && flagged > 0 && (
        <div className="mb-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-warning/25 bg-warning-soft/60 py-2 pr-2.5 pl-3.5 text-ui">
          <span className="mr-1.5 text-warning">⚠ <b>{t('leads.attnLead', { count: flagged })}</b> {t('leads.needAttention')}</span>
          {attnGroups.map((g) => (
            <Chip key={g.k} size="sm" pressed={f.attn === g.k} onClick={() => setF({ ...f, attn: f.attn === g.k ? undefined : g.k })}>
              {t(`leads.attn.${g.k}`)} <b className="ml-0.5">{g.n}</b>
            </Chip>
          ))}
          <span className="flex-1" />
          <button type="button" onClick={() => setSt((s) => ({ ...s, attnOpen: false, f: { ...s.f, attn: undefined } }))} title={t('ps.hideForNow')} aria-label={t('ps.hideForNow')}
            className="grid size-6 place-items-center rounded-full text-xs text-warning/80 hover:bg-warning-soft">✕</button>
        </div>
      )}

      {/* search, pills and tabs stay at the top while the list scrolls */}
      <div className="z-10 -mx-4 bg-background px-4 pt-2 md:-mx-6 md:px-6 lg:sticky lg:top-[49px]">
        {st.aiOpen ? (
          <div className="mb-2">
            <form onSubmit={(e) => { e.preventDefault(); ask(f.aiText ?? '') }}
              className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-violet/40 bg-card py-2 pr-2 pl-3.5 shadow-[0_0_0_4px_var(--violet-soft)]">
              <Sparkles className="size-[18px] shrink-0 text-violet" />
              <input autoFocus value={f.aiText ?? ''} onChange={(e) => setSt((s) => ({ ...s, f: { ...s.f, aiText: e.target.value } }))}
                onKeyDown={(e) => { if (e.key === 'Escape') setSt((s) => ({ ...s, aiOpen: false })) }}
                placeholder={t('leads.aiPlaceholder')} aria-label={t('leads.aiPlaceholder')} className="min-w-0 flex-1 bg-transparent py-1.5 text-prompt outline-none" />
              <Button size="sm" type="submit">{t('search.go')}</Button>
              <Button size="sm" type="button" variant="outline" onClick={() => setSt((s) => ({ ...s, aiOpen: false }))}>{t('ps.backToNormal')}</Button>
            </form>
            <div className="mx-0.5 mt-2 flex min-h-[26px] flex-wrap items-center gap-1.5 text-ui" aria-live="polite">
              {f.aiMiss ? <span className="font-medium text-warning">{t('leads.aiMiss')}</span>
                : f.aiRan ? <span className="text-muted-foreground">{t('leads.found', { count: list.length })}</span>
                  : <span className="text-muted-foreground">{t('ps.try')}</span>}
              {(!f.aiRan || f.aiMiss) && LEAD_EXAMPLES.map((x) => <Chip key={x} tone="violet" size="sm" dashed onClick={() => ask(x)}>{x}</Chip>)}
            </div>
          </div>
        ) : null}
        <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-start">
          {!st.aiOpen && (
            <div className="relative flex w-full items-center lg:w-[300px]" role="search">
              <Search className="pointer-events-none absolute left-3 size-3.5 opacity-50" />
              <input type="search" value={f.q ?? ''} onChange={(e) => setF({ ...f, q: e.target.value || undefined })} placeholder={t('leads.searchPlaceholder')} aria-label={t('leads.searchPlaceholder')}
                className="h-8 w-full rounded-full border bg-card pr-10 pl-8 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
              <button type="button" onClick={() => setSt((s) => ({ ...s, aiOpen: true }))} title={t('leads.aiTitle')} aria-label={t('leads.aiTitle')}
                className="absolute right-1 grid h-[26px] w-7 place-items-center rounded-full bg-gradient-to-br from-violet-soft to-accent ring-1 ring-violet/25 ring-inset hover:from-violet/20">
                <Sparkles className="size-3.5 text-violet" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {pills.filter((p) => manager || !p.managerOnly).map((p) => (
              <PillButton key={p.k} label={p.label} set={p.set} open={open === p.k} onOpenChange={(o) => setOpen(o ? p.k : null)}
                onClear={() => setF(p.k === 'type' ? { ...f, type: undefined, city: undefined } : { ...f, [p.k]: undefined })} clearLabel={t('action.clear')}>
                {p.body}
              </PillButton>
            ))}
            {budgetSet && (
              <Chip size="sm" pressed onClick={() => setF({ ...f, maxBudget: undefined, minBudget: undefined })} className="h-8">
                {f.minBudget && f.maxBudget ? `${inrShort(f.minBudget)} – ${inrShort(f.maxBudget)}` : f.maxBudget ? t('leads.upTo', { amount: inrShort(f.maxBudget) }) : t('leads.from', { amount: inrShort(f.minBudget) })} ✕
              </Chip>
            )}
          </div>
          <div className="flex items-center gap-1 lg:ml-auto">
            <PillButton plain label={t('leads.sortLabel', { s: t(`leads.sort.${f.sort ?? 'ready'}`) })} set={false} open={open === 'sort'} align="end"
              onOpenChange={(o) => setOpen(o ? 'sort' : null)} onClear={() => undefined} clearLabel="">
              {SORTS.map((s) => opt((f.sort ?? 'ready') === s, t(`leads.sort.${s}`), () => set('sort', s === 'ready' ? undefined : s), s))}
            </PillButton>
            {anything && <button type="button" onClick={() => { setOpen(null); setF({ sort: f.sort }) }} className="h-8 px-1 text-ui font-medium whitespace-nowrap text-primary">{t('ps.clearAll')}</button>}
          </div>
        </div>

        {/* follow-up tabs; the attention button and the view switch stay on the right */}
        <div className="flex items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto border-b [scrollbar-width:none]">
            {tabs.map((o) => {
              const on = st.tab === o.k
              return (
                <button key={o.k} type="button" onClick={() => setSt((s) => ({ ...s, tab: o.k, page: 1 }))} aria-current={on ? 'page' : undefined}
                  className={cn('-mb-px border-b-2 px-3 pt-2 pb-[9px] text-ui font-medium whitespace-nowrap', on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  {t(`leads.tab.${o.k}`)}
                  <span className={cn('ml-1 rounded-full px-[7px] text-label', o.k === 'overdue' && o.n ? 'bg-danger-soft text-danger' : on ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}>{o.n}</span>
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-3 border-b pb-1 pl-3">
            {flagged > 0 && (
              <Chip size="sm" pressed={st.attnOpen} className={cn('whitespace-nowrap', !st.attnOpen && 'border-warning/40 text-warning')}
                onClick={() => setSt((s) => ({ ...s, attnOpen: !s.attnOpen, f: s.attnOpen ? { ...s.f, attn: undefined } : s.f }))}>
                ⚠ <span className="max-sm:sr-only">{t('leads.needsAttention')}</span> <b className="ml-0.5">{flagged}</b>
              </Chip>
            )}
            {!cards && (
              <ListOptions prefs={prefs} onChange={setPrefs} fixedLabel={t('leads.col.lead')}
                columns={[
                  { key: 'purpose', label: t('leads.col.purpose'), minWidth: BREAKPOINT_PX['2xl'] }, { key: 'looking', label: t('leads.col.looking'), minWidth: BREAKPOINT_PX.xl },
                  { key: 'budget', label: t('leads.col.budget'), minWidth: BREAKPOINT_PX.md }, { key: 'ready', label: t('leads.col.ready'), minWidth: BREAKPOINT_PX.md },
                  { key: 'cls', label: t('leads.col.cls'), minWidth: BREAKPOINT_PX.xl }, { key: 'stage', label: t('leads.col.stage'), minWidth: BREAKPOINT_PX.md },
                  ...(manager ? [{ key: 'owner', label: t('leads.col.owner'), minWidth: BREAKPOINT_PX.wide }] : []),
                  { key: 'followUp', label: t('leads.col.followUp'), minWidth: BREAKPOINT_PX.md },
                ]} />
            )}
            <Segmented<View> variant="pill" label={t('ps.viewLabel')} value={view} onChange={(v) => { setView(v); setSt((s) => ({ ...s, page: 1 })) }}
              segments={[
                { value: 'cards', label: <span className="max-sm:sr-only">{t('leads.viewCards')}</span>, icon: <LayoutGrid aria-hidden /> },
                { value: 'table', label: <span className="max-sm:sr-only">{t('ps.viewTable')}</span>, icon: <List aria-hidden /> },
              ]} />
          </div>
        </div>
      </div>

      <div className="mt-2.5">
        {list.length === 0 ? (
          <EmptyState variant="card" action={anything ? <Button variant="outline" size="sm" onClick={() => setF({ sort: f.sort })}>{t('ps.clearAll')}</Button> : undefined}>
            {items.length ? t('leads.noneMatch') : t('leads.none')}
          </EmptyState>
        ) : cards ? (
          <ul aria-label={t('leads.title')} className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 4xl:grid-cols-6">
            {shown.map((x) => <LeadCard key={x.lead.id} x={x} />)}
          </ul>
        ) : (
          <DataTable<LeadItem> label={t('leads.title')} rows={shown} rowKey={(x) => x.lead.id} onRowClick={(x) => navigate(`/leads/${x.lead.id}`)} dense={compact}
            columns={([
              {
                key: 'lead', header: t('leads.col.lead'), cell: (x) => (
                  <div className="flex min-w-40 items-start gap-3">
                    <UserAvatar name={x.lead.name} size="sm" className="mt-0.5" />
                    <div className="whitespace-normal">
                      <b className="block">{x.lead.name}</b>
                      {/* the purpose column shows from 1536 px; below that the purpose sits here instead of the source */}
                      <small className="block truncate text-muted-foreground" title={`${x.lead.source} · ${fmtDate(x.lead.enquiryDate)}`}>
                        <span className="font-mono">{x.lead.id}</span> · <span className="2xl:hidden">{x.lead.purpose ? t(`purpose.buyer.${x.lead.purpose}`) : x.lead.source}</span><span className="max-2xl:hidden">{x.lead.source}</span>
                      </small>
                      {/* phones: the hidden columns' essentials under the name */}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                        <StatusChip tone={STAGE_TONE[x.lead.stage]}>{t(`stage.${x.lead.stage}`)}</StatusChip><FollowUp lead={x.lead} />
                      </span>
                    </div>
                  </div>
                ),
              },
              { key: 'purpose', header: t('leads.col.purpose'), hideBelow: '2xl', cell: (x) => (x.lead.purpose ? t(`purpose.buyer.${x.lead.purpose}`) : <span className="text-muted-foreground">—</span>) },
              { key: 'looking', header: t('leads.col.looking'), hideBelow: 'xl', cell: (x) => <LookingFor lead={x.lead} /> },
              { key: 'budget', header: t('leads.col.budget'), align: 'right', hideBelow: 'md', cell: (x) => <span className="inline-block whitespace-normal"><span className="whitespace-nowrap">{inrShort(x.lead.budget.min)} –</span> <span className="whitespace-nowrap">{inrShort(x.lead.budget.max)}</span></span> },
              { key: 'ready', header: <span title={t('leads.readyHint')}>{t('leads.col.ready')}</span>, hideBelow: 'md', cell: (x) => <Ready x={x} /> },
              { key: 'cls', header: t('leads.col.cls'), hideBelow: 'xl', cell: (x) => <ClassChip cls={x.cls} className="h-auto min-h-6 max-w-32 py-0.5 leading-tight whitespace-normal" /> },
              { key: 'stage', header: t('leads.col.stage'), hideBelow: 'md', cell: (x) => <StatusChip tone={STAGE_TONE[x.lead.stage]} className="h-auto min-h-6 max-w-32 py-0.5 leading-tight whitespace-normal">{t(`stage.${x.lead.stage}`)}</StatusChip> },
              ...(manager ? [{ key: 'owner', header: t('leads.col.owner'), hideBelow: 'wide' as const, cell: (x: LeadItem) => <small>{userName(db, x.lead.ownerId) || <span className="text-muted-foreground">{t('leads.unassigned')}</span>}</small> }] : []),
              { key: 'followUp', header: t('leads.col.followUp'), hideBelow: 'md', cell: (x) => <FollowUp lead={x.lead} /> },
              { key: 'actions', header: <span className="sr-only">{t('table.actions')}</span>, className: 'w-9 py-1.5 pr-2 pl-0', sticky: true, cell: (x) => <LeadRowMenu lead={x.lead} /> },
            ] satisfies Column<LeadItem>[]).filter((c) => !prefs.hidden.includes(c.key))} />
        )}
      </div>

      {/* pager: pinned to the bottom from tablet up */}
      <div className="z-10 -mx-4 flex flex-wrap items-center gap-3 bg-background px-4 py-2.5 text-ui text-muted-foreground md:sticky md:bottom-0 md:-mx-6 md:px-6">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-card px-3">
              {cards ? t('ps.cardsPerPage') : t('ps.rowsPerPage')} <b className="text-foreground">{size}</b> <span className="text-micro">▾</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto min-w-[150px] rounded-xl p-2">
            {(cards ? GRID_SIZES : PAGE_SIZES).map((n) => (
              <button key={n} type="button" onClick={() => setSt((s) => ({ ...s, ...(cards ? { gridSize: n } : { size: n }), page: 1 }))}
                className={cn('block w-full rounded-[7px] px-2.5 py-[7px] text-left text-ui text-foreground hover:bg-muted', n === size && 'bg-accent text-primary')}>{cards ? t('ps.cards', { n }) : t('ps.rows', { n })}</button>
            ))}
          </PopoverContent>
        </Popover>
        <span className="flex-1 text-center max-lg:order-3 max-lg:basis-full max-lg:text-left">
          {list.length ? <>{t('ps.showing')} <b className="text-secondary-foreground">{from + 1}–{from + shown.length}</b> {t('ps.of')} <b className="text-secondary-foreground">{list.length}</b> {t('leads.count', { count: list.length })}</> : t('ps.nothingToShow')}
          {' · '}<span title={t('leads.separateHint')}>{t('leads.separate')}</span>
        </span>
        <div className="flex items-center gap-2 max-lg:ml-auto">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setSt((s) => ({ ...s, page: page - 1 }))}>‹ {t('ps.prev')}</Button>
          <span>{t('ps.pageOf', { page, pages })}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setSt((s) => ({ ...s, page: page + 1 }))}>{t('ps.next')} ›</Button>
        </div>
      </div>
    </Page>
  )
}

/* ---------- cells ---------- */

/** "Flat / Apartment · Madurai · 1,000 sq.ft. · 2 BHK", up to two lines (all of it on hover). */
function LookingFor({ lead: l }: { lead: Lead }) {
  const L = useLabels()
  const r = l.requirement
  const text = [L.type(r.type), (r.localities.length ? r.localities : r.cities).join(' / '), r.sizeSqft && `${num(r.sizeSqft)} sq.ft.`, r.bhk, r.commCategory]
    .filter(Boolean).join(' · ')
  return <span className="line-clamp-2 max-w-52 whitespace-normal" title={text}>{text}</span>
}

/** The 100-point "ready to buy" score with a small bar, coloured by band. */
function Ready({ x }: { x: LeadItem }) {
  const { t } = useTranslation()
  return (
    <span className="flex min-w-24 items-center gap-2" title={t(`readiness.${x.ready.band}`)}>
      <b className={cn('w-6 tabular-nums', toneText[BAND_TONE[x.ready.band]])}>{x.ready.total}</b>
      <Meter value={x.ready.total} tone={BAND_TONE[x.ready.band]} label={t('leads.col.ready')} className="w-14" />
    </span>
  )
}

/** The classification; an HNI one is "Restricted" for executives. */
function ClassChip({ cls, className }: { cls: Classification; className?: string }) {
  const { t } = useTranslation()
  const can = useCan()
  if (isHni(cls) && !can('lead.seeAll')) return <StatusChip tone="neutral" variant="outline" title={t('leads.restrictedHint')} className={className}>🔒 {t('leads.restricted')}</StatusChip>
  return <StatusChip tone={CLASS_TONE[cls]} variant={isHni(cls) ? 'soft' : 'outline'} className={className}>{t(`class.${cls}`)}</StatusChip>
}

/** Overdue (red), Today (amber), or the date — day and month only, a follow-up is always near; nothing for closed / lost leads. */
function FollowUp({ lead: l }: { lead: Lead }) {
  const { t, i18n } = useTranslation()
  const { today } = useStore()
  if (!isActive(l) || !l.nextFollowUp) return <span className="text-muted-foreground">—</span>
  const day = new Date(l.nextFollowUp).toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' })
  const full = fmtDate(l.nextFollowUp, i18n.language)
  if (isOverdue(l, today)) return <StatusChip tone="danger" className="whitespace-nowrap" title={full}>{t('leads.overdue', { date: day })}</StatusChip>
  if (isDueToday(l, today)) return <StatusChip tone="warning" title={full}>{t('leads.today')}</StatusChip>
  return <small className="whitespace-nowrap text-muted-foreground" title={full}>{day}</small>
}

/* ---------- actions ---------- */

/** Call, WhatsApp and Log activity for anyone; Move stage; Reassign for managers. Opening the lead comes with the Lead page. */
function useLeadActions(l: Lead) {
  const { t } = useTranslation()
  const { db, today, updateLead } = useStore()
  return {
    call: () => toast(t('leads.calling', { name: l.name, phone: l.phone }), { description: t('leads.demoHint') }),
    whatsapp: () => toast(t('leads.whatsapping', { name: l.name }), { description: t('leads.demoHint') }),
    log: () => toast(t('property.comingNext', { what: t('leads.logActivityModule') })),
    move: (s: LeadStage) => {
      if (s === 'lost') { toast(t('leads.lostNeedsReason')); return }
      updateLead(l.id, (x) => { x.stage = s; x.stageSince = today }, t('leads.stageNote', { stage: t(`stage.${s}`) }))
      toast.success(t('leads.stageMoved', { name: l.name, stage: t(`stage.${s}`) }))
    },
    reassign: (userId: string) => {
      updateLead(l.id, (x) => { x.ownerId = userId }, t('leads.reassignNote', { name: userName(db, userId) }))
      toast.success(t('leads.reassigned', { name: l.name, to: userName(db, userId) }))
    },
  }
}

function LeadRowMenu({ lead: l }: { lead: Lead }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { db } = useStore()
  const can = useCan()
  const a = useLeadActions(l)
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('leads.rowMenu', { name: l.name })} title={t('props.more')}
            className="text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => navigate(`/leads/${l.id}`)}><ArrowUpRight /> {t('leads.open')}</DropdownMenuItem>
          <DropdownMenuItem onClick={a.call}><Phone /> {t('leads.call')}</DropdownMenuItem>
          <DropdownMenuItem onClick={a.whatsapp}><MessageCircle /> {t('leads.whatsapp')}</DropdownMenuItem>
          <DropdownMenuItem onClick={a.log}><NotebookPen /> {t('leads.logActivity')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Tag /> {t('leads.moveStage')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {[...STAGE_ORDER, 'lost' as LeadStage].map((s) => <DropdownMenuItem key={s} disabled={s === l.stage} onClick={() => a.move(s)}>{t(`stage.${s}`)}</DropdownMenuItem>)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {can('lead.seeAll') && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Users /> {t('leads.reassign')}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {db.users.filter((u) => u.role === 'executive').map((u) => <DropdownMenuItem key={u.id} disabled={u.id === l.ownerId} onClick={() => a.reassign(u.id)}>{u.name}</DropdownMenuItem>)}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

/** Lead card: who they are and how ready, budget, what they want and their executive, stage and follow-up; Call / WhatsApp / Open. */
function LeadCard({ x }: { x: LeadItem }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const can = useCan()
  const l = x.lead
  const a = useLeadActions(l)
  const L = useLabels()
  const r = l.requirement
  const want = [L.type(r.type), (r.localities.length ? r.localities : r.cities).join(' / '), r.sizeSqft && `${num(r.sizeSqft)} sq.ft.`, r.bhk].filter(Boolean).join(' · ')
  const fact = (Icon: typeof Wallet, text: string) => (
    <p className="flex min-w-0 items-center gap-1.5"><Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate" title={text}>{text}</span></p>
  )
  return (
    <li className="flex min-w-0 flex-col rounded-xl border bg-card text-sm">
      <div className="flex items-start gap-2.5 p-3 pb-2">
        <UserAvatar name={l.name} />
        <div className="min-w-0 flex-1">
          <Link to={`/leads/${l.id}`} className="block truncate font-semibold text-primary hover:underline" title={l.name}>{l.name}</Link>
          <p className="truncate text-meta text-muted-foreground"><span className="font-mono">{l.id}</span> · {l.purpose ? t(`purpose.buyer.${l.purpose}`) : l.source}</p>
        </div>
        <ClassChip cls={x.cls} className="max-w-[45%] truncate" />
      </div>
      <div className="flex flex-col gap-2 px-3">
        <div className="flex items-center gap-2 text-meta">
          <span className="shrink-0 text-muted-foreground first-letter:uppercase">{t('props.match.readyToBuy')}</span>
          <Meter value={x.ready.total} tone={BAND_TONE[x.ready.band]} label={t('leads.col.ready')} className="flex-1" />
          <b className={cn('w-6 text-right tabular-nums', toneText[BAND_TONE[x.ready.band]])} title={t(`readiness.${x.ready.band}`)}>{x.ready.total}</b>
        </div>
        <div className="flex flex-col gap-1 text-meta">
          {fact(Wallet, `${inrShort(l.budget.min)} – ${inrShort(l.budget.max)}`)}
          {fact(MapPin, want)}
          {can('lead.seeAll') && fact(UserRound, userName(db, l.ownerId) || t('leads.unassigned'))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip tone={STAGE_TONE[l.stage]}>{t(`stage.${l.stage}`)}</StatusChip>
          <FollowUp lead={l} />
        </div>
      </div>
      <span className="flex-1" />
      <div className="mt-2.5 flex items-center gap-1.5 border-t px-3 py-2.5">
        <Button size="sm" variant="outline" className="flex-1" onClick={a.call}><Phone /> {t('leads.call')}</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={a.whatsapp}><MessageCircle /> {t('leads.whatsappShort')}</Button>
        <LeadRowMenu lead={l} />
      </div>
    </li>
  )
}
