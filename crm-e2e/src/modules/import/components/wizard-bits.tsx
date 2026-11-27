/** Wizard building blocks: a value-for-all-rows input and the sticky Back / Next bar. */
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CITY_NAMES, LEAD_SOURCES } from '@/domain/catalogue'
import { cn } from '@/lib/utils'

/** A value for every row of a field the sheet lacks: a select for sources and cities, text otherwise. */
export function DefaultInput({ field, value, onChange, compact }: { field: string; value: string; onChange: (v: string) => void; compact?: boolean }) {
  const { t } = useTranslation(['import', 'catalogue'])
  const id = `default-${field.replace(/\./g, '-')}`
  const opts = field === 'source' ? LEAD_SOURCES.map((s) => ({ v: s, l: t(`catalogue:source.${s}`) }))
    : field === 'location.city' || field === 'requirement.cities' ? CITY_NAMES.map((c) => ({ v: c, l: c })) : null
  return (
    <div className={cn('flex flex-col gap-1.5', compact && 'min-w-44')}>
      <label htmlFor={id} className="text-sm font-medium">{t(`import:field.${field}`)}</label>
      {opts ? (
        <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
          <SelectTrigger id={id} className="w-full" data-testid={`default-${field}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">{t('import:form.notSet')}</SelectItem>
            {opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} data-testid={`default-${field}`} />
      )}
    </div>
  )
}

export function WizardNav({ onBack, backLabel, onNext, nextLabel, nextDisabled, testId, extra }: {
  onBack: () => void; backLabel: string; onNext: () => void; nextLabel: string; nextDisabled?: boolean; testId?: string; extra?: ReactNode
}) {
  return (
    <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-popover/95 p-3 shadow-lg backdrop-blur mr-14 md:bottom-4 md:mr-16">
      <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft />{backLabel}</Button>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        <Button type="button" onClick={onNext} disabled={nextDisabled} data-testid={testId}>{nextLabel}<ArrowRight /></Button>
      </div>
    </div>
  )
}
