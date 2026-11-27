/**
 * Activity → Timeline items, rendered through the `activity` namespace (t(`activity:${kind}`, params)); stage changes
 * use the stage colour, calls the call colour, notes neutral, assignments info, AI-made entries show ✦.
 * Shows the activities that reference `refTo` (a lead's timeline) or the list given.
 */
import {
  ArrowRightLeft, Building2, CalendarCheck, CalendarDays, CalendarX, CheckCircle2, FileText, ListPlus, Mail, MessageCircle,
  MessageSquare, Phone, Settings, Share2, Star, Trash2, Upload, UserPlus, Users, type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyActivity } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Timeline, type TimelineItem } from '@/components/shared/timeline'
import type { Activity, ActivityKind, EntityRef, PipelineStageKey } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { addDaysToDay, localDay } from '@/lib/dates'
import { fmtDate, fmtTime } from '@/lib/format'
import { appointmentTypeTone, stageTone, type Tone, type ToneClasses } from '@/lib/tones'

const ICON: Partial<Record<ActivityKind, [LucideIcon, Tone]>> = {
  'lead.created': [UserPlus, 'primary'], 'lead.updated': [FileText, 'neutral'], 'lead.assigned': [Users, 'info'], 'lead.reassigned': [ArrowRightLeft, 'info'],
  'lead.deleted': [Trash2, 'danger'], 'lead.qualified': [CheckCircle2, 'success'], 'lead.merged': [Users, 'neutral'],
  'comm.whatsapp': [MessageCircle, 'success'], 'comm.email': [Mail, 'info'], 'comm.sms': [MessageSquare, 'neutral'], note: [FileText, 'neutral'],
  'appointment.created': [CalendarDays, 'primary'], 'appointment.rescheduled': [CalendarDays, 'warning'], 'appointment.completed': [CalendarCheck, 'success'],
  'appointment.cancelled': [CalendarX, 'neutral'], 'appointment.noShow': [CalendarX, 'danger'],
  'task.created': [ListPlus, 'neutral'], 'task.completed': [CheckCircle2, 'success'], 'task.cancelled': [CalendarX, 'neutral'],
  'property.created': [Building2, 'primary'], 'property.updated': [Building2, 'neutral'], 'property.statusChanged': [Building2, 'warning'],
  'property.deleted': [Trash2, 'danger'], 'property.shared': [Share2, 'success'], 'property.shortlisted': [Star, 'highlight'],
  'client.created': [Users, 'success'], 'client.updated': [Users, 'neutral'], 'import.completed': [Upload, 'info'], 'draft.saved': [FileText, 'neutral'],
  'settings.changed': [Settings, 'neutral'],
}

export function ActivityTimeline({ refTo, activities, limit = 50, className }: { refTo?: EntityRef; activities?: Activity[]; limit?: number; className?: string }) {
  const { t, i18n } = useTranslation(['activity', 'catalogue', 'domain'])
  const all = useDb((db) => db.activities)
  const users = useDb((db) => db.users)
  const now = useNow()
  const items = useMemo((): TimelineItem[] => {
    const src = activities ?? all.filter((a) => !refTo || a.refs.some((r) => r.kind === refTo.kind && r.id === refTo.id))
    const today = localDay(now)
    const yesterday = addDaysToDay(today, -1)
    return [...src].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit).map((a) => {
      const day = localDay(a.at)
      let icon: LucideIcon = ICON[a.kind]?.[0] ?? FileText
      let tone: Tone | undefined = ICON[a.kind]?.[1] ?? 'neutral'
      let classes: ToneClasses | undefined
      const params: Record<string, unknown> = { ...a.params }
      if (a.kind === 'lead.stageChanged') {
        const to = a.params.to as PipelineStageKey
        classes = stageTone[to]
        icon = stageTone[to]?.icon ?? icon
        tone = undefined
        params.toLabel = t(`catalogue:stage.${to}`)
        params.fromLabel = t(`catalogue:stage.${a.params.from as PipelineStageKey}`)
      }
      if (a.kind === 'comm.call') {
        icon = Phone
        classes = appointmentTypeTone.phoneCall
        tone = undefined
      }
      const actor = a.actorId === 'system' ? t('domain:timeline.system') : users.find((u) => u.id === a.actorId)?.name
      return {
        id: a.id, day,
        dayLabel: day === today ? t('domain:timeline.today') : day === yesterday ? t('domain:timeline.yesterday') : fmtDate(a.at, i18n.language),
        time: fmtTime(a.at, i18n.language), icon, tone, classes,
        title: t(`activity:${a.kind}`, params),
        body: a.text, actor, ai: a.via === 'ai',
      }
    })
  }, [activities, all, refTo, limit, now, t, i18n.language, users])
  return (
    <Timeline
      items={items} className={className}
      empty={<EmptyState compact illustration={EmptyActivity} title={t('domain:timeline.emptyTitle')} body={t('domain:timeline.emptyBody')} />}
    />
  )
}
