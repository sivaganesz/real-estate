/**
 * One set of status tones for the whole app (chips, callouts, meters, stat tiles, avatars).
 * Each maps to theme tokens in index.css, so a theme change never touches a screen.
 */
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet'

/** Soft background + strong text: chips, avatars, icon wells. */
export const toneSoft: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-neutral',
  primary: 'bg-accent text-accent-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  violet: 'bg-violet-soft text-violet',
}

/** Text colour only. */
export const toneText: Record<Tone, string> = {
  neutral: 'text-neutral',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  violet: 'text-violet',
}

/** Solid fill: dots, meter bars. */
export const toneFill: Record<Tone, string> = {
  neutral: 'bg-neutral',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  violet: 'bg-violet',
}

/** A left border in the tone: callouts. */
export const toneBorder: Record<Tone, string> = {
  neutral: 'border-neutral/40',
  primary: 'border-primary/50',
  success: 'border-success/50',
  warning: 'border-warning/50',
  danger: 'border-danger/50',
  info: 'border-info/50',
  violet: 'border-violet/50',
}
