/**
 * The Leads toolbar filters (master prompt §8): search, then pills for stage, temperature, priority, source,
 * executive (managers/admins), city, locality, budget, created date and "needs attention". A typed sentence
 * ("hot NRI leads in Gurugram under 4 cr") is offered as filters by the AI (Demo AI badge); the user applies it.
 */
import { useMemo, type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill, type FilterOption } from '@/components/shared/filter-pill'
import { Button } from '@/components/ui/button'
import type { LeadSource, LostReason, PipelineStageKey, Priority, Temperature } from '@/domain/types'
import { CITY_NAMES, LEAD_SOURCES, LOST_REASONS, PRIORITIES, STAGES, TEMPERATURES } from '@/domain/catalogue'
import { getAI } from '@/ai'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { inrShort } from '@/lib/format'
import { LEAD_ATTENTION, filterCount, parseLeadSentence, type LeadAttention, type LeadFilters } from '@/lib/lead-queries'
import { localityOptions } from '../lib/lead-form'
import type { LeadRow } from './use-lead-items'

const BUDGET_BANDS: { key: string; min?: number; max?: number }[] = [
  { key: 'u50', max: 5_000_000 },
  { key: '50to100', min: 5_000_000, max: 10_000_000 },
  { key: '100to200', min: 10_000_000, max: 20_000_000 },
  { key: 'a200', min: 20_000_000 },
]
const CREATED = [1, 7, 30] as const

export function LeadsFilters({ rows, filters, onChange, end }: {
  rows: LeadRow[]
  filters: LeadFilters
  onChange: (f: LeadFilters) => void
  end?: ReactNode
}) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const { scope } = usePermission()
  const users = useDb((db) => db.users)
  const set = <K extends keyof LeadFilters>(k: K, v: LeadFilters[K]) => onChange({ ...filters, [k]: v })
  const counts = useMemo(() => {
    const count = <T extends string>(get: (r: LeadRow) => T | T[] | undefined) => {
      const m = new Map<string, number>()
      for (const r of rows) {
        const v = get(r)
        for (const x of Array.isArray(v) ? v : v ? [v] : []) m.set(x, (m.get(x) ?? 0) + 1)
      }
      return m
    }
    return {
      stage: count((r) => r.lead.stage),
      temp: count((r) => r.temperature),
      priority: count((r) => r.priority),
      source: count((r) => r.lead.source),
      owner: count((r) => r.lead.ownerId ?? '__none'),
      city: count((r) => r.lead.requirement.cities),
      locality: count((r) => r.lead.requirement.localities),
      lost: count((r) => r.lead.lost?.reason),
    }
  }, [rows])
  const opts = (values: readonly string[], label: (v: string) => string, m: Map<string, number>): FilterOption[] =>
    values.map((v) => ({ value: v, label: label(v), count: m.get(v) ?? 0 }))

  const owners = scope('lead.view') !== 'own'
  const execs = users.filter((u) => u.role === 'executive')
  const budgetKey = BUDGET_BANDS.find((b) => b.min === filters.minBudget && b.max === filters.maxBudget)?.key
  const sentence = useMemo(() => {
    const q = filters.q?.trim() ?? ''
    if (q.split(/\s+/).length < 2) return null
    const f = parseLeadSentence(q)
    return filterCount(f) ? f : null
  }, [filters.q])

  return (
    <div className="flex flex-col gap-2">
      <FilterBar
        search={filters.q ?? ''}
        onSearch={(q) => set('q', q)}
        searchLabel={t('filters.search')}
        placeholder={t('filters.placeholder')}
        activeCount={filterCount({ ...filters, q: undefined })}
        onClearAll={() => onChange({ sort: filters.sort, q: filters.q })}
        end={end}
        filters={
          <>
            <FilterPill label={t('filters.stage')} options={opts(STAGES, (v) => t(`catalogue:stage.${v}`), counts.stage)} selected={filters.stages ?? []} onChange={(v) => set('stages', v as PipelineStageKey[])} />
            <FilterPill label={t('filters.temperature')} options={opts(TEMPERATURES, (v) => t(`catalogue:temperature.${v}`), counts.temp)} selected={filters.temperatures ?? []} onChange={(v) => set('temperatures', v as Temperature[])} />
            <FilterPill label={t('filters.priority')} options={opts(PRIORITIES, (v) => t(`catalogue:priority.${v}`), counts.priority)} selected={filters.priorities ?? []} onChange={(v) => set('priorities', v as Priority[])} />
            <FilterPill label={t('filters.source')} options={opts(LEAD_SOURCES, (v) => t(`catalogue:source.${v}`), counts.source).filter((o) => o.count || filters.sources?.includes(o.value as LeadSource))} selected={filters.sources ?? []} onChange={(v) => set('sources', v as LeadSource[])} />
            {owners && (
              <FilterPill
                label={t('filters.owner')}
                options={[{ value: '__none', label: t('filters.unassigned'), count: counts.owner.get('__none') ?? 0 }, ...execs.map((u) => ({ value: u.id, label: u.name, count: counts.owner.get(u.id) ?? 0 }))]}
                selected={filters.owners ?? []} onChange={(v) => set('owners', v)}
              />
            )}
            <FilterPill label={t('filters.city')} options={opts(CITY_NAMES, (v) => v, counts.city)} selected={filters.cities ?? []} onChange={(v) => set('cities', v)} />
            <FilterPill
              label={t('filters.locality')}
              options={opts(localityOptions(filters.cities ?? []), (v) => v, counts.locality).filter((o) => o.count || filters.localities?.includes(o.value))}
              selected={filters.localities ?? []} onChange={(v) => set('localities', v)}
            />
            <FilterPill
              single label={t('filters.budget')}
              options={BUDGET_BANDS.map((b) => ({ value: b.key, label: t(`filters.budgetBand.${b.key}`, { min: inrShort(b.min), max: inrShort(b.max) }) }))}
              selected={budgetKey ? [budgetKey] : []}
              onChange={(v) => { const b = BUDGET_BANDS.find((x) => x.key === v[0]); onChange({ ...filters, minBudget: b?.min, maxBudget: b?.max }) }}
            />
            <FilterPill
              single label={t('filters.created')}
              options={CREATED.map((d) => ({ value: String(d), label: t(`filters.createdWithin.${d}`) }))}
              selected={filters.createdWithin ? [String(filters.createdWithin)] : []}
              onChange={(v) => set('createdWithin', v[0] ? Number(v[0]) : undefined)}
            />
            {(filters.lostReasons?.length || filters.stages?.includes('lost')) && (
              <FilterPill label={t('filters.lostReason')} options={opts(LOST_REASONS, (v) => t(`catalogue:lostReason.${v}`), counts.lost)} selected={filters.lostReasons ?? []} onChange={(v) => set('lostReasons', v as LostReason[])} />
            )}
            <FilterPill
              single label={t('filters.attention')}
              options={LEAD_ATTENTION.map((a) => ({ value: a, label: t(`attention.${a}`) }))}
              selected={filters.attn ? [filters.attn] : []}
              onChange={(v) => set('attn', (v[0] as LeadAttention | undefined) || undefined)}
            />
          </>
        }
      />
      {sentence && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-ai-border/60 bg-ai-soft/40 px-3 py-2 text-meta" data-testid="sentence-filters">
          <Sparkles className="size-3.5 text-ai" aria-hidden="true" />
          <span className="text-ai">{t('filters.sentenceRead')}</span>
          <span className="font-medium text-foreground">{describeFilters(sentence, t as unknown as TFunction)}</span>
          <DemoAIBadge mode={getAI().mode} />
          <Button size="xs" variant="ai" className="ml-auto" onClick={() => onChange({ ...filters, ...sentence, q: undefined })} data-testid="sentence-apply">
            {t('filters.sentenceApply')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** "Hot · NRI · NCR · up to ₹4 Cr" from a filter set (for the AI read-out). */
function describeFilters(f: LeadFilters, t: TFunction): string {
  const parts: string[] = []
  f.temperatures?.forEach((x) => parts.push(t(`catalogue:temperature.${x}`)))
  f.stages?.forEach((x) => parts.push(t(`catalogue:stage.${x}`)))
  if (f.nri) parts.push(t('filters.nri'))
  if (f.cls) parts.push(t(`catalogue:classification.${f.cls}`))
  f.types?.forEach((x) => parts.push(t(`catalogue:propertyType.${x}`)))
  f.cities?.forEach((x) => parts.push(x))
  if (f.owners?.includes('__none')) parts.push(t('filters.unassigned'))
  if (f.maxBudget) parts.push(t('filters.upTo', { amount: inrShort(f.maxBudget) }))
  if (f.minBudget) parts.push(t('filters.from', { amount: inrShort(f.minBudget) }))
  if (f.attn) parts.push(t(`attention.${f.attn}`))
  return parts.join(' · ')
}
