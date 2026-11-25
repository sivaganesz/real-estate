/**
 * History — everything that happened to this property, and to the buyers around it (from spec-system-wireframe).
 * Property changes come from its own history; the buyers' side from lead timelines (shared, recommended, visits).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Camera, FileText, IndianRupee, MapPin, Pencil, Tag, Users, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/app/section-card'
import { type Tone, toneSoft } from '@/components/app/tone'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStore, useVisibleLeads, userName } from '@/store/db'
import type { Lead, LeadActivity, Property } from '@/data/types'

type Cat = 'details' | 'price' | 'status' | 'location' | 'docs' | 'media' | 'buyers'
const CATS: { k: Cat; icon: LucideIcon; tone: Tone }[] = [
  { k: 'details', icon: Pencil, tone: 'neutral' }, { k: 'price', icon: IndianRupee, tone: 'success' }, { k: 'status', icon: Tag, tone: 'violet' },
  { k: 'location', icon: MapPin, tone: 'info' }, { k: 'docs', icon: FileText, tone: 'warning' }, { k: 'media', icon: Camera, tone: 'primary' },
  { k: 'buyers', icon: Users, tone: 'violet' },
]

/** Sort a history line into a category by what it's about (language-independent keywords are in the English text the store writes). */
function categoryOf(text: string): Cat {
  const s = text.toLowerCase()
  if (/price|comparable|similar/.test(s)) return 'price'
  if (/status|archiv|restor|published|sold|reserved|booked/.test(s)) return 'status'
  if (/approval|document|verif|rera|noc|deed/.test(s)) return 'docs'
  if (/location|place|route|road|map/.test(s)) return 'location'
  if (/photo|video/.test(s)) return 'media'
  if (/brochure|shared/.test(s)) return 'buyers'
  return 'details'
}

type Item = { id: string; at: string; by: string; text: string; cat: Cat; lead?: Lead; activity?: LeadActivity }

export function HistoryTab({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const { db } = useStore()
  const leads = useVisibleLeads()
  const [filter, setFilter] = useState<Cat | 'all'>('all')

  const items = useMemo<Item[]>(() => {
    const own: Item[] = p.history.map((h) => ({ id: h.id, at: h.at, by: h.by, text: h.text, cat: categoryOf(h.text) }))
    const buyers: Item[] = leads.flatMap((l) => l.activity
      .filter((a) => a.propertyId === p.id || a.text.includes(p.id))
      .map((a) => ({ id: a.id, at: a.at, by: a.by, text: a.text, cat: 'buyers' as Cat, lead: l, activity: a })))
    return [...own, ...buyers].sort((a, b) => b.at.localeCompare(a.at))
  }, [p, leads])

  const shown = filter === 'all' ? items : items.filter((i) => i.cat === filter)
  const buyerText = (i: Item) => {
    const a = i.activity!
    if (a.type === 'shared') return t('props.hist.shared', { channel: t(`props.hist.channel.${a.text}`) })
    if (a.type === 'recommended') return t(a.text === 'off' ? 'props.hist.unrecommended' : 'props.hist.recommended')
    return a.text
  }

  return (
    <SectionCard title={t('props.tab.history')} description={t('props.hist.subtitle')}>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('props.hist.filter')}>
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('all')}>{t('attn.all')} <span className="opacity-70">{items.length}</span></Button>
        {CATS.filter((c) => items.some((i) => i.cat === c.k)).map((c) => (
          <Button key={c.k} size="sm" variant={filter === c.k ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter(c.k)}>
            <c.icon /> {t(`props.hist.cat.${c.k}`)} <span className="opacity-70">{items.filter((i) => i.cat === c.k).length}</span>
          </Button>
        ))}
      </div>
      {shown.length ? (
        <ol className="flex flex-col">
          {shown.map((i, n) => {
            // a date heading above the first item of each day
            const day = n === 0 || shown[n - 1].at !== i.at ? fmtDate(i.at, i18n.language) : ''
            const c = CATS.find((x) => x.k === i.cat)!
            return (
              <li key={i.id}>
                {day && <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground first:mt-0">{day}</p>}
                <div className="flex items-start gap-3 py-1.5">
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', toneSoft[c.tone])}><c.icon className="size-3.5" /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p>{i.lead && <><Link to={`/leads/${i.lead.id}`} className="font-medium hover:underline">{i.lead.name}</Link> · </>}{i.lead ? buyerText(i) : i.text}</p>
                    <p className="text-xs text-muted-foreground">{userName(db, i.by) || t('history.you')}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : <p className="text-sm text-muted-foreground">{t('props.hist.none')}</p>}
    </SectionCard>
  )
}
