/**
 * A rupee amount typed in lakh or crore (lib/amount.ts), with the short form shown underneath as you type.
 * Used by the offer form and the Add / Edit lead budget.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { type AmountField, fromAmountField } from '@/lib/amount'
import { inrShort } from '@/lib/format'
import { cn } from '@/lib/utils'

export function AmountInput({ label, value, onChange, hint, required, invalid }: {
  label: string
  value: AmountField
  onChange: (f: AmountField) => void
  /** Shown under the field while it is empty. */
  hint?: string
  required?: boolean
  invalid?: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const n = fromAmountField(value)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}{required && <span className="text-danger"> *</span>}</label>
      <span className="flex">
        <Input id={id} inputMode="decimal" value={value.v} aria-invalid={invalid || undefined} placeholder="0"
          onChange={(e) => onChange({ ...value, v: e.target.value.replace(/[^\d.]/g, '') })} className="min-w-0 rounded-r-none" />
        {(['L', 'Cr'] as const).map((u, i) => (
          <button key={u} type="button" onClick={() => onChange({ ...value, unit: u })} aria-pressed={value.unit === u}
            className={cn('h-9 shrink-0 border border-l-0 px-2.5 text-sm', i === 1 && 'rounded-r-md', value.unit === u ? 'bg-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted')}>
            {t(`amount.unit.${u}`)}
          </button>
        ))}
      </span>
      <span className="min-h-4 text-xs text-muted-foreground">{n ? inrShort(n) : hint}</span>
    </div>
  )
}
