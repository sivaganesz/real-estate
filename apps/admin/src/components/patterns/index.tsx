/**
 * Page building blocks from the approved wireframe (TRD v2 §12.2). Pages compose these
 * instead of styling their own headers, chips and notes, so every screen looks the same.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Tone } from './tone';
import { TONE_CHIP, TONE_FILL, TONE_NOTE, TONE_TEXT } from './tone';

export type { Tone } from './tone';

/** Page title (the page's only h1), a one-line description, and actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Small chips next to the title, e.g. a status. */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start gap-3">
      {/* At least 18rem wide, so on a phone the actions wrap under the title. */}
      <div className="min-w-0 flex-[1_1_18rem]">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Pill with a status tone (wireframe `.chip`). */
export function Chip({
  tone = 'grey',
  outline,
  className,
  children,
}: {
  tone?: Tone;
  outline?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-px text-xs font-medium whitespace-nowrap',
        outline ? 'border bg-transparent text-tone-grey' : TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Explanatory note with a coloured rule (wireframe `.note`). */
export function Note({
  tone = 'grey',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="note"
      className={cn(
        'rounded-lg border-l-[3px] px-3 py-2 text-[13px] text-ink-2',
        TONE_NOTE[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** KPI card: label, big value, small line under it (wireframe `.kpi`). */
export function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3.5 shadow-card">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-[26px] leading-tight font-bold tracking-tight',
          tone && TONE_TEXT[tone],
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Progress bar from 0 to 100 (wireframe `.meter`). */
export function Meter({
  value,
  tone = 'brand',
  label,
}: {
  value: number;
  tone?: Tone | 'brand';
  /** Accessible name, e.g. "Purchase readiness". */
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded-full bg-tone-grey-soft"
    >
      <i
        className={cn('block h-full rounded-full', TONE_FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Nothing to show yet, with an optional next step (wireframe `.empty`). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 px-6 py-8 text-center text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A numbered form section: "1 Main property information" (wireframe `.form-sec`). */
export function NumberedSection({
  number,
  title,
  aside,
  children,
}: {
  number: number;
  title: ReactNode;
  /** Shown next to the title, e.g. a type chip. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line-soft pt-4 first:border-t-0 first:pt-0">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <span className="grid size-[22px] place-items-center rounded-full bg-primary-soft text-xs text-primary">
          {number}
        </span>
        {title}
        {aside}
      </h2>
      {children}
    </section>
  );
}

/** Label over value, three columns (wireframe `.dl3`); one column on a phone. */
export function DescriptionGrid({
  items,
  label,
}: {
  items: { label: ReactNode; value: ReactNode; wide?: boolean }[];
  /** Accessible name, e.g. "Main property information". */
  label?: string;
}) {
  return (
    <dl aria-label={label} className="grid gap-x-[18px] gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <div key={i} className={cn('min-w-0', item.wide && 'sm:col-span-2 lg:col-span-3')}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-medium break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Not recorded" in the muted style the wireframe uses for empty values. */
export function NotRecorded() {
  return <span className="font-normal text-muted-foreground">Not recorded</span>;
}

/** Vertical timeline with a dot per entry (wireframe `.tl`). */
export function Timeline({
  items,
  label,
}: {
  items: { key: string; when: ReactNode; children: ReactNode }[];
  label: string;
}) {
  return (
    <ol aria-label={label} className="m-0 list-none p-0">
      {items.map((item) => (
        <li
          key={item.key}
          className="relative ml-1.5 border-l-2 border-border pb-3.5 pl-5 last:border-l-transparent before:absolute before:top-[3px] before:-left-[7px] before:size-3 before:rounded-full before:border-2 before:border-primary before:bg-card"
        >
          <div className="text-xs text-muted-foreground">{item.when}</div>
          {item.children}
        </li>
      ))}
    </ol>
  );
}
