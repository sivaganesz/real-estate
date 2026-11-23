import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, CalendarPlus, ChevronDown, CircleCheck, MapPin, Rocket, Share2, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { ApprovalBadges, StatusBadge } from '@/components/property/badges'
import { PropertyPhoto } from '@/components/property/property-photo'
import { ShareSheet } from '@/components/property/share-sheet'
import { LISTED_STATUSES } from '@/data/catalogue'
import { inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { leadsForProperty } from '@/lib/matching'
import { completion, missingRequired, type TodoKey } from '@/lib/property'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads } from '@/store/db'
import type { Property, PropertyStatus } from '@/data/types'
import { MatchesPanel } from './matches-panel'
import {
  DetailsSection, DocumentsSection, HistorySection, LocationSection, OverviewSection, PhotosSection, PriceSection, SECTION_IDS, type SectionId,
} from './sections'

/** Which section a to-do item opens. */
const TODO_TARGET: Record<TodoKey, SectionId> = {
  required: 'details', photos: 'photos', exactLocation: 'location', approvalDocs: 'documents', description: 'overview', nearby: 'location', amenities: 'overview',
}
const goTo = (id: SectionId) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export function PropertyPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { db } = useStore()
  const can = useCan()
  const p = db.properties.find((x) => x.id === id)

  if (!p || (p.status === 'draft' && !can('property.seeDrafts'))) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <p className="text-lg font-medium">{t('property.notFound')}</p>
        <Button asChild variant="outline"><Link to="/properties">{t('property.back')}</Link></Button>
      </div>
    )
  }
  return <PropertyView key={p.id} p={p} />
}

function PropertyView({ p }: { p: Property }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { db, updateProperty } = useStore()
  const can = useCan()
  const leads = useVisibleLeads()
  const manager = can('property.manage')
  const navigate = useNavigate()
  const [share, setShare] = useState<{ open: boolean; leadId?: string }>({ open: false })
  const matches = useMemo(() => leadsForProperty(p, leads, db.settings), [p, leads, db.settings])
  const done = completion(p)
  const missing = missingRequired(p)
  const photos = p.media.filter((m) => m.kind === 'photo')
  const ppsf = p.areaSqft ? Math.round(p.price / p.areaSqft) : 0
  const isDraft = p.status === 'draft'
  const active = useActiveSection()

  const changeStatus = (s: PropertyStatus) => {
    if (s === p.status) return
    updateProperty(p.id, (x) => { x.status = s }, t('history.status', { status: t(`status.${s}`) }))
    toast.success(t('property.statusChanged', { status: t(`status.${s}`) }))
  }
  const publish = () => {
    updateProperty(p.id, (x) => { x.status = 'available'; x.listedAt = x.listedAt ?? x.created.at }, t('history.published'))
    const fit = leadsForProperty({ ...p, status: 'available' }, db.leads, db.settings)
    toast.success(t('property.published'), {
      description: fit.length ? t('property.publishedFit', { count: fit.length }) : t('property.publishedNoFit'),
      action: fit.length ? { label: t('matches.notify'), onClick: () => toast.success(t('matches.notified', { count: new Set(fit.map((m) => m.lead.ownerId)).size })) } : undefined,
    })
  }
  const notYet = (what: string) => toast(t('property.comingNext', { what }))

  const actions = (
    <div className="flex flex-col gap-2">
      {isDraft ? (
        <>
          <Button size="lg" disabled={missing.length > 0} onClick={publish}><Rocket /> {t('action.publish')}</Button>
          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">{t('property.missingToPublish', { list: missing.map((k) => L.fact(k)).join(', ') })}</p>
          )}
        </>
      ) : (
        <>
          <Button size="lg" onClick={() => setShare({ open: true })}><Share2 /> {t('action.share')}</Button>
          <Button size="lg" variant="outline" onClick={() => notYet(t('property.bookVisitModule'))}><CalendarPlus /> {t('action.bookVisit')}</Button>
        </>
      )}
      {manager && (
        <Button size="lg" variant="outline" onClick={() => navigate(`/properties/${p.id}/edit`)}><Sparkles /> {t('action.editWithAi')}</Button>
      )}
    </div>
  )

  const priceBlock = (
    <div>
      <p className="text-3xl font-semibold tracking-tight">{inrShort(p.price)}</p>
      <p className="text-sm text-muted-foreground">
        {ppsf > 0 && t('card.perSqft', { rate: num(ppsf) })} · {L.purpose(p.purpose)}
      </p>
    </div>
  )

  const statusControl = manager && !isDraft ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label={t('property.changeStatus')}>
          <StatusBadge status={p.status} className="border-0" /> <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('property.changeStatus')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={p.status} onValueChange={(v) => changeStatus(v as PropertyStatus)}>
          {LISTED_STATUSES.map((s) => <DropdownMenuRadioItem key={s} value={s}>{t(`status.${s}`)}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : <StatusBadge status={p.status} />

  const todoCard = manager && done.todo.length > 0 && (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{t('todo.title')}</span>
        <span className="text-muted-foreground">{t('todo.complete', { pct: done.pct })}</span>
      </div>
      <Progress value={done.pct} className="mb-3 h-1.5" />
      <ul className="flex flex-col gap-1">
        {done.todo.map((item) => (
          <li key={item.key}>
            <button type="button" onClick={() => goTo(TODO_TARGET[item.key])}
              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', item.key === 'required' && 'font-medium text-destructive')}>
              <span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" />
              <span className="flex-1">
                {t(`todo.${item.key}`, { count: item.count ?? 0 })}
                {item.key === 'required' && item.detail?.length ? `: ${item.detail.map((k) => L.fact(k)).join(', ')}` : ''}
              </span>
              <span className="text-xs text-primary">{t('todo.open')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 pb-28 md:px-6 lg:pb-10">
      <Link to="/properties" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('property.back')}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* gallery */}
          <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
            <button type="button" onClick={() => goTo('photos')} className="relative md:col-span-3 md:row-span-2" aria-label={t('photos.openAll')}>
              <PropertyPhoto type={p.type} media={photos[0]} alt={p.title} className="aspect-[16/10] w-full rounded-xl md:h-full" iconClassName="size-16" />
              {photos.length > 0 && <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/55 px-2 py-0.5 text-xs text-white">{t('photos.count', { count: photos.length })}</span>}
            </button>
            {photos.slice(1, 3).map((m) => (
              <PropertyPhoto key={m.id} type={p.type} media={m} alt="" className="hidden aspect-[4/3] w-full rounded-xl md:flex md:h-full" iconClassName="size-8" />
            )).concat(photos.length < 3 ? [<div key="pad" className="hidden rounded-xl bg-muted md:block" />] : [])}
          </div>

          {/* title */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {isDraft && <StatusBadge status="draft" />}
              <ApprovalBadges property={p} />
              <span className="text-xs text-muted-foreground">{p.id}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{p.title}</h1>
            <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" /> {p.location.locality}, {p.location.city}</p>
            <p className="text-sm">{[L.type(p.type), ...L.keyFacts(p), p.facing && t('search.facing', { dir: L.facing(p.facing) })].filter(Boolean).join(' · ')}</p>
            {isDraft && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t('property.draftNote')}</p>}
          </div>

          {/* phone: price + status, then the to-do */}
          <div className="flex items-end justify-between gap-3 lg:hidden">{priceBlock}{statusControl}</div>
          <div className="lg:hidden">{todoCard}</div>

          <MatchesPanel property={p} matches={matches} onShare={(leadId) => setShare({ open: true, leadId })} />

          {/* jump bar */}
          <nav aria-label={t('property.sections')} className="sticky top-14 z-10 -mx-4 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur md:-mx-0 md:rounded-xl md:border md:px-2">
            <ul className="flex gap-1">
              {SECTION_IDS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => goTo(s)} aria-current={active === s ? 'true' : undefined}
                    className={cn('border-b-2 px-2.5 py-2.5 text-sm whitespace-nowrap', active === s ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    {t(`section.short.${s}`)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <OverviewSection p={p} />
          <DetailsSection p={p} />
          <LocationSection p={p} />
          <PhotosSection p={p} />
          <DocumentsSection p={p} />
          <PriceSection p={p} />
          <HistorySection p={p} />
        </div>

        {/* desktop: sticky action panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">{priceBlock}{statusControl}</div>
              {actions}
            </div>
            {todoCard}
            {manager && done.todo.length === 0 && (
              <p className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm"><CircleCheck className="size-4 text-emerald-600" /> {t('todo.allDone')}</p>
            )}
          </div>
        </aside>
      </div>

      {/* phone: sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {isDraft ? (
          <Button size="lg" className="flex-1" disabled={missing.length > 0} onClick={publish}><Rocket /> {t('action.publish')}</Button>
        ) : (
          <>
            <Button size="lg" className="flex-1" onClick={() => setShare({ open: true })}><Share2 /> {t('action.share')}</Button>
            <Button size="lg" variant="outline" className="flex-1" onClick={() => notYet(t('property.bookVisitModule'))}><CalendarPlus /> {t('action.bookVisit')}</Button>
          </>
        )}
        {manager && <Button size="icon-lg" variant="outline" aria-label={t('action.editWithAi')} onClick={() => navigate(`/properties/${p.id}/edit`)}><Sparkles /></Button>}
      </div>

      {share.open && <ShareSheet property={p} open={share.open} leadId={share.leadId} onOpenChange={(o) => setShare({ open: o })} />}
    </div>
  )
}

/** The section currently under the jump bar, for highlighting. */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>('overview')
  useEffect(() => {
    const els = SECTION_IDS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id as SectionId)
      },
      { rootMargin: '-130px 0px -55% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
  return active
}
