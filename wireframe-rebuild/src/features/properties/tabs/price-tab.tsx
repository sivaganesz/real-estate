/**
 * Price — is the asking price reasonable, and how do we say it without overselling? (from spec-system-wireframe)
 * The price is judged against similar properties in our own records (same type and city, area within ±25%, last 12 months),
 * worked out live, plus ones the team adds from outside (portal listings, registered sales). Wording stays neutral.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Meter } from '@/components/app/meter'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import { PROPERTY_TYPES } from '@/data/catalogue'
import { DEMO_TODAY } from '@/data/seed'
import { fmtDate, inr, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { comparablesFromRecords, priceCheck } from '@/lib/property'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'
import type { Comparable, Property } from '@/data/types'

export function PriceTab({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const { db, updateProperty } = useStore()
  const [editing, setEditing] = useState<Comparable | null>(null)
  const pc = priceCheck(p, db)
  const found = comparablesFromRecords(p, db)
  const editable = !p.archived
  const c = db.settings.buyerCostsPct

  // the bars: this property and every comparable, on a scale that starts just below the lowest so differences show
  const bars = [{ id: 'me', label: t('price.thisAsking'), v: pc.pricePerSqft ?? 0, me: true },
    ...pc.comparables.filter((x) => x.pricePerSqft > 0).map((x) => ({ id: x.id, label: `${x.locality}${x.ref ? ' · ' + x.ref : ''} · ${t(`price.kind.${x.kind}`)}`, v: x.pricePerSqft, me: false }))]
  const hi = Math.max(...bars.map((b) => b.v), 1)
  const lo = Math.min(...bars.map((b) => b.v).filter((v) => v > 0), hi) * 0.85

  const dismiss = (ref: string) => updateProperty(p.id, (x) => { x.dismissedComparables = [...(x.dismissedComparables ?? []), ref] }, t('history.compDismissed', { ref }))
  const undo = () => updateProperty(p.id, (x) => { x.dismissedComparables = [] }, t('history.compRestored'))
  const removeOutside = (id: string) => updateProperty(p.id, (x) => { x.comparables = x.comparables.filter((y) => y.id !== id) }, t('history.compRemoved'))
  const saveOutside = (cmp: Comparable) => {
    updateProperty(p.id, (x) => {
      const i = x.comparables.findIndex((y) => y.id === cmp.id)
      if (i >= 0) x.comparables[i] = cmp
      else x.comparables.push(cmp)
    }, t('history.compSaved', { place: cmp.locality }))
    setEditing(null)
  }
  const verdictTone = pc.position === 'within' ? 'success' : pc.position ? 'warning' : 'neutral'

  return (
    <div className="flex flex-col gap-5">
      <SectionCard>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t('price.asking')}</p>
            <p className="text-2xl font-semibold tracking-tight">{inr(p.price)}</p>
            <p className="text-xs text-muted-foreground">{pc.pricePerSqft ? `${inr(pc.pricePerSqft)}/sq.ft. · ` : ''}{num(p.areaSqft)} sq.ft.</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t('price.totalBuyer')}</p>
            <p className="text-xl font-semibold tracking-tight">{inr(pc.allIn)}</p>
            <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 text-xs">
              <dt className="text-muted-foreground">{t('price.stampDuty', { pct: c.stampDuty })}</dt><dd className="text-right">+ {inr(pc.costs.stampDuty)}</dd>
              <dt className="text-muted-foreground">{t('price.registration', { pct: c.registration })}</dt><dd className="text-right">+ {inr(pc.costs.registration)}</dd>
              <dt className="text-muted-foreground">{t('price.otherCosts', { pct: c.other })}</dt><dd className="text-right">+ {inr(pc.costs.other)}</dd>
            </dl>
          </div>
          <div className={cn('rounded-lg p-3', verdictTone === 'success' ? 'bg-success-soft' : verdictTone === 'warning' ? 'bg-warning-soft' : 'bg-muted/50')}>
            <p className="text-xs text-muted-foreground">{t('price.marketCheck', { count: pc.count })}</p>
            {pc.position ? (
              <>
                <p className="text-xl font-semibold tracking-tight">{t(`price.market.${pc.position}`)}</p>
                <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 text-xs">
                  <dt className="text-muted-foreground">{t('price.similar')}</dt><dd className="text-right">{pc.min === pc.max ? inr(pc.min) : `${inr(pc.min)} – ${inr(pc.max)}`}</dd>
                  {pc.soldAvg && <><dt className="text-muted-foreground">{t('price.soldAvg')}</dt><dd className="text-right">{inr(pc.soldAvg)}</dd></>}
                  <dt className="text-muted-foreground">{t('price.this')}</dt><dd className="text-right">{inr(pc.pricePerSqft)}</dd>
                </dl>
                {pc.position !== 'within' && <p className="mt-1 text-xs">{t(`price.hint.${pc.position}`)}</p>}
              </>
            ) : (
              <>
                <p className="text-xl font-semibold tracking-tight">{t('price.notComparedTitle')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('price.notComparedBody', { type: L.type(p.type).toLowerCase(), city: p.location.city })}</p>
              </>
            )}
          </div>
        </div>

        {pc.count > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {bars.map((b) => (
              <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-3 text-sm">
                <span className={cn('truncate', b.me ? 'font-medium' : 'text-muted-foreground')}>{b.label}</span>
                <Meter value={((b.v - lo) / (hi - lo || 1)) * 100} tone={b.me ? 'primary' : 'neutral'} className="h-2" />
                <span className={cn('w-20 text-right tabular-nums', b.me && 'font-semibold')}>{num(b.v)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t('price.neutralRule')} <Link to="/settings" className="text-primary hover:underline">{t('nav.settings')}</Link>.</p>
      </SectionCard>

      <SectionCard title={t('price.similarTitle')} action={editable && (
        <Button size="sm" variant="outline" onClick={() => setEditing({ id: `cmp-${Date.now()}`, locality: `${p.location.locality}, ${p.location.city}`, type: PROPERTY_TYPES[p.type].label, areaSqft: p.areaSqft, pricePerSqft: 0, kind: 'transaction', date: DEMO_TODAY, source: '', differences: '' })}>
          <Plus /> {t('price.addOutside')}
        </Button>
      )}>
        <p className="mb-3 flex items-start gap-1.5 text-sm text-muted-foreground"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /> {t('price.autoFound', { type: L.type(p.type).toLowerCase(), city: p.location.city })}</p>
        {found.length ? (
          <ul className="flex flex-col divide-y">
            {found.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-24 shrink-0 font-semibold tabular-nums">{inr(x.pricePerSqft)}<span className="text-xs font-normal text-muted-foreground">/sq.ft.</span></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{x.locality} <StatusChip tone={x.kind === 'transaction' ? 'success' : 'neutral'}>{t(`price.kind.${x.kind}`)}</StatusChip>
                    <Link to={`/properties/${x.ref}`} className="font-mono text-xs text-primary hover:underline">{x.ref}</Link></p>
                  <p className="text-xs text-muted-foreground">{num(x.areaSqft)} sq.ft. · {fmtDate(x.date, i18n.language)} · <i>{x.differences}</i></p>
                </div>
                {editable && <Button size="sm" variant="ghost" onClick={() => dismiss(x.ref)}>{t('price.notSimilar')}</Button>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t('price.noneInRecords')}</p>}

        {p.comparables.length > 0 && (
          <>
            <p className="mt-4 mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('price.fromOutside')}</p>
            <ul className="flex flex-col divide-y">
              {p.comparables.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="w-24 shrink-0 font-semibold tabular-nums">{x.pricePerSqft ? inr(x.pricePerSqft) : '—'}<span className="text-xs font-normal text-muted-foreground">/sq.ft.</span></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{x.locality} <StatusChip tone={x.kind === 'transaction' ? 'success' : 'neutral'}>{t(`price.kind.${x.kind}`)}</StatusChip></p>
                    <p className="text-xs text-muted-foreground">{num(x.areaSqft)} sq.ft. · {fmtDate(x.date, i18n.language)} · {x.source || t('price.noSource')}{x.differences ? <> · <i>{x.differences}</i></> : ''}</p>
                  </div>
                  {editable && (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={t('action.edit')} onClick={() => setEditing(x)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger" aria-label={t('documents.remove', { name: x.locality })} onClick={() => removeOutside(x.id)}><X /></Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {(p.dismissedComparables?.length ?? 0) > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('price.leftOut', { count: p.dismissedComparables!.length, list: p.dismissedComparables!.join(', ') })}{' '}
            {editable && <button type="button" onClick={undo} className="text-primary hover:underline">{t('price.bringBack')}</button>}
          </p>
        )}
      </SectionCard>

      {editing && <ComparableDialog value={editing} onClose={() => setEditing(null)} onSave={saveOutside} />}
    </div>
  )
}

/** Add or edit a comparable from outside our records: a portal listing or a registered sale. */
function ComparableDialog({ value, onSave, onClose }: { value: Comparable; onSave: (c: Comparable) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [c, setC] = useState<Comparable>(value)
  const set = (patch: Partial<Comparable>) => setC((prev) => ({ ...prev, ...patch }))
  const submit = (e: FormEvent) => { e.preventDefault(); if (c.pricePerSqft > 0 && c.locality.trim()) onSave(c) }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader><DialogTitle>{t('price.outsideTitle')}</DialogTitle><DialogDescription>{t('price.outsideHint')}</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-loc">{t('price.cLocation')}</Label><Input id="c-loc" value={c.locality} onChange={(e) => set({ locality: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-area">{t('price.cArea')}</Label><Input id="c-area" type="number" min={0} value={c.areaSqft || ''} onChange={(e) => set({ areaSqft: Number(e.target.value) })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-ppsf">{t('price.cPpsf')}</Label><Input id="c-ppsf" type="number" min={0} autoFocus value={c.pricePerSqft || ''} onChange={(e) => set({ pricePerSqft: Number(e.target.value) })} /></div>
            <div className="grid gap-1.5"><Label>{t('price.cKind')}</Label>
              <Select value={c.kind} onValueChange={(v) => set({ kind: v as Comparable['kind'] })}>
                <SelectTrigger className="w-full" aria-label={t('price.cKind')}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="asking">{t('price.kindLong.asking')}</SelectItem><SelectItem value="transaction">{t('price.kindLong.transaction')}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="c-date">{t('price.cDate')}</Label><Input id="c-date" type="date" value={c.date} onChange={(e) => set({ date: e.target.value })} /></div>
            <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-src">{t('price.cSource')}</Label><Input id="c-src" value={c.source} onChange={(e) => set({ source: e.target.value })} placeholder={t('price.cSourceHint')} /></div>
            <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-diff">{t('price.cDiff')}</Label><Input id="c-diff" value={c.differences} onChange={(e) => set({ differences: e.target.value })} placeholder={t('price.cDiffHint')} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={!(c.pricePerSqft > 0) || !c.locality.trim()}>{t('action.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
