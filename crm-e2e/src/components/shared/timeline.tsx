/**
 * Timeline (DESIGN_SYSTEM §11.12): a vertical 1 px `--border` line with 28 px icon-tile nodes coloured by event type,
 * each entry with its text, the actor avatar and a relative time; items grouped by day under sticky day labels.
 * Generic: domain/activity-timeline maps Activity records to these items.
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TONE, type Tone, type ToneClasses } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { UserAvatar } from './user-avatar'

export type TimelineItem = {
  id: string
  /** Local day key 'YYYY-MM-DD' for grouping. */
  day: string
  /** Day label ("Today", "Yesterday", "21 Nov 2026"). */
  dayLabel: string
  time: string
  icon: LucideIcon
  tone?: Tone
  classes?: ToneClasses
  title: ReactNode
  body?: ReactNode
  actor?: string
  /** Done by the AI (shows ✦). */
  ai?: boolean
  action?: ReactNode
}

export function Timeline({ items, empty, className, stickyTop = 'top-0' }: { items: TimelineItem[]; empty?: ReactNode; className?: string; stickyTop?: string }) {
  const { t } = useTranslation('ui')
  if (!items.length) return <>{empty}</>
  const groups: { day: string; label: string; items: TimelineItem[] }[] = []
  for (const it of items) {
    const g = groups.at(-1)
    if (g && g.day === it.day) g.items.push(it)
    else groups.push({ day: it.day, label: it.dayLabel, items: [it] })
  }
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {groups.map((g) => (
        <section key={g.day} aria-label={g.label}>
          <h3 className={cn('sticky z-[1] mb-2 bg-card/95 py-1 text-caption font-semibold tracking-[0.06em] text-subtle-foreground uppercase backdrop-blur [:lang(ta)_&]:normal-case [:lang(ta)_&]:tracking-normal', stickyTop)}>{g.label}</h3>
          <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[13.5px] before:w-px before:bg-border">
            {g.items.map((it) => {
              const c = it.classes ?? TONE[it.tone ?? 'neutral']
              const Icon = it.icon
              return (
                <li key={it.id} className="relative grid grid-cols-[28px_1fr] gap-3">
                  <span aria-hidden="true" className={cn('relative z-[1] flex size-7 items-center justify-center rounded-md ring-4 ring-card', c.soft, it.classes ? 'text-foreground' : c.text)}>
                    <Icon className="size-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm">
                      {it.ai && <Sparkles className="mr-1 inline size-3.5 text-ai" aria-label={t('timeline.byAi')} />}
                      {it.title}
                    </p>
                    {it.body && <div className="mt-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm text-foreground/90 whitespace-pre-line">{it.body}</div>}
                    <p className="mt-1 flex items-center gap-1.5 text-meta text-muted-foreground">
                      {it.actor && <UserAvatar name={it.actor} size="xs" />}
                      {it.actor && <span className="truncate">{it.actor}</span>}
                      {it.actor && <span aria-hidden="true">·</span>}
                      <span className="tabular-nums">{it.time}</span>
                    </p>
                    {it.action && <div className="mt-1.5">{it.action}</div>}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
