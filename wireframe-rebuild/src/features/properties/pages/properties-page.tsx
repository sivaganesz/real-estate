/**
 * Property specification database — the property list, exactly as spec-system-wireframe (views-properties.js + property-search.js):
 * heading with Drafts / Add property / Bulk import, the "need attention" strip, the search bar and status tabs (sticky),
 * the table with completion rings, and the pager. Filters and paging are kept while you open a property and come back.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DataTable } from '@/components/app/data-table'
import { Page, PageHeader } from '@/components/app/page-header'
import { StatusChip } from '@/components/app/status-chip'
import { useCrumbs } from '@/components/layout/crumbs'
import { LISTED_STATUSES } from '@/data/catalogue'
import { DEMO_TODAY } from '@/data/seed'
import { fmtDate, inr, inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { ATTENTION_KEYS, type Attention, attentionFor, listingScore } from '@/lib/property'
import { cn } from '@/lib/utils'
import { useCan, useStore } from '@/store/db'
import type { Property } from '@/data/types'
import { CompletionRing, PropertyStatusChip } from '../components/property-bits'
import { dropKeys, EXAMPLES, matches, PAGE_SIZES, parseSentence, type PSFilters, type PSItem, relaxFor, setValue, sortList } from '../search/prop-search'
import { type Pill, SearchBar, useFilterWords } from '../search/search-bar'

/** List state kept between visits (as the current wireframe keeps UI.filters in memory). */
type ListState = { f: PSFilters; aiOpen: boolean; attnHidden: boolean; page: number; size: number }
let saved: ListState = { f: {}, aiOpen: false, attnHidden: false, page: 1, size: 10 }

const PILL_KEYS: Record<Exclude<Pill, 'sort'>, string[]> = { type: ['type'], city: ['city', 'locality'], budget: ['price'], size: ['bhk', 'area'], more: ['purpose', 'facing', 'corner', 'amen'] }
const VOICE_SAMPLE = '2 BHK flat in Madurai under 60 lakh with lift'

export function PropertiesPage() {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const W = useFilterWords()
  const navigate = useNavigate()
  const { db } = useStore()
  const can = useCan()
  const manager = can('property.manage')
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.properties') }])

  const [st, setSt] = useState<ListState>(saved)
  const [open, setOpen] = useState<Pill | null>(null)
  const [listening, setListening] = useState(false)
  const voiceTimer = useRef<number | null>(null)
  useEffect(() => { saved = st }, [st])
  useEffect(() => () => { if (voiceTimer.current) window.clearInterval(voiceTimer.current) }, [])
  const f = st.f
  // any filter change goes back to page 1
  const setF = (nf: PSFilters, keepPage = false) => setSt((s) => ({ ...s, f: nf, page: keepPage ? s.page : 1 }))

  // drafts live on their own page (Drafts), as in the current wireframe
  const items: PSItem[] = useMemo(() => db.properties.filter((p) => p.status !== 'draft').map((p) => ({
    raw: p, id: p.id, title: p.title, type: p.type, purpose: p.purpose, city: p.location.city, locality: p.location.locality,
    price: p.price, area: p.areaSqft, facing: p.facing ? { E: 'East', W: 'West', N: 'North', S: 'South', NE: 'North-east', NW: 'North-west', SE: 'South-east', SW: 'South-west' }[p.facing] : '',
    specs: p.specs, amenities: p.amenities, status: p.status, archived: !!p.archived, date: p.listedAt ?? p.created.at,
    score: listingScore(p).score, attn: p.archived ? [] : attentionFor(p, db, DEMO_TODAY),
  })), [db])
  const drafts = db.properties.filter((p) => p.status === 'draft' && !p.archived).length
  const typeLabel = L.type
  const list = useMemo(() => sortList(items.filter((x) => matches(x, f, [], typeLabel)), f.sort), [items, f, typeLabel])
  const relax = !list.length ? relaxFor(items, f) : null

  /* paging */
  const pages = Math.max(1, Math.ceil(list.length / st.size))
  const page = Math.min(Math.max(1, st.page), pages)
  const from = (page - 1) * st.size
  const shown = list.slice(from, from + st.size)
  const archivedN = items.filter((x) => x.archived).length

  /* AI sentence search */
  const ask = (text: string) => {
    text = text.trim()
    if (!text) { toast(t('ps.typeOrSay')); return }
    const p = parseSentence(text, LISTED_STATUSES)
    const got = p.type || p.city || p.purpose || p.status || p.ai || p.sort
    setF(got ? { ...p, aiText: text, aiRan: text } : { aiText: text, aiRan: text, aiMiss: true })
    setOpen(null)
  }
  const voice = () => {
    if (listening) { if (voiceTimer.current) window.clearInterval(voiceTimer.current); setListening(false); return }
    // the wireframe "hears" a sample phrase so the flow can be shown without a microphone
    toast(t('ps.voiceDemo'))
    setListening(true)
    let i = 0
    voiceTimer.current = window.setInterval(() => {
      i += 3
      setSt((s) => ({ ...s, f: { ...s.f, aiText: VOICE_SAMPLE.slice(0, i) } }))
      if (i >= VOICE_SAMPLE.length) { if (voiceTimer.current) window.clearInterval(voiceTimer.current); setListening(false); ask(VOICE_SAMPLE) }
    }, 70)
  }
  const onSet = (k: string, v: string | number | boolean | '') => {
    setF(setValue(f, k, v))
    if (['type', 'sort', 'budget'].includes(k) || (k === 'city' && !v)) setOpen(null) // single choice: close the panel
  }

  const noun = (n: number) => t('ps.properties', { count: n })
  const stale = !!f.aiRan && f.aiText !== f.aiRan
  const exampleChips = EXAMPLES.map((x) => (
    <button key={x} type="button" onClick={() => ask(x)} className="rounded-full border border-dashed border-violet/40 bg-card px-2.5 py-0.5 text-[12.5px] text-violet hover:bg-violet-soft">{x}</button>
  ))
  const relaxButton = relax && (
    <Button size="sm" variant="outline" onClick={() => setF(dropKeys(f, relax.drop.map((c) => c.k)))}>
      {t('ps.showWithout', { n: relax.n, what: relax.drop.map(W.critText).join(` ${t('ps.and')} `) })}
    </Button>
  )
  const understood = stale ? <span className="text-muted-foreground">{t('ps.pressEnter')}</span>
    : f.aiMiss ? <><span className="font-medium text-warning">{t('ps.miss')}</span> {exampleChips}</>
      : f.aiRan ? <><span className="text-muted-foreground">{list.length ? <>{t('ps.found', { count: list.length })}</> : t('ps.noExact')}</span>{relaxButton}</>
        : <><span className="text-muted-foreground">{t('ps.try')}</span> {exampleChips}</>

  /* status tabs, counted with every other filter applied; empty ones hidden */
  const tabDefs = [{ v: '', l: t('attn.all') }, ...LISTED_STATUSES.map((s) => ({ v: s as string, l: t(`status.${s}`) })), { v: '__arch', l: t('ps.archived') }]
    .map((o) => ({ ...o, n: items.filter((x) => matches(x, { ...f, status: o.v }, [], typeLabel)).length }))
    .filter((o) => !o.v || o.n || (f.status ?? '') === o.v)

  /* the AI "needs attention" strip */
  const groups = ATTENTION_KEYS.map((k) => ({ k, n: items.filter((x) => x.attn.some((a) => a.key === k)).length })).filter((g) => g.n)
  const flagged = items.filter((x) => x.attn.length).length
  const attnText = (a: Attention) => t(`attn.${a.key}${a.key === 'price' ? '_' + a.values?.dir : ''}`, a.values ?? {})
  const attnFix = (p: Property, a: Attention) => a.key === 'details' ? `/properties/${p.id}/edit` : a.key === 'price' ? `/properties/${p.id}/price` : a.key === 'docs' ? `/properties/${p.id}/legal` : `/properties/${p.id}/matching`

  return (
    <Page className="pb-0">
      <PageHeader title={t('ps.title')} description={t('ps.subtitle')}
        actions={manager && (
          <>
            {drafts > 0 && <Button variant="outline" asChild><Link to="/properties/drafts">📝 {t('ps.drafts')} <StatusChip tone="neutral" className="h-5">{drafts}</StatusChip></Link></Button>}
            <Button asChild><Link to="/properties/new">＋ {t('props.add')}</Link></Button>
            <Button variant="outline" asChild><Link to="/import">📥 {t('nav.import')}</Link></Button>
          </>
        )} />

      {!st.attnHidden && flagged > 0 && (
        <div className="mb-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-violet/20 bg-gradient-to-r from-violet-soft to-accent py-2 pr-2.5 pl-3.5 text-[13px]">
          <span className="mr-1.5 text-violet">✨ <b>{t('ps.attnLead', { count: flagged })}</b> {t('ps.needAttention')}</span>
          {groups.map((g) => (
            <button key={g.k} type="button" onClick={() => setF({ ...f, attn: f.attn === g.k ? undefined : g.k })}
              className={cn('rounded-full border px-2.5 py-0.5 text-[12.5px]', f.attn === g.k ? 'border-violet bg-violet text-white' : 'border-violet/30 bg-card text-violet hover:bg-violet-soft')}>
              {t(`attn.group.${g.k}`)} <b className="ml-0.5">{g.n}</b>
            </button>
          ))}
          <span className="flex-1" />
          <button type="button" onClick={() => setSt((s) => ({ ...s, attnHidden: true, f: { ...s.f, attn: undefined } }))} title={t('ps.hideForNow')} aria-label={t('ps.hideForNow')}
            className="grid size-6 place-items-center rounded-full text-xs text-violet/70 hover:bg-violet-soft">✕</button>
        </div>
      )}

      {/* search + tabs stay at the top while the table scrolls */}
      <div className="z-10 -mx-4 bg-background px-4 pt-2 md:-mx-6 md:px-6 lg:sticky lg:top-[83px]">
        <SearchBar filters={f} items={items} onChange={(nf) => setF(nf, true)} onSet={onSet}
          onClearPill={(pl) => { setOpen(null); setF(dropKeys(f, PILL_KEYS[pl as Exclude<Pill, 'sort'>])) }}
          onClearAll={() => { setOpen(null); setF({}) }}
          aiOpen={st.aiOpen} onToggleAi={() => { setSt((s) => ({ ...s, aiOpen: !s.aiOpen })); setOpen(null); if (listening) voice() }}
          onAsk={ask} listening={listening} onVoice={voice} open={open} setOpen={setOpen} understood={understood} />
        <div className="flex items-center gap-0.5 overflow-x-auto border-b [scrollbar-width:none]">
          {tabDefs.map((o) => {
            const on = (f.status ?? '') === o.v
            return (
              <button key={o.v || 'all'} type="button" onClick={() => setF({ ...f, status: o.v || undefined })} aria-current={on ? 'page' : undefined}
                className={cn('-mb-px border-b-2 px-3 pt-2 pb-[9px] text-[13px] font-medium whitespace-nowrap', on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {o.l} <span className={cn('ml-1 rounded-full px-[7px] text-[11.5px]', on ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}>{o.n}</span>
              </button>
            )
          })}
          {st.attnHidden && (
            <button type="button" onClick={() => setSt((s) => ({ ...s, attnHidden: false }))} className="ml-auto text-[12.5px] font-medium whitespace-nowrap text-violet">✨ {t('ps.needsAttention')}</button>
          )}
        </div>
      </div>

      <div className="mt-2.5">
        {list.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {t('ps.noneMatch')}
            {relaxButton && <div className="mt-4">{relaxButton}</div>}
          </div>
        ) : (
          <DataTable<Property> label={t('ps.title')} rows={shown.map((x) => x.raw)} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/properties/${p.id}`)}
            columns={[
              { key: 'id', header: t('table.id'), cell: (p) => <span className="font-mono text-[12.5px] whitespace-nowrap">{p.id}</span> },
              {
                key: 'title', header: t('table.property'), cell: (p) => {
                  const item = items.find((x) => x.id === p.id)!
                  return (
                    <div className="min-w-48">
                      <b className="block">{p.title}</b>
                      <small className="text-muted-foreground">{L.type(p.type)} · {L.purpose(p.purpose)}</small>
                      {f.attn && item.attn.filter((a) => a.key === f.attn).map((a) => (
                        <span key={a.key} className="mt-1 block text-xs text-warning">⚠ {attnText(a)} · <Link to={attnFix(p, a)} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{t(`attn.act.${a.key}`)} →</Link></span>
                      ))}
                    </div>
                  )
                },
              },
              { key: 'loc', header: t('table.location'), hideOnPhone: true, cell: (p) => <>{p.location.locality}<br /><small className="text-muted-foreground">{p.location.city}</small></> },
              { key: 'area', header: t('table.area'), align: 'right', hideOnPhone: true, cell: (p) => <span className="whitespace-nowrap">{num(p.areaSqft)} <small className="text-muted-foreground">sq.ft.</small></span> },
              { key: 'price', header: t('table.askingPrice'), align: 'right', cell: (p) => <><b className="whitespace-nowrap">{inrShort(p.price)}</b><br /><small className="whitespace-nowrap text-muted-foreground">{inr(p.areaSqft ? Math.round(p.price / p.areaSqft) : 0)}/sq.ft.</small></> },
              { key: 'status', header: t('table.status'), cell: (p) => <span className="inline-flex flex-wrap gap-1"><PropertyStatusChip property={{ status: p.status }} />{p.archived && <StatusChip tone="neutral" variant="outline">{t('ps.archived')}</StatusChip>}</span> },
              { key: 'listed', header: t('table.listed'), hideOnPhone: true, cell: (p) => <small className="whitespace-nowrap text-muted-foreground">{fmtDate(p.listedAt, i18n.language)}</small> },
              {
                key: 'score', header: <span title={t('ps.scoreHint')}>{t('table.completionScore')}</span>, className: 'w-[140px] text-center align-middle', hideOnPhone: true, cell: (p) => {
                  const sc = listingScore(p)
                  return <span title={sc.missing.length ? t('ps.toReach', { list: sc.missing.map((m) => `${t(`score.${m.key}`)} (+${m.max - m.points}%)`).join(', ') }) : t('ps.complete')} className="inline-flex"><CompletionRing score={sc.score} size={46} /></span>
                },
              },
            ]} />
        )}
      </div>

      {/* pager: rows per page, showing x–y of n, Prev / Next — stays at the bottom */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-0 flex flex-wrap items-center gap-3 bg-background px-4 py-2.5 text-[13px] text-muted-foreground md:-mx-6 md:px-6">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-card px-3">
              {t('ps.rowsPerPage')} <b className="text-foreground">{st.size}</b> <span className="text-[10px]">▾</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto min-w-[150px] rounded-xl p-2">
            {PAGE_SIZES.map((n) => (
              <button key={n} type="button" onClick={() => setSt((s) => ({ ...s, size: n, page: 1 }))}
                className={cn('block w-full rounded-[7px] px-2.5 py-[7px] text-left text-[13px] text-foreground hover:bg-muted', n === st.size && 'bg-accent text-primary')}>{t('ps.rows', { n })}</button>
            ))}
          </PopoverContent>
        </Popover>
        <span className="flex-1 text-center max-lg:order-3 max-lg:basis-full max-lg:text-left">
          {list.length ? <>{t('ps.showing')} <b className="text-secondary-foreground">{from + 1}–{from + shown.length}</b> {t('ps.of')} <b className="text-secondary-foreground">{list.length}</b> {noun(list.length)}</> : t('ps.nothingToShow')}
          {archivedN > 0 && ` · ${t('ps.archivedCount', { count: archivedN })}`}
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
