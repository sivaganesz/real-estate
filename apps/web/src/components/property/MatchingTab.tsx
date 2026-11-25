import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Send, Users } from 'lucide-react';
import { STAGE_META } from '@estate/shared';
import { useAuth } from '../../lib/auth';
import { TEMP_DOT } from '../../lib/leads';
import type { Property } from '../../lib/property';
import { Badge, Card, EmptyState } from '../ui';
import { FIT, Reasons, ShareDialog, type Fit } from '../../features/matching';
import { canMatch, useBuyers, type Buyer } from './data';

const FIT_COLOR: Record<Fit, string> = { strong: 'bg-emerald-500', good: 'bg-brand-400', partial: 'bg-amber-300' };
const ORDER: Fit[] = ['strong', 'good', 'partial'];

/** Open customers this property suits, best first, with why, and a way to send it. */
export function MatchingTab({ p }: { p: Property }) {
  const { can } = useAuth();
  const q = useBuyers(p);
  const [fit, setFit] = useState<Fit | null>(null);
  const [sending, setSending] = useState<Buyer['lead'] | null>(null);

  if (!canMatch(p))
    return <EmptyState icon={<Users className="h-5 w-5" />} title="Not matching right now" body={p.listing !== 'live' ? 'Customers are matched once the property is live.' : 'This property is booked or sold, so it is no longer offered.'} />;

  const items = q.data ?? [];
  const count = (f: Fit) => items.filter((b) => b.fit === f).length;
  const shown = fit ? items.filter((b) => b.fit === fit) : items;

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{q.data ? items.length : '…'}</p>
            <p className="text-sm text-slate-500">{items.length === 1 ? 'customer fits' : 'customers fit'} this property{can('lead.viewAll') ? '' : ' among yours'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ORDER.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={fit === f}
                onClick={() => setFit(fit === f ? null : f)}
                className={clsx('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition', fit === f ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                <span className={clsx('h-2 w-2 rounded-full', FIT_COLOR[f])} /> {FIT[f].label} · {count(f)}
              </button>
            ))}
          </div>
        </div>
        {items.length > 0 && (
          <div className="mt-4 flex h-3 gap-1 overflow-hidden rounded-full">
            {ORDER.map((f) => (count(f) ? <span key={f} className={clsx('h-full', FIT_COLOR[f])} style={{ flex: count(f) }} title={`${FIT[f].label}: ${count(f)}`} /> : null))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Only open customers, after the hard checks (type, purpose, city, budget). A strong fit meets everything they asked for.</p>
      </Card>

      {q.isLoading ? (
        <p className="text-sm text-slate-400">Finding customers…</p>
      ) : !shown.length ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title={fit ? `No ${FIT[fit].label.toLowerCase()} customers` : 'No open customer fits this one yet'} body="New enquiries are matched automatically as they come in." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((b) => (
            <li key={b.lead.id}>
              <Card className="flex h-full flex-col rounded-3xl p-4">
                <div className="flex items-start gap-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                    {b.lead.name.charAt(0)}
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white', TEMP_DOT[b.lead.temperature])} title={b.lead.temperature} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link to={`/leads/${b.lead.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-800">
                      {b.lead.name}
                    </Link>
                    <span className="block truncate text-xs text-slate-500">
                      {STAGE_META[b.lead.stage].label} · <span className="capitalize">{b.lead.temperature}</span>
                      {can('lead.viewAll') && b.lead.owner ? ` · ${b.lead.owner}` : ''}
                    </span>
                  </span>
                  <Badge tone={FIT[b.fit].tone}>{FIT[b.fit].label}</Badge>
                </div>
                <div className="mt-3 flex-1 rounded-2xl bg-slate-50 px-3 py-2">
                  <Reasons reasons={b.reasons} max={4} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setSending(b.lead)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800">
                    <Send className="h-3.5 w-3.5" /> Send to {b.lead.name.split(' ')[0]}
                  </button>
                  <Link to={`/leads/${b.lead.id}`} className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Open customer
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {sending && <ShareDialog lead={sending} propertyIds={[p.id]} onClose={() => setSending(null)} />}
    </div>
  );
}
