import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LayoutGrid, List, Mic, Plus, Search, SearchX, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { StatusBadge } from '@/components/property/badges'
import { PropertyCard } from '@/components/property/property-card'
import { PropertyPhoto } from '@/components/property/property-photo'
import { CITIES, TYPE_ORDER } from '@/data/catalogue'
import { inrShort } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { leadsForProperty, type Match } from '@/lib/matching'
import { completion, pendingApprovals, PHOTO_TARGET } from '@/lib/property'
import { applyFilters, EMPTY_FILTERS, hasFilters, parseQuery, type Filters } from '@/lib/search'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads } from '@/store/db'
import type { Property } from '@/data/types'

type View = 'available' | 'drafts' | 'attention' | 'listed' | 'all'
type Sort = 'newest' | 'priceAsc' | 'priceDesc' | 'mostLeads'

const BUDGETS: { k: string; min?: number; max?: number }[] = [
  { k: 'u30', max: 3e6 },
  { k: '30to60', min: 3e6, max: 6e6 },
  { k: '60to1cr', min: 6e6, max: 1e7 },
  { k: '1to3cr', min: 1e7, max: 3e7 },
  { k: '3crPlus', min: 3e7 },
]

const EXAMPLE = 'east-facing plots in Madurai under 35 L'

/** Listed properties that need a manager's attention: an approval without its document, too few photos, or no exact location. */
const needsAttention = (p: Property) =>
  p.status !== 'draft' && p.status !== 'sold' &&
  (pendingApprovals(p).length > 0 || p.media.filter((m) => m.kind === 'photo').length < PHOTO_TARGET || !p.location.exact)

export function PropertiesPage() {
  const { t } = useTranslation()
  const L = useLabels()
  const { db } = useStore()
  const can = useCan()
  const leads = useVisibleLeads()
  const navigate = useNavigate()
  const manager = can('property.manage')
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'available'
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [filters, setFilters] = useState<Filters>(() => (params.get('q') ? parseQuery(params.get('q')!) : EMPTY_FILTERS))
  const [sort, setSort] = useState<Sort>('newest')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')

  const visible = useMemo(() => db.properties.filter((p) => manager || p.status !== 'draft'), [db.properties, manager])
  const matches = useMemo(() => {
    const m = new Map<string, Match[]>()
    visible.forEach((p) => m.set(p.id, leadsForProperty(p, leads, db.settings)))
    return m
  }, [visible, leads, db.settings])

  const views: { k: View; n: number }[] = manager
    ? [
        { k: 'available', n: visible.filter((p) => p.status === 'available').length },
        { k: 'drafts', n: visible.filter((p) => p.status === 'draft').length },
        { k: 'attention', n: visible.filter(needsAttention).length },
        { k: 'all', n: visible.length },
      ]
    : [
        { k: 'available', n: visible.filter((p) => p.status === 'available').length },
        { k: 'listed', n: visible.length },
      ]

  const results = useMemo(() => {
    const inView = visible.filter((p) =>
      view === 'available' ? p.status === 'available'
        : view === 'drafts' ? p.status === 'draft'
          : view === 'attention' ? needsAttention(p)
            : true)
    const list = applyFilters(inView, filters)
    const byLeads = (p: Property) => matches.get(p.id)?.length ?? 0
    return [...list].sort((a, b) =>
      sort === 'priceAsc' ? a.price - b.price
        : sort === 'priceDesc' ? b.price - a.price
          : sort === 'mostLeads' ? byLeads(b) - byLeads(a)
            : (b.listedAt ?? '').localeCompare(a.listedAt ?? ''))
  }, [visible, view, filters, sort, matches])

  const setView = (v: View) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('view', v); return n }, { replace: true })

  const runSearch = (text: string) => {
    setQuery(text)
    setFilters(text.trim() ? parseQuery(text) : EMPTY_FILTERS)
    setParams((prev) => { const n = new URLSearchParams(prev); if (text.trim()) n.set('q', text); else n.delete('q'); return n }, { replace: true })
  }
  const onSubmit = (e: FormEvent) => { e.preventDefault(); runSearch(query) }
  const clearAll = () => runSearch('')
  const patch = (f: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...f }))

  const budgetKey = BUDGETS.find((b) => b.max === filters.maxPrice && b.min === filters.minPrice)?.k ?? ''
  const cityKey = filters.cities.length === 1 && !filters.localities.length ? filters.cities[0] : ''

  /* "Understood" chips — what the search turned into, each removable */
  const chips: { key: string; label: string; remove: () => void }[] = []
  filters.types.forEach((ty) => chips.push({ key: 'type-' + ty, label: L.type(ty), remove: () => patch({ types: filters.types.filter((x) => x !== ty) }) }))
  if (filters.commCategory) chips.push({ key: 'comm', label: filters.commCategory, remove: () => patch({ commCategory: undefined }) })
  if (filters.bhk) chips.push({ key: 'bhk', label: filters.bhk, remove: () => patch({ bhk: undefined }) })
  if (filters.purpose) chips.push({ key: 'purpose', label: L.purpose(filters.purpose), remove: () => patch({ purpose: undefined }) })
  filters.localities.forEach((l) => chips.push({ key: 'loc-' + l, label: l, remove: () => patch({ localities: filters.localities.filter((x) => x !== l) }) }))
  filters.cities.filter((c) => !filters.localities.some((l) => CITIES[c]?.includes(l)))
    .forEach((c) => chips.push({ key: 'city-' + c, label: c, remove: () => patch({ cities: filters.cities.filter((x) => x !== c) }) }))
  if (filters.minPrice || filters.maxPrice) {
    const label = filters.minPrice && filters.maxPrice ? `${inrShort(filters.minPrice)} – ${inrShort(filters.maxPrice)}`
      : filters.maxPrice ? t('search.under', { amount: inrShort(filters.maxPrice) }) : t('search.above', { amount: inrShort(filters.minPrice) })
    chips.push({ key: 'price', label, remove: () => patch({ minPrice: undefined, maxPrice: undefined }) })
  }
  if (filters.facing) chips.push({ key: 'facing', label: t('search.facing', { dir: L.facing(filters.facing) }), remove: () => patch({ facing: undefined }) })
  if (filters.text) chips.push({ key: 'text', label: `“${filters.text}”`, remove: () => patch({ text: undefined }) })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('properties.title')}</h1>
          <p className="text-sm text-muted-foreground">{manager ? t('properties.subtitleManager') : t('properties.subtitleExecutive')}</p>
        </div>
        {manager && (
          <Button size="lg" onClick={() => navigate('/properties/new')} className="max-md:hidden">
            <Plus /> {t('action.add')}
          </Button>
        )}
      </header>

      {/* plain-words search */}
      <form onSubmit={onSubmit} role="search" className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('search.label')}
            placeholder={t('search.placeholder', { example: EXAMPLE })} className="h-12 rounded-xl pr-24 pl-10 text-base"
          />
          <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label={t('search.voice')}
              onClick={() => { toast(t('search.listening'), { description: t('search.voiceSimulated') }); runSearch(EXAMPLE) }}>
              <Mic />
            </Button>
            <Button type="submit" size="icon" aria-label={t('search.go')}><Search /></Button>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Sparkles className="size-3.5" />{t('search.understood')}</span>
            {chips.map((c) => (
              <Badge key={c.key} variant="secondary" className="h-7 gap-1 pr-1 pl-2.5 text-sm">
                {c.label}
                <button type="button" onClick={c.remove} aria-label={t('search.remove', { what: c.label })} className="rounded-full p-0.5 hover:bg-foreground/10">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <Button type="button" variant="link" size="sm" onClick={clearAll}>{t('search.clear')}</Button>
          </div>
        )}
      </form>

      {/* quick filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ToggleGroup type="multiple" variant="outline" size="sm" value={filters.types} onValueChange={(v) => patch({ types: v as Filters['types'] })} aria-label={t('filters.type')}>
            {TYPE_ORDER.map((ty) => <ToggleGroupItem key={ty} value={ty} className="whitespace-nowrap">{L.type(ty)}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <Select value={cityKey || 'any'} onValueChange={(v) => patch({ cities: v === 'any' ? [] : [v], localities: [] })}>
            <SelectTrigger className="flex-1 lg:w-auto lg:min-w-44" aria-label={t('filters.city')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('filters.anyCity')}</SelectItem>
              {Object.keys(CITIES).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={budgetKey || 'any'} onValueChange={(v) => { const b = BUDGETS.find((x) => x.k === v); patch({ minPrice: b?.min, maxPrice: b?.max }) }}>
            <SelectTrigger className="flex-1 lg:w-auto lg:min-w-44" aria-label={t('filters.budget')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('filters.anyBudget')}</SelectItem>
              {BUDGETS.map((b) => <SelectItem key={b.k} value={b.k}>{t(`filters.budgets.${b.k}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* views + sort + layout */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <nav className="-mb-2.5 flex gap-1 overflow-x-auto" aria-label={t('properties.views')}>
          {views.map((v) => (
            <button key={v.k} type="button" onClick={() => setView(v.k)} aria-current={view === v.k ? 'page' : undefined}
              className={cn('flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-sm whitespace-nowrap transition-colors',
                view === v.k ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t(`properties.view.${v.k}`)} <span className="rounded-full bg-muted px-1.5 text-xs">{v.n}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger size="sm" className="w-auto" aria-label={t('sort.label')}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['newest', 'priceAsc', 'priceDesc', 'mostLeads'] as Sort[]).map((s) => <SelectItem key={s} value={s}>{t(`sort.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          {manager && (
            <ToggleGroup type="single" variant="outline" size="sm" value={layout} onValueChange={(v) => v && setLayout(v as 'grid' | 'list')} className="max-md:hidden">
              <ToggleGroupItem value="grid" aria-label={t('layout.grid')}><LayoutGrid /></ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label={t('layout.list')}><List /></ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">{t('properties.showing', { count: results.length })}</p>

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <SearchX className="size-8 text-muted-foreground" />
          <p className="font-medium">{t('properties.emptyTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('properties.emptyBody')}</p>
          {hasFilters(filters) && <Button variant="outline" onClick={clearAll}>{t('search.clear')}</Button>}
        </div>
      ) : layout === 'grid' || !manager ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((p) => <PropertyCard key={p.id} property={p} matches={matches.get(p.id) ?? []} />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{t('table.property')}</th>
                <th className="p-3 font-medium">{t('table.location')}</th>
                <th className="p-3 text-right font-medium">{t('table.price')}</th>
                <th className="p-3 font-medium">{t('table.status')}</th>
                <th className="p-3 text-right font-medium">{t('table.leadsFit')}</th>
                <th className="p-3 text-right font-medium">{t('table.complete')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/40">
                  <td className="p-3">
                    <Link to={`/properties/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                      <PropertyPhoto type={p.type} media={p.media[0]} alt="" className="size-10 shrink-0 rounded-md" iconClassName="size-5" />
                      <span><span className="block">{p.title}</span><span className="text-xs font-normal text-muted-foreground">{p.id} · {L.type(p.type)}</span></span>
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.location.locality}, {p.location.city}</td>
                  <td className="p-3 text-right font-medium">{inrShort(p.price)}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-right">{matches.get(p.id)?.length ?? 0}</td>
                  <td className="p-3 text-right">{completion(p).pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {manager && (
        <Button size="lg" onClick={() => navigate('/properties/new')} aria-label={t('action.add')}
          className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 size-14 rounded-full shadow-lg md:hidden">
          <Plus className="size-6" />
        </Button>
      )}
    </div>
  )
}
