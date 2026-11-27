/**
 * The body of an assistant answer (DESIGN_SYSTEM §11.9, "graphical, not text-heavy"): the reply sentence and bullets,
 * how a Hinglish request was read, small metric bars, the records it found as rich rows (avatar, stage, score ring,
 * price, due time) that open the record, page links, a drafted client message and next-question chips.
 */
import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Copy, Languages, ListChecks, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { AIDraft, AIStat, CommandPlan } from '@/ai/types'
import { pathFor } from '@/app/paths'
import { EntityLink } from '@/components/domain/entity-link'
import { StagePill } from '@/components/domain/lead-pills'
import { ProgressRing, ScoreRing } from '@/components/shared/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Chip } from '@/components/shared/chip'
import { Button } from '@/components/ui/button'
import type { EntityKind, ID } from '@/domain/types'
import { useDb, useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime, fmtTime, inrShort } from '@/lib/format'
import { leadScore } from '@/lib/scoring'
import { TONE, appointmentTypeTone, propertyStatusTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { waLink } from '@/lib/whatsapp'
import { DemoAIBadge } from './demo-ai-badge'
import { runProposal } from './use-proposals'
import { propose } from '@/ai/proposals'

const MAX_ROWS = 6

/** Metric bars: label, value (or display text) and a bar in the answer's tone. */
export function StatBars({ stats }: { stats: AIStat[] }) {
  const max = Math.max(1, ...stats.map((s) => s.value))
  return (
    <ul className="flex flex-col gap-2" data-testid="ai-stats">
      {stats.map((s, i) => {
        const pct = s.pct ?? Math.round((s.value / max) * 100)
        const tone = TONE[s.tone ?? 'primary']
        return (
          <li key={`${s.label}-${i}`} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2 text-meta">
              <span className="truncate text-foreground">{s.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{s.display ?? s.value}</span>
            </span>
            <span aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <span className={cn('block h-full rounded-full transition-[width] duration-(--dur-slower) ease-out', tone.solid)} style={{ width: `${pct > 0 ? Math.max(3, Math.min(100, pct)) : 0}%` }} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Tiles for a mix of measures (a count, a ₹ amount, a %): value large, label small, a ring when there is a percentage. */
export function StatTiles({ stats }: { stats: AIStat[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2" data-testid="ai-stats">
      {stats.map((s, i) => (
        <li key={`${s.label}-${i}`} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2">
          {typeof s.pct === 'number'
            ? <ProgressRing value={s.pct} size={30} tone={s.tone ?? 'primary'} label={s.label} />
            : <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE[s.tone ?? 'primary'].solid)} />}
          <span className="min-w-0">
            <span className="block text-base font-semibold tabular-nums">{s.display ?? s.value}</span>
            <span className="block truncate text-micro text-muted-foreground" title={s.label}>{s.label}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The records an answer found, as rows that open the record. */
export function ResultList({ kind, ids, onNavigate }: { kind: EntityKind; ids: ID[]; onNavigate?: () => void }) {
  const { t } = useTranslation(['ai', 'catalogue'])
  const db = useWholeDb()
  const now = useNow()
  const [all, setAll] = useState(false)
  const shown = all ? ids : ids.slice(0, MAX_ROWS)
  const rows = useMemo(() => shown.map((id) => {
    const ref = { kind, id }
    if (kind === 'lead') {
      const l = db.leads.find((x) => x.id === id)
      if (!l) return null
      const s = leadScore(l, { properties: db.properties, settings: db.settings, now })
      return { ref, title: l.name, avatar: l.name, sub: l.requirement.localities[0] ?? l.requirement.cities[0] ?? '', pill: <StagePill stage={l.stage} short />, ring: s.score, ringKind: 'score' as const }
    }
    if (kind === 'property') {
      const p = db.properties.find((x) => x.id === id)
      if (!p) return null
      const st = propertyStatusTone[p.status]
      return { ref, title: p.title, sub: `${p.location.locality} · ${inrShort(p.price)}`, pill: <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-micro font-semibold', st.soft)}><span className={cn('size-1.5 rounded-full', st.solid)} />{t(`catalogue:propertyStatus.${p.status}`)}</span> }
    }
    if (kind === 'task') {
      const x = db.tasks.find((y) => y.id === id)
      if (!x) return null
      const overdue = x.dueAt < now.toISOString()
      return { ref, title: x.title, icon: ListChecks, sub: fmtDateTime(x.dueAt), subTone: overdue ? 'text-danger' : undefined, pill: overdue ? <span className="rounded-full bg-danger-soft px-2 text-micro font-semibold text-danger">{t('ai:result.overdue')}</span> : undefined }
    }
    if (kind === 'appointment') {
      const a = db.appointments.find((y) => y.id === id)
      if (!a) return null
      const tone = appointmentTypeTone[a.type]
      return { ref, title: db.leads.find((l) => l.id === a.leadId)?.name ?? a.id, icon: CalendarDays, iconTone: cn(tone.soft, 'text-foreground'), sub: `${fmtTime(a.start)} · ${t(`catalogue:appointmentType.${a.type}`)}` }
    }
    if (kind === 'user') {
      const u = db.users.find((y) => y.id === id)
      if (!u) return null
      return { ref, title: u.name, avatar: u.name, availability: u.availability, sub: t(`ai:result.availability.${u.availability}`) }
    }
    return null
  }).filter((r) => !!r), [shown, kind, db, now, t])

  if (!rows.length) return null
  return (
    <div className="flex flex-col gap-1" data-testid="ai-results">
      <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
        {rows.map((r) => {
          const Icon = 'icon' in r ? r.icon : undefined
          return (
            <li key={r.ref.id}>
              <Link to={pathFor(r.ref)} onClick={onNavigate} className="flex items-center gap-2.5 px-2.5 py-2 transition-colors duration-(--dur-fast) hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                {'avatar' in r && r.avatar ? <UserAvatar name={r.avatar} size="sm" availability={'availability' in r ? r.availability : undefined} />
                  : Icon ? <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', 'iconTone' in r && r.iconTone ? r.iconTone : 'bg-primary-soft text-primary')}><Icon className="size-4" /></span> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  {r.sub && <span className={cn('block truncate text-meta text-muted-foreground', 'subTone' in r && r.subTone)}>{r.sub}</span>}
                </span>
                {r.pill}
                {'ring' in r && typeof r.ring === 'number' && <ScoreRing score={r.ring} kind={r.ringKind} size={30} label={t('ai:result.score')} />}
              </Link>
            </li>
          )
        })}
      </ul>
      {ids.length > MAX_ROWS && (
        <button type="button" onClick={() => setAll((x) => !x)} className="self-start rounded-sm px-1 text-meta font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {all ? t('ai:result.less') : t('ai:result.more', { count: ids.length - MAX_ROWS })}
        </button>
      )}
    </div>
  )
}

/** A drafted client message: Copy, or open it in WhatsApp (that click logs the message on the lead's timeline). */
export function DraftCard({ draft, mode }: { draft: AIDraft; mode: CommandPlan['mode'] }) {
  const { t } = useTranslation(['ai', 'common'])
  const lead = useDb((db) => db.leads.find((l) => l.id === draft.leadId))
  const { can } = usePermission()
  const [text, setText] = useState(draft.text)
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)
  if (!lead) return null
  const mayLog = can('lead.edit', lead)
  const send = () => {
    window.open(draft.channel === 'email' ? `mailto:${lead.email ?? ''}?body=${encodeURIComponent(text)}` : waLink(lead.phone, text), '_blank', 'noopener')
    if (mayLog) {
      const p = propose({ kind: 'logActivity', permission: 'lead.edit', summary: [], payload: { leadId: lead.id, channel: draft.channel === 'email' ? 'email' : 'whatsapp', text } })
      const r = runProposal(p)
      if (r.status === 'done') setSent(true)
    }
  }
  return (
    <section data-testid="ai-draft" className="flex flex-col gap-2 rounded-xl border border-ai-border bg-card p-3">
      <header className="flex items-center gap-2 text-meta">
        <MessageCircle className={cn('size-4', draft.channel === 'whatsapp' ? 'text-success' : 'text-primary')} aria-hidden="true" />
        <span className="flex-1 font-semibold">{t(`ai:draft.title.${draft.channel}`, { name: lead.name })}</span>
        {draft.tone === 'hinglish' && <span className="inline-flex items-center gap-1 text-muted-foreground"><Languages className="size-3" aria-hidden="true" />{t('ai:draft.hinglish')}</span>}
        <DemoAIBadge mode={mode} />
      </header>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={t('ai:draft.edit')}
        rows={Math.min(8, Math.max(3, Math.ceil(text.length / 48)))}
        className="w-full resize-y rounded-md border bg-background px-2.5 py-2 text-sm whitespace-pre-wrap focus-visible:border-ring focus-visible:shadow-focus focus-visible:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false)) }}>
          {copied ? <Check /> : <Copy />}{copied ? t('ai:draft.copied') : t('ai:draft.copy')}
        </Button>
        <Button size="sm" className={draft.channel === 'whatsapp' ? 'bg-success text-success-foreground hover:bg-[color-mix(in_oklch,var(--success),var(--foreground)_12%)]' : undefined} onClick={send} data-testid="ai-draft-send">
          <MessageCircle />{t(`ai:draft.send.${draft.channel}`)}
        </Button>
        {sent && <span className="text-meta text-success">{t('ai:draft.logged')}</span>}
      </div>
    </section>
  )
}

/** Reply text, bullets, the Hinglish reading, stats, results, links and page links. */
export function AnswerBody({ plan, onNavigate }: { plan: CommandPlan; onNavigate?: () => void }) {
  const { t } = useTranslation('ai')
  const r = plan.reply
  return (
    <div className="flex flex-col gap-2.5">
      {plan.readAs && <p className="flex items-center gap-1.5 text-meta text-muted-foreground" data-testid="ai-read-as"><Languages className="size-3.5 shrink-0" aria-hidden="true" />{t('ai:panel.readAs', { text: plan.readAs })}</p>}
      {r.text && <p className="whitespace-pre-wrap">{r.text}</p>}
      {!!r.bullets?.length && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-foreground/90 marker:text-ai">
          {r.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      {!!plan.stats?.length && (plan.statsStyle === 'tiles' ? <StatTiles stats={plan.stats} /> : <StatBars stats={plan.stats} />)}
      {plan.results && plan.results.ids.length > 0 && <ResultList kind={plan.results.kind} ids={plan.results.ids} onNavigate={onNavigate} />}
      {!!r.links?.length && (!plan.results || plan.results.kind !== r.links[0].kind) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-meta">
          {r.links.map((l) => <EntityLink key={`${l.kind}-${l.id}`} refTo={l} onNavigate={onNavigate} />)}
        </div>
      )}
      {!!r.nav?.length && (
        <div className="flex flex-wrap gap-2">
          {r.nav.map((n) => (
            <Button key={n.to} asChild size="sm" variant="secondary">
              <Link to={n.to} onClick={onNavigate}>{t(n.label)}<ArrowRight /></Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Next-question chips under an answer. */
export function FollowUpChips({ items, onPick }: { items: { label: string; command: string }[]; onPick: (command: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="ai-followups">
      {items.map((f) => <Chip key={f.command} tone="ai" size="sm" className="h-auto py-1 text-left whitespace-normal" onClick={() => onPick(f.command)}>{f.label}</Chip>)}
    </div>
  )
}
