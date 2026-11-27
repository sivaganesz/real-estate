/**
 * Change a property's status from its page: Available / On hold (until a date) / Booked / Sold. Booked and Sold ask
 * first and say what happens: the property leaves every match list at once and the owners of leads that shortlisted it
 * (or have a visit booked) are notified (E12). Every change can be undone for a few seconds.
 */
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AvailabilityPill } from '@/components/domain/property-pills'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { PROPERTY_STATUSES } from '@/domain/catalogue'
import type { Property, PropertyStatus } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { addDaysToDay, localDay } from '@/lib/dates'
import { linkedLeads } from '@/lib/property'
import { propertyStatusTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { changePropertyStatus } from '@/services/properties'

export function StatusControl({ p, editable }: { p: Property; editable: boolean }) {
  const { t } = useTranslation(['properties', 'catalogue'])
  const now = useNow()
  const leads = useDb((db) => db.leads)
  const appointments = useDb((db) => db.appointments)
  const [ask, setAsk] = useState<PropertyStatus | null>(null)
  const [until, setUntil] = useState(() => addDaysToDay(localDay(now), 3))
  const affected = useMemo(() => linkedLeads(p.id, { leads, appointments }, now).filter((l) => l.lead.deal?.propertyId !== p.id && (l.shortlisted || l.upcomingVisitIds.length)), [p.id, leads, appointments, now])

  if (!editable) return <AvailabilityPill status={p.status} />
  const apply = (status: PropertyStatus) => {
    try {
      const hold = status === 'onHold' ? { heldUntil: new Date(`${until}T18:00:00`).toISOString() } : {}
      const { undoToken } = changePropertyStatus(p.id, status, hold)
      toastUndo(t('properties:status.changed', { status: t(`catalogue:propertyStatus.${status}`) }), undoToken, {
        description: (status === 'booked' || status === 'sold') && affected.length ? t('properties:status.notified', { count: affected.length }) : undefined,
      })
    } catch (e) { toastError(e) }
  }
  const choose = (s: PropertyStatus) => {
    if (s === p.status) return
    if (s === 'available') apply(s)
    else setAsk(s)
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" data-testid="property-status" aria-label={t('properties:status.change', { status: t(`catalogue:propertyStatus.${p.status}`) })}>
            <span aria-hidden="true" className={cn('size-2 rounded-full', propertyStatusTone[p.status].solid)} />
            {t(`catalogue:propertyStatus.${p.status}`)}
            <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('properties:status.label')}</DropdownMenuLabel>
          {PROPERTY_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => choose(s)} disabled={s === p.status} data-testid={`status-${s}`}>
              <span aria-hidden="true" className={cn('size-2 rounded-full', propertyStatusTone[s].solid)} />{t(`catalogue:propertyStatus.${s}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={ask !== null} onOpenChange={(o) => { if (!o) setAsk(null) }}
        title={ask ? t('properties:status.confirmTitle', { status: t(`catalogue:propertyStatus.${ask}`) }) : ''}
        description={ask === 'onHold' ? t('properties:status.holdBody') : t('properties:status.closeBody', { count: affected.length })}
        confirmLabel={ask ? t('properties:status.confirm', { status: t(`catalogue:propertyStatus.${ask}`) }) : ''}
        onConfirm={() => { if (ask) apply(ask); setAsk(null) }}
      >
        {ask === 'onHold' && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('properties:form.heldUntil')}
            <Input type="date" min={localDay(now)} value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
        )}
        {(ask === 'booked' || ask === 'sold') && affected.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {affected.slice(0, 5).map((l) => <li key={l.lead.id} className="text-muted-foreground">· {l.lead.name}</li>)}
          </ul>
        )}
      </ConfirmDialog>
    </>
  )
}
