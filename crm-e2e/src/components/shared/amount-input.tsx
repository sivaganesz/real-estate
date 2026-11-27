/**
 * A rupee amount typed in lakh or crore (lib/amount.ts), with the short form shown underneath as you type
 * ("₹1.2 Cr"). Ported from wireframe-rebuild/src/components/app/amount-input.tsx; the label moved to FormField,
 * the value is plain rupees (number | undefined), and pasting "1.2 Cr" or "85 lakhs" picks the unit itself.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { fromAmountField, parseAmountText, toAmountField, type AmountField, type AmountUnit } from '@/lib/amount'
import { inr, inrShort } from '@/lib/format'
import { cn } from '@/lib/utils'

export function AmountInput({ value, onChange, id, invalid, describedBy, placeholder, className }: {
  value: number | undefined
  onChange: (rupees: number | undefined) => void
  id?: string
  invalid?: boolean
  describedBy?: string
  placeholder?: string
  className?: string
}) {
  const { t } = useTranslation('ui')
  const [field, setField] = useState<AmountField>(() => toAmountField(value))
  // follow outside changes (AI fill, reset) without fighting the user's typing
  const shown = fromAmountField(field) === value ? field : toAmountField(value)
  const update = (f: AmountField) => {
    setField(f)
    onChange(fromAmountField(f))
  }
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="flex">
        <span aria-hidden="true" className="inline-flex h-9 items-center rounded-l-sm border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">₹</span>
        <Input
          id={id} inputMode="decimal" value={shown.v} aria-invalid={invalid || undefined} aria-describedby={describedBy} placeholder={placeholder ?? '0'}
          className="min-w-0 rounded-none tabular-nums"
          onChange={(e) => update({ ...shown, v: e.target.value.replace(/[^\d.]/g, '') })}
          onPaste={(e) => {
            const n = parseAmountText(e.clipboardData.getData('text'))
            if (n) {
              e.preventDefault()
              update(toAmountField(n))
            }
          }}
        />
        <span role="group" aria-label={t('amount.unit')} className="flex">
          {(['L', 'Cr'] as AmountUnit[]).map((u, i) => (
            <button
              key={u} type="button" aria-pressed={shown.unit === u} onClick={() => update({ ...shown, unit: u })}
              className={cn('h-9 shrink-0 border border-l-0 border-input px-2.5 text-sm', i === 1 && 'rounded-r-sm', shown.unit === u ? 'bg-primary-soft font-medium text-primary' : 'bg-card text-muted-foreground hover:bg-muted')}
            >
              {t(`amount.${u}`)}
            </button>
          ))}
        </span>
      </span>
      <span className="min-h-4 text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {value ? `${inrShort(value)} · ${inr(value)}` : ''}
      </span>
    </div>
  )
}
