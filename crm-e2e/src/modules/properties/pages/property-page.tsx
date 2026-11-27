/**
 * Property page (master prompt §13, plan §8.3 M3): gallery, title / price / status, key facts as icon tiles, price check,
 * legal and approvals, matched leads (property → leads with %, label, reasons and the four actions), close-on-budget,
 * leads already linked, related appointments, history from Activities, listing health with the "find missing data"
 * checklist, and AI listing copy. Status changes to Booked / Sold drop the property out of every match list at once.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, ExternalLink, History, MapPin, MessageCircle, Pencil, Phone, Target, Trash2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { paths } from '@/app/paths'
import { ActivityTimeline } from '@/components/domain/activity-timeline'
import { AppointmentCard } from '@/components/domain/appointment-card'
import { LeadSelect } from '@/components/domain/lead-select'
import { MatchList, useMatchActions } from '@/components/domain/match-list'
import { SpecChip } from '@/components/domain/property-pills'
import { EmptyMatches, EmptyProperties } from '@/components/illustrations'
import { ToneBadge } from '@/components/shared/badges'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { SectionCard } from '@/components/shared/section-card'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { inr, inrShort, num } from '@/lib/format'
import { closeOnBudget, configLabel, leadsForProperty } from '@/lib/matching'
import { phoneDisplay, telLink } from '@/lib/phone'
import { attentionFor, isMatchable, linkedLeads, pricePerSqft, primaryAreaSqft } from '@/lib/property'
import { mapsLink, propertyAddress, waLink } from '@/lib/whatsapp'
import { deleteProperty } from '@/services/properties'
import { visible } from '@/services/queries/visibility'
import { Gallery } from '../components/gallery'
import { KeyFacts } from '../components/key-facts'
import { LegalCard } from '../components/legal-card'
import { ListingCopyCard, ListingHealthCard } from '../components/listing-health-card'
import { PriceCheckCard } from '../components/price-check-card'
import { StatusControl } from '../components/status-control'

export default function PropertyPage() {
  const { t } = useTranslation(['properties', 'catalogue', 'matching', 'common'])
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const { can, explain } = usePermission()
  const { actions, share, dialogs } = useMatchActions()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sharePick, setSharePick] = useState(false)
  const [shareLead, setShareLead] = useState<ID | undefined>()
  const p = db.properties.find((x) => x.id === id)

  const data = useMemo(() => {
    if (!p) return null
    const myLeads = visible.leads(db, user)
    const myLeadIds = new Set(myLeads.map((l) => l.id))
    return {
      matches: leadsForProperty(p, myLeads, db.settings, now),
      close: closeOnBudget(p, myLeads, db.settings, now),
      linked: linkedLeads(p.id, db, now).filter((l) => myLeadIds.has(l.lead.id)),
      appointments: visible.appointments(db, user).filter((a) => a.propertyIds.includes(p.id)).sort((a, b) => b.start.localeCompare(a.start)),
      attention: attentionFor(p, db, now),
      creator: db.users.find((u) => u.id === p.createdBy),
    }
  }, [p, db, user, now])

  if (!p || !data) {
    return (
      <EmptyState
        illustration={EmptyProperties} title={t('properties:detail.notFound')} body={t('properties:detail.notFoundBody', { id })}
        primary={<Button asChild><Link to={paths.properties()}>{t('properties:detail.backToList')}</Link></Button>}
      />
    )
  }
  const editable = can('property.edit', p)
  const area = primaryAreaSqft(p)
  const ppsf = pricePerSqft(p)
  const matchable = isMatchable(p)
  const nowIso = now.toISOString()
  const upcoming = data.appointments.filter((a) => a.start >= nowIso && a.status !== 'cancelled')
  const past = data.appointments.filter((a) => !upcoming.includes(a))

  const remove = () => {
    try {
      const { undoToken } = deleteProperty(p.id)
      toastUndo(t('properties:detail.deleted', { title: p.title }), undoToken)
      navigate(paths.properties())
    } catch (e) { toastError(e) }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5" data-testid="property-page">
      <Link to={paths.properties()} className="inline-flex w-fit items-center gap-1 text-meta font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{t('properties:detail.backToList')}</Link>
      <Gallery p={p} editable={editable} />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-meta text-muted-foreground">{p.id} · {[p.location.locality, p.location.city].filter(Boolean).join(' · ')}</p>
          <h1 className="mt-1 text-2xl font-[650] tracking-[-0.02em] [:lang(ta)_&]:tracking-normal">{p.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SpecChip>{t(`catalogue:propertyType.${p.type}`)}</SpecChip>
            {p.configuration && <SpecChip>{configLabel(p.configuration)}</SpecChip>}
            {area > 0 && <SpecChip>{t('properties:fact.sqft', { area: num(area) })}</SpecChip>}
            <SpecChip>{t(`catalogue:purpose.${p.purpose}`)}</SpecChip>
            {p.listing !== 'live' && <ToneBadge tone="neutral">{t(`catalogue:listing.${p.listing}`)}</ToneBadge>}
            {p.projectName && <SpecChip>{p.projectName}{p.builderName ? ` · ${p.builderName}` : ''}</SpecChip>}
          </div>
          {p.description && <p className="mt-3 max-w-3xl text-sm text-foreground/85">{p.description}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <div className="lg:text-right">
            <p className="text-kpi font-[650] tabular-nums" title={inr(p.price)}>{p.price ? inrShort(p.price) : t('domain:property.onRequest')}{p.purpose !== 'sale' && <span className="text-sm font-normal text-muted-foreground"> {t('properties:detail.perMonth')}</span>}</p>
            <p className="text-meta text-muted-foreground tabular-nums">{ppsf ? t('properties:form.ppsf', { price: num(ppsf) }) : ''}{p.priceNegotiable ? ` · ${t('properties:form.negotiable')}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatusControl p={p} editable={editable} />
            {editable ? (
              <Button asChild variant="secondary" size="sm"><Link to={paths.editProperty(p.id)} data-testid="property-edit"><Pencil />{t('properties:actions.edit')}</Link></Button>
            ) : can('property.edit') && (
              // the role may edit listings, just not this one (an executive edits only what they created): say why
              <span title={t(explain('property.edit').reasonKey, explain('property.edit').params)} data-testid="property-edit-locked">
                <Button variant="secondary" size="sm" disabled><Pencil />{t('properties:actions.edit')}</Button>
              </span>
            )}
            <Button asChild variant="secondary" size="sm"><a href={mapsLink(propertyAddress(p))} target="_blank" rel="noreferrer"><MapPin />{t('properties:actions.map')}<ExternalLink className="opacity-60" /></a></Button>
            {matchable && can('matching.run') && <Button variant="secondary" size="sm" className="text-success" onClick={() => setSharePick(true)}><MessageCircle />{t('properties:actions.share')}</Button>}
            {can('matching.run') && <Button asChild size="sm"><Link to={paths.matching({ property: p.id })}><Target />{t('properties:actions.findBuyers')}</Link></Button>}
            {can('property.delete') && <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={t('properties:actions.delete')} title={t('properties:actions.delete')} onClick={() => setConfirmDelete(true)}><Trash2 /></Button>}
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title={t('properties:detail.facts')}><KeyFacts p={p} /></SectionCard>
          <PriceCheckCard p={p} />
          <LegalCard p={p} />
          <SectionCard title={t('properties:detail.history')} icon={History}>
            <ActivityTimeline refTo={{ kind: 'property', id: p.id }} limit={30} />
          </SectionCard>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <SectionCard
            title={t('properties:detail.matched', { count: data.matches.length })} icon={Target} data-testid="matched-leads"
            action={data.matches.length > 0 ? <Button asChild variant="ghost" size="sm"><Link to={paths.matching({ property: p.id })}>{t('common:actions.viewAll')}</Link></Button> : undefined}
          >
            {!matchable ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t('properties:detail.notMatchable', { status: t(`catalogue:propertyStatus.${p.status}`), listing: t(`catalogue:listing.${p.listing}`) })}</p>
            ) : (
              <MatchList
                matches={data.matches} side="lead" limit={5} actions={actions}
                empty={<EmptyState compact illustration={EmptyMatches} title={t('properties:detail.noMatchesTitle')} body={t('properties:detail.noMatchesBody')} />}
              />
            )}
            {matchable && data.close.length > 0 && (
              <div className="mt-3 rounded-md border border-dashed border-warning/50 bg-warning-soft/40 p-3">
                <p className="text-sm font-medium">{t('matching:close.title', { count: data.close.length })}</p>
                <p className="text-meta text-muted-foreground">{t('matching:close.body')}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {data.close.slice(0, 3).map((m) => (
                    <li key={m.lead.id} className="flex items-center gap-2 text-sm">
                      <Link to={paths.lead(m.lead.id)} className="min-w-0 flex-1 truncate font-medium hover:underline">{m.lead.name}</Link>
                      <span className="text-meta text-muted-foreground tabular-nums">{t('matching:close.upTo', { max: inrShort(m.ceiling) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          {data.linked.length > 0 && (
            <SectionCard title={t('properties:detail.linked', { count: data.linked.length })} icon={Users}>
              <ul className="flex flex-col gap-2">
                {data.linked.map((l) => (
                  <li key={l.lead.id} className="flex items-center gap-2.5">
                    <UserAvatar name={l.lead.name} size="sm" />
                    <Link to={paths.lead(l.lead.id)} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{l.lead.name}</Link>
                    <span className="flex flex-wrap justify-end gap-1">
                      {l.deal && <ToneBadge tone="info">{t('properties:detail.linkDeal')}</ToneBadge>}
                      {l.shortlisted && <ToneBadge tone="highlight">{t('properties:detail.linkShortlist')}</ToneBadge>}
                      {l.visits > 0 && <ToneBadge tone="primary">{t('properties:detail.linkVisits', { count: l.visits })}</ToneBadge>}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title={t('properties:detail.appointments', { count: data.appointments.length })} icon={CalendarDays}>
            {data.appointments.length ? (
              <div className="flex flex-col gap-2">
                {[...upcoming.reverse(), ...past].slice(0, 5).map((a) => <AppointmentCard key={a.id} appointment={a} showDate />)}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t('properties:detail.noAppointments')}</p>}
          </SectionCard>

          <ListingHealthCard p={p} attention={data.attention} editable={editable} />
          <ListingCopyCard p={p} editable={editable} />

          {(p.owner || data.creator) && (
            <SectionCard title={t('properties:detail.owner')}>
              {p.owner && (
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={p.owner.name || p.owner.phone} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.owner.name || phoneDisplay(p.owner.phone)}</p>
                    <p className="text-meta text-muted-foreground">{t(`properties:ownerKind.${p.owner.kind}`)}{p.commissionPct ? ` · ${t('properties:detail.commission', { pct: p.commissionPct })}` : ''}</p>
                  </div>
                  {p.owner.phone && <Button asChild variant="ghost" size="icon-sm"><a href={telLink(p.owner.phone)} aria-label={t('properties:detail.callOwner')}><Phone /></a></Button>}
                  {waLink(p.owner.phone) && <Button asChild variant="ghost" size="icon-sm" className="text-success"><a href={waLink(p.owner.phone)} target="_blank" rel="noreferrer" aria-label={t('properties:detail.whatsappOwner')}><MessageCircle /></a></Button>}
                </div>
              )}
              {data.creator && <p className="mt-2 text-meta text-muted-foreground">{t('properties:detail.addedBy', { name: data.creator.name })}</p>}
            </SectionCard>
          )}
        </aside>
      </div>

      {dialogs}
      <Dialog open={sharePick} onOpenChange={setSharePick}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('properties:detail.shareTitle')}</DialogTitle>
            <DialogDescription>{t('properties:detail.shareBody', { title: p.title })}</DialogDescription>
          </DialogHeader>
          <LeadSelect value={shareLead} onChange={setShareLead} />
          {data.matches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="w-full text-meta text-muted-foreground">{t('properties:detail.shareSuggested')}</span>
              {data.matches.slice(0, 4).map((m) => <Button key={m.lead.id} type="button" size="sm" variant={shareLead === m.lead.id ? 'default' : 'secondary'} onClick={() => setShareLead(m.lead.id)}>{m.lead.name} · {Math.round(m.score)}%</Button>)}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSharePick(false)}>{t('common:actions.cancel')}</Button>
            <Button disabled={!shareLead} onClick={() => { if (shareLead) { setSharePick(false); share(shareLead, [p.id]) } }}>{t('properties:detail.shareNext')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete} onOpenChange={setConfirmDelete} tone="danger"
        title={t('properties:detail.deleteTitle', { title: p.title })} description={t('properties:detail.deleteBody', { count: data.linked.length })}
        confirmLabel={t('properties:actions.delete')} onConfirm={remove}
      />
    </div>
  )
}
