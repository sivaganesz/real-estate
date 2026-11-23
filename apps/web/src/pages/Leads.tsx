import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlarmClock, Search, Shuffle, UserPlus, Users, X } from 'lucide-react';
import { LEAD_SOURCE_LABEL, OPEN_STAGES, STAGE_META, relativeDay, type Stage } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { STAGE_TONE, TEMP_DOT, relLower, type Lead } from '../lib/leads';
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
  const attention = params.get('attention') === '1';
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
    queryKey: ['leads', { q, owner, stages, attention }],
    queryFn: () =>
      api.get<{ items: Lead[]; total: number }>(
        `/leads${qs({ q, ownerId: owner || undefined, stages: stages.length ? stages : undefined, open: !stages.length && !q ? true : undefined, limit: 300 })}`,
      ),
    select: (d) => ({ ...d, items: attention ? d.items.filter((l) => l.overdue || l.stale || (!l.nextAction && OPEN_STAGES.includes(l.stage))) : d.items }),
  });

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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <FilterChip on={attention} onClick={() => update({ attention: attention ? null : '1' })}>
            <span className="inline-flex items-center gap-1">
              <AlarmClock className="h-3 w-3" /> Needs attention
            </span>
          </FilterChip>
          <span className="mx-1 h-4 w-px bg-slate-200" />
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
        ) : !list.data?.items.length ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title={attention ? 'Nobody needs attention right now' : 'No leads here'} body={attention ? 'Every open lead has a next step planned and is moving.' : 'Add a lead, or change the filters.'} action={<Button variant="primary" onClick={() => setAdding(true)}>New lead</Button>} />
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">
              {list.data.items.length} {stages.length || q ? '' : 'open '}lead{list.data.items.length === 1 ? '' : 's'}
            </p>
            <Card className="divide-y divide-slate-100">
              {list.data.items.map((l) => (
                <LeadRow key={l.id} l={l} showOwner={manager} />
              ))}
            </Card>
          </>
        )}
      </div>
      <NewLead open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

/** One customer in a list. `compact` is for narrow side columns: details move under the name. */
export function LeadRow({ l, showOwner, right, compact }: { l: Lead; showOwner?: boolean; right?: ReactNode; compact?: boolean }) {
  return (
    <Link to={`/leads/${l.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
      <div className="relative">
        <Avatar name={l.name} />
        <span className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', TEMP_DOT[l.temperature])} title={l.temperature} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-slate-900">{l.name}</p>
          <Badge tone={STAGE_TONE[l.stage]} className="shrink-0">{STAGE_META[l.stage].label}</Badge>
          {l.stale && !compact && <Badge tone="amber" className="shrink-0">{l.daysInStage}d in stage</Badge>}
        </div>
        <p className="truncate text-xs text-slate-500">{l.summary}</p>
        {compact && (
          <p className="truncate text-xs text-slate-400">
            {showOwner && `${l.ownerName ?? 'Unassigned'} · `}
            {LEAD_SOURCE_LABEL[l.source]}
            {l.stale && ` · ${l.daysInStage}d waiting`}
          </p>
        )}
      </div>
      <div className={clsx('shrink-0 text-right text-xs', compact ? 'hidden' : 'hidden sm:block')}>
        {l.nextAction?.dueAt ? (
          <p className={l.overdue ? 'font-medium text-rose-600' : 'text-slate-700'}>
            {l.nextAction.title ?? l.nextAction.type} · {relativeDay(l.nextAction.dueAt)}
          </p>
        ) : l.stage !== 'lost' && l.stage !== 'booked' ? (
          <p className="text-amber-700">No next step</p>
        ) : null}
        <p className="text-slate-400">
          {showOwner && (l.ownerName ?? 'Unassigned')}
          {showOwner && ' · '}
          {l.lastContactAt ? `spoke ${relLower(l.lastContactAt)}` : LEAD_SOURCE_LABEL[l.source]}
        </p>
      </div>
      {right}
    </Link>
  );
}
