/**
 * Deactivate a user (admin; ROLE_RESEARCH #21): their open leads are handed over — auto (the assignment engine without
 * them, within their manager's team), to one person, or left unassigned for the manager's queue — with a preview of
 * who gets what before confirming. Open tasks and future visits follow each lead (effect E3). Undo for 10 s.
 * The same hand-over runs when an executive who still owns open leads gets another role (`roleChange`, ADM-5).
 */
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Sparkles, UserCog, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAI } from '@/ai'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { Callout } from '@/components/shared/callout'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ID, User } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { assignablePool, openLeadsOf, previewRedistribution, previewTotals, type RedistributeChoice } from '@/lib/assignment'
import { cn } from '@/lib/utils'
import { changeRoleWithHandOver, deactivateUser, type UserPatch } from '@/services/users'

type Mode = 'auto' | 'person' | 'unassign'

export function RedistributeDialog({ user, open, onOpenChange, roleChange }: {
  user: User
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Hand over for a role change instead of deactivating: the edited fields (with the new role), called back once saved. */
  roleChange?: { patch: UserPatch & { role: User['role'] }; onDone?: () => void }
}) {
  const { t } = useTranslation(['team', 'common', 'catalogue'])
  const db = useWholeDb()
  const [mode, setMode] = useState<Mode>('auto')
  const people = useMemo(() => assignablePool(db.users).filter((u) => u.id !== user.id), [db.users, user.id])
  // mounted fresh each time it opens (the caller renders it only while open): default to a teammate
  const [to, setTo] = useState<ID>(() => people.find((p) => p.managerId === user.managerId)?.id ?? people[0]?.id ?? '')

  const leads = useMemo(() => openLeadsOf(db.leads, user.id), [db.leads, user.id])
  const choice = useMemo<RedistributeChoice>(() => (mode === 'auto' ? 'auto' : mode === 'unassign' ? 'unassign' : { toUserId: to }), [mode, to])
  const preview = useMemo(() => (open ? previewRedistribution(db, user.id, choice) : []), [open, db, user.id, choice])
  const totals = previewTotals(preview)
  const nameOf = (id: ID | null) => (id ? db.users.find((u) => u.id === id)?.name : undefined) ?? t('team:redistribute.unassigned')
  const leadName = (id: ID) => db.leads.find((l) => l.id === id)?.name ?? id
  const unassignedLeft = preview.filter((p) => !p.to).length

  const confirm = () => {
    try {
      const r = roleChange ? changeRoleWithHandOver(user.id, roleChange.patch, choice) : deactivateUser(user.id, choice)
      const name = roleChange?.patch.name ?? user.name
      const done = roleChange ? t('team:roleHandOver.done', { name, role: t(`common:roles.${roleChange.patch.role}`) }) : t('team:redistribute.done', { name })
      toastUndo(done, r.undoToken, {
        description: leads.length ? totals.map((x) => `${nameOf(x.to)} ${x.count}`).join(' · ') : t('team:redistribute.noLeads'),
      })
      onOpenChange(false)
      roleChange?.onDone?.()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl" data-testid="redistribute-dialog">
        <DialogHeader>
          {roleChange ? (
            <>
              <DialogTitle className="flex items-center gap-2"><UserCog className="size-5 text-primary" aria-hidden="true" />{t('team:roleHandOver.title', { name: user.name, role: t(`common:roles.${roleChange.patch.role}`) })}</DialogTitle>
              <DialogDescription>{t('team:roleHandOver.body', { count: leads.length })}</DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="flex items-center gap-2"><UserX className="size-5 text-danger" aria-hidden="true" />{t('team:redistribute.title', { name: user.name })}</DialogTitle>
              <DialogDescription>{leads.length ? t('team:redistribute.body', { count: leads.length }) : t('team:redistribute.bodyNone')}</DialogDescription>
            </>
          )}
        </DialogHeader>

        {leads.length > 0 && (
          <>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-2" aria-label={t('team:redistribute.how')}>
              <Option value="auto" on={mode === 'auto'} title={<span className="inline-flex flex-wrap items-center gap-2">{t('team:redistribute.auto')}<DemoAIBadge mode={getAI().mode} /></span>} hint={t('team:redistribute.autoHint')} icon={<Sparkles className="size-4 text-ai" aria-hidden="true" />} />
              <Option value="person" on={mode === 'person'} title={t('team:redistribute.person')} hint={t('team:redistribute.personHint')}>
                {mode === 'person' && (
                  <Select value={to} onValueChange={setTo}>
                    <SelectTrigger className="mt-2 w-full sm:w-72" aria-label={t('team:redistribute.person')}><SelectValue placeholder={t('team:redistribute.pick')} /></SelectTrigger>
                    <SelectContent>
                      {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {t(`common:availability.${p.availability}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </Option>
              <Option value="unassign" on={mode === 'unassign'} title={t('team:redistribute.unassign')} hint={t('team:redistribute.unassignHint')} />
            </RadioGroup>

            <section className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3" aria-label={t('team:redistribute.preview')} data-testid="redistribute-preview">
              <h3 className="text-sm font-medium">{t('team:redistribute.preview')}</h3>
              <ul className="flex flex-wrap gap-2">
                {totals.map((x) => (
                  <li key={String(x.to)} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-meta font-medium">
                    {x.to ? <UserAvatar name={nameOf(x.to)} size="xs" /> : <span className="size-6 rounded-full border border-dashed" aria-hidden="true" />}
                    {nameOf(x.to)} <span className="tabular-nums text-muted-foreground">{x.count}</span>
                  </li>
                ))}
              </ul>
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-meta">
                {preview.map((p) => (
                  <li key={p.leadId} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">{leadName(p.leadId)} <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" /> <strong className="truncate">{nameOf(p.to)}</strong></span>
                    <span className="shrink-0 text-muted-foreground">{t(`catalogue:assignmentReason.${p.reasonKey}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
            {unassignedLeft > 0 && <Callout tone="warning">{t(roleChange ? 'team:roleHandOver.leftWarning' : 'team:redistribute.leftWarning', { count: unassignedLeft })}</Callout>}
          </>
        )}
        <Callout tone="info">{t(roleChange ? 'team:roleHandOver.note' : 'team:redistribute.note')}</Callout>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button variant={roleChange ? 'default' : 'destructive'} onClick={confirm} disabled={mode === 'person' && !to} data-testid="redistribute-confirm">
            {roleChange ? t('team:roleHandOver.confirm') : t('team:redistribute.confirm', { name: user.name })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Option({ value, on, title, hint, icon, children }: { value: Mode; on: boolean; title: ReactNode; hint: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors', on ? 'border-primary/40 bg-primary-soft/50' : 'hover:bg-muted/50')}>
      <RadioGroupItem value={value} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">{icon}{title}</span>
        <span className="block text-meta text-muted-foreground">{hint}</span>
        {children}
      </span>
    </label>
  )
}
