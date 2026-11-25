/**
 * Share — the brochure the customer receives (spec-system-wireframe's views-share.js), built from the property with only
 * what may be advertised, beside the panel that shares it:
 * - nearby places: the Customer view (everyday places only once their route is checked);
 * - approvals: only verified ones become badges — a pending document is never advertised, and nothing says "legally clear";
 * - never shown: the owner's contact, internal notes, the price check, documents, internal fields (survey / layout numbers);
 *   details for this property only, when someone switches them on.
 * Sharing (WhatsApp, link or PDF) is logged on the property and, with a buyer chosen, on their timeline as a recommendation.
 */
import { useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Bus, Camera, Check, ExternalLink, FileDown, GraduationCap, Hospital, Link2, MapPin, MessageCircle, MoreHorizontal, ShoppingBasket, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Callout } from '@/components/app/callout'
import { EmptyState } from '@/components/app/empty-state'
import { Page, PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { useCrumbs } from '@/components/layout/crumbs'
import { typeFacts } from '@/data/catalogue'
import type { Lead, NearbyPlace, PlaceCategory, Property } from '@/data/types'
import { fmtDate, inr, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { matchScore } from '@/lib/matching'
import { isApproxDistance, placesFor, priceCheck } from '@/lib/property'
import { cn } from '@/lib/utils'
import { type ShareChannel, useStore, useVisibleLeads, userName } from '@/store/db'
import { useFactText } from '../assistant/use-fact-text'
import { PropertyPhoto } from '../components/property-bits'

const GROUPS: { key: PlaceCategory['group']; icon: LucideIcon }[] = [
  { key: 'commute', icon: Bus }, { key: 'schools', icon: GraduationCap }, { key: 'health', icon: Hospital }, { key: 'shop', icon: ShoppingBasket }, { key: 'other', icon: MoreHorizontal },
]

/** The address the customer opens. A short code from the property, so it can't be guessed from the ID alone. */
export function shareUrl(p: Property) {
  let h = 0
  for (const c of p.id + p.title) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `https://realspec.in/p/${p.id.replace('PROP-', '')}${h.toString(36).slice(0, 4)}`
}

type Options = { total: boolean; exact: boolean }

export function SharePage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const { t } = useTranslation()
  const { db } = useStore()
  const p = db.properties.find((x) => x.id === id)
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.properties'), to: '/properties' }, ...(p ? [{ label: p.id, to: `/properties/${p.id}` }] : []), { label: t('brochure.crumb') }])
  if (!p) {
    return <Page><EmptyState title={t('property.notFound')} action={<Button asChild variant="outline"><Link to="/properties">{t('property.back')}</Link></Button>} /></Page>
  }
  return <ShareView key={p.id} p={p} leadId={search.get('lead') ?? undefined} />
}

function ShareView({ p, leadId }: { p: Property; leadId?: string }) {
  const { t, i18n } = useTranslation()
  const ft = useFactText()
  const { db, user, role, shareProperty, updateProperty } = useStore()
  const leads = useVisibleLeads()
  const [forLead, setForLead] = useState<string>(leadId && leads.some((l) => l.id === leadId) ? leadId : '')
  const [opt, setOpt] = useState<Options>({ total: true, exact: false })
  const live = p.status === 'available' && !p.archived
  const lead = leads.find((l) => l.id === forLead)

  // best-matching buyers first; those it doesn't fit at all at the end
  const buyers = leads
    .filter((l) => l.stage !== 'lost' && l.stage !== 'closed')
    .map((l) => ({ l, m: matchScore(l, p, db.settings) }))
    .sort((a, b) => Number(a.m.excluded) - Number(b.m.excluded) || b.m.score - a.m.score)

  const places = placesFor(p, db.settings, 'customer')
  const held = p.location.nearby.length - places.length
  const verified = p.approvals.filter((a) => a.status === 'verified')
  const notYet = p.approvals.filter((a) => a.status !== 'verified')
  const photos = p.media.filter((m) => m.kind === 'photo').length
  const internal = typeFacts(p.type, db.settings).filter((f) => f.internal && p.specs[f.key] !== undefined && p.specs[f.key] !== '')

  const share = (channel: ShareChannel) => {
    const how = t(`brochure.how.${channel}`)
    // shared with a lead, the History tab shows it from their timeline; shared with anyone, it gets its own history line
    shareProperty(p.id, lead?.id, channel, lead ? undefined : t('history.brochureShared', { how }))
    const url = shareUrl(p)
    if (channel === 'link') {
      navigator.clipboard?.writeText(url).catch(() => { /* the toast still shows the link */ })
      toast.success(t('brochure.copied', { url }), { description: lead ? t('brochure.loggedOn', { name: lead.name }) : undefined })
    } else if (channel === 'pdf') {
      toast.success(t('brochure.pdfReady'), { description: lead ? t('brochure.loggedOn', { name: lead.name }) : undefined })
      setTimeout(() => window.print(), 60) // the print styles show the brochure only: "Save as PDF"
    } else {
      toast.success(t('share.done.whatsapp', { name: lead?.name }), { description: t('brochure.whatsappDemo') })
    }
  }
  const toggleExtra = (label: string, on: boolean) =>
    updateProperty(p.id, (x) => { x.extraDetails = (x.extraDetails ?? []).map((d) => (d.label === label ? { ...d, public: on } : d)) },
      t(on ? 'history.extraShown' : 'history.extraHidden', { label }))

  const check = (good: boolean, children: ReactNode, key?: string) => (
    <li key={key} className="flex items-start gap-2 text-sm">
      {good ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
      <span>{children}</span>
    </li>
  )
  const linkTo = (to: string, text: string) => <Link to={to} className="font-medium text-primary hover:underline">{text}</Link>
  const label = (text: string) => <p className="mt-4 mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase first:mt-0">{text}</p>

  return (
    <Page wide>
      <PageHeader className="print:hidden" title={t('brochure.title')} description={t('brochure.subtitle')}
        actions={<Button variant="outline" asChild><Link to={`/properties/${p.id}`}><ArrowLeft /> {p.id}</Link></Button>} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <Brochure p={p} lead={lead} opt={opt} places={places} verified={verified.map((a) => a.approvalId)}
          contact={lead?.ownerId ? userName(db, lead.ownerId) : role === 'executive' ? user.name : ''} />

        <aside className="flex flex-col gap-4 print:hidden lg:sticky lg:top-[70px]">
          <SectionCard title={t('brochure.panelTitle')}>
            {!live && <Callout tone="warning" className="mb-3">{t('brochure.notLive', { status: p.archived ? t('ps.archived') : t(`status.${p.status}`) })}</Callout>}

            {label(t('brochure.for'))}
            <Select value={forLead || 'anyone'} onValueChange={(v) => setForLead(v === 'anyone' ? '' : v)} disabled={!live}>
              <SelectTrigger className="w-full" aria-label={t('brochure.for')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anyone">{t('brochure.anyone')}</SelectItem>
                {buyers.map(({ l, m }) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} — {m.excluded ? t('share.notAFit') : t('brochure.fit', { score: m.score })}{l.recommendedPropertyIds.includes(p.id) ? ` · ${t('brochure.recommended')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-meta text-muted-foreground">{lead ? t('brochure.forLeadHint') : t('brochure.anyoneHint')}</p>

            {label(t('brochure.show'))}
            <div className="flex flex-col gap-2">
              {p.purpose === 'sale' && (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={opt.total} onCheckedChange={(v) => setOpt({ ...opt, total: !!v })} className="mt-0.5" />
                  <span>{t('brochure.optTotal')} <span className="text-meta text-muted-foreground">{t('brochure.optTotalHint')}</span></span>
                </label>
              )}
              <label className={cn('flex items-start gap-2 text-sm', !p.location.exact && 'text-muted-foreground')}>
                <Checkbox checked={opt.exact && p.location.exact} disabled={!p.location.exact} onCheckedChange={(v) => setOpt({ ...opt, exact: !!v })} className="mt-0.5" />
                <span>{t('brochure.optExact')} <span className="text-meta text-muted-foreground">{p.location.exact ? t('brochure.optExactHint') : t('brochure.optExactNotSet')}</span></span>
              </label>
            </div>

            {!!p.extraDetails?.length && (
              <>
                {label(t('brochure.extras'))}
                <div className="flex flex-col gap-2">
                  {p.extraDetails.map((x) => (
                    <label key={x.label} className="flex items-start gap-2 text-sm">
                      <Checkbox checked={!!x.public} onCheckedChange={(v) => toggleExtra(x.label, !!v)} className="mt-0.5" disabled={!!p.archived} />
                      <span>{x.label} <span className="text-meta text-muted-foreground">“{x.value}”</span></span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-meta text-muted-foreground">{t('brochure.extrasHint')}</p>
              </>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button className="col-span-2" disabled={!live || !lead} onClick={() => share('whatsapp')} title={!lead ? t('brochure.whatsappNeedsLead') : undefined}>
                <MessageCircle /> {t('share.whatsapp')}
              </Button>
              <Button variant="outline" disabled={!live} onClick={() => share('link')}><Link2 /> {t('share.copyLink')}</Button>
              <Button variant="outline" disabled={!live} onClick={() => share('pdf')}><FileDown /> {t('share.pdf')}</Button>
            </div>
            {!lead && live && <p className="mt-1.5 text-meta text-muted-foreground">{t('brochure.whatsappNeedsLead')}</p>}

            {label(t('brochure.before'))}
            <ul className="flex flex-col gap-1.5">
              {check(photos > 0, photos ? t('brochure.chk.photos', { count: photos }) : <>{t('brochure.chk.noPhotos')} {linkTo(`/properties/${p.id}`, t('brochure.chk.addSome'))}</>)}
              {check(true, <>{t('brochure.chk.places', { count: places.length })}{held > 0 && <> · <b>{t('brochure.chk.held', { count: held })}</b> {linkTo(`/properties/${p.id}`, t('brochure.chk.check'))}</>}</>)}
              {verified.map((a) => check(true, t('brochure.chk.verified', { approval: ft.approval(a.approvalId) }), a.approvalId))}
              {notYet.map((a) => check(false,
                <>{t(a.status === 'pending' ? 'brochure.chk.pending' : 'brochure.chk.unverified', { approval: ft.approval(a.approvalId) })} {linkTo(`/properties/${p.id}/legal`, t('brochure.chk.open'))}</>,
                a.approvalId))}
              {check(p.location.exact, p.location.exact ? t('brochure.chk.exact') : t('brochure.chk.noExact'))}
            </ul>
            <p className="mt-3 text-meta text-muted-foreground">
              {t('brochure.never')}{internal.length > 0 && `, ${internal.map((f) => ft.label(`spec:${f.key}`).replace(/\s*\(.*\)$/, '').toLowerCase()).join(', ')}`}.
            </p>
          </SectionCard>

          {!!p.shares?.length && (
            <SectionCard title={t('brochure.sharedTimes', { count: p.shares.length })}>
              <ul className="flex flex-col gap-1.5 text-sm">
                {p.shares.slice(0, 6).map((s, i) => {
                  const who = s.leadId ? db.leads.find((l) => l.id === s.leadId) : undefined
                  return (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                      <span>{fmtDate(s.at, i18n.language)} · {t(`brochure.how.${s.channel}`)}</span>
                      {who ? <>· <Link to={`/leads/${who.id}`} className="font-medium text-primary hover:underline">{who.name}</Link></> : <>· {t('brochure.anyoneShort')}</>}
                      <span className="text-meta text-muted-foreground">{t('brochure.by', { name: userName(db, s.by) })}</span>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          )}
        </aside>
      </div>
    </Page>
  )
}

/** The brochure itself — also what "Download PDF" prints. */
function Brochure({ p, lead, opt, places, verified, contact }: {
  p: Property; lead?: Lead; opt: Options; places: NearbyPlace[]; verified: string[]; contact: string
}) {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const ft = useFactText()
  const { db, today } = useStore()
  const photos = p.media.filter((m) => m.kind === 'photo')
  const cover = photos.find((m) => m.isCover) ?? photos[0]
  const rest = photos.filter((m) => m !== cover)
  const pc = priceCheck(p, db)
  const c = db.settings.buyerCostsPct
  const exact = opt.exact && p.location.exact
  const facts: [string, string][] = [
    [t(`areaLabel.${p.type}`), `${num(p.areaSqft)} sq.ft.`],
    ...(p.facing ? [[t('fact.facing'), L.facing(p.facing)] as [string, string]] : []),
    ...typeFacts(p.type, db.settings).filter((f) => !f.internal && p.specs[f.key] !== undefined && p.specs[f.key] !== '')
      .map((f) => [L.fact(f.key, f.label).replace(/\s*\(.*\)$/, ''), L.factValue(f, p.specs[f.key]) + (f.kind === 'number' && /\(ft\)/.test(f.label) ? ' ft' : /sq\.ft/.test(f.label) ? ' sq.ft.' : '')] as [string, string]),
    ...(p.extraDetails ?? []).filter((x) => x.public).map((x) => [x.label, x.value] as [string, string]),
  ]
  const cat = (id: string) => db.settings.placeCategories.find((x) => x.id === id)
  const groups = GROUPS.map((g) => ({ ...g, items: places.filter((x) => (cat(x.categoryId)?.group ?? 'other') === g.key) })).filter((g) => g.items.length)
  const dist = (x: NearbyPlace) => { const a = isApproxDistance(p, x) ? '~' : ''; return `${a}${x.distanceKm} km${x.durationMin ? ` · ${a}${x.durationMin} ${t('location.min')}` : ''}` }
  const h3 = (text: string) => <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{text}</h3>

  return (
    <article id="brochure" aria-label={t('brochure.preview')} className="overflow-hidden rounded-xl border bg-card shadow-card print:rounded-none print:border-0 print:shadow-none">
      <header className="flex items-center gap-2.5 px-5 py-3.5">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">RE</span>
        <b className="text-sm">RealSpec Properties</b>
        <span className="flex-1" />
        <small className="text-meta text-muted-foreground">{lead && <>{t('brochure.preparedFor')} <b className="text-foreground">{lead.name}</b> · </>}{fmtDate(today, i18n.language)}</small>
      </header>

      {cover ? (
        // the cover, and up to two more beside it ("+n" on the last); a single photo takes the full width
        <div className={cn('grid h-60 grid-rows-[minmax(0,1fr)] gap-1 px-1 sm:h-72', rest.length > 0 && 'grid-cols-[2fr_1fr]')}>
          <div className="min-h-0 overflow-hidden rounded-md">
            <PropertyPhoto type={p.type} media={cover} alt={p.title} className="size-full" />
          </div>
          {rest.length > 0 && (
            <div className={cn('grid min-h-0 gap-1', rest.length > 1 ? 'grid-rows-2' : 'grid-rows-1')}>
              {rest.slice(0, 2).map((m, i) => (
                <div key={m.id} className="relative min-h-0 overflow-hidden rounded-md">
                  <PropertyPhoto type={p.type} media={m} alt="" className="size-full" iconClassName="size-6" />
                  {i === 1 && rest.length > 2 && <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 text-xs font-semibold text-white">+{rest.length - 2}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-1 flex h-40 flex-col items-center justify-center gap-1 rounded-md bg-muted text-muted-foreground"><Camera className="size-6" /><small>{t('brochure.photosSoon')}</small></div>
      )}

      <div className="px-5 pt-5 pb-6 sm:px-6">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">{L.type(p.type)} · {t('brochure.forPurpose', { purpose: L.purpose(p.purpose).toLowerCase() })}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{p.title}</h2>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" /> {p.location.locality}, {p.location.city}</p>
        {verified.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {verified.map((a) => <span key={a} className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"><Check className="size-3" /> {ft.approval(a)}</span>)}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg bg-muted/60 px-4 py-3.5">
          {p.priceOnRequest ? <b className="text-lg">{t('brochure.priceOnRequest')}</b> : (
            <>
              <div>
                <b className="block text-2xl tracking-tight">{inr(p.price)}{p.purpose !== 'sale' && <span className="text-sm font-normal text-muted-foreground"> {t('brochure.perMonth')}</span>}</b>
                {p.purpose === 'sale' && p.areaSqft > 0 && <small className="text-meta text-muted-foreground">{inr(Math.round(p.price / p.areaSqft))} / sq.ft.</small>}
              </div>
              {p.purpose === 'sale' && opt.total && (
                <div>
                  <small className="block text-meta text-muted-foreground">{t('brochure.approxTotal')}</small>
                  <b className="block text-lg">{inr(pc.allIn)}</b>
                  <small className="text-meta text-muted-foreground">{t('brochure.totalIncl', { stamp: c.stampDuty, reg: c.registration, other: c.other })}</small>
                </div>
              )}
            </>
          )}
        </div>

        {h3(t('brochure.keyFacts'))}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-meta text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {p.amenities.length > 0 && (
          <>
            {h3(t('overview.amenities'))}
            <div className="flex flex-wrap gap-1.5">{p.amenities.map((a) => <span key={a} className="rounded-full bg-muted px-2.5 py-1 text-sm">{t(`amenity.${a}`, { defaultValue: a })}</span>)}</div>
          </>
        )}

        {groups.length > 0 && (
          <>
            {h3(t('brochure.nearby'))}
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {groups.map((g) => (
                <div key={g.key}>
                  <b className="flex items-center gap-1.5 text-sm"><g.icon className="size-4" /> {t(`nb.group.${g.key}`)}</b>
                  {g.items.map((x) => <p key={x.id} className="text-sm">{x.name} <small className="text-meta text-muted-foreground">{dist(x)}</small></p>)}
                </div>
              ))}
            </div>
          </>
        )}

        {h3(t('brochure.location'))}
        <p className="text-sm">
          {p.location.locality}, {p.location.city} · {exact
            ? <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer"
                href={`https://www.google.com/maps?q=${p.location.lat && p.location.lng ? `${p.location.lat},${p.location.lng}` : encodeURIComponent(`${p.location.locality}, ${p.location.city}`)}`}>{t('brochure.openMap')} <ExternalLink className="size-3.5" /></a>
            : t('brochure.atVisit')}
        </p>
      </div>

      <footer className="flex flex-wrap items-center gap-3 bg-primary px-5 py-4 text-primary-foreground sm:px-6">
        <div className="min-w-0 flex-1">
          <b className="block">{t('brochure.talkTo', { name: contact || t('brochure.salesTeam') })}</b>
          <small className="opacity-85">{t('brochure.footerHint')}</small>
        </div>
        <span className="rounded-md bg-primary-foreground/15 px-2.5 py-1 font-mono text-xs">{shareUrl(p)}</span>
      </footer>
      <p className="px-5 py-3 text-meta text-muted-foreground sm:px-6">{t('brochure.fine')}</p>
    </article>
  )
}
