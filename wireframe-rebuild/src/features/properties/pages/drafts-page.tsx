/**
 * Drafts — the properties still being added, as in spec-system-wireframe (views-add-property.js → draftsList):
 * the property list's search bar and pager, tabs Draft / Ready to publish / Waiting for approval, and per row what is
 * still needed to publish. A row opens the draft in the AI assistant. Executives see their own drafts; managers see all.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { type Column, DataTable } from '@/components/app/data-table'
import { EmptyState } from '@/components/app/empty-state'
import { Page, PageHeader } from '@/components/app/page-header'
import { StatusChip } from '@/components/app/status-chip'
import type { Tone } from '@/components/app/tone'
import { useCrumbs } from '@/components/layout/crumbs'
import { LISTED_STATUSES } from '@/data/catalogue'
import type { Property } from '@/data/types'
import { draftFromRecord, draftScore, missingKeys } from '@/lib/assistant'
import { fmtDate, inr, inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useCan, useStore, userName } from '@/store/db'
import { useFactText } from '../assistant/use-fact-text'
import { CompletionBar, PropertyPhoto } from '../components/property-bits'
import { dropKeys, matches, PAGE_SIZES, parseSentence, type PSFilters, type PSItem, relaxFor, setValue, sortList } from '../search/prop-search'
import { type Pill, SearchBar, useFilterWords } from '../search/search-bar'

export type DraftState = 'draft' | 'ready' | 'waiting'
const STATE_TONE: Record<DraftState, Tone> = { draft: 'warning', ready: 'success', waiting: 'info' }
const PILL_KEYS: Record<Exclude<Pill, 'sort'>, string[]> = { type: ['type'], city: ['city', 'locality'], budget: ['price'], size: ['bhk', 'area'], more: ['purpose', 'facing', 'corner', 'amen'] }

/** Where a draft stands, and what it still needs to be published. */
export function draftState(p: Property): { state: DraftState; missing: string[]; score: number } {
  const d = draftFromRecord(p)
  const missing = missingKeys(d).filter((k) => !k.startsWith('spec:?'))
  const score = draftScore(d, { uploaded: p.approvals.filter((a) => a.status !== 'pending').map((a) => a.approvalId), any: p.documents.length > 0 })
  return { state: p.submitted ? 'waiting' : missing.length ? 'draft' : 'ready', missing, score }
}

/** Filters, tab and paging kept while a draft is open and you come back. */
let saved: { f: PSFilters; tab: DraftState | ''; aiOpen: boolean; page: number; size: number } = { f: {}, tab: '', aiOpen: false, page: 1, size: 10 }

export function DraftsPage() {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const W = useFilterWords()
  const ft = useFactText()
  const navigate = useNavigate()
  const { db, user } = useStore()
  const can = useCan()
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.properties'), to: '/properties' }, { label: t('drafts.title') }])

  const [st, setSt] = useState(saved)
  const [open, setOpen] = useState<Pill | null>(null)
  useEffect(() => { saved = st }, [st])
  const f = st.f
  const setF = (nf: PSFilters) => setSt((s) => ({ ...s, f: nf, page: 1 }))

  // executives see the drafts they started; managers see everyone's
  const mine = (p: Property) => can('property.seeDrafts') || p.created.by === user.id
  const items = db.properties.filter((p) => p.status === 'draft' && !p.archived && mine(p)).map((p) => {
    const s = draftState(p)
    return {
      item: {
        raw: p, id: p.id, title: p.title, type: p.type, purpose: p.purpose, city: p.location.city, locality: p.location.locality,
        price: p.price, area: p.areaSqft, facing: '', specs: p.specs, amenities: p.amenities, status: p.status, archived: false,
        date: p.updated.at, score: s.score, attn: [],
      } satisfies PSItem,
      ...s,
    }
  })
  const typeLabel = L.type
  const filtered = items.filter((x) => matches(x.item, f, [], typeLabel))
  const tabs = (['', 'draft', 'ready', 'waiting'] as const).map((v) => ({ v, n: filtered.filter((x) => !v || x.state === v).length }))
  // newest change first, unless a sort is chosen
  const list = sortList(filtered.filter((x) => !st.tab || x.state === st.tab).map((x) => x.item), f.sort)
  const relax = !list.length && items.length ? relaxFor(items.map((x) => x.item), f) : null

  const size = st.size
  const pages = Math.max(1, Math.ceil(list.length / size))
  const page = Math.min(Math.max(1, st.page), pages)
  const from = (page - 1) * size
  const shown = list.slice(from, from + size)
  const info = (id: string) => items.find((x) => x.item.id === id)!

  const ask = (text: string) => {
    text = text.trim()
    if (!text) { toast(t('ps.typeOrSay')); return }
    const p = parseSentence(text, LISTED_STATUSES)
    setF(p.type || p.city || p.purpose || p.ai ? { ...p, status: undefined, aiText: text, aiRan: text } : { aiText: text, aiRan: text, aiMiss: true })
    setOpen(null)
  }
  const relaxButton = relax && (
    <Button size="sm" variant="outline" onClick={() => setF(dropKeys(f, relax.drop.map((c) => c.k)))}>
      {t('ps.showWithout', { n: relax.n, what: relax.drop.map(W.critText).join(` ${t('ps.and')} `) })}
    </Button>
  )
  const understood = f.aiMiss ? <span className="font-medium text-warning">{t('ps.miss')}</span>
    : f.aiRan ? <span className="text-muted-foreground">{list.length ? t('ps.found', { count: list.length }) : t('ps.noExact')}</span>
      : <span className="text-muted-foreground">{t('drafts.searchHint')}</span>

  return (
    <Page full className="pb-0">
      <PageHeader title={t('drafts.title')} description={t('drafts.subtitle')}
        actions={<>
          <Button variant="outline" asChild><Link to="/properties">← {t('drafts.allProperties')}</Link></Button>
          <Button asChild><Link to="/properties/new">＋ {t('props.add')}</Link></Button>
        </>} />

      <div className="z-10 -mx-4 bg-background px-4 pt-2 md:-mx-6 md:px-6 lg:sticky lg:top-[49px]">
        <SearchBar filters={f} items={items.map((x) => x.item)} onChange={(nf) => setSt((s) => ({ ...s, f: nf }))}
          onSet={(k, v) => { setF(setValue(f, k, v)); if (['type', 'sort', 'budget'].includes(k)) setOpen(null) }}
          onClearPill={(pl) => { setOpen(null); setF(dropKeys(f, PILL_KEYS[pl as Exclude<Pill, 'sort'>])) }}
          onClearAll={() => { setOpen(null); setF({}) }}
          aiOpen={st.aiOpen} onToggleAi={() => { setSt((s) => ({ ...s, aiOpen: !s.aiOpen })); setOpen(null) }}
          onAsk={ask} listening={false} onVoice={() => toast(t('ps.voiceDemo'))} open={open} setOpen={setOpen} understood={understood} />
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto border-b [scrollbar-width:none]">
          {tabs.map((o) => {
            const on = st.tab === o.v
            return (
              <button key={o.v || 'all'} type="button" onClick={() => setSt((s) => ({ ...s, tab: o.v, page: 1 }))} aria-current={on ? 'page' : undefined}
                className={cn('-mb-px border-b-2 px-3 pt-2 pb-[9px] text-ui font-medium whitespace-nowrap', on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {o.v ? t(`drafts.state.${o.v}`) : t('attn.all')}
                <span className={cn('ml-1 rounded-full px-[7px] text-label', on ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}>{o.n}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-2.5">
        {!items.length ? (
          <EmptyState variant="card" action={<Button asChild><Link to="/properties/new">＋ {t('props.add')}</Link></Button>}>{t('drafts.none')}</EmptyState>
        ) : !list.length ? (
          <EmptyState variant="card" action={relaxButton || undefined}>{t('drafts.noneMatch')}</EmptyState>
        ) : (
          <DataTable<Property> label={t('drafts.title')} rows={shown.map((x) => x.raw)} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/properties/${p.id}/edit`)}
            columns={[
              {
                key: 'title', header: t('table.property'), cell: (p) => {
                  const s = info(p.id)
                  return (
                    <div className="flex min-w-56 items-start gap-3">
                      <span aria-hidden className="w-12 shrink-0 md:w-16">
                        <PropertyPhoto type={p.type} media={p.media.find((m) => m.isCover) ?? p.media[0]} alt="" className="h-9 w-12 rounded-lg md:h-12 md:w-16" iconClassName="size-5" />
                      </span>
                      <div className="whitespace-normal">
                        <b className="block max-md:line-clamp-2">{p.title || t('drafts.untitled')}</b>
                        <small className="text-muted-foreground"><span className="font-mono whitespace-nowrap">{p.id}</span> · {L.type(p.type)}{p.sources?.purpose || !p.sources ? ` · ${L.purpose(p.purpose)}` : ''}</small>
                        {s.missing.length > 0 && (
                          <small className="block text-danger">{t('drafts.needs', { list: s.missing.map((k) => ft.label(k, p.type)).join(', ') })}</small>
                        )}
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
                          {p.price > 0 && <b className="text-sm whitespace-nowrap">{inrShort(p.price)}</b>}
                          <StatusChip tone={STATE_TONE[s.state]}>{t(`drafts.state.${s.state}`)}</StatusChip>
                        </span>
                      </div>
                    </div>
                  )
                },
              },
              { key: 'loc', header: t('table.location'), hideBelow: 'xl', cell: (p) => p.location.locality ? <>{p.location.locality}<br /><small className="text-muted-foreground">{p.location.city}</small></> : <span className="text-muted-foreground">{p.location.city || '—'}</span> },
              { key: 'area', header: t('table.area'), align: 'right', hideBelow: 'xl', cell: (p) => p.areaSqft > 0 ? <span className="whitespace-nowrap">{num(p.areaSqft)} <small className="text-muted-foreground">sq.ft.</small></span> : <span className="text-muted-foreground">—</span> },
              {
                key: 'price', header: t('table.askingPrice'), align: 'right', hideBelow: 'md', cell: (p) => p.price > 0
                  ? <><b className="whitespace-nowrap">{inrShort(p.price)}</b>{p.areaSqft > 0 && <><br /><small className="whitespace-nowrap text-muted-foreground">{inr(Math.round(p.price / p.areaSqft))}/sq.ft.</small></>}</>
                  : <span className="text-muted-foreground">—</span>,
              },
              {
                key: 'approvals', header: t('drafts.approvals'), hideBelow: 'wide', cell: (p) => p.approvals.length ? (
                  <span className="inline-flex flex-wrap gap-1">
                    {p.approvals.map((a) => <StatusChip key={a.approvalId} tone={a.status === 'pending' ? 'warning' : 'info'}>{ft.approval(a.approvalId)}{a.status === 'pending' ? ` · ${t('drawer.docPending')}` : ''}</StatusChip>)}
                  </span>
                ) : <span className="text-muted-foreground">—</span>,
              },
              { key: 'status', header: t('table.status'), hideBelow: 'md', cell: (p) => { const s = info(p.id).state; return <StatusChip tone={STATE_TONE[s]}>{t(`drafts.state.${s}`)}</StatusChip> } },
              { key: 'updated', header: t('drafts.updated'), hideBelow: 'lg', cell: (p) => <small className="whitespace-nowrap text-muted-foreground">{fmtDate(p.updated.at, i18n.language)}<br />{userName(db, p.created.by)}</small> },
              {
                key: 'score', header: t('table.complete'), hideBelow: 'xl', cell: (p) => {
                  const s = info(p.id)
                  return <span className="inline-flex" title={s.missing.length ? t('assistant.needed', { list: s.missing.map((k) => ft.label(k, p.type)).join(', ') }) : t('assistant.allIn')}><CompletionBar score={s.score} /></span>
                },
              },
            ] satisfies Column<Property>[]} />
        )}
      </div>

      <div className="z-10 -mx-4 flex flex-wrap items-center gap-3 bg-background px-4 py-2.5 text-ui text-muted-foreground md:sticky md:bottom-0 md:-mx-6 md:px-6">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-card px-3">
              {t('ps.rowsPerPage')} <b className="text-foreground">{size}</b> <span className="text-micro">▾</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto min-w-[150px] rounded-xl p-2">
            {PAGE_SIZES.map((n) => (
              <button key={n} type="button" onClick={() => setSt((s) => ({ ...s, size: n, page: 1 }))}
                className={cn('block w-full rounded-[7px] px-2.5 py-[7px] text-left text-ui text-foreground hover:bg-muted', n === size && 'bg-accent text-primary')}>{t('ps.rows', { n })}</button>
            ))}
          </PopoverContent>
        </Popover>
        <span className="flex-1 text-center max-lg:order-3 max-lg:basis-full max-lg:text-left">
          {list.length ? <>{t('ps.showing')} <b className="text-secondary-foreground">{from + 1}–{from + shown.length}</b> {t('ps.of')} <b className="text-secondary-foreground">{list.length}</b> {t('drafts.count', { count: list.length })}</> : t('ps.nothingToShow')}
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
