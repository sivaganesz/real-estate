import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, ErrorNote, Field, Input } from '../components/ui';

const DEMO = [
  { email: 'admin@estate.test', label: 'Admin' },
  { email: 'manager@estate.test', label: 'Sales manager' },
  { email: 'priya@estate.test', label: 'Sales executive' },
];

export function Login() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: (v: { email: string; password: string }) => api.post('/auth/login', v),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    },
  });
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-ai-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" className="h-10 w-10" alt="" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">EstateOS</h1>
            <p className="text-sm text-slate-500">Sales & inventory, with an assistant that does the busywork.</p>
          </div>
        </div>
        <form
          className="card space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <Field label="Email">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <ErrorNote error={login.error} />
          <Button variant="primary" className="w-full" loading={login.isPending}>
            Sign in
          </Button>
        </form>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-ai-600" /> Demo accounts (password demo1234)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button key={d.email} type="button" onClick={() => login.mutate({ email: d.email, password: 'demo1234' })} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-brand-50 hover:text-brand-800">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
