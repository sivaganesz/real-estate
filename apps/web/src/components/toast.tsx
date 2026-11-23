import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm shadow-pop', t.tone === 'ok' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white')}>
            {t.tone === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertCircle className="h-4 w-4" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong';
}
