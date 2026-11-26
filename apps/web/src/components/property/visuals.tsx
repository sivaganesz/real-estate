import type { ReactNode } from 'react';
import clsx from 'clsx';
import {
  ArrowUpDown,
  Building,
  Car,
  CheckCircle2,
  Droplets,
  Dumbbell,
  Fence,
  Flower2,
  Phone,
  PlugZap,
  Ruler,
  ShieldCheck,
  Sun,
  Trees,
  Video,
  Waves,
  Zap,
} from 'lucide-react';

/** A ring that fills to a percentage, with the number in the middle. */
export function Ring({ value, size = 56, stroke = 6, label, tone }: { value: number; size?: number; stroke?: number; label?: ReactNode; tone?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone ?? (value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#f43f5e');
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${value}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="absolute text-xs font-semibold text-slate-800">{label ?? `${value}%`}</span>
    </span>
  );
}

/**
 * A low–high range as a soft track, with "this property" as a marker on it.
 * Values outside the range sit at the ends with an arrow.
 */
export function RangeBar({ min, max, value, format, className }: { min: number; max: number; value: number | null; format: (n: number) => string; className?: string }) {
  const span = Math.max(1, max - min);
  // Leave room either side so a marker just outside the range still shows.
  const lo = min - span * 0.25;
  const hi = max + span * 0.25;
  const pos = (n: number) => `${Math.min(100, Math.max(0, ((n - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className={clsx('pt-6', className)}>
      <div className="relative h-2.5 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-brand-200 to-brand-400" style={{ left: pos(min), right: `calc(100% - ${pos(max)})` }} />
        {value != null && (
          <div className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(value) }}>
            <span className="whitespace-nowrap rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">This · {format(value)}</span>
            <span className="mt-0.5 h-5 w-0.5 rounded-full bg-slate-900" />
          </div>
        )}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-slate-500">
        <span className="absolute -translate-x-1/2" style={{ left: pos(min) }}>
          {format(min)}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: pos(max) }}>
          {format(max)}
        </span>
      </div>
    </div>
  );
}

/** Parts of a whole as one bar, with a legend under it. */
export function StackedBar({ parts }: { parts: { label: string; value: number; tone: string; note?: string }[] }) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {parts.map((p) => (
          <span key={p.label} className={clsx('h-full first:rounded-l-full last:rounded-r-full', p.tone)} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.note ?? ''}`} />
        ))}
      </div>
      <ul className="mt-2.5 space-y-1">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-xs">
            <span className={clsx('h-2 w-2 shrink-0 rounded-full', p.tone)} />
            <span className="flex-1 text-slate-600">{p.label}</span>
            <span className="font-medium text-slate-800">{p.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const AMENITY_ICON: Record<string, typeof Ruler> = {
  'Car parking': Car,
  'Visitor parking': Car,
  Lift: ArrowUpDown,
  'Power backup': Zap,
  Security: ShieldCheck,
  CCTV: Video,
  Gym: Dumbbell,
  'Swimming pool': Waves,
  Clubhouse: Building,
  "Children's play area": Flower2,
  Garden: Trees,
  'Gated community': Fence,
  'Rainwater harvesting': Droplets,
  Borewell: Droplets,
  'Corporation water': Droplets,
  Solar: Sun,
  Intercom: Phone,
  'EV charging': PlugZap,
};

export const amenityIcon = (name: string) => AMENITY_ICON[name] ?? CheckCircle2;
