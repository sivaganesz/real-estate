/**
 * Two small admin sections. Users: who is on the team (by role and status) with a link to Team, where people are
 * added, edited and (de)activated. Demo data: reset everything to a fresh sample for today, after a confirm that
 * says what is lost (no Undo: the snapshot is replaced).
 */
import { useState } from 'react'
import { ArrowRight, Database, RotateCcw, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { Callout } from '@/components/shared/callout'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { SectionCard } from '@/components/shared/section-card'
import { toastError } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { ROLES } from '@/lib/permissions'
import { useDb } from '@/hooks/use-db'
import { roleTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { resetDemo } from '@/services/demo'

export function UsersSection() {
  const { t } = useTranslation(['settings', 'common'])
  const users = useDb((db) => db.users)
  const active = users.filter((u) => u.status === 'active')
  return (
    <SectionCard title={t('settings:users.title')} description={t('settings:users.body')} icon={UsersRound}
      action={<Button asChild><Link to={paths.team()}>{t('settings:users.open')}<ArrowRight aria-hidden="true" /></Link></Button>}>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => {
          const list = active.filter((u) => u.role === r)
          return (
            <div key={r} className="flex flex-col gap-2 rounded-lg border p-3">
              <span className={cn('inline-flex h-6 w-fit items-center rounded-full px-2.5 text-meta font-medium', roleTone[r].soft, roleTone[r].text)}>{t(`common:roles.${r}`)}</span>
              <span className="text-kpi font-[650] tabular-nums">{list.length}</span>
              <span className="flex -space-x-1.5">{list.slice(0, 6).map((u) => <UserAvatar key={u.id} name={u.name} size="xs" className="ring-2 ring-card rounded-full" />)}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-meta text-muted-foreground">{t('settings:users.deactivated', { count: users.length - active.length })}</p>
    </SectionCard>
  )
}

export function DemoSection() {
  const { t } = useTranslation('settings')
  const [asking, setAsking] = useState(false)
  const counts = useDb((db) => ({ leads: db.leads.length, properties: db.properties.length, appointments: db.appointments.length, tasks: db.tasks.length }))
  const reset = () => {
    try {
      resetDemo()
      toast.success(t('demo.done'), { description: t('demo.doneHint') })
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <SectionCard title={t('demo.title')} description={t('demo.body')} icon={Database}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['leads', 'properties', 'appointments', 'tasks'] as const).map((k) => (
            <div key={k} className="rounded-lg bg-muted/60 p-3">
              <dt className="text-meta text-muted-foreground">{t(`demo.count.${k}`)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{counts[k]}</dd>
            </div>
          ))}
        </dl>
        <Callout tone="warning">{t('demo.warning')}</Callout>
        <div>
          <Button variant="destructive" onClick={() => setAsking(true)} data-testid="demo-reset"><RotateCcw aria-hidden="true" />{t('demo.reset')}</Button>
        </div>
      </div>
      <ConfirmDialog
        open={asking} onOpenChange={setAsking} tone="danger" title={t('demo.confirmTitle')} description={t('demo.confirmBody')} confirmLabel={t('demo.confirm')}
        onConfirm={() => {
          setAsking(false)
          reset()
        }}
      />
    </SectionCard>
  )
}
