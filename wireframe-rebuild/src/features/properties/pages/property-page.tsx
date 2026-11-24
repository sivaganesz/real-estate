import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Archive, Lock, MapPin, MoreHorizontal, Pencil, RotateCcw, Share2, Sparkles, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Callout } from '@/components/app/callout'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState } from '@/components/app/empty-state'
import { Page, PageHeader } from '@/components/app/page-header'
import { useCrumbs } from '@/components/layout/crumbs'
import { Segmented } from '@/components/app/segmented'
import { StatusChip } from '@/components/app/status-chip'
import { LISTED_STATUSES } from '@/data/catalogue'
import { fmtDate, inr, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { leadsForProperty } from '@/lib/matching'
import { isListed, pendingApprovals } from '@/lib/property'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import type { Property, PropertyStatus } from '@/data/types'
import { ApprovalChips, PropertyStatusChip } from '../components/property-bits'
import { SharePanel } from '../components/share-panel'
import { HistoryTab } from '../tabs/history-tab'
import { LegalTab } from '../tabs/legal-tab'
import { MatchingTab } from '../tabs/matching-tab'
import { OverviewTab } from '../tabs/overview-tab'
import { PriceTab } from '../tabs/price-tab'

const TABS = ['overview', 'legal', 'price', 'matching', 'history'] as const
type Tab = (typeof TABS)[number]

export function PropertyPage() {
  const { id, tab } = useParams()
  const { t } = useTranslation()
  const { db } = useStore()
  const can = useCan()
  const p = db.properties.find((x) => x.id === id)
  // executives never see drafts or archived properties
  if (!p || (!isListed(p) && !can('property.seeDrafts'))) {
    return (
      <Page>
        <EmptyState icon={MapPin} title={t('property.notFound')} action={<Button asChild variant="outline"><Link to="/properties">{t('property.back')}</Link></Button>} />
      </Page>
    )
  }
  const current: Tab = (TABS as readonly string[]).includes(tab ?? '') ? (tab as Tab) : 'overview'
  return <PropertyView key={p.id} p={p} tab={current} />
}

/** The property page, laid out as in spec-system-wireframe: a header with the photo thumbnail, then five tabs. */
function PropertyView({ p, tab }: { p: Property; tab: Tab }) {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const navigate = useNavigate()
  const { db, user, today, updateProperty, deleteProperty } = useStore()
  const can = useCan()
  const leads = useVisibleLeads()
  const manager = can('property.manage')
  const [share, setShare] = useState<{ open: boolean; leadId?: string }>({ open: false })
  const [archiving, setArchiving] = useState(false)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const matches = useMemo(() => leadsForProperty(p, leads, db.settings), [p, leads, db.settings])
  const ppsf = p.areaSqft ? Math.round(p.price / p.areaSqft) : 0
  const pending = pendingApprovals(p).length
  const openShare = (leadId?: string) => setShare({ open: true, leadId })
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.properties'), to: '/properties' }, { label: p.id }])
  const live = p.status === 'available' && !p.archived
  const statusMenu = manager && !p.archived && p.status !== 'draft'

  const changeStatus = (s: PropertyStatus) => {
    if (s === p.status) return
    updateProperty(p.id, (x) => { x.status = s; if (s !== 'draft') x.listedAt ??= today }, t('history.status', { status: t(`status.${s}`) }))
    toast.success(t('property.statusChanged', { status: t(`status.${s}`) }))
  }
  const archive = () => {
    updateProperty(p.id, (x) => { x.archived = { by: user.id, at: today, reason: reason.trim() || undefined } }, t('history.archived', { reason: reason.trim() || '—' }))
    toast.success(t('props.archivedToast'))
    setReason('')
  }
  const restore = () => {
    updateProperty(p.id, (x) => { delete x.archived }, t('history.restored'))
    toast.success(t('props.restoredToast'))
  }
  const remove = () => {
    deleteProperty(p.id)
    toast.success(t('props.deletedToast', { id: p.id }))
    navigate('/properties?view=archived')
  }

  const actions = p.archived ? (
    manager && (
      <>
        <Button variant="outline" onClick={restore}><RotateCcw /> {t('props.restore')}</Button>
        <Button variant="destructive" onClick={() => setDeleting(true)}><Trash2 /> {t('props.delete')}</Button>
      </>
    )
  ) : manager ? (
    <>
      {p.status !== 'draft' && (
        <Select value={p.status} onValueChange={(v) => changeStatus(v as PropertyStatus)}>
          <SelectTrigger className="w-44 bg-card" aria-label={t('property.changeStatus')}><SelectValue /></SelectTrigger>
          <SelectContent>{LISTED_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <Button onClick={() => navigate(`/properties/${p.id}/edit`)}><Sparkles /> {t('action.editWithAi')}</Button>
      {live && <Button variant="outline" onClick={() => openShare()}><Share2 /> {t('action.share')}</Button>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={t('props.more')}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setArchiving(true)}><Archive /> {t('props.archive')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  ) : (
    <>
      <PropertyStatusChip property={p} />
      {live && <Button variant="outline" onClick={() => openShare()}><Share2 /> {t('action.share')}</Button>}
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={t('props.readOnlyHint')}><Lock className="size-3.5" /> {t('props.readOnly')}</span>
    </>
  )

  return (
    <Page>

      <PageHeader
        className="mb-4"
        title={
          <span className="block min-w-0">
              <span className="inline-flex flex-wrap items-center gap-2">
                {p.title}
                {manager && !p.archived && (
                  <Link to={`/properties/${p.id}/edit`} aria-label={t('props.changeTitle')} title={t('props.changeTitle')}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-4" /></Link>
                )}
              </span>
              {/* one line of facts: ID · type · purpose · place · area · facing · listed */}
              <span className="mt-1 block text-sm font-normal tracking-normal text-muted-foreground">
                <span className="font-mono text-foreground/80">{p.id}</span> · {L.type(p.type)} · {L.purpose(p.purpose)} ·{' '}
                <span className="whitespace-nowrap"><MapPin className="mr-0.5 inline size-3.5 align-[-2px]" />{p.location.locality}, {p.location.city}</span> · {num(p.areaSqft)} sq.ft.
                {p.facing ? ` · ${t('search.facing', { dir: L.facing(p.facing) })}` : ''}
                {p.listedAt ? ` · ${t('props.listedOn', { date: fmtDate(p.listedAt, i18n.language) })}` : ''}
              </span>
              {/* the status shows here only where there's no status menu beside the price */}
              {(!statusMenu || p.approvals.length > 0) && (
                <span className="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-normal tracking-normal">
                  {!statusMenu && <PropertyStatusChip property={p} />}
                  <ApprovalChips property={p} />
                </span>
              )}
            </span>
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="sm:text-right">
              <p className="text-2xl font-semibold tracking-tight">{inr(p.price)}</p>
              {ppsf > 0 && <p className="text-sm text-muted-foreground">{t('props.ppsfBasis', { rate: inr(ppsf), basis: t(`props.basis.${areaBasis(p)}`) })}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
          </div>
        }
      />

      {p.archived && (
        <Callout tone="neutral" className="mb-4" title={t('props.archivedTitle', { date: fmtDate(p.archived.at, i18n.language), by: userName(db, p.archived.by) })}>
          {p.archived.reason ? `“${p.archived.reason}” · ` : ''}{t('props.archivedBody')}
        </Callout>
      )}
      {p.status === 'draft' && !p.archived && <Callout tone="info" className="mb-4">{t('property.draftNote')}</Callout>}

      <div className="mb-5 border-b">
        <Segmented label={t('property.sections')} value={tab} onChange={(v) => navigate(`/properties/${p.id}${v === 'overview' ? '' : '/' + v}`)}
          segments={[
            { value: 'overview', label: t('props.tab.overview') },
            {
              value: 'legal', label: t('props.tab.legal'),
              badge: pending ? <StatusChip tone="warning" className="h-5">{t('props.pendingBadge', { count: pending })}</StatusChip> : undefined,
              count: pending ? undefined : p.approvals.length + p.documents.length,
            },
            { value: 'price', label: t('props.tab.price') },
            { value: 'matching', label: t('props.tab.matching'), count: live ? matches.length : 0 },
            { value: 'history', label: t('props.tab.history') },
          ]} />
      </div>

      {tab === 'overview' && <OverviewTab p={p} matches={matches} />}
      {tab === 'legal' && <LegalTab p={p} />}
      {tab === 'price' && <PriceTab p={p} />}
      {tab === 'matching' && <MatchingTab p={p} />}
      {tab === 'history' && <HistoryTab p={p} />}

      {share.open && <SharePanel property={p} open={share.open} leadId={share.leadId} onOpenChange={(o) => setShare({ open: o })} />}

      <ConfirmDialog open={archiving} onOpenChange={setArchiving} title={t('props.archiveTitle', { title: p.title })} confirmLabel={t('props.archive')} onConfirm={archive}>
        <p className="mb-3">{t('props.archiveBody')}</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('props.archiveReason')} aria-label={t('props.archiveReason')} />
      </ConfirmDialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} danger title={t('props.deleteTitle', { id: p.id })} confirmLabel={t('props.deleteConfirm')} onConfirm={remove}>
        {t('props.deleteBody')}
      </ConfirmDialog>
    </Page>
  )
}

const areaBasis = (p: Property) => ({ plot: 'plotArea', flat: 'builtUpArea', house: 'builtUpArea', commercial: 'usableArea', agri: 'landArea', industrial: 'plotArea' } as const)[p.type]

/** Placeholder for Add property / Edit with AI — the next step of the Properties rebuild. */
export function PropertyEditPlaceholder() {
  const { t } = useTranslation()
  const { id } = useParams()
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.properties'), to: '/properties' }, ...(id ? [{ label: id, to: `/properties/${id}` }] : []), { label: id ? t('action.editWithAi') : t('props.add') }])
  return (
    <Page>
      <PageHeader back={{ to: id ? `/properties/${id}` : '/properties', label: id ? t('assistant.backToProperty') : t('property.back') }} title={id ? t('action.editWithAi') : t('props.add')} />
      <EmptyState icon={Sparkles} title={t('props.nextStepTitle')}>{t('props.nextStepBody')}</EmptyState>
    </Page>
  )
}
