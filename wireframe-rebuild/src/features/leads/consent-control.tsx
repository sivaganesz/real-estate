/**
 * Consent to follow up, in the lead profile (spec, Module B · A; DPDP): the green / red line opens a small menu.
 * - No consent (or withdrawn): record it — how they agreed (WhatsApp, phone call, in person, enquiry form) and when.
 *   Recording it adds a timeline entry and makes Schedule available.
 * - Consent given: when and how, and "Record withdrawal" (asks first). Withdrawing clears the planned follow-up,
 *   adds a timeline entry, and Schedule is greyed out again.
 * No pop-up notification: the line itself and the timeline show the change.
 */
import { useState } from 'react'
import { ChevronDown, ShieldCheck, ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Lead } from '@/data/types'
import { hasFollowUpConsent } from '@/lib/consent'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'

const VIA = ['whatsapp', 'call', 'inPerson', 'form'] as const

export function ConsentControl({ lead: l }: { lead: Lead }) {
  const { t, i18n } = useTranslation()
  const { today, updateLead } = useStore()
  const ok = hasFollowUpConsent(l)
  const [open, setOpen] = useState(false)
  const [how, setHow] = useState<(typeof VIA)[number]>(l.contactPref === 'whatsapp' ? 'whatsapp' : 'call')
  const [date, setDate] = useState(today)
  const [confirming, setConfirming] = useState(false)
  // older records hold free text (e.g. the lead source "Website"); new ones hold a key
  const via = (v: string) => t(`lead.consent.via.${v}`, { defaultValue: v })
  const date_ = (d: string) => fmtDate(d, i18n.language)

  const record = () => {
    updateLead(l.id, (x) => { x.consent = { followUp: true, at: date, how } }, t('lead.consent.noteRecorded', { how: via(how) }))
    setOpen(false)
  }
  const withdraw = () => {
    updateLead(l.id, (x) => { if (x.consent) x.consent.withdrawnAt = today; x.nextFollowUp = undefined }, t('lead.consent.noteWithdrawn'))
    setOpen(false)
  }
  const Icon = ok ? ShieldCheck : ShieldX
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setConfirming(false); setDate(today) } }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn('-mx-1 flex w-fit items-center gap-2 rounded-md px-1 text-left hover:bg-muted', ok ? 'text-success' : 'text-danger')}>
          <Icon className="size-3.5 shrink-0" /> {ok ? t('lead.consentOk') : t('lead.consentNo')} <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl p-3">
        {ok && l.consent ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-success"><ShieldCheck className="size-4" /> {t('lead.consent.givenTitle')}</p>
            <p className="text-muted-foreground">{t('lead.consent.given', { date: date_(l.consent.at), how: via(l.consent.how) })}</p>
            {confirming ? (
              <div className="mt-1 rounded-lg border border-danger/30 bg-danger-soft/40 p-2.5">
                <p className="mb-2">{t('lead.consent.withdrawConfirm', { name: l.name })}</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>{t('action.cancel')}</Button>
                  <Button size="sm" variant="destructive" onClick={withdraw}>{t('lead.consent.withdrawYes')}</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="mt-1 self-start text-danger hover:text-danger" onClick={() => setConfirming(true)}>
                <ShieldX /> {t('lead.consent.withdraw')}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 text-sm">
            <div>
              <p className="font-semibold">{t('lead.consent.recordTitle')}</p>
              {l.consent?.withdrawnAt && <p className="text-xs text-danger">{t('lead.consent.withdrawnOn', { date: date_(l.consent.withdrawnAt) })}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">{t('lead.consent.recordHint')}</p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('lead.consent.how')}</p>
              <div className="flex flex-wrap gap-1.5">
                {VIA.map((v) => (
                  <button key={v} type="button" onClick={() => setHow(v)} aria-pressed={how === v}
                    className={cn('rounded-full border px-2.5 py-0.5 text-sm', how === v ? 'border-primary bg-accent font-medium text-primary' : 'hover:bg-muted')}>
                    {via(v)}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {t('lead.consent.date')}
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 text-sm" />
            </label>
            <Button size="sm" className="self-end" disabled={!date} onClick={record}><ShieldCheck /> {t('lead.consent.record')}</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
