import clsx from 'clsx';
import { ArrowRight, CircleSlash } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { formatINR } from '@estate/shared';
import { DEAL_STEPS, dealNextStep, dealStep, type Deal } from '../lib/deals';

/** Who is looking, in the terms the next-step text needs. */
export function useDealViewer() {
  const { can, user } = useAuth();
  return { canApprove: can('deal.approve'), canBook: can('deal.book'), isAdmin: user?.role === 'admin', name: user?.name };
}

/** Five segments with the current step highlighted; `labels` adds the step names under them. */
export function StepTrack({ d, labels, className }: { d: Pick<Deal, 'status'>; labels?: boolean; className?: string }) {
  const at = dealStep(d);
  if (at < 0)
    return (
      <p className={clsx('flex items-center gap-1.5 text-xs text-slate-400', className)}>
        <CircleSlash className="h-3.5 w-3.5" /> Dropped
      </p>
    );
  return (
    <div className={className}>
      <div className="flex gap-1">
        {DEAL_STEPS.map((s, i) => (
          <span key={s.label} title={s.label} className={clsx('h-1.5 flex-1 rounded-full', i < at || at === 4 ? 'bg-brand-600' : i === at ? (d.status === 'approval' ? 'bg-ai-500' : 'bg-amber-400') : 'bg-slate-100')} />
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex gap-1">
          {DEAL_STEPS.map((s, i) => (
            <span key={s.label} className={clsx('flex-1 truncate text-[10px]', i === at ? 'font-semibold text-slate-800' : i < at || at === 4 ? 'text-brand-700' : 'text-slate-400')}>
              {s.short}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The one thing that has to happen next, said plainly; highlighted when it's on the viewer. */
export function NextStepNote({ d, className }: { d: Deal; className?: string }) {
  const viewer = useDealViewer();
  const n = dealNextStep(d, viewer);
  return (
    <p className={clsx('flex items-start gap-1.5 text-xs', n.owner === 'done' ? 'text-slate-500' : n.urgent ? 'text-rose-700' : n.owner === 'you' ? 'text-slate-800' : 'text-slate-500', className)}>
      <ArrowRight className={clsx('mt-0.5 h-3 w-3 shrink-0', n.urgent ? 'text-rose-500' : 'text-slate-400')} />
      <span>
        {n.owner === 'you' && <b className="font-semibold">Your move: </b>}
        {n.text}
      </span>
    </p>
  );
}

/** Their offer, our counter and the asking price on one line, so the gap is plain to see. */
export function PriceTrack({ d }: { d: Deal }) {
  const theirs = [...d.offers].reverse().find((o) => o.by === 'customer')?.amount;
  // Our side: the agreed price, else our last counter. Without either there is nothing to show between offer and asking.
  const ours = d.agreedPrice ?? [...d.offers].reverse().find((o) => o.by === 'us')?.amount;
  const ask = d.listPrice;
  const points = [theirs, ours, ask].filter((v): v is number => v != null);
  const low = Math.min(...points) * 0.98;
  const high = Math.max(...points);
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - low) / (high - low || 1)) * 100))}%`;
  return (
    <>
      <div className="relative my-2 h-1.5 rounded-full bg-slate-200">
        {theirs != null && <span className="absolute inset-y-0 rounded-full bg-amber-200" style={/* scan-ok: track spans their offer to our price */ { left: at(theirs), width: `calc(${at(ours ?? ask)} - ${at(theirs)})` }} />}
        {theirs != null && <Dot left={at(theirs)} className="bg-blue-600" />}
        {ours != null && <Dot left={at(ours)} className="bg-amber-600" />}
        <Dot left={at(ask)} className="bg-slate-500" />
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
        {theirs != null && (
          <span>
            <b className="font-semibold text-blue-700">{formatINR(theirs)}</b> offer
          </span>
        )}
        {ours != null && (
          <span>
            <b className="font-semibold text-amber-700">{formatINR(ours)}</b> {d.agreedPrice ? 'agreed' : 'counter'}
          </span>
        )}
        <span>
          <b className="font-semibold text-slate-700">{formatINR(ask)}</b> asking
        </span>
      </p>
    </>
  );
}

function Dot({ left, className }: { left: string; className: string }) {
  return <span className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${className}`} style={/* scan-ok: position on the price track */ { left }} />;
}
