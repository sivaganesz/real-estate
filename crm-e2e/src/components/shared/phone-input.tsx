/**
 * Indian mobile input: a fixed "+91" prefix, typing or pasting any form ("98450 12345", "+91-98450-12345",
 * "09845012345") is normalised to E.164 (+919845012345) and shown as "98450 12345". Invalid numbers keep the typed
 * text so nothing is lost; validation (lib/validation) reports them.
 */
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { last10, toE164 } from '@/lib/phone'
import { cn } from '@/lib/utils'

const pretty = (e164: string | undefined) => {
  if (!e164) return ''
  const d = last10(e164)
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : e164
}

export function PhoneInput({ value, onChange, id, invalid, describedBy, placeholder = '98450 12345', className }: {
  /** E.164 when valid, else the raw text. */
  value: string | undefined
  onChange: (value: string) => void
  id?: string
  invalid?: boolean
  describedBy?: string
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(() => pretty(value))
  const shown = (toE164(text) || text) === (value ?? '') ? text : pretty(value)
  return (
    <span className={cn('flex', className)}>
      <span aria-hidden="true" className="inline-flex h-9 items-center rounded-l-sm border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground tabular-nums">+91</span>
      <Input
        id={id} type="tel" inputMode="tel" autoComplete="tel" value={shown} placeholder={placeholder}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
        className="min-w-0 rounded-l-none tabular-nums"
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d+\s-]/g, '')
          setText(raw)
          onChange(toE164(raw) || raw.trim())
        }}
        onBlur={() => {
          const e164 = toE164(text)
          if (e164) setText(pretty(e164))
        }}
      />
    </span>
  )
}
