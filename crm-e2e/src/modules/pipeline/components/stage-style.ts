/**
 * Kanban-only stage classes (DESIGN_SYSTEM §11.5) that lib/tones does not carry: the column wash (half the soft tint in
 * light mode, the soft wash as is in dark), the drop ring at 40% and the top bar. Written out in full for Tailwind.
 */
import type { PipelineStageKey } from '@/domain/types'

export const STAGE_STYLE: Record<PipelineStageKey, { wash: string; dropRing: string; bar: string; border: string }> = {
  new: { wash: 'bg-stage-new-soft/50 dark:bg-stage-new-soft', dropRing: 'ring-stage-new/40', bar: 'bg-stage-new', border: 'border-stage-new/50' },
  contacted: { wash: 'bg-stage-contacted-soft/50 dark:bg-stage-contacted-soft', dropRing: 'ring-stage-contacted/40', bar: 'bg-stage-contacted', border: 'border-stage-contacted/50' },
  qualified: { wash: 'bg-stage-qualified-soft/50 dark:bg-stage-qualified-soft', dropRing: 'ring-stage-qualified/40', bar: 'bg-stage-qualified', border: 'border-stage-qualified/50' },
  siteVisitScheduled: { wash: 'bg-stage-visit-scheduled-soft/50 dark:bg-stage-visit-scheduled-soft', dropRing: 'ring-stage-visit-scheduled/40', bar: 'bg-stage-visit-scheduled', border: 'border-stage-visit-scheduled/50' },
  siteVisitDone: { wash: 'bg-stage-visit-done-soft/50 dark:bg-stage-visit-done-soft', dropRing: 'ring-stage-visit-done/40', bar: 'bg-stage-visit-done', border: 'border-stage-visit-done/50' },
  negotiation: { wash: 'bg-stage-negotiation-soft/50 dark:bg-stage-negotiation-soft', dropRing: 'ring-stage-negotiation/40', bar: 'bg-stage-negotiation', border: 'border-stage-negotiation/50' },
  booked: { wash: 'bg-stage-booked-soft/50 dark:bg-stage-booked-soft', dropRing: 'ring-stage-booked/40', bar: 'bg-stage-booked', border: 'border-stage-booked/50' },
  converted: { wash: 'bg-stage-converted-soft/50 dark:bg-stage-converted-soft', dropRing: 'ring-stage-converted/40', bar: 'bg-stage-converted', border: 'border-stage-converted/50' },
  lost: { wash: 'bg-stage-lost-soft/50 dark:bg-stage-lost-soft', dropRing: 'ring-stage-lost/40', bar: 'bg-stage-lost', border: 'border-stage-lost/50' },
}
