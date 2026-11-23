import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type RecordRef = { kind: 'property' | 'project' | 'lead' | 'deal' | 'activity' | 'user'; id: string; title: string; subtitle?: string };
export type Proposal = { id: string; summary: string; state?: 'pending' | 'confirmed' | 'dismissed' | 'failed'; result?: string };
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  records?: RecordRef[];
  proposals?: Proposal[];
  done?: string[];
  mode?: 'claude' | 'offline';
  error?: boolean;
};

export type PageContext = {
  page: string;
  entity?: 'property' | 'project' | 'lead' | 'deal';
  entityId?: string;
  label?: string;
  suggestions?: string[];
};

type AssistantValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  ask: (text: string) => void;
  messages: Message[];
  pending: boolean;
  context: PageContext;
  setContext: (c: PageContext) => void;
  confirm: (msgIndex: number, proposalId: string) => Promise<void>;
  dismiss: (msgIndex: number, proposalId: string) => Promise<void>;
  reset: () => void;
};

const Ctx = createContext<AssistantValue | null>(null);

type ChatReply = { mode: 'claude' | 'offline'; reply: string; records: RecordRef[]; proposals: Proposal[]; done: string[] };

export function AssistantProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<PageContext>({ page: 'Home' });
  const contextRef = useRef(context);
  contextRef.current = context;

  const chat = useMutation({
    mutationFn: (history: Message[]) =>
      api.post<ChatReply>('/ai/chat', {
        messages: history.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
        context: { page: contextRef.current.page, entity: contextRef.current.entity, entityId: contextRef.current.entityId, label: contextRef.current.label },
      }),
    onSuccess: (r) => {
      setMessages((s) => [...s, { role: 'assistant', content: r.reply, records: r.records, proposals: r.proposals.map((p) => ({ ...p, state: 'pending' })), done: r.done, mode: r.mode }]);
      if (r.done.length) void qc.invalidateQueries();
    },
    onError: (e) => setMessages((s) => [...s, { role: 'assistant', content: e instanceof Error ? e.message : 'Something went wrong', error: true }]),
  });

  const ask = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setOpen(true);
      setMessages((s) => {
        const next = [...s, { role: 'user' as const, content: t }];
        chat.mutate(next);
        return next;
      });
    },
    [chat],
  );

  const updateProposal = (msgIndex: number, id: string, patch: Partial<Proposal>) =>
    setMessages((s) => s.map((m, i) => (i === msgIndex ? { ...m, proposals: m.proposals?.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : m)));

  const confirm = async (msgIndex: number, id: string) => {
    try {
      const r = await api.post<{ done: string; records: RecordRef[] }>(`/ai/proposals/${id}/confirm`);
      updateProposal(msgIndex, id, { state: 'confirmed', result: r.done });
      void qc.invalidateQueries();
    } catch (e) {
      updateProposal(msgIndex, id, { state: 'failed', result: e instanceof Error ? e.message : 'Failed' });
    }
  };
  const dismiss = async (msgIndex: number, id: string) => {
    await api.post(`/ai/proposals/${id}/dismiss`).catch(() => {});
    updateProposal(msgIndex, id, { state: 'dismissed' });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const value = useMemo<AssistantValue>(
    () => ({ open, setOpen, ask, messages, pending: chat.isPending, context, setContext, confirm, dismiss, reset: () => setMessages([]) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, ask, messages, chat.isPending, context],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAssistant outside AssistantProvider');
  return v;
}

/** Pages call this so the assistant knows where the user is and what "this" means. */
export function useAssistantPage(ctx: PageContext) {
  const { setContext } = useAssistant();
  const key = JSON.stringify(ctx);
  useEffect(() => {
    setContext(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setContext]);
}
