import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Clock, Pencil, Percent, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { ROLE_LABEL, ROLES, PERMISSIONS, PERMISSION_INFO, type Permission, type Role } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth, useUsers, type User } from '../lib/auth';
import { PageHeader } from '../components/Layout';
import { Avatar, Badge, Button, ErrorNote, Field, Input, Modal, PageLoader, Select } from '../components/ui';
import { useToast } from '../components/toast';
import { useAssistantPage } from '../ai/assistant';

type OrgSettings = { companyName: string; discountLimitPct: { executive: number; manager: number }; holdDays: number };

const ROLE_TONE: Record<Role, 'ai' | 'brand' | 'slate'> = { admin: 'ai', manager: 'brand', executive: 'slate' };

/** Settings: four numbers, the team beside the approval rules, then what each role can do. */
export function Settings() {
  useAssistantPage({ page: 'Settings' });
  const users = useUsers();
  const { user: me } = useAuth();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<OrgSettings>('/settings') });
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const all = users.data ?? [];
  const managers = all.filter((u) => u.role === 'manager');
  const active = all.filter((u) => u.active);
  const byRole = (r: Role) => all.filter((u) => u.role === r).length;
  const order: Record<Role, number> = { admin: 0, manager: 1, executive: 2 };
  const people = [...all].sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  const nameOf = (id: string | null) => all.find((u) => u.id === id)?.name;
  const s = settings.data;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your team, the price approval rules, and what each role can do."
        actions={
          <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Add person
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Users className="h-4 w-4" />} label="People" tone="text-brand-700" glow="bg-brand-100/60" value={users.data ? active.length : '–'} hint={users.data ? `active${all.length > active.length ? ` · ${all.length - active.length} switched off` : ''}` : ' '} />
        <Tile icon={<ShieldCheck className="h-4 w-4" />} label="By role" tone="text-ai-700" glow="bg-ai-100/60" value={users.data ? byRole('executive') : '–'} hint={users.data ? `sales executives · ${byRole('manager')} manager${byRole('manager') === 1 ? '' : 's'} · ${byRole('admin')} admin${byRole('admin') === 1 ? '' : 's'}` : ' '} />
        <Tile icon={<Percent className="h-4 w-4" />} label="Discount limits" tone="text-amber-700" glow="bg-amber-100/70" value={s ? `${s.discountLimitPct.executive}% · ${s.discountLimitPct.manager}%` : '–'} hint="executive · manager, without asking" />
        <Tile icon={<Clock className="h-4 w-4" />} label="Unit hold" tone="text-slate-700" glow="bg-slate-100" value={s ? `${s.holdDays} day${s.holdDays === 1 ? '' : 's'}` : '–'} hint="a unit is held for a buyer" />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
            <p className="text-sm font-semibold text-slate-900">Team</p>
            <p className="text-xs text-slate-500">{all.length} people</p>
          </div>
          {users.isLoading ? (
            <div className="p-6">
              <PageLoader />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {people.map((u) => (
                <li key={u.id} className={clsx('flex items-center gap-3 px-5 py-3', !u.active && 'opacity-60')}>
                  <Avatar name={u.name} soft />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {u.name} {u.id === me?.id && <span className="font-normal text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {u.email}
                      {u.phone && ` · ${u.phone}`}
                    </p>
                    {u.role === 'executive' && nameOf(u.managerId) && <p className="truncate text-[11px] text-slate-400">Reports to {nameOf(u.managerId)}</p>}
                  </div>
                  {!u.active && <Badge tone="red">Switched off</Badge>}
                  <Badge tone={ROLE_TONE[u.role]} className="hidden sm:inline-flex">
                    {ROLE_LABEL[u.role]}
                  </Badge>
                  <button onClick={() => setEditing(u)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label={`Edit ${u.name}`} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ApprovalRules />
      </div>

      <Permissions />
      {editing && <UserModal user={editing === 'new' ? null : editing} managers={managers} onClose={() => setEditing(null)} />}
    </>
  );
}

function Tile({ icon, label, value, hint, tone, glow }: { icon: ReactNode; label: string; value: ReactNode; hint: string; tone: string; glow: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
      <span className={clsx('pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full', glow)} />
      <span className={clsx('relative flex items-center gap-1.5 text-sm font-medium', tone)}>
        {icon}
        {label}
      </span>
      <span className="relative mt-1 block truncate text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</span>
      <span className="relative mt-0.5 block truncate text-xs text-slate-500">{hint}</span>
    </div>
  );
}

/** Every permission by role, grouped, with clear yes and no marks. */
function Permissions() {
  const groups = [...new Set(Object.values(PERMISSION_INFO).map((i) => i.group))];
  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <p className="text-sm font-semibold text-slate-900">What each role can do</p>
        <p className="text-xs text-slate-500">Checked on the server for every action; screens only hide what a role can't use.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
              <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Can they…</th>
              {ROLES.map((r) => (
                <th key={r} className="w-24 py-2.5 text-center sm:w-36">
                  <Badge tone={ROLE_TONE[r]}>{ROLE_LABEL[r]}</Badge>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group}>
              <tr>
                <th colSpan={ROLES.length + 1} className="px-5 pb-1.5 pt-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {group}
                </th>
              </tr>
              {(Object.entries(PERMISSIONS) as [Permission, readonly Role[]][])
                .filter(([k]) => PERMISSION_INFO[k].group === group)
                .map(([k, roles]) => (
                  <tr key={k} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-5 py-2 text-slate-700">{PERMISSION_INFO[k].label}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="text-center">
                        {roles.includes(r) ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-label="Yes">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="text-slate-300" aria-label="No">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

function UserModal({ user, managers, onClose }: { user: User | null; managers: User[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    role: (user?.role ?? 'executive') as Role,
    managerId: user?.managerId ?? managers[0]?.id ?? '',
    password: '',
    active: user?.active ?? true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, managerId: form.role === 'executive' ? form.managerId || null : null, password: form.password || undefined };
      return user ? api.patch(`/users/${user.id}`, body) : api.post('/users', body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast(user ? 'Saved' : `${form.name} added`);
      onClose();
    },
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `Edit ${user.name}` : 'Add a person'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Select value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          {form.role === 'executive' && (
            <Field label="Reports to">
              <Select value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label={user ? 'New password (leave empty to keep)' : 'Password'} hint="At least 8 characters">
          <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
        </Field>
        {user && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Active (can sign in)
          </label>
        )}
        <ErrorNote error={save.error} />
      </div>
    </Modal>
  );
}

/** Who may agree how much discount without asking, shown as a ladder; and how long holds last. */
function ApprovalRules() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api.get<OrgSettings>('/settings') });
  const [f, setF] = useState<{ executive: string; manager: string; holdDays: string } | null>(null);
  const cur = f ?? (q.data ? { executive: String(q.data.discountLimitPct.executive), manager: String(q.data.discountLimitPct.manager), holdDays: String(q.data.holdDays) } : null);
  const save = useMutation({
    mutationFn: () => api.patch('/settings', { discountLimitPct: { executive: Number(cur!.executive), manager: Number(cur!.manager) }, holdDays: Number(cur!.holdDays) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      toast('Approval rules saved');
      setF(null);
    },
  });
  if (!cur) return <section className="h-64 animate-pulse rounded-3xl bg-white shadow-card" />;
  const exec = Math.max(0, Number(cur.executive) || 0);
  const mgr = Math.max(exec, Number(cur.manager) || 0);
  // The ladder runs to a little past the manager's limit, so the admin band always shows.
  const top = Math.max(mgr * 1.6, mgr + 3, 5);
  const pct = (v: number) => `${(v / top) * 100}%`;
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <p className="text-sm font-semibold text-slate-900">Price approvals and holds</p>
        <p className="text-xs text-slate-500">Who agrees a discount, by how big it is.</p>
      </div>
      <div className="px-5 py-4">
        <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={`Up to ${exec}% the executive agrees; up to ${mgr}% a manager approves; above that an admin`}>
          <span className="h-full bg-emerald-500" style={/* scan-ok: band width is the limit */ { width: pct(exec) }} />
          <span className="h-full border-l-2 border-white bg-amber-400" style={/* scan-ok: band width is the limit */ { width: pct(mgr - exec) }} />
          <span className="h-full flex-1 border-l-2 border-white bg-ai-500" />
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="flex-1 text-slate-700">Up to {exec}% off</span>
            <span className="text-xs text-slate-500">the executive agrees</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
            <span className="flex-1 text-slate-700">
              {exec}% to {mgr}% off
            </span>
            <span className="text-xs text-slate-500">a manager approves</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ai-500" />
            <span className="flex-1 text-slate-700">Above {mgr}% off</span>
            <span className="text-xs text-slate-500">an admin approves</span>
          </li>
        </ul>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-slate-100 px-5 py-4">
        <Field label="Executive (%)">
          <Input type="number" step="0.5" min={0} max={10} value={cur.executive} onChange={(e) => setF({ ...cur, executive: e.target.value })} />
        </Field>
        <Field label="Manager (%)">
          <Input type="number" step="0.5" min={0} max={25} value={cur.manager} onChange={(e) => setF({ ...cur, manager: e.target.value })} />
        </Field>
        <Field label="Hold (days)">
          <Input type="number" min={1} max={30} value={cur.holdDays} onChange={(e) => setF({ ...cur, holdDays: e.target.value })} />
        </Field>
      </div>
      <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <Button size="sm" variant="primary" disabled={!f} loading={save.isPending} onClick={() => save.mutate()}>
          Save rules
        </Button>
        {f && (
          <button className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={() => setF(null)}>
            Undo changes
          </button>
        )}
        <ErrorNote error={save.error} />
      </div>
    </section>
  );
}
