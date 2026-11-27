import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUp, Building2, CalendarPlus, ChevronDown, FileSpreadsheet, History, PanelLeftClose, Plus, Search, SquarePen, Trash2, UserPlus, X } from 'lucide-react';
import { relativeDay } from '@estate/shared';
import { useAuth } from '../lib/auth';
import { useAssistant, useAssistantPage } from '../ai/assistant';
import { Conversation, VoiceButton } from '../ai/AssistantPanel';
import { NewLead } from '../components/NewLead';
import { NewAppointment } from '../features/activities';

type Quick = { label: string; prompt: string };

/** One tap to the questions each role asks most. */
const QUICK: Record<'admin' | 'manager' | 'executive', Quick[]> = {
  executive: [
    { label: 'Plan my day', prompt: 'Plan my day: what should I do first and why?' },
    { label: 'Leads needing attention', prompt: 'Which of my leads need attention today?' },
    { label: 'Draft a follow-up', prompt: 'Draft a WhatsApp follow-up for my hottest lead.' },
    { label: 'Find a property', prompt: 'Find 2 BHK apartments under 70 lakhs in Porur' },
  ],
  manager: [
    { label: 'Team brief', prompt: 'Give me a short brief of the team for today: who needs help, what is stuck, and what I should do first.' },
    { label: 'Approvals waiting', prompt: 'What approvals are waiting for me?' },
    { label: 'Stuck deals', prompt: 'Where are deals getting stuck?' },
    { label: 'Slow projects', prompt: 'Which projects have low inventory movement?' },
  ],
  admin: [
    { label: 'Sales this month', prompt: 'How are sales this month? Bookings, money collected and what is due.' },
    { label: 'Payment status', prompt: 'Which payments are due or overdue this month?' },
    { label: 'Lead insights', prompt: 'Which lead sources bring the most bookings, and where do we lose leads?' },
    { label: 'Inventory report', prompt: 'Give me an inventory report: what is available, held, booked and sold, and which projects are slow.' },
  ],
};

/**
 * The assistant as a page of its own: a calm, centred greeting, quick actions
 * for the role, and one input — then the conversation, with past chats kept
 * in this browser.
 */
export function AssistantPage() {
  const a = useAssistant();
  const { user, ai, can } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [showQuick, setShowQuick] = useState(true);
  const [rail, setRail] = useState<'history' | 'search' | null>(null);
  const [find, setFind] = useState('');
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState<'lead' | 'appointment' | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const quick = QUICK[user?.role ?? 'executive'];
  useAssistantPage({ page: 'Assistant', suggestions: quick.map((q) => q.prompt) });

  // This page replaces the side panel while it's open.
  // Effects use braces so they never return a value: React would call it as a clean-up.
  useEffect(() => {
    a.setOpen(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- close the side panel once, when the page opens
  useEffect(() => {
    inputRef.current?.focus();
  }, [a.chatId]);
  // Scroll the conversation, not the window.
  // Newer browsers return a Promise from a smooth scrollTo; returning it from the effect crashed the page.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [a.messages.length, a.pending]);

  const send = (text = draft) => {
    if (!text.trim() || a.pending) return;
    a.ask(text, { panel: false });
    setDraft('');
  };
  const empty = a.messages.length === 0;
  const first = user?.name.split(' ')[0] ?? '';
  const shownChats = a.chats.filter((c) => !find || c.title.toLowerCase().includes(find.toLowerCase()));

  const create: { label: string; icon: React.ReactNode; run: () => void; show: boolean }[] = [
    { label: 'New lead', icon: <UserPlus className="h-4 w-4" />, run: () => setAdding('lead'), show: can('lead.create') },
    { label: 'New appointment', icon: <CalendarPlus className="h-4 w-4" />, run: () => setAdding('appointment'), show: can('lead.editOwn') },
    { label: 'Add a property', icon: <Building2 className="h-4 w-4" />, run: () => navigate('/properties?add=1'), show: can('property.create') },
    { label: 'Import an owner sheet', icon: <FileSpreadsheet className="h-4 w-4" />, run: () => navigate('/properties/import'), show: can('property.import') },
  ];

  return (
    <div className="relative flex h-[calc(100dvh-11.5rem)] min-h-[520px] flex-col overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-card sm:flex-row lg:h-[calc(100dvh-7.75rem)]">
      {/* A soft glow rising from the input. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(124,108,242,0.16),transparent),radial-gradient(40%_40%_at_20%_100%,rgba(20,184,166,0.10),transparent)]" />

      {/* Rail: new chat, search, history. */}
      <div className="relative z-10 flex items-center gap-2 p-3 sm:flex-col sm:p-4">
        <RailButton label="New chat" dark onClick={() => { a.newChat(); setRail(null); }}>
          <SquarePen className="h-4 w-4" />
        </RailButton>
        <RailButton label="Search chats" on={rail === 'search'} onClick={() => setRail(rail === 'search' ? null : 'search')}>
          <Search className="h-4 w-4" />
        </RailButton>
        <RailButton label="Past chats" on={rail === 'history'} onClick={() => setRail(rail === 'history' ? null : 'history')}>
          <History className="h-4 w-4" />
        </RailButton>
      </div>

      {rail && (
        <aside className="absolute inset-y-0 left-0 z-20 flex w-72 max-w-[85%] flex-col border-r border-slate-100 bg-white p-4 shadow-pop sm:left-[72px]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{rail === 'search' ? 'Search chats' : 'Past chats'}</p>
            <button onClick={() => setRail(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          {rail === 'search' && <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search your questions…" className="mb-3 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-ai-500 focus:ring-2 focus:ring-ai-100" />}
          <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto">
            {shownChats.map((c) => (
              <li key={c.id} className={clsx('group flex items-center gap-1 rounded-xl px-1', c.id === a.chatId && 'bg-slate-100')}>
                <button onClick={() => { a.openChat(c.id); setRail(null); }} className="min-w-0 flex-1 px-2 py-2 text-left">
                  <span className="block truncate text-sm text-slate-800">{c.title}</span>
                  <span className="block text-[11px] text-slate-400">{relativeDay(c.at)}</span>
                </button>
                <button onClick={() => a.removeChat(c.id)} className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:text-rose-600 group-hover:opacity-100" aria-label={`Delete “${c.title}”`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {!shownChats.length && <li className="px-2 py-6 text-center text-xs text-slate-400">{find ? 'No chat matches.' : 'Your conversations will be kept here, on this device.'}</li>}
          </ul>
        </aside>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6 text-center">
            <h1 className="max-w-xl text-3xl font-light leading-tight tracking-tight text-slate-400 sm:text-4xl">
              Hey <span className="font-semibold text-slate-900">{first}!</span> How can I help with your <span className="font-semibold text-slate-900">customers and properties</span> today?
            </h1>
            <p className={clsx('mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs', ai?.mode === 'offline' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-500')}>
              <span className={clsx('h-1.5 w-1.5 rounded-full', ai?.mode === 'offline' ? 'bg-amber-500' : 'bg-emerald-500')} />
              {ai?.mode === 'offline' ? 'Offline mode · common requests only' : 'Live data · asks before changing anything'}
            </p>
          </div>
        ) : (
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
            <div className="mx-auto max-w-3xl space-y-6">
              <Conversation wide />
            </div>
          </div>
        )}

        <div className="px-4 pb-5 sm:px-6">
          <div className="mx-auto max-w-2xl">
            {empty && (
              <div className="mb-3">
                <button onClick={() => setShowQuick(!showQuick)} className="mb-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                  Quick actions <ChevronDown className={clsx('h-3.5 w-3.5 transition', !showQuick && '-rotate-90')} />
                </button>
                {showQuick && (
                  <div className="flex flex-wrap gap-2">
                    {quick.map((q) => (
                      <button key={q.label} onClick={() => send(q.prompt)} className="rounded-full border border-ai-100 bg-ai-50/70 px-3 py-1.5 text-xs font-medium text-ai-700 transition hover:border-ai-200 hover:bg-ai-50">
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              {menu && (
                <div className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop">
                  {create
                    .filter((c) => c.show)
                    .map((c) => (
                      <button key={c.label} onClick={() => { setMenu(false); c.run(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                        <span className="text-slate-400">{c.icon}</span> {c.label}
                      </button>
                    ))}
                </div>
              )}
              <div className="flex items-end gap-1.5 rounded-[1.75rem] border border-slate-200/80 bg-white p-2 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] focus-within:border-ai-300 focus-within:ring-4 focus-within:ring-ai-100/60">
                <button onClick={() => setMenu(!menu)} className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition', menu ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')} aria-label={menu ? 'Close menu' : 'Create something'}>
                  {menu ? <X className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask me anything…"
                  className="max-h-40 min-h-[36px] min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[15px] shadow-none outline-none placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0"
                />
                <VoiceButton onText={(t) => setDraft((d) => (d ? `${d} ${t}` : t))} />
                <button onClick={() => send()} disabled={!draft.trim() || a.pending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ai-600 to-brand-600 text-white shadow-sm transition hover:opacity-90 disabled:opacity-40" aria-label="Send">
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">Answers come from your live data and your role's permissions. Changes always wait for your confirmation.</p>
          </div>
        </div>
      </div>

      {adding === 'lead' && <NewLead open onClose={() => setAdding(null)} />}
      {adding === 'appointment' && <NewAppointment onClose={() => setAdding(null)} />}
    </div>
  );
}

function RailButton({ label, dark, on, onClick, children }: { label: string; dark?: boolean; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={clsx('flex h-9 w-9 items-center justify-center rounded-full transition', dark ? 'bg-slate-900 text-white hover:bg-slate-800' : on ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}>
      {children}
    </button>
  );
}
