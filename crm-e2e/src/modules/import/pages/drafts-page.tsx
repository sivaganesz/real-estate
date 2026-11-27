/**
 * /import/drafts — records waiting for a quick review (master prompt §15.3 "Show a Drafts list"): uncertain document
 * extractions, incomplete import rows, AI drafts. Each card shows how sure the reading was (a ring), which fields need
 * a check (low confidence) and what is still missing; Open finishes it in the prefilled form; Discard asks and can be
 * undone. Executives see their own drafts; managers and admins see everyone's.
 */
import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, CircleAlert, FileClock, FileImage, FileSpreadsheet, FileText, Building2, MessageSquareText, Sparkles, Trash2, TriangleAlert, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths, pathFor } from '@/app/paths'
import { EmptyImport } from '@/components/illustrations'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill } from '@/components/shared/filter-pill'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { IconTile } from '@/components/shared/icon-tile'
import { PageHeader } from '@/components/shared/page-header'
import { ProgressRing } from '@/components/shared/progress-ring'
import { Segmented } from '@/components/shared/segmented'
import { ToneBadge } from '@/components/shared/badges'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { Draft } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtRelative } from '@/lib/dates'
import { discardDraft } from '@/services/drafts'
import { draftGaps } from '../lib/document'
import { draftConfidence, lowFields, visibleDrafts } from '../lib/stats'

type Tab = Draft['status']
const KIND_ICON = { lead: Users, property: Building2, appointment: CalendarDays } as const
const SOURCE_ICON = { pdf: FileText, image: FileImage, paste: MessageSquareText, voice: MessageSquareText, import: FileSpreadsheet, assistant: Sparkles } as const

export default function DraftsPage() {
  const { t, i18n } = useTranslation(['import', 'common'])
  const now = useNow()
  const user = useCurrentUser()
  const { can } = usePermission()
  const all = useDb((db) => db.drafts)
  const users = useDb((db) => db.users)
  const [tab, setTab] = useState<Tab>('open')
  const [q, setQ] = useState('')
  const [kinds, setKinds] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [confirm, setConfirm] = useState<Draft | null>(null)
  const drafts = useMemo(() => visibleDrafts(all, user.id, can('import.leads')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [all, user.id, can])
  const inTab = drafts.filter((d) => d.status === tab)
  const list = inTab.filter((d) => (!q.trim() || d.title.toLowerCase().includes(q.trim().toLowerCase()) || (d.source.fileName ?? '').toLowerCase().includes(q.trim().toLowerCase()))
    && (!kinds.length || kinds.includes(d.kind)) && (!sources.length || sources.includes(d.source.type)))
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? t('import:someone')
  const active = (q ? 1 : 0) + (kinds.length ? 1 : 0) + (sources.length ? 1 : 0)
  const clear = () => { setQ(''); setKinds([]); setSources([]) }

  const discard = (d: Draft) => {
    try {
      const { undoToken } = discardDraft(d.id)
      toastUndo(t('import:drafts.discarded', { title: d.title }), undoToken)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="drafts-page">
      <PageHeader
        eyebrow={<Link to={paths.import()} className="hover:text-foreground">{t('import:title')}</Link>}
        title={t('import:drafts.title')} subtitle={t('import:drafts.subtitle')}
        actions={<Button asChild variant="ai"><Link to={paths.importKind('document')}><Sparkles />{t('import:drafts.readDoc')}</Link></Button>}
      />
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto border-b [scrollbar-width:none]">
          <Segmented value={tab} onChange={setTab} label={t('import:drafts.tabs')}
            segments={(['open', 'saved', 'discarded'] as const).map((s) => ({ value: s, label: t(`import:drafts.tab.${s}`), count: drafts.filter((d) => d.status === s).length }))} />
        </div>
        {inTab.length > 0 && (
          <FilterBar search={q} onSearch={setQ} placeholder={t('import:drafts.search')} activeCount={active} onClearAll={clear}
            filters={(
              <>
                <FilterPill label={t('import:drafts.kind')} options={(['lead', 'property', 'appointment'] as const).map((k) => ({ value: k, label: t(`import:drafts.kinds.${k}`), count: inTab.filter((d) => d.kind === k).length }))} selected={kinds} onChange={setKinds} />
                <FilterPill label={t('import:drafts.source')} options={(['pdf', 'image', 'paste', 'voice', 'import', 'assistant'] as const).map((s) => ({ value: s, label: t(`import:drafts.sources.${s}`), count: inTab.filter((d) => d.source.type === s).length })).filter((o) => o.count)} selected={sources} onChange={setSources} />
              </>
            )}
          />
        )}
      </div>

      {inTab.length === 0 ? (
        <section className="rounded-lg border bg-card shadow-card">
          <EmptyState illustration={EmptyImport} title={t(`import:drafts.empty.${tab}.title`)} body={t(`import:drafts.empty.${tab}.body`)}
            primary={tab === 'open' ? <Button asChild variant="ai"><Link to={paths.importKind('document')}><Sparkles />{t('import:drafts.readDoc')}</Link></Button> : undefined} />
        </section>
      ) : list.length === 0 ? (
        <section className="rounded-lg border bg-card shadow-card"><FilteredEmpty onClear={clear} title={t('import:drafts.filteredTitle')} /></section>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" data-testid="draft-cards">
          {list.map((d) => {
            const conf = Math.round(draftConfidence(d.fieldMeta) * 100)
            const low = lowFields(d.fieldMeta).length
            const gaps = draftGaps(d)
            const SourceIcon = SOURCE_ICON[d.source.type]
            return (
              <li key={d.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-md" data-testid={`draft-${d.id}`}>
                <div className="flex items-start gap-3">
                  <IconTile icon={KIND_ICON[d.kind]} tone={d.kind === 'lead' ? 'primary' : d.kind === 'property' ? 'info' : 'violet'} size="lg" />
                  <div className="min-w-0 flex-1">
                    <Link to={paths.draft(d.id)} className="line-clamp-2 font-semibold hover:text-primary focus-visible:underline focus-visible:outline-none">{d.title}</Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-meta text-muted-foreground">
                      <SourceIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{d.source.fileName ?? t(`import:drafts.sources.${d.source.type}`)}</span>
                    </p>
                  </div>
                  <ProgressRing value={conf} size={44} tone={conf < 75 ? 'warning' : 'ai'} label={t('import:drafts.confidence', { pct: conf })}>
                    <span className="text-micro font-semibold tabular-nums">{conf}%</span>
                  </ProgressRing>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ToneBadge tone="neutral">{t(`import:drafts.kinds.${d.kind}`)}</ToneBadge>
                  {low > 0 && <ToneBadge tone="warning" icon={TriangleAlert}>{t('import:drafts.toCheck', { count: low })}</ToneBadge>}
                  {gaps > 0 && <ToneBadge tone="danger" icon={CircleAlert}>{t('import:drafts.missing', { count: gaps })}</ToneBadge>}
                  {low === 0 && gaps === 0 && d.status === 'open' && <ToneBadge tone="success">{t('import:drafts.readyToSave')}</ToneBadge>}
                </div>
                <div className="mt-auto flex items-center gap-2 border-t pt-3">
                  <UserAvatar name={nameOf(d.createdBy)} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">{t('import:drafts.by', { name: nameOf(d.createdBy), when: fmtRelative(d.updatedAt, now, i18n.language) })}</span>
                  {d.status === 'open' && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setConfirm(d)} aria-label={t('import:drafts.discardAria', { title: d.title })} data-testid={`discard-${d.id}`}><Trash2 /></Button>
                  )}
                  {d.status === 'saved' && d.savedAs ? (
                    <Button asChild size="sm" variant="secondary"><Link to={pathFor(d.savedAs)}>{t('import:drafts.viewSaved')}<ArrowRight /></Link></Button>
                  ) : (
                    <Button asChild size="sm"><Link to={paths.draft(d.id)} data-testid={`draft-open-${d.id}`}><FileClock />{t(d.status === 'open' ? 'import:drafts.open' : 'import:drafts.view')}</Link></Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null) }} tone="danger"
        title={t('import:drafts.discardTitle', { title: confirm?.title ?? '' })} description={t('import:drafts.discardBody')}
        confirmLabel={t('import:drafts.discard')} onConfirm={() => { if (confirm) discard(confirm); setConfirm(null) }}
      />
    </div>
  )
}
