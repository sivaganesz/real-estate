/**
 * The single domain → colour/icon map (DESIGN_SYSTEM §3.2). Components never pick colours by hand.
 * Class strings are written out in full (never interpolated) so Tailwind can see them.
 *  - solid: dot / bar / icon fill     - soft: chip or wash background
 *  - text:  text-safe tone (semantic tones only; stage and appointment solids are marks, not body text)
 */
import {
  BadgeCheck, Briefcase, Building2, CalendarClock, ChevronsUp, ChevronUp, CircleCheck, CircleDashed, CirclePause, CircleX,
  FilePenLine, Flame, Handshake, Lock, MapPinCheck, Minus, Phone, PhoneOutgoing, Snowflake, Sparkle, Sparkles, Stamp,
  Thermometer, Trophy, Video, type LucideIcon,
} from 'lucide-react'
import type {
  AppointmentStatus, AppointmentType, Availability, PipelineStageKey, Priority, PropertyStatus, Role, Temperature,
} from '@/domain/types'

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral' | 'ai' | 'highlight' | 'hot' | 'warm' | 'cold'

export type ToneClasses = { solid: string; soft: string; text: string; ring: string; icon?: LucideIcon }

/** Semantic tones: every `text` here is ≥ 4.5:1 on its soft background and on cards, in both themes. */
export const TONE: Record<Tone, ToneClasses> = {
  primary: { solid: 'bg-primary', soft: 'bg-primary-soft', text: 'text-primary', ring: 'ring-primary' },
  success: { solid: 'bg-success', soft: 'bg-success-soft', text: 'text-success', ring: 'ring-success' },
  warning: { solid: 'bg-warning', soft: 'bg-warning-soft', text: 'text-warning', ring: 'ring-warning' },
  danger: { solid: 'bg-danger', soft: 'bg-danger-soft', text: 'text-danger', ring: 'ring-danger' },
  info: { solid: 'bg-info', soft: 'bg-info-soft', text: 'text-info', ring: 'ring-info' },
  violet: { solid: 'bg-violet', soft: 'bg-violet-soft', text: 'text-violet', ring: 'ring-violet' },
  neutral: { solid: 'bg-neutral', soft: 'bg-neutral-soft', text: 'text-neutral', ring: 'ring-neutral' },
  ai: { solid: 'bg-ai', soft: 'bg-ai-soft', text: 'text-ai', ring: 'ring-ai' },
  highlight: { solid: 'bg-highlight', soft: 'bg-highlight-soft', text: 'text-highlight-foreground', ring: 'ring-highlight' },
  hot: { solid: 'bg-hot', soft: 'bg-hot-soft', text: 'text-hot', ring: 'ring-hot' },
  warm: { solid: 'bg-warm', soft: 'bg-warm-soft', text: 'text-warm', ring: 'ring-warm' },
  cold: { solid: 'bg-cold', soft: 'bg-cold-soft', text: 'text-cold', ring: 'ring-cold' },
}

export const temperatureTone: Record<Temperature, ToneClasses> = {
  hot: { ...TONE.hot, icon: Flame },
  warm: { ...TONE.warm, icon: Thermometer },
  cold: { ...TONE.cold, icon: Snowflake },
}

/** Stage badges: soft wash + solid dot + foreground label (stage solids are not text-safe). */
export const stageTone: Record<PipelineStageKey, ToneClasses> = {
  new: { solid: 'bg-stage-new', soft: 'bg-stage-new-soft', text: 'text-foreground', ring: 'ring-stage-new', icon: Sparkle },
  contacted: { solid: 'bg-stage-contacted', soft: 'bg-stage-contacted-soft', text: 'text-foreground', ring: 'ring-stage-contacted', icon: PhoneOutgoing },
  qualified: { solid: 'bg-stage-qualified', soft: 'bg-stage-qualified-soft', text: 'text-foreground', ring: 'ring-stage-qualified', icon: BadgeCheck },
  siteVisitScheduled: { solid: 'bg-stage-visit-scheduled', soft: 'bg-stage-visit-scheduled-soft', text: 'text-foreground', ring: 'ring-stage-visit-scheduled', icon: CalendarClock },
  siteVisitDone: { solid: 'bg-stage-visit-done', soft: 'bg-stage-visit-done-soft', text: 'text-foreground', ring: 'ring-stage-visit-done', icon: MapPinCheck },
  negotiation: { solid: 'bg-stage-negotiation', soft: 'bg-stage-negotiation-soft', text: 'text-foreground', ring: 'ring-stage-negotiation', icon: Handshake },
  booked: { solid: 'bg-stage-booked', soft: 'bg-stage-booked-soft', text: 'text-foreground', ring: 'ring-stage-booked', icon: Stamp },
  converted: { solid: 'bg-stage-converted', soft: 'bg-stage-converted-soft', text: 'text-foreground', ring: 'ring-stage-converted', icon: Trophy },
  lost: { solid: 'bg-stage-lost', soft: 'bg-stage-lost-soft', text: 'text-foreground', ring: 'ring-stage-lost', icon: CircleX },
}

export const appointmentTypeTone: Record<AppointmentType, ToneClasses> = {
  siteVisit: { solid: 'bg-appt-site-visit', soft: 'bg-appt-site-visit-soft', text: 'text-foreground', ring: 'ring-appt-site-visit', icon: Building2 },
  officeMeeting: { solid: 'bg-appt-office', soft: 'bg-appt-office-soft', text: 'text-foreground', ring: 'ring-appt-office', icon: Briefcase },
  phoneCall: { solid: 'bg-appt-call', soft: 'bg-appt-call-soft', text: 'text-foreground', ring: 'ring-appt-call', icon: Phone },
  videoCall: { solid: 'bg-appt-video', soft: 'bg-appt-video-soft', text: 'text-foreground', ring: 'ring-appt-video', icon: Video },
  documentation: { solid: 'bg-appt-docs', soft: 'bg-appt-docs-soft', text: 'text-foreground', ring: 'ring-appt-docs', icon: FilePenLine },
}

export const appointmentStatusTone: Record<AppointmentStatus, ToneClasses> = {
  scheduled: TONE.info,
  confirmed: TONE.primary,
  completed: { ...TONE.success, icon: CircleCheck },
  noShow: { ...TONE.danger, icon: CircleX },
  cancelled: { ...TONE.neutral, icon: CircleDashed },
  rescheduled: TONE.warning,
}

export const propertyStatusTone: Record<PropertyStatus, ToneClasses> = {
  available: { ...TONE.success, icon: CircleCheck },
  onHold: { ...TONE.warning, icon: CirclePause },
  booked: { ...TONE.info, icon: Stamp },
  sold: { ...TONE.neutral, icon: Lock },
}

export const priorityTone: Record<Priority, ToneClasses> = {
  high: { ...TONE.danger, icon: ChevronsUp },
  medium: { ...TONE.warning, icon: ChevronUp },
  low: { ...TONE.neutral, icon: Minus },
}

export const availabilityTone: Record<Availability, ToneClasses> = {
  available: TONE.success,
  inVisit: TONE.warning,
  onLeave: TONE.neutral,
}

/** Avatar ring per role (DESIGN_SYSTEM §11.1): Admin violet, Manager info, Executive primary. */
export const roleTone: Record<Role, ToneClasses> = {
  admin: TONE.violet,
  manager: TONE.info,
  executive: TONE.primary,
}

export const aiTone: ToneClasses = { ...TONE.ai, icon: Sparkles }

/**
 * Avatar backgrounds: hash(name) % 8 over the chart palette (soft mix with the card colour, foreground text).
 * Written out in full for Tailwind.
 */
export const AVATAR_TINTS = [
  'bg-[color-mix(in_oklch,var(--chart-1)_18%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--chart-2)_18%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--chart-3)_18%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--chart-4)_18%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--chart-5)_18%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--chart-6)_18%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--chart-7)_18%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--chart-8)_18%,var(--card))]',
] as const

export function avatarTint(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[h % AVATAR_TINTS.length]
}

/** Ring tone for a lead score (DESIGN_SYSTEM §11.3): ≥ 70 success, 40–69 warning, under 40 neutral. */
export const scoreTone = (score: number): Tone => (score >= 70 ? 'success' : score >= 40 ? 'warning' : 'neutral')
/** Ring tone for a match percentage (DESIGN_SYSTEM §11.4): ≥ 80 success, 60–79 primary, 40–59 warning, else neutral. */
export const matchTone = (pct: number): Tone => (pct >= 80 ? 'success' : pct >= 60 ? 'primary' : pct >= 40 ? 'warning' : 'neutral')
