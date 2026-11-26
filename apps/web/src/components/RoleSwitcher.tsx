import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Loader2 } from 'lucide-react';
import { ROLES, ROLE_LABEL } from '@estate/shared';
import { useAuth, useSwitchOptions } from '../lib/auth';
import { Avatar } from './ui';
import { useToast } from './toast';

/**
 * Switch role: the demo accounts grouped by role. Picking one signs this
 * browser in as that person and opens their own home, so every screen shows
 * what that role can see and do. Shown only to demo accounts (the API decides).
 */
export function RoleList({ onDone }: { onDone?: () => void }) {
  const { user, switchTo } = useAuth();
  const options = useSwitchOptions();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!options.data?.length) return null;
  const pick = async (id: string) => {
    if (id === user?.id || busy) return;
    setBusy(id);
    try {
      const u = await switchTo(id);
      onDone?.();
      navigate('/');
      toast(`Now viewing as ${u.name} · ${ROLE_LABEL[u.role]}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not switch', 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div role="group" aria-label="Switch role">
      {ROLES.map((role) => {
        const people = options.data!.filter((o) => o.role === role);
        if (!people.length) return null;
        return (
          <div key={role} className="py-1">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">{ROLE_LABEL[role]}</p>
            {people.map((p) => {
              const current = p.id === user?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.id)}
                  aria-current={current || undefined}
                  disabled={!!busy}
                  className={clsx('flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition disabled:opacity-60', current ? 'bg-brand-50 font-medium text-brand-800' : 'text-slate-700 hover:bg-slate-50')}
                >
                  <Avatar name={p.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : current ? <Check className="h-4 w-4 text-brand-700" aria-label="Current" /> : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
