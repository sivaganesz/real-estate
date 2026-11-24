/**
 * Actions on the property list without opening each property:
 * the ⋯ menu on every table row, the bar that appears when rows are ticked, the archive dialog and the CSV export.
 * The changes go through the same store calls as the property page, so each one lands in that property's History.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Archive, ArrowUpRight, Download, MoreHorizontal, RotateCcw, Share2, Sparkles, Tag, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { LISTED_STATUSES } from '@/data/catalogue'
import type { Property, PropertyStatus } from '@/data/types'
import { useLabels } from '@/lib/labels'
import { listingScore } from '@/lib/property'
import { useCan, useStore } from '@/store/db'

/** Status change, archive and restore for one or many properties, each with its toast. */
export function usePropertyActions() {
  const { t } = useTranslation()
  const { updateProperty, user, today } = useStore()
  const setStatus = (list: Property[], s: PropertyStatus) => {
    const changing = list.filter((p) => p.status !== s && !p.archived)
    changing.forEach((p) => updateProperty(p.id, (x) => { x.status = s; x.listedAt ??= today }, t('history.status', { status: t(`status.${s}`) })))
    toast.success(list.length === 1 ? t('property.statusChanged', { status: t(`status.${s}`) }) : t('bulk.statusToast', { count: changing.length, status: t(`status.${s}`) }))
  }
  const archive = (list: Property[], reason: string) => {
    const why = reason.trim()
    list.forEach((p) => updateProperty(p.id, (x) => { x.archived = { by: user.id, at: today, reason: why || undefined } }, t('history.archived', { reason: why || '—' })))
    toast.success(list.length === 1 ? t('props.archivedToast') : t('bulk.archivedToast', { count: list.length }))
  }
  const restore = (list: Property[]) => {
    list.forEach((p) => updateProperty(p.id, (x) => { delete x.archived }, t('history.restored')))
    toast.success(list.length === 1 ? t('props.restoredToast') : t('bulk.restoredToast', { count: list.length }))
  }
  return { setStatus, archive, restore }
}

/** Ask before archiving one or many properties, with an optional reason (kept in each property's History). */
export function ArchiveDialog({ list, onOpenChange, onConfirm }: { list: Property[]; onOpenChange: (open: boolean) => void; onConfirm: (reason: string) => void }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  return (
    <ConfirmDialog open={list.length > 0} onOpenChange={(o) => { if (!o) setReason(''); onOpenChange(o) }}
      title={list.length === 1 ? t('props.archiveTitle', { title: list[0].title }) : t('bulk.archiveTitle', { count: list.length })}
      confirmLabel={t('props.archive')} onConfirm={() => { onConfirm(reason); setReason('') }}>
      <p className="mb-3">{t('props.archiveBody')}</p>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('props.archiveReason')} aria-label={t('props.archiveReason')} />
    </ConfirmDialog>
  )
}

/** The ⋯ menu at the end of a table row. Managers get every action; sales executives open, share and see matching customers. */
export function PropertyRowMenu({ property: p, onShare, onArchive }: { property: Property; onShare: () => void; onArchive: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const can = useCan()
  const act = usePropertyActions()
  const manager = can('property.manage')
  const live = p.status === 'available' && !p.archived
  return (
    // the cell swallows clicks and Enter, so using the menu never opens the row
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('bulk.rowMenu', { title: p.title })} title={t('props.more')}
            className="text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => navigate(`/properties/${p.id}`)}><ArrowUpRight /> {t('bulk.open')}</DropdownMenuItem>
          {manager && !p.archived && <DropdownMenuItem onClick={() => navigate(`/properties/${p.id}/edit`)}><Sparkles /> {t('action.editWithAi')}</DropdownMenuItem>}
          {live && <DropdownMenuItem onClick={onShare}><Share2 /> {t('action.share')}</DropdownMenuItem>}
          {!p.archived && <DropdownMenuItem onClick={() => navigate(`/properties/${p.id}/matching`)}><Users /> {t('props.tab.matching')}</DropdownMenuItem>}
          {manager && !p.archived && p.status !== 'draft' && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Tag /> {t('property.changeStatus')}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {LISTED_STATUSES.map((s) => (
                  <DropdownMenuItem key={s} disabled={s === p.status} onClick={() => act.setStatus([p], s)}>{t(`status.${s}`)}</DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {manager && (
            <>
              <DropdownMenuSeparator />
              {p.archived
                ? <DropdownMenuItem onClick={() => act.restore([p])}><RotateCcw /> {t('props.restore')}</DropdownMenuItem>
                : <DropdownMenuItem variant="destructive" onClick={onArchive}><Archive /> {t('props.archive')}</DropdownMenuItem>}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

/**
 * The bar that appears while rows are ticked: how many, "select all N" when only this page is ticked,
 * and Change status · Export CSV · Archive (Restore in the Archived tab).
 */
export function BulkBar({ list, total, allOnPageOnly, archivedView, onSelectAll, onClear, onArchive }: {
  list: Property[]
  /** How many properties the current filters show, for "Select all N". */
  total: number
  allOnPageOnly: boolean
  archivedView: boolean
  onSelectAll: () => void
  onClear: () => void
  onArchive: () => void
}) {
  const { t } = useTranslation()
  const L = useLabels()
  const act = usePropertyActions()
  return (
    <div role="region" aria-label={t('bulk.selected', { count: list.length })}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-foreground py-2 pr-2 pl-4 text-ui text-background shadow-lg">
      <b aria-live="polite">{t('bulk.selected', { count: list.length })}</b>
      {allOnPageOnly && total > list.length && (
        <button type="button" onClick={onSelectAll} className="font-medium underline-offset-2 opacity-80 hover:underline hover:opacity-100">{t('bulk.selectAll', { count: total })}</button>
      )}
      <span className="flex-1" />
      {!archivedView && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="text-background hover:bg-background/15 hover:text-background"><Tag /> {t('property.changeStatus')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {LISTED_STATUSES.map((s) => <DropdownMenuItem key={s} onClick={() => { act.setStatus(list, s); onClear() }}>{t(`status.${s}`)}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button size="sm" variant="ghost" className="text-background hover:bg-background/15 hover:text-background" onClick={() => { exportCsv(list, L, t); toast.success(t('bulk.exportedToast', { count: list.length })) }}>
        <Download /> {t('bulk.export')}
      </Button>
      {archivedView ? (
        <Button size="sm" variant="ghost" className="text-background hover:bg-background/15 hover:text-background" onClick={() => { act.restore(list); onClear() }}><RotateCcw /> {t('props.restore')}</Button>
      ) : (
        <Button size="sm" variant="ghost" className="text-background hover:bg-background/15 hover:text-background" onClick={onArchive}><Archive /> {t('props.archive')}</Button>
      )}
      <Button size="icon-sm" variant="ghost" className="text-background hover:bg-background/15 hover:text-background" onClick={onClear} aria-label={t('bulk.clear')} title={t('bulk.clear')}><X /></Button>
    </div>
  )
}

/** Download the properties as a CSV file that opens in Excel (UTF-8 with a BOM, so Tamil text shows correctly). */
function exportCsv(list: Property[], L: ReturnType<typeof useLabels>, t: ReturnType<typeof useTranslation>['t']) {
  const head = ['id', 'title', 'type', 'purpose', 'locality', 'city', 'area', 'price', 'status', 'listed', 'completion'].map((k) => t(`bulk.csv.${k}`))
  const rows = list.map((p) => [p.id, p.title, L.type(p.type), L.purpose(p.purpose), p.location.locality, p.location.city, p.areaSqft, p.price,
    p.archived ? t('props.archived') : L.status(p.status), p.listedAt ?? '', listingScore(p).score])
  const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `properties-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000) // after the browser has started the download
}
