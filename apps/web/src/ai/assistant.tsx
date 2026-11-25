import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export type RecordRef = { kind: 'property' | 'project' | 'lead' | 'deal' | 'activity' | 'user'; id: string; title: string; subtitle?: string };
export type Proposal = { id: string; summary: string; state?: 'pending' | 'confirmed' | 'dismissed' | 'failed'; result?: string };
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  records?: RecordRef[];
  proposals?: Proposal[];
  done?: string[];
  mode?: 'gemini' | 'offline';
  error?: boolean;
};

export type PageContext = {
  page: string;
  entity?: 'property' | 'project' | 'lead' | 'deal';
  entityId?: string;
  label?: string;
  suggestions?: string[];
};

export type SavedChat = { id: string; title: string; at: string; messages: Message[] };

type AssistantValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Sends a question. Opens the side panel unless `panel: false` (the full Assistant page). */
  ask: (text: string, opts?: { panel?: boolean }) => void;
  chats: SavedChat[];
  chatId: string;
  newChat: () => void;
  openChat: (id: string) => void;
  removeChat: (id: string) => void;
  messages: Message[];
  pending: boolean;
  context: PageContext;
  setContext: (c: PageContext) => void;
  confirm: (msgIndex: number, proposalId: string) => Promise<void>;
  dismiss: (msgIndex: number, proposalId: string) => Promise<void>;
  reset: () => void;
};

const Ctx = createContext<AssistantValue | null>(null);

type ChatReply = { mode: 'gemini' | 'offline'; reply: string; records: RecordRef[]; proposals: Proposal[]; done: string[] };

const newId = () => Math.random().toString(36).slice(2, 10);

/** Past conversations live in this browser only, per user: a convenience, never the source of truth. */
function readChats(key: string): SavedChat[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedChat[]) : [];
  } catch {
    return [];
  }
}
function writeChats(key: string, chats: SavedChat[]) {
  try {
    localStorage.setItem(key, JSON.stringify(chats));
  } catch {
    // Storage full or blocked: chats just won't be remembered.
  }
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const storeKey = `estate.chats.${user?.id ?? 'anon'}`;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // The latest messages, for sending without reading state inside an updater.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [chatId, setChatId] = useState(newId);
  const [chats, setChats] = useState<SavedChat[]>(() => readChats(storeKey));
  // A different person signed in: their own saved chats, and a fresh conversation.
  useEffect(() => {
    setChats(readChats(storeKey));
    setMessages([]);
    setChatId(newId());
  }, [storeKey]);

  // Keep the current conversation in the saved list (newest first, at most 20).
  useEffect(() => {
    const first = messages.find((m) => m.role === 'user');
    if (!first) return;
    setChats((list) => {
      const next = [{ id: chatId, title: first.content.slice(0, 80), at: new Date().toISOString(), messages }, ...list.filter((c) => c.id !== chatId)].slice(0, 20);
      writeChats(storeKey, next);
      return next;
    });
  }, [messages, chatId, storeKey]);

  const newChat = useCallback(() => {
    setMessages([]);
    setChatId(newId());
  }, []);
  const openChat = useCallback(
    (id: string) => {
      const c = chats.find((x) => x.id === id);
      if (!c) return;
      setChatId(c.id);
      setMessages(c.messages);
    },
    [chats],
  );
  const removeChat = useCallback(
    (id: string) => {
      setChats((list) => {
        const next = list.filter((c) => c.id !== id);
        writeChats(storeKey, next);
        return next;
      });
      if (id === chatId) newChat();
    },
    [storeKey, chatId, newChat],
  );
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
    (text: string, opts?: { panel?: boolean }) => {
      const t = text.trim();
      if (!t) return;
      if (opts?.panel !== false) setOpen(true);
      // Send outside the state update: React may run an updater twice, which would ask twice.
      const next = [...messagesRef.current, { role: 'user' as const, content: t }];
      messagesRef.current = next;
      setMessages(next);
      chat.mutate(next);
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
    () => ({ open, setOpen, ask, chats, chatId, newChat, openChat, removeChat, messages, pending: chat.isPending, context, setContext, confirm, dismiss, reset: newChat }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- confirm and dismiss only read state through setMessages, so they need not trigger a new value
    [open, ask, chats, chatId, newChat, openChat, removeChat, messages, chat.isPending, context],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for ctx, which is a new object on every render
  }, [key, setContext]);
}
