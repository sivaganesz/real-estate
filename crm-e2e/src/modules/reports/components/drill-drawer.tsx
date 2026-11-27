/**
 * The drill-down drawer (DESIGN_SYSTEM §10 "click-through to a filtered list"): the leads or properties behind the
 * number that was clicked, with links to each record, a CSV of exactly this list (when the role may export) and a
 * way on to the full module.
 */
import { ArrowUpRight, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { NoResults } from '@/components/illustrations'
import { DotBadge } from '@/components/shared/badges'
import { Drawer } from '@/components/shared/drawer'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { DB } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { fmtDate, inrShort } from '@/lib/format'
import { propertyStatusTone, stageTone } from '@/lib/tones'
import { drillLeads, drillProperties, isPropertyDrill, type Drill, type ReportData } from '../lib/report-data'
import { csvFileName, toCsv } from '../lib/csv'
import { downloadText } from './download'


export function DrillDrawer({ drill, onClose, data, db, now }: { drill: Drill | null; onClose: () => void; data: ReportData; db: DB; now: Date }) {
  const { t, i18n } = useTranslation(['reports', 'catalogue'])
  const { can } = usePermission()
  if (!drill) return null
  const props = isPropertyDrill(drill)
  const leads = props ? [] : drillLeads(data, drill, { settings: db.settings, now })
  const properties = props ? drillProperties(db.properties, drill) : []
  const title = drillTitle(drill, (k, o) => String(t(k, o ?? {})), db)
  const count = props ? properties.length : leads.length
  const owner = (id: string | null | undefined) => db.users.find((u) => u.id === id)
  const exportCsv = () => {
    const text = props
      ? toCsv([t('reports:drill.col.id'), t('reports:drill.col.title'), t('reports:drill.col.status'), t('reports:drill.col.price'), t('reports:drill.col.locality')],
        properties.map((p) => [p.id, p.title, t(`catalogue:propertyStatus.${p.status}`), p.price, `${p.location.locality}, ${p.location.city}`]))
      : toCsv([t('reports:drill.col.id'), t('reports:drill.col.name'), t('reports:drill.col.stage'), t('reports:drill.col.source'), t('reports:drill.col.owner'), t('reports:drill.col.value'), t('reports:drill.col.created')],
        leads.map((l) => [l.id, l.name, t(`catalogue:stage.${l.stage}`), t(`catalogue:source.${l.source}`), owner(l.ownerId)?.name ?? '', l.deal?.value ?? l.requirement.budgetMax ?? '', fmtDate(l.createdAt, 'en')]))
    downloadText(csvFileName(`drill-${drill.kind}`, data.period, 'list', now), text)
  }
  return (
    <Drawer
      open onOpenChange={(o) => { if (!o) onClose() }} title={title} subtitle={t('reports:drill.count', { count })} size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {can('export.data') && count > 0 ? <Button variant="secondary" size="sm" onClick={exportCsv}><Download />{t('reports:export')}</Button> : <span />}
          <Button asChild size="sm"><Link to={props ? paths.properties() : drill.kind === 'stage' || drill.kind === 'stalled' ? paths.pipeline() : paths.leads()}>{props ? t('reports:drill.openProperties') : drill.kind === 'stage' || drill.kind === 'stalled' ? t('reports:drill.openPipeline') : t('reports:drill.openLeads')}<ArrowUpRight /></Link></Button>
        </div>
      }
    >
      <div data-testid="drill-drawer">
        {count === 0 ? (
          <EmptyState compact illustration={NoResults} title={t('reports:drill.emptyTitle')} body={t('reports:drill.emptyBody')} />
        ) : props ? (
          <ul className="flex flex-col divide-y divide-border/70">
            {properties.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link to={paths.property(p.id)} className="block truncate text-sm font-medium hover:underline">{p.title}</Link>
                  <p className="truncate text-meta text-muted-foreground">{p.location.locality}, {p.location.city} · {t(`catalogue:propertyType.${p.type}`)}</p>
                </div>
                <DotBadge classes={propertyStatusTone[p.status]}>{t(`catalogue:propertyStatus.${p.status}`)}</DotBadge>
                <span className="w-20 text-right text-sm font-semibold tabular-nums">{inrShort(p.price)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col divide-y divide-border/70">
            {leads.map((l) => {
              const o = owner(l.ownerId)
              return (
                <li key={l.id} className="flex items-center gap-3 py-2.5" data-testid="drill-row">
                  <div className="min-w-0 flex-1">
                    <Link to={paths.lead(l.id)} className="block truncate text-sm font-medium hover:underline">{l.name}</Link>
                    <p className="truncate text-meta text-muted-foreground">{[t(`catalogue:source.${l.source}`), fmtDate(l.createdAt, i18n.language)].join(' · ')}</p>
                  </div>
                  <DotBadge classes={stageTone[l.stage]}>{t(`catalogue:stageShort.${l.stage}`)}</DotBadge>
                  <span className="hidden w-20 text-right text-sm font-semibold tabular-nums sm:inline">{inrShort(l.deal?.value ?? l.requirement.budgetMax)}</span>
                  {o ? <UserAvatar name={o.name} size="xs" /> : <span className="size-6" />}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Drawer>
  )
}

function drillTitle(d: Drill, t: (k: string, o?: Record<string, unknown>) => string, db: DB): string {
  switch (d.kind) {
    case 'stage': return t(d.scope === 'open' ? 'reports:drill.stageOpen' : 'reports:drill.stageReached', { stage: t(`catalogue:stage.${d.stage}`) })
    case 'source': return t('reports:drill.source', { source: t(`catalogue:source.${d.source}`) })
    case 'lost': return t('reports:drill.lost', { reason: t(`catalogue:lostReason.${d.reason}`) })
    case 'owner': return t('reports:drill.owner', { name: db.users.find((u) => u.id === d.userId)?.name ?? '' })
    case 'bucket': return t(d.metric === 'leads' ? 'reports:drill.bucketLeads' : 'reports:drill.bucketBookings', { when: d.key })
    case 'stalled': return t('reports:drill.stalled')
    case 'cohort': return t('reports:drill.cohort')
    case 'booked': return t('reports:drill.booked')
    case 'propertyStatus': return t('reports:drill.propertyStatus', { status: t(`catalogue:propertyStatus.${d.status}`) })
    case 'propertyType': return t('reports:drill.propertyType', { type: t(`catalogue:propertyType.${d.type}`) })
  }
}
