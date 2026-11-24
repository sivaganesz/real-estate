import clsx from 'clsx';
import { ArrowRight, CircleSlash } from 'lucide-react';
import { useAuth } from '../lib/auth';
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
