import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, ChevronRight, RotateCcw, TrendingDown, XCircle } from 'lucide-react';
import { CALL_OUTCOMES, LOST_REASONS, OPEN_STAGES, STAGE_META, relativeDay, type Stage } from '@estate/shared';
import { api, ApiError, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { STAGE_TONE, TEMP_DOT, type Lead } from '../lib/leads';
import { priceLabel, type Property } from '../lib/property';
import { Avatar, Badge, Button, Card, ErrorNote, Input, Modal, PageLoader, Textarea } from '../components/ui';
import { useToast } from '../components/toast';
import { leadSlots, views } from '../slots-leads';

type Column = { stage: Stage; label: string; entry: string; leads: Lead[] };
type Need = 'conversation' | 'requirement' | 'visit' | 'property' | 'reason' | 'booking' | 'reopen';

function useMove(onNeed: (lead: Lead, to: Stage, need: Need, message: string) => void) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ lead, to, extra }: { lead: Lead; to: Stage; extra?: object }) => api.post<{ lead: Lead }>(`/pipeline/move/${lead.id}`, { to, ...extra }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['board'] });
      void qc.invalidateQueries({ queryKey: ['lead', r.lead.id] });
      void qc.invalidateQueries({ queryKey: ['timeline', r.lead.id] });
      void qc.invalidateQueries({ queryKey: ['insights'] });
      toast(`${r.lead.name} → ${STAGE_META[r.lead.stage].label}`);
    },
    onError: (e, v) => {
      if (e instanceof ApiError && e.status === 422) onNeed(v.lead, v.to, (e.details as { need: Need }).need, e.message);
      else toast(e instanceof Error ? e.message : 'Could not move', 'error');
    },
  });
}

/** The pipeline as a board: drag a card to move it; if something is missing, it asks for exactly that. */
export function PipelineBoard({ owner, q }: { owner: string; q: string }) {
  const { can } = useAuth();
  const [gate, setGate] = useState<{ lead: Lead; to: Stage; need: Need; message: string } | null>(null);
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const b = useQuery({ queryKey: ['board', owner, q], queryFn: () => api.get<{ columns: Column[] }>(`/pipeline/board${qs({ owner, q })}`) });
  const move = useMove((lead, to, need, message) => setGate({ lead, to, need, message }));
  if (b.isLoading) return <PageLoader />;
  const cols = b.data?.columns ?? [];
  return (
    <>
      <Health owner={owner} />
      <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        {cols.map((c) => {
          const closed = c.stage === 'booked' || c.stage === 'lost';
          return (
            <div
              key={c.stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(c.stage);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragging && dragging.stage !== c.stage) {
                  if (c.stage === 'lost') setGate({ lead: dragging, to: 'lost', need: 'reason', message: 'Why was it lost?' });
                  else move.mutate({ lead: dragging, to: c.stage });
                }
                setDragging(null);
              }}
              className={clsx('flex w-[272px] shrink-0 flex-col rounded-2xl p-2 transition', over === c.stage ? 'bg-brand-50 ring-2 ring-brand-300' : closed ? 'bg-slate-100/60' : 'bg-slate-100')}
            >
              <div className="flex items-center justify-between px-2 pb-2 pt-1" title={c.entry}>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  {c.label}
                  <span className="rounded-full bg-white px-1.5 text-xs font-medium text-slate-500">{c.leads.length}</span>
                </span>
                {closed && <span className="text-[10px] text-slate-400">last 30 days</span>}
              </div>
              <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto">
                {c.leads.map((l) => (
                  <div key={l.id} draggable={!closed || c.stage === 'lost'} onDragStart={() => setDragging(l)} onDragEnd={() => setDragging(null)} className={clsx('cursor-grab active:cursor-grabbing', dragging?.id === l.id && 'opacity-40')}>
                    <BoardCard l={l} showOwner={can('lead.viewAll')} />
                  </div>
                ))}
                {!c.leads.length && <p className="px-2 py-6 text-center text-xs text-slate-400">{c.entry}</p>}
              </div>
            </div>
          );
        })}
      </div>
      {gate && <MoveDialog {...gate} onClose={() => setGate(null)} onRetry={(extra) => move.mutateAsync({ lead: gate.lead, to: gate.to, extra }).then(() => setGate(null))} />}
    </>
  );
}

function BoardCard({ l, showOwner }: { l: Lead; showOwner: boolean }) {
  return (
    <Link to={`/leads/${l.id}`} className="block rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm transition hover:shadow-card">
      <div className="flex items-center gap-2">
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', TEMP_DOT[l.temperature])} />
        <p className="truncate text-sm font-medium text-slate-900">{l.name}</p>
        {showOwner && <span className="ml-auto">{l.ownerName ? <Avatar name={l.ownerName} size="sm" /> : <Badge tone="amber">Unassigned</Badge>}</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{l.summary}</p>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        {l.nextAction?.dueAt ? <span className={l.overdue ? 'font-medium text-rose-600' : 'text-slate-600'}>{l.nextAction.title ?? l.nextAction.type} · {relativeDay(l.nextAction.dueAt)}</span> : l.stage !== 'lost' && l.stage !== 'booked' ? <span className="text-amber-700">No next step</span> : <span className="text-slate-400">{l.lostReason}</span>}
        {OPEN_STAGES.includes(l.stage) && <span className={l.stale ? 'font-medium text-rose-600' : 'text-slate-400'}>{l.daysInStage}d</span>}
      </div>
    </Link>
  );
}

/** Asks for exactly what a move needs: a reason, a property, the first conversation… */
export function MoveDialog({ lead, to, need, message, onClose, onRetry }: { lead: Lead; to: Stage; need: Need; message: string; onClose: () => void; onRetry: (extra?: object) => Promise<unknown> }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('Interested');
  const [search, setSearch] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const props = useQuery({
    queryKey: ['props-pick', search, lead.id],
    queryFn: () => api.get<{ items: Property[] }>(`/properties${qs({ q: search || lead.summary.replace(/·/g, ' '), availability: ['available', 'held'], limit: 8 })}`),
    enabled: need === 'property',
  });
  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null);
      await fn();
    } catch (e) {
      setErr(e);
    }
  };
  const logAndMove = () =>
    run(async () => {
      await api.post(`/leads/${lead.id}/log`, { type: 'call', outcome, notes: note || undefined });
      void qc.invalidateQueries({ queryKey: ['timeline', lead.id] });
      await onRetry();
    });
  return (
    <Modal open onClose={onClose} title={need === 'reason' ? `Close ${lead.name} as lost` : `Move ${lead.name} to ${STAGE_META[to].label}`}>
      <div className="space-y-3">
        {need !== 'reason' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
        {need === 'reason' && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {LOST_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} className={clsx('rounded-full border px-2.5 py-1 text-xs', reason === r ? 'border-rose-500 bg-rose-600 text-white' : 'border-slate-200 text-slate-600')}>
                  {r}
                </button>
              ))}
            </div>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember, e.g. bought in Vadapalani for 68 L" />
            <p className="text-xs text-slate-500">Their planned follow-ups are cancelled. If they come back, their history is waiting.</p>
            <Button variant="danger" className="w-full" disabled={!reason} onClick={() => run(() => onRetry({ reason, note: note || undefined }))}>
              Close as lost
            </Button>
          </>
        )}
        {need === 'conversation' && (
          <>
            <p className="text-sm text-slate-600">Log how the first conversation went, and I'll move them.</p>
            <div className="flex flex-wrap gap-1.5">
              {CALL_OUTCOMES.slice(0, 3).map((o) => (
                <button key={o} onClick={() => setOutcome(o)} className={clsx('rounded-full border px-2.5 py-1 text-xs', outcome === o ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                  {o}
                </button>
              ))}
            </div>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said" />
            <Button variant="primary" className="w-full" onClick={logAndMove}>
              Log call and move
            </Button>
          </>
        )}
        {need === 'property' && (
          <>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a property, code or locality" />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {props.data?.items.map((p) => (
                <button key={p.id} onClick={() => run(() => onRetry({ propertyId: p.id }))} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                  <span className="truncate">{p.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{priceLabel(p)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {(need === 'requirement' || need === 'visit') && (
          <Link to={`/leads/${lead.id}`} onClick={onClose}>
            <Button variant="primary" className="w-full" icon={<ArrowRight className="h-4 w-4" />}>
              {need === 'visit' ? 'Open their page to schedule the visit' : 'Open their page to fill it in'}
            </Button>
          </Link>
        )}
        {need === 'booking' && <p className="text-sm text-slate-600">Open the deal on their page and confirm the booking there, with the booking amount and payment plan.</p>}
        <ErrorNote error={err} />
      </div>
    </Modal>
  );
}

/** One line of truth about the pipeline: conversion, the leakiest step, what's stuck. */
function Health({ owner }: { owner: string }) {
  const i = useQuery({
    queryKey: ['insights', owner],
    queryFn: () =>
      api.get<{ total: number; booked: number; overallRate: number; funnel: { label: string; count: number }[]; weakest: { from: string; to: string; rate: number } | null; stuck: { label: string; stuck: number; open: number }[]; lostReasons: { reason: string; count: number }[] }>(
        `/pipeline/insights${qs({ owner: owner && owner !== 'none' ? owner : undefined })}`,
      ),
  });
  if (!i.data) return null;
  const d = i.data;
  const max = Math.max(1, ...d.funnel.map((f) => f.count));
  const stuck = d.stuck.filter((s) => s.stuck);
  return (
    <Card className="grid gap-4 p-4 md:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-xs text-slate-500">
          Last 90 days · {d.total} leads · <b className="text-emerald-700">{d.booked} booked</b> ({d.overallRate}%)
        </p>
        <div className="mt-2 flex items-end gap-1.5">
          {d.funnel.map((f, idx) => (
            <div key={f.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold text-slate-800">{f.count}</span>
              <div className="w-full rounded-md bg-brand-600" style={{ height: `${8 + (f.count / max) * 44}px`, opacity: 0.35 + 0.65 * (1 - idx / d.funnel.length) }} />
              <span className="truncate text-[10px] text-slate-500">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        {d.weakest && (
          <p className="flex items-center gap-1.5 text-slate-700">
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Weakest step: <b>{d.weakest.from}</b> <ChevronRight className="h-3 w-3" /> <b>{d.weakest.to}</b> ({d.weakest.rate}%)
          </p>
        )}
        <p className="text-slate-700">{stuck.length ? `Stuck: ${stuck.map((s) => `${s.stuck} in ${s.label}`).join(', ')}` : 'Nothing stuck right now'}</p>
        {d.lostReasons.length > 0 && <p className="text-slate-500">Lost mostly to: {d.lostReasons.slice(0, 2).map((l) => `${l.reason.toLowerCase()} (${l.count})`).join(', ')}</p>}
      </div>
    </Card>
  );
}

/** On the lead page: where they are, and the obvious next move. */
function StageBar({ lead }: { lead: Lead }) {
  const [gate, setGate] = useState<{ to: Stage; need: Need; message: string } | null>(null);
  const move = useMove((_l, to, need, message) => setGate({ to, need, message }));
  const steps: Stage[] = ['new', 'contacted', 'qualified', 'visit', 'negotiation', 'booked'];
  const at = steps.indexOf(lead.stage);
  const next = at >= 0 && at < 4 ? steps[at + 1] : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <ol className="flex flex-1 items-center gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <button
                disabled={lead.stage === 'lost' || s === 'booked' || s === lead.stage}
                onClick={() => move.mutate({ lead, to: s })}
                title={STAGE_META[s].entry}
                className={clsx(
                  'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition',
                  s === lead.stage ? 'bg-brand-700 text-white' : i < at ? 'bg-brand-50 text-brand-800 hover:bg-brand-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                  lead.stage === 'lost' && 'opacity-50',
                )}
              >
                {STAGE_META[s].label}
              </button>
              {i < steps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
            </li>
          ))}
        </ol>
        {lead.stage === 'lost' ? (
          <Button size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => move.mutate({ lead, to: 'contacted' })}>
            Reopen
          </Button>
        ) : (
          <div className="flex gap-2">
            {next && (
              <Button size="sm" variant="primary" onClick={() => move.mutate({ lead, to: next })}>
                Move to {STAGE_META[next].label}
              </Button>
            )}
            {lead.stage !== 'booked' && (
              <Button size="sm" variant="ghost" className="text-rose-600" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setGate({ to: 'lost', need: 'reason', message: '' })}>
                Lost
              </Button>
            )}
          </div>
        )}
      </div>
      {lead.stage === 'lost' && lead.lostReason && (
        <p className="mt-2 text-xs text-rose-700">
          Lost: {lead.lostReason}
          {lead.lostNote && ` — ${lead.lostNote}`}
        </p>
      )}
      {lead.stale && lead.stage !== 'lost' && (
        <p className="mt-2 text-xs text-amber-700">
          {lead.daysInStage} days in {STAGE_META[lead.stage].label} — longer than usual. <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_META[lead.stage].entry}</Badge>
        </p>
      )}
      {gate && <MoveDialog lead={lead} {...gate} onClose={() => setGate(null)} onRetry={(extra) => move.mutateAsync({ lead, to: gate.to, extra }).then(() => setGate(null))} />}
    </div>
  );
}

views.board = PipelineBoard;
leadSlots.hero.push(StageBar);
