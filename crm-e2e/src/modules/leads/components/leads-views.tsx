/**
 * The card grid and the "Today design" (ported from wireframe-rebuild/src/features/leads/leads-today.tsx: the agreed
 * grouping of who to call now). Groups, first match wins: overdue follow-ups · not called yet (SLA) · due today ·
 * hot without a site visit · no follow-up planned · coming up. Each group is a card with an icon tile, a count and
 * compact lead rows with the reason in Iris when it is the AI's next best action.
 */
import { useState, type ReactNode } from 'react'
import { AlarmClock, CalendarCheck2, CalendarClock, CalendarX2, Flame, PhoneCall, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AISuggestionChip } from '@/components/ai/ai-suggestion-chip'
import { LeadCard } from '@/components/domain/lead-card'
import { IconTile } from '@/components/shared/icon-tile'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { fmtDate, fmtTime } from '@/lib/format'
import type { Tone } from '@/lib/tones'
import { groupFocus, type FocusGroup } from '../lib/focus'
import { LeadActionsMenu } from './lead-actions-menu'
import type { LeadRow } from './use-lead-items'

export function LeadsCards({ rows, selected, onSelectedChange, empty, footer }: {
  rows: LeadRow[]
  selected: ReadonlySet<string>
  onSelectedChange?: (s: Set<string>) => void
  empty: ReactNode
  footer?: ReactNode
}) {
  const { t } = useTranslation('leads')
  if (!rows.length) return <div className="rounded-lg border bg-card shadow-card">{empty}</div>
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4" aria-label={t('list.label')}>
        {rows.map((r) => (
          <li key={r.lead.id} className="relative">
            {onSelectedChange && (
              <Checkbox
                className="absolute top-3 right-14 z-[2] bg-card"
                checked={selected.has(r.lead.id)} aria-label={t('list.select', { name: r.lead.name })}
                onCheckedChange={(v) => { const s = new Set(selected); if (v === true) s.add(r.lead.id); else s.delete(r.lead.id); onSelectedChange(s) }}
              />
            )}
            <LeadCard lead={r.lead} className="h-full" more={<LeadActionsMenu lead={r.lead} />} />
          </li>
        ))}
      </ul>
      {footer}
    </div>
  )
}

const GROUPS: { key: FocusGroup; icon: LucideIcon; tone: Tone }[] = [
  { key: 'overdue', icon: AlarmClock, tone: 'danger' },
  { key: 'uncontacted', icon: PhoneCall, tone: 'warning' },
  { key: 'dueToday', icon: CalendarClock, tone: 'primary' },
  { key: 'hotNoVisit', icon: Flame, tone: 'hot' },
  { key: 'noFollowUp', icon: CalendarX2, tone: 'neutral' },
  { key: 'upcoming', icon: CalendarCheck2, tone: 'info' },
]
const SHOW = 6

export function LeadsFocus({ rows, now, empty }: { rows: LeadRow[]; now: Date; empty: ReactNode }) {
  const { t, i18n } = useTranslation('leads')
  const groups = groupFocus(rows, now)
  const [open, setOpen] = useState<Partial<Record<FocusGroup, boolean>>>({})
  const shown = GROUPS.filter((g) => groups[g.key].length)
  if (!shown.length) return <div className="rounded-lg border bg-card shadow-card">{empty}</div>

  const reason = (g: FocusGroup, r: LeadRow): ReactNode => {
    const at = r.nextFollowUpAt
    if (g === 'overdue' && at) return <span className="text-meta font-medium text-danger">{t('focus.reason.overdue', { date: fmtDate(at, i18n.language) })}</span>
    if (g === 'uncontacted') return <span className="text-meta font-medium text-warning">{r.aging.breached ? t('aging.sla') : t('focus.reason.uncontacted')}</span>
    if (g === 'dueToday' && at) return <span className="text-meta font-medium text-primary">{t('list.todayAt', { time: fmtTime(at, i18n.language) })}</span>
    if (g === 'upcoming' && at) return <span className="text-meta text-muted-foreground">{fmtDate(at, i18n.language)}</span>
    return r.next ? <AISuggestionChip>{t(`next.${r.next.key}`, r.next.params ?? {})}</AISuggestionChip> : null
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="leads-focus">
      {shown.map((g) => {
        const list = groups[g.key]
        const all = open[g.key] || list.length <= SHOW
        return (
          <section key={g.key} aria-labelledby={`focus-${g.key}`} className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 shadow-card md:p-5">
            <header className="flex items-start gap-3">
              <IconTile icon={g.icon} tone={g.tone} />
              <div className="min-w-0 flex-1">
                <h2 id={`focus-${g.key}`} className="flex items-center gap-2 text-base font-semibold">
                  {t(`focus.group.${g.key}.title`)}
                  <span className="rounded-full bg-muted px-2 text-meta font-semibold tabular-nums">{list.length}</span>
                </h2>
                <p className="text-meta text-muted-foreground">{t(`focus.group.${g.key}.body`)}</p>
              </div>
            </header>
            <ul className="flex flex-col gap-2">
              {(all ? list : list.slice(0, SHOW)).map((r) => (
                <li key={r.lead.id} className="flex flex-col gap-1">
                  <LeadCard compact lead={r.lead} />
                  <div className="min-w-0 pl-4">{reason(g.key, r)}</div>
                </li>
              ))}
            </ul>
            {list.length > SHOW && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setOpen((o) => ({ ...o, [g.key]: !all }))}>
                {all ? t('focus.showLess') : t('focus.showAll', { count: list.length })}
              </Button>
            )}
          </section>
        )
      })}
    </div>
  )
}
