/** The six status tones of the design system (wireframe `.chip.green`, `.note.amber`…). */
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'grey';

/** Soft background + strong text, for chips and badges. */
export const TONE_CHIP: Record<Tone, string> = {
  green: 'bg-tone-green-soft text-tone-green',
  amber: 'bg-tone-amber-soft text-tone-amber',
  red: 'bg-tone-red-soft text-tone-red',
  blue: 'bg-tone-blue-soft text-tone-blue',
  purple: 'bg-tone-purple-soft text-tone-purple',
  grey: 'bg-tone-grey-soft text-tone-grey',
};

/** Text only, e.g. a KPI value. */
export const TONE_TEXT: Record<Tone, string> = {
  green: 'text-tone-green',
  amber: 'text-tone-amber',
  red: 'text-tone-red',
  blue: 'text-tone-blue',
  purple: 'text-tone-purple',
  grey: 'text-tone-grey',
};

/** Soft background + a coloured left rule, for notes. */
export const TONE_NOTE: Record<Tone, string> = {
  green: 'bg-tone-green-soft border-tone-green/50',
  amber: 'bg-tone-amber-soft border-tone-amber/50',
  red: 'bg-tone-red-soft border-tone-red/50',
  blue: 'bg-tone-blue-soft border-tone-blue/50',
  purple: 'bg-tone-purple-soft border-tone-purple/50',
  grey: 'bg-tone-grey-soft border-tone-grey/40',
};

/** Solid fill, for meters and dots. */
export const TONE_FILL: Record<Tone | 'brand', string> = {
  brand: 'bg-primary',
  green: 'bg-tone-green',
  amber: 'bg-tone-amber',
  red: 'bg-tone-red',
  blue: 'bg-tone-blue',
  purple: 'bg-tone-purple',
  grey: 'bg-tone-grey',
};
