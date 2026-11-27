/**
 * Availability (master prompt §10: Available / In a visit / On leave), changeable with `user.setAvailability`
 * (admin all, manager team, executive self). Going on leave asks until when and, for people who can assign, offers
 * to hand the open leads over with auto-assignment right away (ROLE_RESEARCH #15); otherwise the manager gets the
 * "reassign N leads?" notification (E15). The control is read-only for everyone else.
 */
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Availability, User } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { openLeadsOf } from '@/lib/assignment'
import { addDaysToDay, localDay } from '@/lib/dates'
import { availabilityTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { assignLeads } from '@/services/assignments'
import { setAvailability } from '@/services/users'

const OPTIONS: Availability[] = ['available', 'inVisit', 'onLeave']

export function AvailabilityBadge({ user, className }: { user: User; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-meta font-medium', availabilityTone[user.availability].soft, availabilityTone[user.availability].text, className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', availabilityTone[user.availability].solid)} />
      {t(`availability.${user.availability}`)}
    </span>
  )
}

export function AvailabilityControl({ user, className }: { user: User; className?: string }) {
  const { t } = useTranslation(['team', 'common'])
  const { can } = usePermission()
  const now = useNow()
  const leads = useDb((db) => db.leads)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [until, setUntil] = useState('')
  const [handOver, setHandOver] = useState(true)
  const open = openLeadsOf(leads, user.id)
  const canAssign = can('lead.assign')

  if (!can('user.setAvailability', { ownerId: user.id }) || user.status !== 'active') return <AvailabilityBadge user={user} className={className} />

  const change = (to: Availability) => {
    if (to === user.availability) return
    if (to === 'onLeave') {
      setUntil(addDaysToDay(localDay(now), 3))
      setHandOver(canAssign && open.length > 0)
      setLeaveOpen(true)
      return
    }
    try {
      setAvailability(user.id, to)
      toast.success(t('team:availability.changed', { name: user.name, status: t(`common:availability.${to}`) }))
    } catch (e) {
      toastError(e)
    }
  }

  const confirmLeave = () => {
    try {
      setAvailability(user.id, 'onLeave', until || undefined)
      if (handOver && canAssign && open.length) {
        const r = assignLeads(open.map((l) => l.id), 'auto', t('team:availability.handOverNote', { name: user.name }))
        const moved = r.result.filter((x) => x.to).length
        toastUndo(t('team:availability.leaveHandedOver', { name: user.name, count: moved }), r.undoToken)
      } else {
        toast.success(t('team:availability.leaveSet', { name: user.name }))
      }
      setLeaveOpen(false)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('h-7 gap-1.5 rounded-full px-2.5', availabilityTone[user.availability].soft, availabilityTone[user.availability].text, className)} aria-label={t('team:availability.changeFor', { name: user.name })} data-testid={`availability-${user.id}`}>
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', availabilityTone[user.availability].solid)} />
            {t(`common:availability.${user.availability}`)}
            <ChevronDown className="size-3" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {OPTIONS.map((o) => (
            <DropdownMenuItem key={o} onSelect={() => change(o)}>
              <span aria-hidden="true" className={cn('size-2 rounded-full', availabilityTone[o].solid)} />
              {t(`common:availability.${o}`)}
              {o === user.availability && <Check className="ml-auto size-3.5" aria-hidden="true" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('team:availability.leaveTitle', { name: user.name })}</DialogTitle>
            <DialogDescription>{t('team:availability.leaveBody')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`leave-until-${user.id}`}>{t('team:availability.until')} <span className="font-normal text-muted-foreground">{t('common:optional')}</span></Label>
            <Input id={`leave-until-${user.id}`} type="date" value={until} min={localDay(now)} onChange={(e) => setUntil(e.target.value)} className="w-48" />
          </div>
          {open.length > 0 && (canAssign ? (
            <label className="flex items-start gap-2.5 rounded-md bg-muted/60 p-3 text-sm">
              <Checkbox checked={handOver} onCheckedChange={(v) => setHandOver(v === true)} className="mt-0.5" />
              <span>
                <span className="block font-medium">{t('team:availability.handOver', { count: open.length })}</span>
                <span className="block text-meta text-muted-foreground">{t('team:availability.handOverHint')}</span>
              </span>
            </label>
          ) : (
            <p className="rounded-md bg-muted/60 p-3 text-meta text-muted-foreground">{t('team:availability.managerWillKnow', { count: open.length })}</p>
          ))}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLeaveOpen(false)}>{t('common:actions.cancel')}</Button>
            <Button onClick={confirmLeave} data-testid="leave-confirm">{t('team:availability.leaveConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
