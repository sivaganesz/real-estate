/**
 * Record or update the negotiation (old wireframe views-customers.js, Negotiation card): which property, the customer's
 * offer, the seller's counter and a note. Amounts are typed in lakhs or crores so nobody counts zeros; the short form and
 * the gap show as you type. Saving puts a line on the timeline and moves an earlier lead to the Negotiation stage.
 */
import { useState } from 'react'
import { Handshake } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { STAGE_ORDER } from '@/data/catalogue'
import type { Lead } from '@/data/types'
import { inrShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'

type Unit = 'L' | 'Cr'
const FACTOR: Record<Unit, number> = { L: 1e5, Cr: 1e7 }

/** A rupee amount as the number someone would type: ₹1.28 Cr → 1.28 Cr, ₹85 L → 85 L. */
const toField = (n?: number): { v: string; unit: Unit } =>
  !n ? { v: '', unit: 'L' } : n >= 1e7 ? { v: String(+(n / 1e7).toFixed(4)), unit: 'Cr' } : { v: String(+(n / 1e5).toFixed(2)), unit: 'L' }
const fromField = (f: { v: string; unit: Unit }) => {
  const x = parseFloat(f.v)
  return Number.isFinite(x) && x > 0 ? Math.round(x * FACTOR[f.unit]) : undefined
}

function Amount({ label, value, onChange, hint }: { label: string; value: { v: string; unit: Unit }; onChange: (f: { v: string; unit: Unit }) => void; hint?: string }) {
  const { t } = useTranslation()
  const n = fromField(value)
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex">
        <Input inputMode="decimal" value={value.v} onChange={(e) => onChange({ ...value, v: e.target.value.replace(/[^\d.]/g, '') })} className="rounded-r-none" placeholder="0" />
        {(['L', 'Cr'] as const).map((u, i) => (
          <button key={u} type="button" onClick={() => onChange({ ...value, unit: u })} aria-pressed={value.unit === u}
            className={cn('h-9 border border-l-0 px-2.5 text-sm', i === 1 && 'rounded-r-md', value.unit === u ? 'bg-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted')}>
            {t(`lead.offerForm.unit.${u}`)}
          </button>
        ))}
      </span>
      <span className="min-h-4 text-xs text-muted-foreground">{n ? inrShort(n) : hint}</span>
    </label>
  )
}

export function OfferDialog({ lead: l, open, propertyIds, onOpenChange }: { lead: Lead; open: boolean; propertyIds: string[]; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { db, today, updateLead } = useStore()
  const n = l.negotiation
  const [pid, setPid] = useState('')
  const [offer, setOffer] = useState(toField())
  const [counter, setCounter] = useState(toField())
  const [notes, setNotes] = useState('')
  const [was, setWas] = useState(false)
  // fill from the current negotiation each time it opens
  if (open !== was) {
    setWas(open)
    if (open) { setPid(n?.propertyId ?? propertyIds[0] ?? ''); setOffer(toField(n?.offered)); setCounter(toField(n?.counter)); setNotes(n?.notes ?? '') }
  }
  const options = [...new Set([...(n ? [n.propertyId] : []), ...propertyIds])].map((id) => db.properties.find((p) => p.id === id)).filter(Boolean)
  const asking = db.properties.find((p) => p.id === pid)?.price
  const o = fromField(offer), c = fromField(counter)
  const gap = o && c ? c - o : null

  const save = () => {
    const moved = STAGE_ORDER.indexOf(l.stage) < STAGE_ORDER.indexOf('negotiation')
    const text = t('lead.offerForm.note', { id: pid, offer: o ? inrShort(o) : '—', counter: c ? inrShort(c) : '—' }) + (notes.trim() ? ` — ${notes.trim()}` : '')
    updateLead(l.id, (x) => {
      x.negotiation = { propertyId: pid, offered: o, counter: c, notes: notes.trim() || undefined }
      if (moved) { x.stage = 'negotiation'; x.stageSince = today }
    }, text)
    toast.success(moved ? t('lead.offerForm.toastMoved') : t('lead.offerForm.toast'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{n ? t('lead.offerForm.titleUpdate') : t('lead.offerForm.titleStart')}</DialogTitle>
          <DialogDescription>{t('lead.offerForm.hint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('lead.property')}</span>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t('lead.property')} /></SelectTrigger>
              <SelectContent>{options.map((p) => <SelectItem key={p!.id} value={p!.id}>{p!.id} · {p!.title}</SelectItem>)}</SelectContent>
            </Select>
            {asking ? <span className="text-xs text-muted-foreground">{t('lead.offerForm.asking', { amount: inrShort(asking) })}</span> : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Amount label={t('lead.offerForm.offer')} value={offer} onChange={setOffer} hint={t('lead.offerForm.optional')} />
            <Amount label={t('lead.offerForm.counter')} value={counter} onChange={setCounter} hint={t('lead.offerForm.optional')} />
          </div>
          {gap !== null && (
            <p className={cn('rounded-lg px-3 py-2 text-sm', gap > 0 ? 'bg-warning-soft' : 'bg-success-soft text-success')}>
              {gap > 0 ? t('lead.offerForm.gap', { amount: inrShort(gap), pct: ((gap / c!) * 100).toFixed(1) }) : t('lead.offerForm.met')}
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('lead.offerForm.notes')}</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('lead.offerForm.notesPh')} className="min-h-16" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>
          <Button disabled={!pid || (!o && !c)} onClick={save}><Handshake /> {t('lead.offerForm.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
