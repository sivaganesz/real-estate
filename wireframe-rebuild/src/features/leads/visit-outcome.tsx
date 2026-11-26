/**
 * Record how a booked site visit went (spec, Appointments: "book, reschedule, cancel and record outcomes"; old wireframe
 * views-appointments.js): Completed needs the customer's feedback and how interested they were; No-show and Cancelled take
 * an optional note. Every outcome goes on the lead's timeline. A completed visit also ticks "Visited a site" and
 * "Responded" in the readiness inputs.
 */
import { useState } from 'react'
import { Ban, Check, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { Lead, SiteVisit } from '@/data/types'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'

type Outcome = 'completed' | 'noShow' | 'cancelled'
const OUTCOMES: { key: Outcome; icon: typeof Check; on: string }[] = [
  { key: 'completed', icon: Check, on: 'border-success bg-success-soft text-success' },
  { key: 'noShow', icon: UserX, on: 'border-danger bg-danger-soft text-danger' },
  { key: 'cancelled', icon: Ban, on: 'border-foreground/30 bg-muted text-foreground' },
]
const INTEREST = ['high', 'medium', 'low'] as const


export function VisitOutcomeDialog({ lead: l, visit, onOpenChange }: { lead: Lead; visit: SiteVisit | null; onOpenChange: (o: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const { db, today, user, updateLead } = useStore()
  const [outcome, setOutcome] = useState<Outcome>('completed')
  const [feedback, setFeedback] = useState('')
  const [interest, setInterest] = useState<(typeof INTEREST)[number]>('medium')
  const [seen, setSeen] = useState<string | null>(null)
  // a fresh form each time the dialog opens for a visit
  if ((visit?.id ?? null) !== seen) {
    setSeen(visit?.id ?? null)
    setOutcome(visit && visit.date > today ? 'cancelled' : 'completed') // a visit still ahead can only be cancelled
    setFeedback('')
    setInterest('medium')
  }
  if (!visit) return null
  const title = db.properties.find((p) => p.id === visit.propertyId)?.title
  const when = `${fmtDate(visit.date, i18n.language)}${visit.time ? ` ${visit.time}` : ''}`
  const ahead = visit.date > today
  const valid = outcome !== 'completed' || feedback.trim().length > 0

  const save = () => {
    const note = feedback.trim()
    const text = outcome === 'completed'
      ? t('lead.outcome.noteDone', { id: visit.propertyId, feedback: note, interest: t(`lead.outcome.interest.${interest}`) })
      : outcome === 'noShow'
        ? t('lead.outcome.noteNoShow', { id: visit.propertyId, date: when }) + (note ? ` — ${note}` : '')
        : t('lead.outcome.noteCancelled', { id: visit.propertyId, date: when }) + (note ? ` — ${note}` : '')
    updateLead(l.id, (x) => {
      const v = x.visits.find((y) => y.id === visit.id)
      if (!v) return
      v.status = outcome
      if (outcome === 'completed') {
        v.feedback = note
        v.interest = interest
        x.engagement.siteVisited = true
        x.engagement.responded = true
      } else if (note) v.feedback = note
      x.activity.unshift({ id: `${x.id}-a${x.activity.length + 1}`, at: today, by: user.id, type: outcome === 'cancelled' ? 'note' : 'visit', propertyId: visit.propertyId, text })
    })
    toast.success(t(`lead.outcome.toast.${outcome}`))
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('lead.outcome.title')}</DialogTitle>
          <DialogDescription>{visit.propertyId}{title ? ` · ${title}` : ''} · {when}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('lead.outcome.title')}>
            {OUTCOMES.map((o) => {
              const Icon = o.icon
              const off = ahead && o.key !== 'cancelled'
              return (
                <button key={o.key} type="button" role="radio" aria-checked={outcome === o.key} disabled={off} onClick={() => setOutcome(o.key)}
                  title={off ? t('lead.outcome.notYet') : undefined}
                  className={cn('flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-sm transition-colors disabled:opacity-40',
                    outcome === o.key ? cn(o.on, 'font-medium') : 'hover:bg-muted')}>
                  <Icon className="size-4" /> {t(`lead.outcome.${o.key}`)}
                </button>
              )
            })}
          </div>
          {outcome === 'completed' && (
            <div>
              <p className="mb-1.5 text-sm font-medium">{t('lead.outcome.interestQ')}</p>
              <div className="flex gap-1.5">
                {INTEREST.map((k) => (
                  <button key={k} type="button" onClick={() => setInterest(k)} aria-pressed={interest === k}
                    className={cn('rounded-full border px-3 py-1 text-sm', interest === k ? 'border-primary bg-accent font-medium text-primary' : 'hover:bg-muted')}>
                    {t(`lead.outcome.interest.${k}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{outcome === 'completed' ? t('lead.outcome.feedback') : t('lead.outcome.note')}</span>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="min-h-20"
              placeholder={outcome === 'completed' ? t('lead.outcome.feedbackPh') : outcome === 'noShow' ? t('lead.outcome.noShowPh') : t('lead.outcome.cancelPh')} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>
          <Button disabled={!valid} onClick={save}>{t('lead.outcome.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
