/**
 * Actions on the property list without opening each property:
 * the ⋯ menu on every table row, the bar that appears when rows are ticked, the archive dialog and the CSV export.
 * The changes go through the same store calls as the property page, so each one lands in that property's History.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Archive, ArrowUpRight, Download, MoreHorizontal, RotateCcw, Share2, Sparkles, Tag, Trash2, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Callout } from '@/components/app/callout'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { LISTED_STATUSES } from '@/data/catalogue'
import type { Property, PropertyStatus } from '@/data/types'
import { useLabels } from '@/lib/labels'
import { fmtDate, inrShort } from '@/lib/format'
import { type LeadLink, linkedLeads, listingScore } from '@/lib/property'
import { useCan, useStore } from '@/store/db'

/** Status change, archive and restore for one or many properties, each with its toast. */
export function usePropertyActions() {
  const { t } = useTranslation()
  const { db, updateProperty, noteOnLeads, user, today } = useStore()
  const setStatus = (list: Property[], s: PropertyStatus) => {
    const changing = list.filter((p) => p.status !== s && !p.archived)
    changing.forEach((p) => updateProperty(p.id, (x) => { x.status = s; x.listedAt ??= today }, t('history.status', { status: t(`status.${s}`) })))
    toast.success(list.length === 1 ? t('property.statusChanged', { status: t(`status.${s}`) }) : t('bulk.statusToast', { count: changing.length, status: t(`status.${s}`) }))
  }
  const archive = (list: Property[], reason: string) => {
    const why = reason.trim()
    list.forEach((p) => {
      updateProperty(p.id, (x) => { x.archived = { by: user.id, at: today, reason: why || undefined } }, t('history.archived', { reason: why || '—' }))
      // the leads that refer to it keep the link, with a note on their timeline
      noteOnLeads(linkedLeads(p.id, db.leads, today).map((l) => l.lead.id), p.id, t('archive.leadNote', { id: p.id, title: p.title }))
    })
    toast.success(list.length === 1 ? t('props.archivedToast') : t('bulk.archivedToast', { count: list.length }))
  }
  const restore = (list: Property[]) => {
    list.forEach((p) => updateProperty(p.id, (x) => { delete x.archived }, t('history.restored')))
    toast.success(list.length === 1 ? t('props.restoredToast') : t('bulk.restoredToast', { count: list.length }))
  }
  return { setStatus, archive, restore }
}

/** The leads that refer to a property, each with how: "recommended · 1 site visit · negotiation". */
function LinkedLeadList({ links, showProperty }: { links: { link: LeadLink; property: Property }[]; showProperty?: boolean }) {
  const { t } = useTranslation()
  const why = (l: LeadLink) => [
    l.recommended && t('archive.why.recommended'), l.visits > 0 && t('archive.why.visits', { count: l.visits }),
    l.negotiation && t('archive.why.negotiation'), l.shared && t('archive.why.shared'),
  ].filter(Boolean).join(', ')
  return (
    <ul className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border bg-muted/40 p-2.5 text-sm">
      {links.map(({ link, property }) => (
        <li key={property.id + link.lead.id}>
          <Link to={`/leads/${link.lead.id}`} className="font-medium text-foreground hover:underline">{link.lead.name}</Link>{' '}
          <small className="font-mono text-muted-foreground">{link.lead.id}</small>
          <span className="text-muted-foreground"> — {why(link)}{showProperty && ` · ${property.id}`}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Ask before archiving one or many properties (spec-system-wireframe's archive dialog): what archiving does, the leads that
 * refer to them (they keep the link and get a note on their timeline), site visits still booked (archiving doesn't cancel
 * them), and an optional reason, kept in each property's History.
 */
export function ArchiveDialog({ list, onOpenChange, onConfirm }: { list: Property[]; onOpenChange: (open: boolean) => void; onConfirm: (reason: string) => void }) {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const { db, today } = useStore()
  const [reason, setReason] = useState('')
  const one = list.length === 1 ? list[0] : undefined
  const links = list.flatMap((property) => linkedLeads(property.id, db.leads, today).map((link) => ({ link, property })))
  const booked = links.flatMap(({ link, property }) => link.upcoming.map((v) => ({ v, lead: link.lead, property })))
  return (
    <ConfirmDialog open={list.length > 0} onOpenChange={(o) => { if (!o) setReason(''); onOpenChange(o) }} className="sm:max-w-lg"
      title={one ? t('props.archiveTitle', { title: one.title }) : t('bulk.archiveTitle', { count: list.length })}
      confirmLabel={t('props.archive')} onConfirm={() => { onConfirm(reason); setReason('') }}>
      {one && (
        <p className="mb-3 text-sm text-muted-foreground">
          <span className="font-mono">{one.id}</span> · {L.type(one.type)} · {one.location.locality}, {one.location.city} · {inrShort(one.price)} · {t(`status.${one.status}`)}
        </p>
      )}
      <div className="rounded-lg bg-muted/60 p-3 text-sm text-foreground">
        <b>{t('archive.will')}</b>
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          <li>{t('archive.will1')}</li>
          <li>{t('archive.will2')}</li>
          <li>{t('archive.will3')}</li>
        </ul>
      </div>
      {links.length > 0 && (
        <div className="mt-3 text-sm text-foreground">
          <b>{t('archive.linked', { count: new Set(links.map((x) => x.link.lead.id)).size })}</b> <span className="text-muted-foreground">{t('archive.linkedKeep')}</span>
          <LinkedLeadList links={links} showProperty={!one} />
        </div>
      )}
      {booked.length > 0 && (
        <Callout tone="warning" className="mt-3">
          {t('archive.booked', { count: booked.length })}{' '}
          {booked.map((b) => `${b.lead.name}, ${fmtDate(b.v.date, i18n.language)}${b.v.time ? ` ${b.v.time}` : ''}${one ? '' : ` (${b.property.id})`}`).join('; ')}.{' '}
          {t('archive.bookedHint')}
        </Callout>
      )}
      <Textarea className="mt-3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('props.archiveReason')} aria-label={t('props.archiveReason')} />
    </ConfirmDialog>
  )
}

/**
 * Delete a property for good — to correct a mistake, such as a wrong import or a property added twice.
 * With no lead linked, a warning of what will be removed is enough. With leads linked, they are listed with what happens to them
 * (it leaves their recommendations, booked site visits for it are cancelled, a negotiation on it is cleared, a note goes on their
 * timeline) and a box must be ticked before Delete works.
 */
export function DeleteDialog({ property: p, open, onOpenChange, onDeleted }: {
  property: Property; open: boolean; onOpenChange: (open: boolean) => void
  /** After deleting: e.g. leave the property's page. */
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const { db, today, deleteProperty } = useStore()
  const [sure, setSure] = useState(false)
  const links = linkedLeads(p.id, db.leads, today).map((link) => ({ link, property: p }))
  const booked = links.reduce((n, x) => n + x.link.upcoming.length, 0)
  const photos = p.media.filter((m) => m.kind === 'photo').length
  const docs = p.approvals.filter((a) => a.file).length + p.documents.length
  const close = (o: boolean) => { if (!o) setSure(false); onOpenChange(o) }
  const remove = () => {
    deleteProperty(p.id, t('del.leadNote', { id: p.id, title: p.title }))
    toast.success(t('props.deletedToast', { id: p.id }), { description: links.length ? t('del.leadsUpdated', { count: links.length }) : undefined })
    close(false)
    onDeleted?.()
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('props.deleteTitle', { id: p.id })}</DialogTitle>
          <DialogDescription>{p.title}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <Callout tone="danger">{t('del.removes', {
            approvals: t('del.n.approvals', { count: p.approvals.length }), docs: t('del.n.docs', { count: docs }),
            comparables: t('del.n.comparables', { count: p.comparables.length }), photos: t('del.n.photos', { count: photos }),
          })}</Callout>
          {links.length > 0 && (
            <>
              <div>
                <b>{t('del.linked', { count: links.length })}</b>
                <LinkedLeadList links={links} />
              </div>
              <Callout tone="warning">{t('del.whatHappens')}{booked > 0 && ` ${t('del.bookedCancelled', { count: booked })}`}</Callout>
              <label className="flex items-start gap-2 font-medium">
                <Checkbox checked={sure} onCheckedChange={(v) => setSure(!!v)} className="mt-0.5" />
                {t('del.confirmLinked', { id: p.id, count: links.length })}
              </label>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>{t('action.cancel')}</Button>
          <Button variant="destructive" disabled={links.length > 0 && !sure} onClick={remove}>{t('props.deleteConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The ⋯ menu at the end of a table row. Managers get every action; sales executives open, share and see matching customers. */
export function PropertyRowMenu({ property: p, onShare, onArchive, onDelete }: { property: Property; onShare: () => void; onArchive: () => void; onDelete: () => void }) {
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
                : <DropdownMenuItem onClick={onArchive}><Archive /> {t('props.archive')}</DropdownMenuItem>}
              <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 /> {t('props.delete')}</DropdownMenuItem>
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
