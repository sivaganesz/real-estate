/**
 * Column mapping table (master prompt §15.2): each sheet column → a CRM field, with sample values, a confidence meter
 * (✦ AI-suggested in Iris, low confidence in warning) and how it was matched. The user changes any row; "Skip this
 * column" is always an option; a field can be used once (already-used fields are disabled elsewhere).
 */
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ColumnMapping } from '@/domain/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Meter } from './meter'

const SKIP = '__skip'

export function MappingTable({ mapping, fields, samples, onChange, className }: {
  mapping: ColumnMapping[]
  /** Target fields: value + translated label. */
  fields: { value: string; label: string; required?: boolean }[]
  /** Sample values per column (same order as mapping). */
  samples?: string[][]
  onChange: (next: ColumnMapping[]) => void
  className?: string
}) {
  const { t } = useTranslation('ui')
  const used = new Set(mapping.map((m) => m.field).filter(Boolean))
  const missingRequired = fields.filter((f) => f.required && !used.has(f.value))
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full text-sm" aria-label={t('mapping.label')}>
          <thead className="bg-card">
            <tr className="border-b text-left text-label font-semibold tracking-[0.04em] text-muted-foreground uppercase [:lang(ta)_&]:normal-case">
              <th className="h-10 px-3">{t('mapping.column')}</th>
              <th className="h-10 px-3 max-md:hidden">{t('mapping.sample')}</th>
              <th className="h-10 px-3">{t('mapping.field')}</th>
              <th className="h-10 w-40 px-3 max-sm:hidden">{t('mapping.confidence')}</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m, i) => {
              const pct = Math.round(m.confidence * 100)
              const auto = m.method !== 'manual' && m.field
              const low = auto && m.confidence < 0.8
              return (
                <tr key={m.column} className="border-b last:border-b-0">
                  <td className="px-3 py-2.5 font-medium">{m.column}</td>
                  <td className="max-w-56 truncate px-3 py-2.5 text-muted-foreground max-md:hidden">{samples?.[i]?.filter(Boolean).slice(0, 2).join(' · ')}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={m.field ?? SKIP}
                      onValueChange={(v) => onChange(mapping.map((x, j) => (j === i ? { ...x, field: v === SKIP ? null : v, method: 'manual', confidence: v === SKIP ? 0 : 1 } : x)))}
                    >
                      <SelectTrigger className={cn('w-full min-w-44', auto && 'border-ai-border bg-ai-soft/40', low && 'border-warning')} aria-label={t('mapping.fieldFor', { column: m.column })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>{t('mapping.skip')}</SelectItem>
                        {fields.map((f) => (
                          <SelectItem key={f.value} value={f.value} disabled={used.has(f.value) && m.field !== f.value}>
                            {f.label}{f.required ? ` · ${t('mapping.required')}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5 max-sm:hidden">
                    {m.field ? (
                      <span className="flex items-center gap-2">
                        {auto && <Sparkles className="size-3.5 shrink-0 text-ai" aria-label={t('mapping.aiSuggested')} />}
                        <Meter value={pct} tone={low ? 'warning' : auto ? 'ai' : 'success'} size="xs" className="w-16" label={t('mapping.confidence')} />
                        <span className={cn('text-meta tabular-nums', low ? 'text-warning' : 'text-muted-foreground')}>{pct}%</span>
                      </span>
                    ) : <span className="text-meta text-muted-foreground">{t('mapping.skipped')}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {missingRequired.length > 0 && (
        <p role="alert" className="text-meta text-warning">{t('mapping.missingRequired', { fields: missingRequired.map((f) => f.label).join(', ') })}</p>
      )}
    </div>
  )
}
