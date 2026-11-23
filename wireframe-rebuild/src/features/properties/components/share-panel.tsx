import { useMemo, useState } from 'react'
import { Check, FileDown, Link2, MessageCircle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SidePanel } from '@/components/app/side-panel'
import { StatusChip } from '@/components/app/status-chip'
import { UserAvatar } from '@/components/app/user-avatar'
import { inrShort } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { matchScore } from '@/lib/matching'
import { cn } from '@/lib/utils'
import { type ShareChannel, useStore, useVisibleLeads } from '@/store/db'
import type { Property } from '@/data/types'
import { MATCH_TONE, PropertyPhoto } from './property-bits'

/**
 * Share a property with one lead — the leads that fit come first, with their match.
 * Sending logs it on the lead's timeline and counts as a recommendation (the pipeline moves).
 * The brochure the customer opens (the Share page) and real WhatsApp sending come later.
 */
export function SharePanel({ property, open, onOpenChange, leadId }: { property: Property; open: boolean; onOpenChange: (o: boolean) => void; leadId?: string }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { db, shareProperty } = useStore()
  const leads = useVisibleLeads()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | undefined>(leadId)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads
      .filter((l) => l.stage !== 'lost' && l.stage !== 'closed')
      .filter((l) => !q || l.name.toLowerCase().includes(q) || l.phone.includes(q))
      .map((l) => ({ lead: l, m: matchScore(l, property, db.settings) }))
      .sort((a, b) => Number(a.m.excluded) - Number(b.m.excluded) || b.m.score - a.m.score)
  }, [leads, property, db.settings, query])

  const send = (channel: ShareChannel) => {
    const lead = db.leads.find((l) => l.id === chosen)
    if (!lead) return
    shareProperty(property.id, lead.id, channel)
    toast.success(t(`share.done.${channel}`, { name: lead.name }), { description: t('share.logged') })
    onOpenChange(false)
  }

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={t('share.title')} description={t('share.subtitle')}
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button size="lg" className="col-span-2" disabled={!chosen} onClick={() => send('whatsapp')}><MessageCircle /> {t('share.whatsapp')}</Button>
          <Button size="lg" variant="outline" disabled={!chosen} onClick={() => send('link')}><Link2 /> {t('share.copyLink')}</Button>
          <Button size="lg" variant="outline" disabled={!chosen} onClick={() => send('pdf')}><FileDown /> {t('share.pdf')}</Button>
        </div>
      }>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2.5">
        <PropertyPhoto type={property.type} media={property.media[0]} alt="" className="size-12 shrink-0 rounded-md" iconClassName="size-5" />
        <div className="min-w-0">
          <p className="truncate font-medium">{property.title}</p>
          <p className="truncate text-sm text-muted-foreground">{inrShort(property.price)} · {L.keyFacts(property).join(' · ')}</p>
        </div>
      </div>
      <p className="text-sm font-medium">{t('share.who')}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('share.searchLeads')} aria-label={t('share.searchLeads')} className="pl-8" />
      </div>
      <ul role="radiogroup" aria-label={t('share.who')} className="flex flex-col gap-1 pb-2">
        {rows.map(({ lead, m }) => {
          const on = chosen === lead.id
          return (
            <li key={lead.id}>
              <button type="button" role="radio" aria-checked={on} onClick={() => setChosen(lead.id)}
                className={cn('flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors', on ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted')}>
                <UserAvatar name={lead.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{lead.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t('share.budgetUpTo', { amount: inrShort(lead.budget.max) })} · {lead.requirement.cities.join(', ')}</span>
                </span>
                {m.excluded ? <span className="text-xs text-muted-foreground">{t('share.notAFit')}</span> : <StatusChip tone={MATCH_TONE[m.label]}>{t(`match.${m.label}`)} · {m.score}</StatusChip>}
                {on && <Check className="size-4 text-primary" />}
              </button>
            </li>
          )
        })}
        {!rows.length && <li className="py-6 text-center text-sm text-muted-foreground">{t('share.noLeads')}</li>}
      </ul>
    </SidePanel>
  )
}
