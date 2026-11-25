import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUp, Building2, Check, CheckCircle2, Home, Mic, RotateCcw, Sparkles, User, Handshake, X, CalendarClock, Layers } from 'lucide-react';
import { useAssistant, type RecordRef } from './assistant';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui';

export function AssistantPanel() {
  const a = useAssistant();
  const { ai, user } = useAuth();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [a.messages.length, a.pending]);
  useEffect(() => {
    if (a.open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [a.open]);

  if (!a.open) return null;
  const send = () => {
    a.ask(draft);
    setDraft('');
  };
  const suggestions = a.context.suggestions ?? [];

  return (
    <aside className="fixed inset-0 z-40 flex flex-col bg-white lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[420px] lg:border-l lg:border-slate-200 lg:shadow-pop">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="rounded-lg bg-gradient-to-br from-ai-600 to-brand-600 p-1.5 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Assistant</p>
          <p className="truncate text-xs text-slate-500">
            {a.context.label ? `On ${a.context.label}` : a.context.page}
            {ai?.mode === 'offline' && ' · offline mode'}
          </p>
        </div>
        {a.messages.length > 0 && (
          <button onClick={a.reset} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="New conversation">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => a.setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close assistant">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
        {a.messages.length === 0 && (
          <div className="pt-4">
            <p className="text-lg font-semibold text-slate-900">Hi {user?.name.split(' ')[0]}, what do you need?</p>
            <p className="mt-1 text-sm text-slate-500">
              I work with your live data and your role's permissions. I'll ask before anything important like publishing, reassigning or approving a price.
            </p>
            {ai?.mode === 'offline' && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Offline mode: no AI key is set, so I understand common requests only. An admin can set <code>GEMINI_API_KEY</code> to switch on Google Gemini.
              </p>
            )}
            {suggestions.length > 0 && (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Try</p>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => a.ask(s)} className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-ai-200 hover:bg-ai-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Conversation onRecord={() => window.innerWidth < 1024 && a.setOpen(false)} />
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 focus-within:border-ai-500 focus-within:ring-2 focus-within:ring-ai-100">
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
            placeholder="Ask, search or tell me what to do…"
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
          />
          <VoiceButton onText={(t) => setDraft((d) => (d ? `${d} ${t}` : t))} />
          <button onClick={send} disabled={!draft.trim() || a.pending} className="rounded-xl bg-brand-700 p-2 text-white transition hover:bg-brand-800 disabled:opacity-40" aria-label="Send">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-slate-400">Enter to send · Ctrl/⌘ K to open or close</p>
      </div>
    </aside>
  );
}

/**
 * The messages of the current conversation: answers, what was done, things to
 * confirm, and links to the records behind them. `wide` is the full Assistant page.
 */
export function Conversation({ wide, onRecord }: { wide?: boolean; onRecord?: () => void }) {
  const a = useAssistant();
  return (
    <>
      {a.messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <p className={clsx('max-w-[85%] whitespace-pre-wrap text-sm text-white', wide ? 'rounded-3xl rounded-br-lg bg-slate-900 px-4 py-2.5' : 'rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2')}>{m.content}</p>
          </div>
        ) : (
          <div key={i} className={clsx(wide && 'flex gap-3')}>
            {wide && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ai-600 to-brand-600 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className={clsx('text-sm', m.error ? 'rounded-2xl bg-rose-50 px-3.5 py-2.5 text-rose-700' : wide ? 'pt-1 text-[15px] text-slate-800' : 'max-w-[95%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-slate-800')}>
                <RichText text={m.content} />
              </div>
              {m.done?.map((d) => (
                <p key={d} className="flex items-start gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {d}
                </p>
              ))}
              {m.proposals?.map((p) => (
                <div key={p.id} className="rounded-2xl border border-ai-200 bg-ai-50/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ai-700">Needs your confirmation</p>
                  <p className="mt-1 text-sm text-slate-800">{p.summary}</p>
                  {p.state === 'pending' ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="primary" icon={<Check className="h-3.5 w-3.5" />} onClick={() => a.confirm(i, p.id)}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => a.dismiss(i, p.id)}>
                        Not now
                      </Button>
                    </div>
                  ) : (
                    <p className={clsx('mt-2 text-xs', p.state === 'confirmed' ? 'text-emerald-700' : p.state === 'failed' ? 'text-rose-600' : 'text-slate-500')}>
                      {p.state === 'confirmed' ? `✓ ${p.result}` : p.state === 'failed' ? p.result : 'Dismissed'}
                    </p>
                  )}
                </div>
              ))}
              {!!m.records?.length && (
                <div className="flex flex-wrap gap-1.5">
                  {m.records.map((r) => (
                    <RecordChip key={`${r.kind}${r.id}`} r={r} onClick={onRecord} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
      )}
      {a.pending && (
        <div className={clsx('flex items-center gap-2 text-sm text-slate-500', wide && 'pl-11')}>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-500 [animation-delay:-.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-500 [animation-delay:-.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-500" />
          </span>
          Working on it…
        </div>
      )}
    </>
  );
}

const KIND_ICON: Record<RecordRef['kind'], ReactNode> = {
  property: <Home className="h-3 w-3" />,
  project: <Building2 className="h-3 w-3" />,
  lead: <User className="h-3 w-3" />,
  deal: <Handshake className="h-3 w-3" />,
  activity: <CalendarClock className="h-3 w-3" />,
  user: <User className="h-3 w-3" />,
};

export function recordHref(r: RecordRef) {
  switch (r.kind) {
    case 'property':
      return `/properties/${r.id}`;
    case 'project':
      return `/projects/${r.id}`;
    case 'lead':
      return `/leads/${r.id}`;
    case 'deal':
      return `/deals?open=${r.id}`;
    case 'activity':
      return `/calendar`;
    default:
      return '#';
  }
}

function RecordChip({ r, onClick }: { r: RecordRef; onClick?: () => void }) {
  return (
    <Link to={recordHref(r)} onClick={onClick} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-brand-300 hover:text-brand-800" title={r.subtitle}>
      {KIND_ICON[r.kind] ?? <Layers className="h-3 w-3" />}
      <span className="truncate">{r.title}</span>
      {r.subtitle && <span className="hidden truncate text-slate-400 sm:inline">· {r.subtitle}</span>}
    </Link>
  );
}

/** Minimal markdown: **bold**, bullet lists, line breaks. */
export function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`l${out.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) list.push(m[1]);
    else {
      flush();
      if (l.trim() === '') out.push(<div key={i} className="h-2" />);
      else out.push(<p key={i}>{inline(l.replace(/^#+\s*/, ''))}</p>);
    }
  });
  flush();
  return <div className="space-y-0.5 leading-relaxed">{out}</div>;
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
}

type SpeechCtor = new () => { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };

export function VoiceButton({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const start = () => {
    const r = new Ctor();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => setOn(false);
    setOn(true);
    r.start();
  };
  return (
    <button onClick={start} className={clsx('rounded-xl p-2 transition', on ? 'bg-rose-100 text-rose-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600')} title="Speak" aria-label="Speak">
      <Mic className="h-4 w-4" />
    </button>
  );
}
