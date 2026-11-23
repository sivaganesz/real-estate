/**
 * The property search bar — as in spec-system-wireframe (property-search.js):
 * a keyword box with an ✨ button that opens the AI sentence box (type or speak), and one row of filter pills —
 * Type · City · Budget · Size · More — with Sort on the right and "Clear all". Each pill opens a small panel.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronUp, Mic, Search, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AMENITIES, CITIES, PROPERTY_TYPES, PURPOSES, TYPE_ORDER } from '@/data/catalogue'
import type { PropertyTypeKey } from '@/data/types'
import { inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { AREAS, BUDGETS, criteria, PRICES, SORTS, type PSFilters, type PSItem } from './prop-search'

export type Pill = 'type' | 'city' | 'budget' | 'size' | 'more' | 'sort'

/** Words for a filter value — shared by the pills and the "Show N without …" suggestion. */
export function useFilterWords() {
  const { t } = useTranslation()
  const L = useLabels()
  const typeText = (v: string) => (v.startsWith('cat:') ? t('ps.allCat', { cat: t(`props.category.${v.slice(4)}`).toLowerCase() }) : L.type(v as PropertyTypeKey))
  const bhkText = (n: number) => (n >= 5 ? '5+ BHK' : `${n} BHK`)
  const range = (lo: number | undefined, hi: number | undefined, fmt: (n: number) => string) =>
    lo && hi ? (lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`) : hi ? t('ps.under', { v: fmt(hi) }) : `${fmt(lo!)}+`
  const critText = (c: ReturnType<typeof criteria>[number]): string => {
    switch (c.kind) {
      case 'type': return typeText(String(c.value))
      case 'bhk': return bhkText(Number(c.value))
      case 'purpose': return t('ps.forPurpose', { p: L.purpose(c.value as never).toLowerCase() })
      case 'price': { const [lo, hi] = c.value as [number?, number?]; return range(lo, hi, inrShort) }
      case 'area': { const [lo, hi] = c.value as [number?, number?]; return `${range(lo, hi, num)} sq.ft.` }
      case 'facing': return t('ps.facing', { d: t(`ps.dir.${c.value}`) })
      case 'corner': return t('ps.cornerPlot')
      case 'amen': return t('ps.with', { m: t(`amenity.${c.value}`, { defaultValue: String(c.value) }).toLowerCase() })
      case 'status': return c.value === '__arch' ? t('ps.archived') : t(`status.${c.value}`)
      case 'attn': return t('ps.needsAttention')
      case 'q': return `“${c.value}”`
      default: return String(c.value)
    }
  }
  return { typeText, bhkText, range, critText }
}

type Props = {
  filters: PSFilters
  items: PSItem[]
  onChange: (f: PSFilters) => void
  onSet: (k: string, v: string | number | boolean | '') => void
  onClearPill: (p: Pill) => void
  onClearAll: () => void
  aiOpen: boolean
  onToggleAi: () => void
  onAsk: (text: string) => void
  listening: boolean
  onVoice: () => void
  open: Pill | null
  setOpen: (p: Pill | null) => void
  understood: ReactNode
}

const optCls = (on: boolean, list?: boolean) => cn(
  'inline-flex items-center gap-2 text-[13px] text-foreground hover:bg-muted',
  list ? 'w-full justify-between rounded-[7px] px-2.5 py-[7px] text-left' : 'rounded-full border bg-card px-[11px] py-1',
  on && (list ? 'bg-accent font-medium text-primary hover:bg-accent' : 'border-primary/30 bg-accent font-medium text-primary hover:bg-accent'),
)
const Sub = ({ children, first }: { children: ReactNode; first?: boolean }) =>
  <p className={cn('mx-0.5 mb-1.5 text-[11px] tracking-[.05em] text-muted-foreground uppercase', first ? 'mt-0.5' : 'mt-3')}>{children}</p>

export function SearchBar(p: Props) {
  const { t } = useTranslation()
  const L = useLabels()
  const W = useFilterWords()
  const f = p.filters, a = f.ai ?? {}
  const boxRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (p.aiOpen) boxRef.current?.focus() }, [p.aiOpen])

  const active = p.items.filter((x) => !x.archived)
  const cnt = (fn: (x: PSItem) => boolean) => active.filter(fn).length
  const cities = [...new Set(p.items.map((x) => x.city).filter(Boolean))].sort()
  if (f.city && !cities.includes(f.city)) cities.push(f.city)
  const residential = !f.type || ['flat', 'house', 'cat:residential'].includes(f.type)
  const moreN = [f.purpose, a.facing, a.corner].filter(Boolean).length + (a.amen?.length ?? 0)
  const sel = (k: string, val: number | undefined, presets: number[], fmt: (n: number) => string, blank: string) => (
    <select value={val ?? ''} onChange={(e) => p.onSet(k, e.target.value)} aria-label={blank}
      className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2 text-[13px]">
      <option value="">{blank}</option>
      {[...new Set([...presets, ...(val ? [val] : [])])].sort((x, y) => x - y).map((v) => <option key={v} value={v}>{fmt(v)}</option>)}
    </select>
  )

  const panels: Record<Pill, ReactNode> = {
    type: (
      <div className="flex max-h-[260px] w-[236px] flex-col overflow-y-auto">
        <button type="button" className={optCls(!f.type, true)} onClick={() => p.onSet('type', '')}>{t('ps.allTypes')}</button>
        {(['residential', 'commercial'] as const).map((cat) => (
          <div key={cat}>
            <p className="px-2.5 pt-2 pb-0.5 text-[11px] tracking-[.05em] text-muted-foreground uppercase">{t(`props.category.${cat}`)}</p>
            <button type="button" className={optCls(f.type === 'cat:' + cat, true)} onClick={() => p.onSet('type', 'cat:' + cat)}>{W.typeText('cat:' + cat)}</button>
            {TYPE_ORDER.filter((k) => PROPERTY_TYPES[k].category === cat).map((k) => (
              <button key={k} type="button" className={optCls(f.type === k, true)} onClick={() => p.onSet('type', k)}>
                {L.type(k)} <small className="font-normal text-muted-foreground">{cnt((x) => x.type === k)}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    ),
    city: (
      <div className="w-[340px] max-w-full">
        <div className="flex max-h-[168px] flex-col overflow-y-auto">
          <button type="button" className={optCls(!f.city, true)} onClick={() => p.onSet('city', '')}>{t('ps.allCities')}</button>
          {cities.map((c) => (
            <button key={c} type="button" className={optCls(f.city === c, true)} onClick={() => p.onSet('city', c)}>{c} <small className="font-normal text-muted-foreground">{cnt((x) => x.city === c)}</small></button>
          ))}
        </div>
        {f.city && (
          <>
            <Sub>{t('ps.locality')}</Sub>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              <button type="button" className={optCls(!a.locality)} onClick={() => p.onSet('locality', '')}>{t('ps.anywhere')}</button>
              {(CITIES[f.city] ?? []).map((l) => <button key={l} type="button" className={optCls(a.locality === l)} onClick={() => p.onSet('locality', l)}>{l}</button>)}
            </div>
          </>
        )}
      </div>
    ),
    budget: (
      <div className="w-[300px] max-w-full">
        <div className="flex flex-wrap gap-1.5">
          {BUDGETS.map(([lo, hi, k]) => (
            <button key={k} type="button" className={optCls((a.minPrice ?? '') === lo && (a.maxPrice ?? '') === hi)} onClick={() => p.onSet('budget', `${lo}-${hi}`)}>{t(`filters.budgets.${k}`)}</button>
          ))}
        </div>
        <Sub>{t('ps.orChoose')}</Sub>
        <div className="flex items-center gap-1.5">{sel('minPrice', a.minPrice, PRICES, inrShort, t('ps.noMin'))}<span className="text-xs text-muted-foreground">{t('ps.to')}</span>{sel('maxPrice', a.maxPrice, PRICES, inrShort, t('ps.noMax'))}</div>
      </div>
    ),
    size: (
      <div className="w-[300px] max-w-full">
        {(residential || a.bhk) && (
          <>
            <Sub first>{t('ps.bedrooms')}</Sub>
            <div className="flex gap-1.5">
              <button type="button" className={optCls(!a.bhk)} onClick={() => p.onSet('bhk', '')}>{t('ps.any')}</button>
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={optCls(a.bhk === n)} onClick={() => p.onSet('bhk', n)}>{n === 5 ? '5+' : n}</button>)}
            </div>
          </>
        )}
        <Sub first={!(residential || a.bhk)}>{t('ps.areaSqft')}</Sub>
        <div className="flex items-center gap-1.5">{sel('minArea', a.minArea, AREAS, num, t('ps.noMin'))}<span className="text-xs text-muted-foreground">{t('ps.to')}</span>{sel('maxArea', a.maxArea, AREAS, num, t('ps.noMax'))}</div>
      </div>
    ),
    more: (
      <div className="w-[340px] max-w-full">
        <Sub first>{t('fact.purpose')}</Sub>
        <div className="flex gap-1.5">
          <button type="button" className={optCls(!f.purpose)} onClick={() => p.onSet('purpose', '')}>{t('ps.any')}</button>
          {PURPOSES.map((v) => <button key={v} type="button" className={optCls(f.purpose === v)} onClick={() => p.onSet('purpose', v)}>{L.purpose(v)}</button>)}
        </div>
        <Sub>{t('fact.facing')}</Sub>
        <div className="flex gap-1.5">
          <button type="button" className={optCls(!a.facing)} onClick={() => p.onSet('facing', '')}>{t('ps.any')}</button>
          {(['East', 'West', 'North', 'South'] as const).map((d) => <button key={d} type="button" className={optCls(a.facing === d)} onClick={() => p.onSet('facing', d)}>{t(`ps.dir.${d}`)}</button>)}
        </div>
        <Sub>{t('overview.amenities')}</Sub>
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          <button type="button" className={optCls(!!a.corner)} onClick={() => p.onSet('corner', true)}>{t('ps.cornerPlot')}</button>
          {AMENITIES.map((m) => <button key={m} type="button" className={optCls(!!a.amen?.includes(m))} onClick={() => p.onSet('amen', m)}>{t(`amenity.${m}`, { defaultValue: m })}</button>)}
        </div>
      </div>
    ),
    sort: (
      <div className="flex w-[200px] flex-col">
        {SORTS.map((s) => <button key={s || 'newest'} type="button" className={optCls((f.sort ?? '') === s, true)} onClick={() => p.onSet('sort', s)}>{t(`ps.sort.${s || 'newest'}`)}</button>)}
      </div>
    ),
  }

  const pills: { k: Exclude<Pill, 'sort'>; label: string; set: boolean }[] = [
    { k: 'type', label: f.type ? W.typeText(f.type) : t('ps.pill.type'), set: !!f.type },
    { k: 'city', label: f.city ? f.city + (a.locality ? ' · ' + a.locality.replace(/ \(.*\)$/, '') : '') : t('ps.pill.city'), set: !!(f.city || a.locality) },
    { k: 'budget', label: a.minPrice || a.maxPrice ? W.range(a.minPrice, a.maxPrice, inrShort) : t('ps.pill.budget'), set: !!(a.minPrice || a.maxPrice) },
    { k: 'size', label: [a.bhk && W.bhkText(a.bhk), (a.minArea || a.maxArea) && `${W.range(a.minArea, a.maxArea, num)} sq.ft.`].filter(Boolean).join(' · ') || t('ps.pill.size'), set: !!(a.bhk || a.minArea || a.maxArea) },
    { k: 'more', label: moreN ? `${t('ps.pill.more')} · ${moreN}` : t('ps.pill.more'), set: moreN > 0 },
  ]
  const anything = criteria(f).length > 0 || !!f.sort || !!f.aiText

  const pillRow = (
    <>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((pl) => (
          <PillButton key={pl.k} label={pl.label} set={pl.set} open={p.open === pl.k} onOpenChange={(o) => p.setOpen(o ? pl.k : null)} onClear={() => p.onClearPill(pl.k)} clearLabel={t('action.clear')}>
            {panels[pl.k]}
          </PillButton>
        ))}
      </div>
      <div className="flex items-center gap-1 lg:ml-auto">
        <PillButton plain label={t('ps.sortLabel', { s: t(`ps.sort.${f.sort || 'newest'}`) })} set={false} open={p.open === 'sort'} align="end"
          onOpenChange={(o) => p.setOpen(o ? 'sort' : null)} onClear={() => undefined} clearLabel="">{panels.sort}</PillButton>
        {anything && <button type="button" onClick={p.onClearAll} className="h-8 px-1 text-[13px] font-medium whitespace-nowrap text-primary">{t('ps.clearAll')}</button>}
      </div>
    </>
  )

  if (p.aiOpen) {
    return (
      <div className="mb-2">
        <div className={cn('flex items-center gap-2 rounded-[14px] border-[1.5px] bg-card py-2 pr-2 pl-3.5 shadow-[0_0_0_4px_var(--violet-soft)]',
          p.listening ? 'border-danger shadow-[0_0_0_4px_var(--danger-soft)]' : 'border-violet/40')}>
          <Sparkles className="size-[18px] shrink-0 text-violet" />
          <textarea ref={boxRef} rows={1} value={f.aiText ?? ''} aria-label={t('ps.aiLabel')}
            placeholder={p.listening ? t('ps.listening') : t('ps.aiPlaceholder')}
            onChange={(e) => { p.onChange({ ...f, aiText: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); p.onAsk(e.currentTarget.value) } else if (e.key === 'Escape') p.onToggleAi() }}
            className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[14.5px] outline-none" />
          <button type="button" onClick={p.onVoice} title={p.listening ? t('ps.stopListening') : t('ps.speak')} aria-label={t('search.voice')}
            className={cn('grid size-8 shrink-0 place-items-center rounded-full border bg-card hover:bg-muted', p.listening && 'animate-pulse border-danger bg-danger text-white hover:bg-danger')}><Mic className="size-4" /></button>
          <Button size="sm" onClick={() => p.onAsk(f.aiText ?? '')}>{t('search.go')}</Button>
          <button type="button" onClick={p.onToggleAi} title={t('ps.backToNormal')} aria-label={t('ps.backToNormal')}
            className="grid size-8 shrink-0 place-items-center rounded-full border bg-card hover:bg-muted"><ChevronUp className="size-4" /></button>
        </div>
        <div className="mx-0.5 mt-2 mb-2.5 flex min-h-[26px] flex-wrap items-center gap-1.5 text-[13px]" aria-live="polite">{p.understood}</div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">{pillRow}</div>
      </div>
    )
  }
  return (
    <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-start">
      <div className="relative flex w-full items-center lg:w-[300px]" role="search">
        <Search className="pointer-events-none absolute left-3 size-3.5 opacity-50" />
        <input type="search" value={f.q ?? ''} onChange={(e) => p.onChange({ ...f, q: e.target.value || undefined })} placeholder={t('ps.searchPlaceholder')} aria-label={t('search.label')}
          className="h-8 w-full rounded-full border bg-card pr-10 pl-8 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
        <button type="button" onClick={p.onToggleAi} title={t('ps.aiTitle')} aria-label={t('ps.aiTitle')}
          className="absolute right-1 grid h-[26px] w-7 place-items-center rounded-full bg-gradient-to-br from-violet-soft to-accent ring-1 ring-violet/25 ring-inset hover:from-violet/20">
          <Sparkles className="size-3.5 text-violet" />
        </button>
      </div>
      {pillRow}
    </div>
  )
}

/** A filter pill: label + caret, or label + ✕ once set. Opens its panel below. */
function PillButton({ label, set, open, onOpenChange, onClear, clearLabel, children, align = 'start', plain }: {
  label: string; set: boolean; open: boolean; onOpenChange: (o: boolean) => void; onClear: () => void; clearLabel: string; children: ReactNode; align?: 'start' | 'end'; plain?: boolean
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div className={cn('inline-flex h-8 items-center rounded-full border text-[13px] font-medium whitespace-nowrap',
        plain ? 'border-transparent text-muted-foreground hover:text-foreground' : set ? 'border-primary/30 bg-accent text-primary' : 'bg-card text-secondary-foreground hover:border-input',
        open && !plain && 'border-primary ring-[3px] ring-accent')}>
        <PopoverTrigger asChild>
          <button type="button" className={cn('flex h-full items-center gap-1.5 pl-3', set ? 'pr-1' : 'pr-3')} title={label}>
            <span className="max-w-[170px] truncate">{label}</span>
            {!set && <span className="text-[10px] text-muted-foreground">▾</span>}
          </button>
        </PopoverTrigger>
        {set && (
          <button type="button" onClick={onClear} aria-label={clearLabel} title={clearLabel}
            className="mr-1.5 grid size-4 place-items-center rounded-full text-[10px] hover:bg-primary/15">✕</button>
        )}
      </div>
      <PopoverContent align={align} sideOffset={6} className="w-auto max-w-[calc(100vw-32px)] min-w-[220px] rounded-xl p-2">{children}</PopoverContent>
    </Popover>
  )
}

