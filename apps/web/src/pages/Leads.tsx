import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlarmClock, CalendarX, Flame, Search, Shuffle, Sparkle, UserPlus, Users, X } from 'lucide-react';
import { LEAD_SOURCE_LABEL, OPEN_STAGES, STAGE_META, relativeDay, type Stage } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { STAGE_TONE, TEMP_DOT, prettyPhone, relLower, type Lead } from '../lib/leads';
import { PageHeader } from '../components/Layout';
import { Avatar, Badge, Button, Card, EmptyState, PageLoader, Segmented, Select } from '../components/ui';
import { FilterChip } from './Properties';
import { NewLead } from '../components/NewLead';
import { useToast } from '../components/toast';
import { useAssistantPage } from '../ai/assistant';
import { views } from '../slots-leads';

export function Leads() {
  const { can } = useAuth();
  const users = useUsers();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const manager = can('lead.viewAll');
  const view = params.get('view') ?? 'list';
  const owner = params.get('owner') ?? '';
  const stages = (params.get('stages')?.split(',').filter(Boolean) ?? []) as Stage[];
  // ?attention=1 is the older link form of the "Needs attention" focus.
  const focus = (params.get('focus') ?? (params.get('attention') === '1' ? 'attention' : '')) as FocusKey | '';
  const q = params.get('q') ?? '';

  useAssistantPage({
    page: 'Leads',
    suggestions: manager
      ? ['Which leads need attention today?', 'Who has overdue follow-ups?', 'Where are deals getting stuck?']
      : ['Which of my leads need attention?', 'Show my hot leads', 'Show my leads without follow-ups'],
  });

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  const list = useQuery({
    queryKey: ['leads', { q, owner, stages }],
    queryFn: () =>
      api.get<{ items: Lead[]; total: number }>(
        `/leads${qs({ q, ownerId: owner || undefined, stages: stages.length ? stages : undefined, open: !stages.length && !q ? true : undefined, limit: 300 })}`,
      ),
  });
  const all = list.data?.items ?? [];
  const items = focus ? all.filter(FOCUS[focus].test) : all;

  const spread = useMutation({
    mutationFn: () => api.post<{ assigned: { lead: string; owner: string }[] }>('/leads/assign-evenly'),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      toast(`Assigned ${r.assigned.length} leads across the team`);
    },
  });

  const unassignedCount = useQuery({
    queryKey: ['leads', 'unassigned-count'],
    queryFn: () => api.get<{ total: number }>('/leads?ownerId=none&open=true&limit=1'),
    enabled: manager,
  });
  const BoardView = views.board;

  return (
    <>
      <PageHeader
        title={manager ? 'Leads' : 'My leads'}
        subtitle="Every customer, from first enquiry to booking."
        actions={
          <>
            {manager && !!unassignedCount.data?.total && (
              <Button icon={<Shuffle className="h-4 w-4" />} loading={spread.isPending} onClick={() => spread.mutate()} title="Each goes to the executive with the fewest open leads">
                Assign {unassignedCount.data.total} unassigned evenly
              </Button>
            )}
            <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              New lead
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {BoardView && (
          <Segmented
            value={view}
            onChange={(v) => update({ view: v === 'list' ? null : v })}
            options={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Pipeline' },
            ]}
          />
        )}
        <form
          className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: draft.trim() || null });
          }}
        >
          <Search className="h-4 w-4 text-slate-400" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Name, phone or locality" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {q && (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                update({ q: null });
              }}
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </form>
        {manager && (
          <Select className="w-auto py-2" value={owner} onChange={(e) => update({ owner: e.target.value || null })}>
            <option value="">Everyone</option>
            <option value="none">Unassigned</option>
            {users.data
              ?.filter((u) => u.role !== 'admin')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
        )}
      </div>

      {view !== 'board' && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(FOCUS) as FocusKey[]).map((k) => {
            const f = FOCUS[k];
            const n = all.filter(f.test).length;
            const on = focus === k;
            return (
              <button
                key={k}
                onClick={() => update({ focus: on ? null : k, attention: null })}
                className={clsx('flex items-center gap-3 rounded-2xl border p-3 text-left transition', on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200/80 bg-white hover:border-slate-300')}
              >
                <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', on ? 'bg-white/15 text-white' : f.chip)}>{f.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xl font-semibold leading-tight">{list.data ? n : '–'}</span>
                  <span className={clsx('block truncate text-xs', on ? 'text-white/70' : 'text-slate-500')}>{f.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {view !== 'board' && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[...OPEN_STAGES, 'booked' as Stage, 'lost' as Stage].map((s) => (
            <FilterChip key={s} on={stages.includes(s)} onClick={() => update({ stages: (stages.includes(s) ? stages.filter((x) => x !== s) : [...stages, s]).join(',') || null })}>
              {STAGE_META[s].label}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="mt-4">
        {view === 'board' && BoardView ? (
          <BoardView owner={owner} q={q} />
        ) : list.isLoading ? (
          <PageLoader />
        ) : !items.length ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title={focus ? `No one in “${FOCUS[focus].label}”` : 'No leads here'} body={focus === 'attention' ? 'Every open lead has a next step planned and is moving.' : 'Add a lead, or change the filters.'} action={<Button variant="primary" onClick={() => setAdding(true)}>New lead</Button>} />
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">
              {items.length} {stages.length || q ? '' : 'open '}lead{items.length === 1 ? '' : 's'}
              {focus && ` · ${FOCUS[focus].label.toLowerCase()}`}
            </p>
            <Card className="overflow-hidden rounded-3xl">
              <div className={clsx(ROW_GRID, 'hidden border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:grid')}>
                <span className="col-span-2">Customer</span>
                <span>Looking for</span>
                <span>Next step</span>
                <span className="text-right">{manager ? 'Owner' : 'Last spoke'}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((l) => (
                  <LeadRow key={l.id} l={l} showOwner={manager} />
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
      <NewLead open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

type FocusKey = 'attention' | 'hot' | 'noplan' | 'new';

/** Quick views over the open list, shown as counts above it. */
const FOCUS: Record<FocusKey, { label: string; icon: ReactNode; chip: string; test: (l: Lead) => boolean }> = {
  attention: { label: 'Needs attention', icon: <AlarmClock className="h-4 w-4" />, chip: 'bg-rose-50 text-rose-600', test: (l) => l.overdue || l.stale || (!l.nextAction && OPEN_STAGES.includes(l.stage)) },
  hot: { label: 'Hot', icon: <Flame className="h-4 w-4" />, chip: 'bg-orange-50 text-orange-600', test: (l) => l.temperature === 'hot' && OPEN_STAGES.includes(l.stage) },
  noplan: { label: 'No next step', icon: <CalendarX className="h-4 w-4" />, chip: 'bg-amber-50 text-amber-700', test: (l) => !l.nextAction && OPEN_STAGES.includes(l.stage) },
  new: { label: 'New this week', icon: <Sparkle className="h-4 w-4" />, chip: 'bg-sky-50 text-sky-600', test: (l) => Date.now() - new Date(l.createdAt).getTime() < 7 * 86_400_000 },
};

const ROW_GRID = 'grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_150px] gap-x-4';

/** One customer in the list: who, what they want, what's next, when we last spoke. */
export function LeadRow({ l, showOwner }: { l: Lead; showOwner?: boolean }) {
  const open = OPEN_STAGES.includes(l.stage);
  return (
    <Link to={`/leads/${l.id}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-slate-50 md:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_150px] md:gap-x-4">
      <div className="relative row-span-2 self-start md:row-span-1 md:self-center">
        <Avatar name={l.name} />
        <span className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', TEMP_DOT[l.temperature])} title={l.temperature} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-slate-900">{l.name}</p>
          <Badge tone={STAGE_TONE[l.stage]} className="shrink-0">
            {STAGE_META[l.stage].label}
          </Badge>
          {l.stale && <span className="hidden shrink-0 text-[11px] font-medium text-amber-700 lg:inline">{l.daysInStage}d</span>}
        </div>
        <p className="truncate text-xs text-slate-500 md:hidden">{l.summary}</p>
        <p className="hidden truncate text-xs text-slate-400 md:block">
          {prettyPhone(l.phone)} · {LEAD_SOURCE_LABEL[l.source]}
        </p>
      </div>
      <p className="hidden text-xs leading-relaxed text-slate-600 md:line-clamp-2">{l.summary || '—'}</p>
      <div className="min-w-0 text-xs">
        {l.nextAction?.dueAt ? (
          <p className={clsx('truncate', l.overdue ? 'font-medium text-rose-600' : 'text-slate-700')}>
            {l.nextAction.title ?? l.nextAction.type} · {relativeDay(l.nextAction.dueAt)}
          </p>
        ) : open ? (
          <p className="text-amber-700">No next step</p>
        ) : (
          <p className="text-slate-400">—</p>
        )}
      </div>
      <div className="hidden min-w-0 text-right text-xs md:block">
        {showOwner && <p className={clsx('truncate', l.ownerName ? 'text-slate-700' : 'font-medium text-amber-700')}>{l.ownerName ?? 'Unassigned'}</p>}
        <p className="truncate text-slate-400">{l.lastContactAt ? `spoke ${relLower(l.lastContactAt)}` : 'not spoken yet'}</p>
      </div>
    </Link>
  );
}
