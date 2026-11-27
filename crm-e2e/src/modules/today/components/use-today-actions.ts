/**
 * The one-click Today actions, each a real write through a service (so the lists re-rank in the same render) with a
 * toast, and Undo where the service keeps a snapshot (completing tasks, bulk assignment). Errors (permission,
 * validation) show as error toasts.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import type { Appointment, ID, Lead } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { retrySlot } from '@/lib/dates'
import { fmtDateTime, firstName } from '@/lib/format'
import { fillTemplate, mapsLink, propertyAddress, waLink } from '@/lib/whatsapp'
import { logContact } from '@/services/activities'
import { confirmAppointment, rescheduleAppointment } from '@/services/appointments'
import { getDb } from '@/services/core/commit'
import { completeTask, createTask, rescheduleTask } from '@/services/tasks'
import type { TodayItem } from '@/services/queries/today'
import type { OutcomeInput } from './log-outcome'

export function useTodayActions() {
  const { t, i18n } = useTranslation(['today', 'domain'])
  const user = useCurrentUser()

  const lead = (id: ID | undefined): Lead | undefined => (id ? getDb().leads.find((l) => l.id === id) : undefined)

  const planFollowUp = useCallback((l: Lead, at: string) => {
    createTask({ title: t('domain:task.suggest.followUp', { name: l.name }), type: 'followUp', leadId: l.id, dueAt: at, ownerId: l.ownerId ?? user.id })
  }, [t, user.id])

  /**
   * Log what happened: completes the task with the call result, or logs a call on the lead; then plans the next step.
   * A call task is done once the call was made (a "not reachable" / "busy" result plans the retry call, E10 → E4). Any
   * other task (collect a document, share a brochure) is done only when the person was reached: otherwise the attempt
   * is logged on the lead and the task stays open, moved to the chosen follow-up or the retry slot (EXE-1).
   */
  const logOutcome = useCallback((item: TodayItem, o: OutcomeInput) => {
    const l = lead(item.leadId)
    try {
      const task = item.ref.kind === 'task' ? getDb().tasks.find((x) => x.id === item.ref.id) : undefined
      if (l && task && task.type !== 'call' && o.result !== 'connected') {
        logContact(l.id, { channel: 'call', result: o.result, text: o.note || undefined })
        const moveTo = o.followUpAt ?? (o.result === 'notReachable' || o.result === 'busy' ? retrySlot(new Date()) : undefined)
        if (moveTo) rescheduleTask(task.id, moveTo)
        toast.success(t('today:toast.logged', { name: l.name, result: t(`today:log.results.${o.result}`) }), {
          description: moveTo ? t('today:toast.keptOpen', { title: task.title, when: fmtDateTime(moveTo, i18n.language) }) : t('today:toast.keptOpenNow', { title: task.title }),
        })
        return
      }
      let undoToken: string | undefined
      if (item.ref.kind === 'task') undoToken = completeTask(item.ref.id, { callResult: o.result, outcome: o.note || undefined }).undoToken
      else if (l) logContact(l.id, { channel: 'call', result: o.result, text: o.note || undefined })
      if (l && o.followUpAt) planFollowUp(l, o.followUpAt)
      const msg = t('today:toast.logged', { name: l?.name ?? '', result: t(`today:log.results.${o.result}`) })
      const description = o.followUpAt ? t('today:toast.nextPlanned', { when: fmtDateTime(o.followUpAt, i18n.language) }) : undefined
      if (undoToken && !o.followUpAt) toastUndo(msg, undoToken, { description })
      else toast.success(msg, { description })
    } catch (e) {
      toastError(e)
    }
  }, [i18n.language, planFollowUp, t])

  const done = useCallback((item: TodayItem) => {
    if (item.ref.kind !== 'task') return
    try {
      const { undoToken } = completeTask(item.ref.id)
      toastUndo(t('today:toast.done', { title: String(item.params.title ?? '') }), undoToken)
    } catch (e) {
      toastError(e)
    }
  }, [t])

  const reschedule = useCallback((item: TodayItem, at: string) => {
    const when = fmtDateTime(at, i18n.language)
    try {
      if (item.ref.kind === 'task') {
        rescheduleTask(item.ref.id, at)
        toast.success(t('today:toast.rescheduled', { when }))
      } else if (item.ref.kind === 'appointment') {
        const { conflicts } = rescheduleAppointment(item.ref.id, at)
        toast.success(t('today:toast.visitMoved', { when }), { description: conflicts.length ? t('today:toast.conflicts', { count: conflicts.length }) : undefined })
      } else {
        const l = lead(item.leadId)
        if (!l) return
        planFollowUp(l, at)
        toast.success(t('today:toast.planned', { name: l.name, when }))
      }
    } catch (e) {
      toastError(e)
    }
  }, [i18n.language, planFollowUp, t])

  /** WhatsApp was opened from Today: logged on the lead as a message (delivery cannot be confirmed: K5). */
  const whatsappSent = useCallback((leadId: ID | undefined, text: string) => {
    const l = lead(leadId)
    if (!l) return
    try {
      logContact(l.id, { channel: 'whatsapp', text })
      toast.success(t('today:toast.whatsapp', { name: l.name }))
    } catch (e) {
      toastError(e)
    }
  }, [t])

  /** The prefilled follow-up message for a lead (settings template, English tone). */
  const followUpText = useCallback((l: Pick<Lead, 'name'>) => {
    const tpl = getDb().settings.templates.find((x) => x.purpose === 'followUp' && x.tone === 'english')
    return tpl ? fillTemplate(tpl.body, { firstName: firstName(l.name), agent: user.name }) : ''
  }, [user.name])

  /** "Send confirmation": opens WhatsApp with the visit-confirmation template and marks the appointment confirmed. */
  const sendConfirmation = useCallback((a: Appointment) => {
    const db = getDb()
    const l = lead(a.leadId)
    if (!l) return
    const p = db.properties.find((x) => x.id === a.propertyIds[0])
    const tpl = db.settings.templates.find((x) => x.purpose === 'visitConfirm' && x.tone === 'english')
    const text = tpl ? fillTemplate(tpl.body, {
      firstName: firstName(l.name), property: p?.title ?? '', time: fmtDateTime(a.start, 'en'), agent: user.name,
      map: a.location?.mapUrl ?? (p ? mapsLink(propertyAddress(p)) : a.location?.text ?? ''),
    }) : ''
    const href = waLink(l.phone, text)
    try {
      if (a.status === 'scheduled' || a.status === 'rescheduled') confirmAppointment(a.id)
      logContact(l.id, { channel: 'whatsapp', text })
      if (href) window.open(href, '_blank', 'noopener')
      toast.success(t('today:toast.confirmationSent', { name: l.name }))
    } catch (e) {
      toastError(e)
    }
  }, [t, user.name])

  return { logOutcome, done, reschedule, whatsappSent, followUpText, sendConfirmation, planFollowUp }
}
