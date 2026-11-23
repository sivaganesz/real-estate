import { useMemo, useState } from 'react'
import { Check, FileDown, Link2, MessageCircle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MatchBadge } from '@/components/property/badges'
import { PropertyPhoto } from '@/components/property/property-photo'
import { useIsPhone } from '@/hooks/use-media-query'
import { inrShort, initials } from '@/lib/format'
import { matchScore } from '@/lib/matching'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { type ShareChannel, useStore, useVisibleLeads } from '@/store/db'
import type { Property } from '@/data/types'

/**
 * Share a property with one lead. Leads that fit come first, with their match.
 * Sending logs it on the lead's timeline and counts as a recommendation (the pipeline moves).
 * The customer page itself (P5) comes in a later step; WhatsApp sending comes with the WhatsApp integration.
 */
export function ShareSheet({
  property, open, onOpenChange, leadId,
}: { property: Property; open: boolean; onOpenChange: (o: boolean) => void; leadId?: string }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { db, shareProperty } = useStore()
  const leads = useVisibleLeads()
  const phone = useIsPhone()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | undefined>(leadId)

  const rows = useMemo(() => {
    const active = leads.filter((l) => l.stage !== 'lost' && l.stage !== 'closed')
    const scored = active.map((l) => ({ lead: l, m: matchScore(l, property, db.settings) }))
    const q = query.trim().toLowerCase()
    return scored
      .filter((r) => !q || r.lead.name.toLowerCase().includes(q) || r.lead.phone.includes(q))
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
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setChosen(leadId) }}>
      <SheetContent side={phone ? 'bottom' : 'right'} className={cn(phone ? 'max-h-[88svh] rounded-t-2xl' : 'sm:max-w-md')}>
        <SheetHeader>
          <SheetTitle>{t('share.title')}</SheetTitle>
          <SheetDescription>{t('share.subtitle')}</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-3 px-4">
          <PropertyPhoto type={property.type} media={property.media[0]} alt={property.title} className="size-14 shrink-0 rounded-lg" iconClassName="size-6" />
          <div className="min-w-0">
            <p className="truncate font-medium">{property.title}</p>
            <p className="text-sm text-muted-foreground">{inrShort(property.price)} · {L.keyFacts(property).join(' · ')}</p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4">
          <p className="text-sm font-medium">{t('share.who')}</p>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('share.searchLeads')} className="pl-8" />
          </div>
          <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1" role="radiogroup" aria-label={t('share.who')}>
            {rows.map(({ lead, m }) => {
              const on = chosen === lead.id
              return (
                <li key={lead.id}>
                  <button
                    type="button" role="radio" aria-checked={on} onClick={() => setChosen(lead.id)}
                    className={cn('flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors', on ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted')}
                  >
                    <Avatar className="size-9"><AvatarFallback>{initials(lead.name)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{lead.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t('share.budgetUpTo', { amount: inrShort(lead.budget.max) })} · {lead.requirement.cities.join(', ')}
                      </span>
                    </span>
                    {!m.excluded ? <MatchBadge label={m.label} score={m.score} /> : <span className="text-xs text-muted-foreground">{t('share.notAFit')}</span>}
                    {on && <Check className="size-4 text-primary" />}
                  </button>
                </li>
              )
            })}
            {!rows.length && <li className="py-6 text-center text-sm text-muted-foreground">{t('share.noLeads')}</li>}
          </ul>
        </div>

        <SheetFooter className="grid grid-cols-3 gap-2 border-t">
          <Button size="lg" className="col-span-3" disabled={!chosen} onClick={() => send('whatsapp')}>
            <MessageCircle /> {t('share.whatsapp')}
          </Button>
          <Button size="lg" variant="outline" className="col-span-3 sm:col-span-1" disabled={!chosen} onClick={() => send('link')}>
            <Link2 /> {t('share.copyLink')}
          </Button>
          <Button size="lg" variant="outline" className="col-span-3 sm:col-span-2" disabled={!chosen} onClick={() => send('pdf')}>
            <FileDown /> {t('share.pdf')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
