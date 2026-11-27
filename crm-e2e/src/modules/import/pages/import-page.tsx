/**
 * /import — the hub (foundation-plan §8.3 M5): KPIs (imports, rows brought in, duplicates caught, drafts to review),
 * the five default templates (download .xlsx / .csv generated at runtime, upload), document extraction, the sample
 * files to try, and the recent jobs. Managers import leads only: property templates show a lock with the reason.
 *
 * Executives cannot bulk import (master prompt §4 "❌ or limited", ROLE_RESEARCH "single-document extraction only"):
 * they get the limited hub, i.e. document extraction, the document samples, their drafts and their own document jobs.
 * The sheet wizards and the history stay NoAccess for them (routes.tsx).
 */
import { useMemo } from 'react'
import { ArrowRight, CopyCheck, FileStack, FileUp, History, Inbox, Layers, Lock, ScanText, Sparkles, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { EmptyImport } from '@/components/illustrations'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { Callout } from '@/components/shared/callout'
import { EmptyState } from '@/components/shared/empty-state'
import { IconTile } from '@/components/shared/icon-tile'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { getAI } from '@/ai'
import type { ImportJob } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtRelative } from '@/lib/dates'
import { num } from '@/lib/format'
import { SHEET_KINDS } from '../lib/fields'
import { visibleDrafts, visibleJobs, importStats } from '../lib/stats'
import { JobCountsBar, JobStatusBadge } from '../components/job-bits'
import { FILE_ICON } from '../lib/kinds'
import { SampleList } from '../components/sample-list'
import { TemplateCard } from '../components/template-card'

/** Where a recent job opens: the history drawer, or (executives have no history) the draft or drafts it made. */
const jobHref = (j: ImportJob, bulk: boolean) =>
  bulk ? `${paths.importHistory()}?job=${j.id}` : j.draftIds.length === 1 ? paths.draft(j.draftIds[0]) : paths.drafts()

export default function ImportPage() {
  const { t, i18n } = useTranslation('import')
  const now = useNow()
  const user = useCurrentUser()
  const { can, explain } = usePermission()
  const bulk = can('import.leads')
  const allJobs = useDb((db) => db.importJobs)
  const allDrafts = useDb((db) => db.drafts)
  const users = useDb((db) => db.users)
  const jobs = useMemo(
    () => (bulk ? visibleJobs(allJobs, user.id, can('import.properties')) : allJobs.filter((j) => j.kind === 'document' && j.createdBy === user.id)),
    [allJobs, user.id, can, bulk],
  )
  const drafts = useMemo(() => visibleDrafts(allDrafts, user.id, bulk), [allDrafts, user.id, bulk])
  const stats = useMemo(() => importStats(jobs, drafts, now), [jobs, drafts, now])
  const recent = useMemo(() => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5), [jobs])
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? t('someone')
  const denied = explain('import.leads')

  return (
    <div className="flex flex-col gap-6" data-testid="import-hub">
      <PageHeader
        title={t('title')}
        subtitle={t(bulk ? 'subtitle' : 'hub.subtitleDocs')}
        actions={(
          <>
            {bulk && <Button asChild variant="secondary"><Link to={paths.importHistory()}><History />{t('hub.history')}</Link></Button>}
            <Button asChild variant="secondary">
              <Link to={paths.drafts()} data-testid="hub-drafts"><Inbox />{t('hub.drafts')}{stats.openDrafts > 0 && <span className="rounded-full bg-ai-soft px-1.5 text-meta text-ai tabular-nums">{stats.openDrafts}</span>}</Link>
            </Button>
            {bulk
              ? <Button asChild><Link to={paths.importKind(can('import.properties') ? 'apartments' : 'leads')}><Upload />{t('hub.upload')}</Link></Button>
              : <Button asChild variant="ai"><Link to={paths.importKind('document')}><Sparkles />{t('hub.docsCta')}</Link></Button>}
          </>
        )}
      />

      {bulk ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <KpiCard label={t('kpi.imports')} value={num(stats.jobs30)} icon={FileStack} tone="primary" spark={stats.spark} hint={t('kpi.last30')} to={paths.importHistory()} />
            <KpiCard label={t('kpi.rows')} value={num(stats.rows30)} icon={Layers} tone="success" hint={t('kpi.rowsHint', { count: stats.created30 })} />
            <KpiCard label={t('kpi.duplicates')} value={num(stats.duplicates30)} icon={CopyCheck} tone="warning" hint={t('kpi.duplicatesHint')} />
            <KpiCard
              label={t('kpi.drafts')} value={num(stats.openDrafts)} icon={Inbox} tone="ai" to={paths.drafts()}
              ring={{ value: stats.draftsLowShare, label: t('kpi.lowShare', { pct: stats.draftsLowShare }) }}
              hint={t('kpi.draftsHint', { count: stats.lowDrafts })}
            />
          </div>

          <section aria-labelledby="tpl-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="tpl-title" className="text-lg font-semibold">{t('hub.templatesTitle')}</h2>
                <p className="text-meta text-muted-foreground">{t('hub.templatesBody')}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 md:gap-4" data-testid="template-cards">
              {SHEET_KINDS.map((k) => <TemplateCard key={k} kind={k} />)}
            </div>
          </section>
        </>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch" data-testid="hub-limited">
          <Callout tone="info" icon={Lock} title={t('hub.limitedTitle')} className="flex-1">
            {t('hub.limitedBody')} <span className="text-muted-foreground">{t(denied.reasonKey, denied.params)}</span>
          </Callout>
          <div className="sm:w-72">
            <KpiCard
              label={t('kpi.myDrafts')} value={num(stats.openDrafts)} icon={Inbox} tone="ai" to={paths.drafts()}
              hint={t('kpi.draftsHint', { count: stats.lowDrafts })}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <SectionCard
          className="min-w-0 lg:col-span-5" icon={ScanText} title={t('hub.docsTitle')} description={t('hub.docsBody')}
          action={<DemoAIBadge mode={getAI().mode} />}
        >
          <div className="flex flex-col gap-4">
            <ul className="grid grid-cols-3 gap-2 text-center">
              {(['pdf', 'image', 'scan'] as const).map((k) => (
                <li key={k} className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-3">
                  <IconTile icon={k === 'pdf' ? FileStack : k === 'image' ? ScanText : FileUp} tone="ai" size="sm" />
                  <span className="text-meta font-medium">{t(`hub.docKind.${k}`)}</span>
                  <span className="text-caption text-muted-foreground">{t(`hub.docKindHint.${k}`)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="ai"><Link to={paths.importKind('document')}><Sparkles />{t('hub.docsCta')}</Link></Button>
              <span className="text-meta text-muted-foreground">{t('hub.docsNote')}</span>
            </div>
          </div>
        </SectionCard>
        <SectionCard className="min-w-0 lg:col-span-7" icon={FileUp} title={t('samples.title')} description={t(bulk ? 'samples.body' : 'samples.bodyDocs')}>
          <SampleList only={bulk ? undefined : (s) => s.kind === 'document'} />
        </SectionCard>
      </div>

      <SectionCard
        icon={History} title={t(bulk ? 'hub.recentTitle' : 'hub.recentDocsTitle')} description={t(bulk ? 'hub.recentBody' : 'hub.recentDocsBody')}
        action={bulk && jobs.length > 0 && <Button asChild variant="ghost" size="sm"><Link to={paths.importHistory()}>{t('common:actions.viewAll')}<ArrowRight /></Link></Button>}
        bodyClassName="px-0 md:px-0 pb-2 md:pb-2"
      >
        {recent.length === 0 ? (
          <EmptyState compact illustration={EmptyImport} title={t(bulk ? 'hub.noJobsTitle' : 'hub.noDocsTitle')} body={t(bulk ? 'hub.noJobsBody' : 'hub.noDocsBody')} />
        ) : (
          <ul className="divide-y divide-border/70" data-testid="recent-jobs">
            {recent.map((j) => {
              const Icon = FILE_ICON[j.fileType]
              return (
                <li key={j.id}>
                  <Link to={jobHref(j, bulk)} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none md:px-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4.5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{j.fileName}</span>
                      <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
                        <UserAvatar name={nameOf(j.createdBy)} size="xs" />
                        <span className="truncate">{t('hub.jobBy', { kind: t(`kind.${j.kind}.short`), name: nameOf(j.createdBy), when: fmtRelative(j.createdAt, now, i18n.language) })}</span>
                      </span>
                    </span>
                    <JobCountsBar counts={j.counts} className="w-40 max-sm:hidden" />
                    <JobStatusBadge status={j.status} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
