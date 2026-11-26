import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Info } from 'lucide-react';
import { AVAILABILITY_LABEL, buyerTotal, formatINR, type Availability } from '@estate/shared';
import { priceLabel, type Property } from '../../lib/property';
import { Card } from '../ui';
import { RangeBar, StackedBar } from './visuals';
import { VERDICT, rateIn, useComparables } from './data';

/** The asking price, what the buyer really pays, and how it compares. */
export function PriceTab({ p }: { p: Property }) {
  const c = useComparables(p.id);
  const d = c.data;
  const sale = p.purpose === 'sale' && !!p.price;
  const costs = sale ? buyerTotal(p.price!) : null;
  const rate = d?.rate ?? (p.price && p.areaSqft ? Math.round(p.price / p.areaSqft) : null);
  // This property and each similar one, on one scale.
  const bars = d ? [...(rate ? [{ id: p.id, label: 'This property', sub: p.locality ?? '', rate, mine: true, open: false, availability: '' }] : []), ...d.items.map((i) => ({ id: i.id, label: i.title, sub: `${i.locality ?? ''} · ${i.areaSqft.toLocaleString('en-IN')} sq.ft`, rate: i.rate, mine: false, open: i.open, availability: i.availability }))].sort((a, b) => b.rate - a.rate) : [];
  const top = Math.max(1, ...bars.map((b) => b.rate));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Asking price</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{priceLabel(p)}</p>
          {rate && p.purpose === 'sale' && <p className="text-sm text-slate-500">{rateIn(p).format(rate)} per {rateIn(p).unit}</p>}
          {p.priceNegotiable && <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">Negotiable</span>}
        </Card>

        <Card className="rounded-3xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total for the buyer</p>
          {costs ? (
            <>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{formatINR(costs.total)}</p>
              <div className="mt-3">
                <StackedBar
                  parts={[
                    { label: 'Price', value: p.price!, tone: 'bg-brand-700', note: formatINR(p.price!) },
                    ...costs.parts.map((c, i) => ({ label: `${c.label} ${c.pct}%`, value: c.amount, tone: i === 0 ? 'bg-amber-400' : 'bg-ai-500', note: `+ ${formatINR(c.amount)}` })),
                  ]}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{p.purpose === 'sale' ? 'Add a price to see the total.' : 'Not shown for rent or lease.'}</p>
          )}
        </Card>

        <Card className={clsx('rounded-3xl p-5', d?.verdict === 'in_line' && 'bg-emerald-50/50', d?.verdict === 'above' && 'bg-amber-50/50', d?.verdict === 'below' && 'bg-sky-50/50')}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Market check{d?.stats ? ` · ${d.stats.count} similar` : ''}</p>
          {!d ? (
            <p className="mt-2 text-sm text-slate-400">Checking…</p>
          ) : d.stats ? (
            <>
              <p className="mt-1 text-lg font-semibold text-slate-900">{d.verdict ? VERDICT[d.verdict].label : 'Not enough to compare'}</p>
              <RangeBar min={d.stats.min} max={d.stats.max} value={rate} format={rateIn(p).format} className="mt-1" />
              <p className="text-[11px] text-slate-500">Typical: {rateIn(p).format(d.stats.median)}/{rateIn(p).unit}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{p.purpose === 'sale' ? 'No similar properties in our records yet.' : 'Market check is for properties for sale.'}</p>
          )}
        </Card>
      </div>

      {bars.length > 1 && (
        <Card className="rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-slate-900">₹ per sq.ft, side by side</h2>
          <p className="mb-4 text-xs text-slate-500">Same type and city, area within 25%, listed or sold. One unit per project.</p>
          <ul className="space-y-3">
            {bars.map((b) => (
              <li key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[14rem_minmax(0,1fr)_5.5rem]">
                <span className="min-w-0">
                  {b.open ? (
                    <Link to={`/properties/${b.id}`} className="block truncate text-sm text-slate-800 hover:text-brand-800">
                      {b.label}
                    </Link>
                  ) : (
                    <span className={clsx('block truncate text-sm', b.mine ? 'font-semibold text-slate-900' : 'text-slate-800')}>{b.label}</span>
                  )}
                  <span className="block truncate text-[11px] text-slate-400">
                    {b.sub}
                    {b.availability && b.availability !== 'available' && ` · ${AVAILABILITY_LABEL[b.availability as Availability]}`}
                  </span>
                </span>
                <span className="order-3 col-span-2 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
                  <span className={clsx('block h-full rounded-full', b.mine ? 'bg-brand-600' : 'bg-slate-300')} style={{ width: `${(b.rate / top) * 100}%` }} />
                </span>
                <span className={clsx('text-right text-sm tabular-nums', b.mine ? 'font-semibold text-slate-900' : 'text-slate-600')}>{rateIn(p).format(b.rate)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-3 rounded-2xl border-l-4 border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>
          Say it neutrally: never “bargain” or “best price” just because another seller asks more. The total is an estimate with Tamil Nadu rates; the final charges depend on the guideline value.
        </p>
      </div>
    </div>
  );
}
