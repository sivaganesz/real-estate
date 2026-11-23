import { useState } from 'react'
import { BellRing, Check, ChevronDown, Share2, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MatchBadge } from '@/components/property/badges'
import { inrShort, initials } from '@/lib/format'
import type { Match } from '@/lib/matching'
import { useCan, useStore, userName } from '@/store/db'
import type { Property } from '@/data/types'

/**
 * Matching on top (CTO, 20 Nov): the leads that fit this property, on the first screen.
 * Managers see every executive's leads and can notify them; executives see only their own and share directly.
 */
export function MatchesPanel({ property, matches, onShare }: { property: Property; matches: Match[]; onShare: (leadId: string) => void }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const can = useCan()
  const manager = can('property.manage')
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const shown = all ? matches : matches.slice(0, 3)

  if (property.status === 'draft') return null
  if (property.status !== 'available') {
    return <section className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">{t('matches.onlyAvailable')}</section>
  }

  const notify = () => {
    const execs = new Set(matches.map((m) => m.lead.ownerId).filter(Boolean))
    toast.success(t('matches.notified', { count: execs.size }), { description: t('matches.notifiedHint') })
  }

  return (
    <section aria-labelledby="matches-title" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-4" /></span>
        <h2 id="matches-title" className="font-semibold">
          {matches.length
            ? manager ? t('matches.title', { count: matches.length }) : t('matches.titleMine', { count: matches.length })
            : t('matches.none')}
        </h2>
        {manager && matches.length > 0 && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={notify}><BellRing /> {t('matches.notify')}</Button>
        )}
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">{manager ? t('matches.noneHintManager') : t('matches.noneHint')}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {shown.map((m) => {
            const isOpen = open === m.lead.id
            return (
              <li key={m.lead.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9"><AvatarFallback>{initials(m.lead.name)}</AvatarFallback></Avatar>
                  <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.lead.id)}>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{m.lead.name}</span>
                      <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t('share.budgetUpTo', { amount: inrShort(m.lead.budget.max) })}
                      {manager && m.lead.ownerId ? ` · ${userName(db, m.lead.ownerId)}` : ''}
                      {' · '}{t(`stage.${m.lead.stage}`)}
                    </span>
                  </button>
                  <MatchBadge label={m.label} score={m.score} />
                  {!manager && (
                    <Button variant="ghost" size="icon" onClick={() => onShare(m.lead.id)} aria-label={t('action.shareWith', { name: m.lead.name })}>
                      <Share2 />
                    </Button>
                  )}
                </div>
                {isOpen && (
                  <ul className="mt-2 ml-12 flex flex-col gap-1 text-sm">
                    {m.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        {r.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> : <X className="mt-0.5 size-3.5 shrink-0 text-rose-600" />}
                        <span>{t(`reason.${r.key}`, { ...r.values })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {matches.length > 3 && (
        <Button variant="link" size="sm" className="mt-1 px-0" onClick={() => setAll(!all)}>
          {all ? t('matches.showFewer') : t('matches.seeAll', { count: matches.length })}
        </Button>
      )}
    </section>
  )
}
