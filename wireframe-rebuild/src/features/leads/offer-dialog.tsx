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
import { AmountInput } from '@/components/app/amount-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { STAGE_ORDER } from '@/data/catalogue'
import type { Lead } from '@/data/types'
import { fromAmountField, toAmountField } from '@/lib/amount'
import { inrShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'

export function OfferDialog({ lead: l, open, propertyIds, onOpenChange }: { lead: Lead; open: boolean; propertyIds: string[]; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { db, today, updateLead } = useStore()
  const n = l.negotiation
  const [pid, setPid] = useState('')
  const [offer, setOffer] = useState(toAmountField())
  const [counter, setCounter] = useState(toAmountField())
  const [notes, setNotes] = useState('')
  const [was, setWas] = useState(false)
  // fill from the current negotiation each time it opens
  if (open !== was) {
    setWas(open)
    if (open) { setPid(n?.propertyId ?? propertyIds[0] ?? ''); setOffer(toAmountField(n?.offered)); setCounter(toAmountField(n?.counter)); setNotes(n?.notes ?? '') }
  }
  const options = [...new Set([...(n ? [n.propertyId] : []), ...propertyIds])].map((id) => db.properties.find((p) => p.id === id)).filter(Boolean)
  const asking = db.properties.find((p) => p.id === pid)?.price
  const o = fromAmountField(offer), c = fromAmountField(counter)
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
            <AmountInput label={t('lead.offerForm.offer')} value={offer} onChange={setOffer} hint={t('lead.offerForm.optional')} />
            <AmountInput label={t('lead.offerForm.counter')} value={counter} onChange={setCounter} hint={t('lead.offerForm.optional')} />
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
