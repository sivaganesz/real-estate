import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { ROLE_LABEL, ROLES, PERMISSIONS, type Role } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth, useUsers, type User } from '../lib/auth';
import { PageHeader } from '../components/Layout';
import { Avatar, Badge, Button, Card, ErrorNote, Field, Input, Modal, PageLoader, SectionTitle, Select } from '../components/ui';
import { useToast } from '../components/toast';
import { useAssistantPage } from '../ai/assistant';

export function Settings() {
  useAssistantPage({ page: 'Settings' });
  const users = useUsers();
  const { user: me } = useAuth();
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const managers = users.data?.filter((u) => u.role === 'manager') ?? [];

  return (
    <>
      <PageHeader title="Settings" subtitle="People and what each role can do." />
      <Card className="p-5">
        <SectionTitle
          action={
            <Button size="sm" variant="primary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')}>
              Add person
            </Button>
          }
        >
          Team
        </SectionTitle>
        {users.isLoading ? (
          <PageLoader />
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.data?.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-3">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {u.name} {u.id === me?.id && <span className="text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {u.email} · {u.phone}
                  </p>
                </div>
                <Badge tone={u.role === 'admin' ? 'ai' : u.role === 'manager' ? 'brand' : 'slate'}>{ROLE_LABEL[u.role]}</Badge>
                {!u.active && <Badge tone="red">Inactive</Badge>}
                <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ApprovalRules />

      <Card className="mt-5 overflow-x-auto p-5">
        <SectionTitle>What each role can do</SectionTitle>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="pb-2 font-medium">Permission</th>
              {ROLES.map((r) => (
                <th key={r} className="pb-2 text-center font-medium">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(PERMISSIONS).map(([k, roles]) => (
              <tr key={k}>
                <td className="py-1.5 text-slate-700">{k}</td>
                {ROLES.map((r) => (
                  <td key={r} className="text-center">
                    {(roles as readonly Role[]).includes(r) ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && <UserModal user={editing === 'new' ? null : editing} managers={managers} onClose={() => setEditing(null)} />}
    </>
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

type OrgSettings = { companyName: string; discountLimitPct: { executive: number; manager: number }; holdDays: number };

/** Who may agree how much discount without asking, and how long holds last. */
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
  if (!cur) return null;
  return (
    <Card className="mt-5 p-5">
      <SectionTitle>Price approvals and holds</SectionTitle>
      <p className="-mt-1 mb-4 text-sm text-slate-500">A discount up to the limit is agreed at once by that person. Above an executive's limit it goes to a manager; above a manager's, to an admin.</p>
      <div className="grid max-w-xl grid-cols-3 gap-3">
        <Field label="Executive limit (% off)">
          <Input type="number" step="0.5" min={0} max={10} value={cur.executive} onChange={(e) => setF({ ...cur, executive: e.target.value })} />
        </Field>
        <Field label="Manager limit (% off)">
          <Input type="number" step="0.5" min={0} max={25} value={cur.manager} onChange={(e) => setF({ ...cur, manager: e.target.value })} />
        </Field>
        <Field label="Hold a unit for (days)">
          <Input type="number" min={1} max={30} value={cur.holdDays} onChange={(e) => setF({ ...cur, holdDays: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" variant="primary" disabled={!f} loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
        <ErrorNote error={save.error} />
      </div>
    </Card>
  );
}
