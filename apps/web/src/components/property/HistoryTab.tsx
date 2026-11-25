import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Camera, FileText, Handshake, History, IndianRupee, Pencil, Sparkles, ToggleRight, Users } from 'lucide-react';
import { Card, EmptyState } from '../ui';
import { usePropertyHistory, type HistoryKind } from './data';

const KIND: Record<HistoryKind, { label: string; icon: typeof Pencil; tone: string }> = {
  details: { label: 'Details', icon: Pencil, tone: 'bg-slate-100 text-slate-600' },
  price: { label: 'Price', icon: IndianRupee, tone: 'bg-amber-50 text-amber-700' },
  status: { label: 'Status', icon: ToggleRight, tone: 'bg-sky-50 text-sky-700' },
  documents: { label: 'Documents', icon: FileText, tone: 'bg-emerald-50 text-emerald-700' },
  photos: { label: 'Photos', icon: Camera, tone: 'bg-pink-50 text-pink-700' },
  buyers: { label: 'Buyers', icon: Users, tone: 'bg-ai-50 text-ai-700' },
  deal: { label: 'Deals', icon: Handshake, tone: 'bg-brand-50 text-brand-700' },
};

const dayOf = (at: string) => new Date(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Changes to the property and what happened with buyers, newest first. */
export function HistoryTab({ id }: { id: string }) {
  const h = usePropertyHistory(id);
  const [kind, setKind] = useState<HistoryKind | null>(null);
  const items = h.data ?? [];
  const kinds = (Object.keys(KIND) as HistoryKind[]).filter((k) => items.some((i) => i.kind === k));
  const shown = kind ? items.filter((i) => i.kind === kind) : items;
  const days = shown.reduce<{ day: string; list: typeof shown }[]>((acc, i) => {
    const d = dayOf(i.at);
    const last = acc.at(-1);
    if (last?.day === d) last.list.push(i);
    else acc.push({ day: d, list: [i] });
    return acc;
  }, []);

  if (h.isLoading) return <p className="text-sm text-slate-400">Loading history…</p>;
  if (!items.length) return <EmptyState icon={<History className="h-5 w-5" />} title="Nothing yet" body="Changes and buyer activity will show here." />;

  return (
    <Card className="rounded-3xl p-5">
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip on={!kind} onClick={() => setKind(null)}>
          All · {items.length}
        </Chip>
        {kinds.map((k) => {
          const Icon = KIND[k].icon;
          return (
            <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}>
              <Icon className="h-3.5 w-3.5" /> {KIND[k].label} · {items.filter((i) => i.kind === k).length}
            </Chip>
          );
        })}
      </div>
      <div className="space-y-5">
        {days.map((g) => (
          <section key={g.day}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{g.day}</p>
            <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-slate-100">
              {g.list.map((i) => {
                const k = KIND[i.kind];
                const Icon = k.icon;
                return (
                  <li key={i.id} className="relative flex gap-3">
                    <span className={clsx('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white', k.tone)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 pt-1">
                      <span className="block text-sm text-slate-800">
                        {i.leadId ? (
                          <Link to={`/leads/${i.leadId}`} className="hover:text-brand-800">
                            {i.text}
                          </Link>
                        ) : (
                          i.text
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        {new Date(i.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        {i.by && ` · ${i.by}`}
                        {i.viaAI && (
                          <span className="inline-flex items-center gap-0.5 text-ai-600">
                            · <Sparkles className="h-3 w-3" /> via assistant
                          </span>
                        )}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </Card>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={clsx('flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition', on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
      {children}
    </button>
  );
}
