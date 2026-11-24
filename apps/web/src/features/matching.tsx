import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Copy, MessageCircle, Send, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { STAGE_META, type Stage } from '@estate/shared';
import { api } from '../lib/api';
import { TEMP_DOT, waLink, type Lead } from '../lib/leads';
import { keyFacts, priceLabel, type Property } from '../lib/property';
import { Badge, Button, Card, Modal, SectionTitle, Segmented, Textarea, type Tone } from '../components/ui';
import { PropertyCover } from '../components/PropertyCard';
import { useToast } from '../components/toast';
import { leadSlots } from '../slots-leads';
import { slots } from '../slots';
import { useAuth } from '../lib/auth';

type Reason = { ok: 'yes' | 'near' | 'no' | 'info'; text: string };
type Fit = 'strong' | 'good' | 'partial';
const FIT: Record<Fit, { label: string; tone: Tone }> = { strong: { label: 'Strong fit', tone: 'green' }, good: { label: 'Good fit', tone: 'brand' }, partial: { label: 'Partial fit', tone: 'amber' } };

export function Reasons({ reasons, max = 4 }: { reasons: Reason[]; max?: number }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {reasons.slice(0, max).map((r) => (
        <li key={r.text} className={clsx('flex gap-1.5 text-xs', r.ok === 'yes' ? 'text-emerald-700' : r.ok === 'near' ? 'text-amber-700' : r.ok === 'no' ? 'text-rose-600' : 'text-slate-500')}>
          <span className="w-3 shrink-0 text-center">{r.ok === 'yes' ? '✓' : r.ok === 'near' ? '≈' : r.ok === 'no' ? '✗' : '•'}</span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function ShareDialog({ lead, propertyIds, onClose }: { lead: { id: string; name: string; phone: string }; propertyIds: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const share = useMutation({
    mutationFn: () => api.post<{ message: string; links: { title: string; url: string }[] }>(`/matching/share/${lead.id}`, { propertyIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['matches', lead.id] });
      void qc.invalidateQueries({ queryKey: ['timeline', lead.id] });
      void qc.invalidateQueries({ queryKey: ['shortlist', lead.id] });
      void qc.invalidateQueries({ queryKey: ['best-matches'] });
    },
  });
  const [text, setText] = useState<string | null>(null);
  if (!share.data && !share.isPending && !share.error) share.mutate();
  const message = text ?? share.data?.message ?? '';
  return (
    <Modal open onClose={onClose} title={`Send to ${lead.name}`}>
      {share.isPending ? (
        <p className="text-sm text-slate-500">Preparing links…</p>
      ) : share.error ? (
        <p className="text-sm text-rose-600">{share.error.message}</p>
      ) : (
        <div className="space-y-3">
          <Textarea rows={9} value={message} onChange={(e) => setText(e.target.value)} />
          <p className="text-xs text-slate-500">Logged on their timeline and added to their shortlist. The links show photos, price and facts — never internal notes.</p>
          <div className="flex flex-wrap gap-2">
            <a href={waLink(lead.phone, message)} target="_blank" rel="noreferrer" onClick={() => setTimeout(onClose, 300)}>
              <Button variant="primary" icon={<MessageCircle className="h-4 w-4" />}>
                Open WhatsApp
              </Button>
            </a>
            <Button
              icon={<Copy className="h-4 w-4" />}
              onClick={async () => {
                await navigator.clipboard.writeText(message).catch(() => {});
                toast('Message copied');
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

type MatchItem = { property: Property; fit: Fit; reasons: Reason[] };

/** On a customer's page: what fits them, why, and one tap to send it. */
function LeadMatches({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'matches' | 'shortlist'>('matches');
  const [picked, setPicked] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const m = useQuery({ queryKey: ['matches', lead.id], queryFn: () => api.get<{ qualified: boolean; total: number; items: MatchItem[] }>(`/matching/lead/${lead.id}?limit=6`), enabled: lead.stage !== 'lost' });
  const sl = useQuery({ queryKey: ['shortlist', lead.id], queryFn: () => api.get<{ items: { status: string; at: string; property: Property }[] }>(`/matching/shortlist/${lead.id}`), enabled: tab === 'shortlist' });
  const rate = useMutation({
    mutationFn: ({ propertyId, status }: { propertyId: string; status: string }) => api.post(`/matching/shortlist/${lead.id}`, { propertyId, status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['matches', lead.id] });
      void qc.invalidateQueries({ queryKey: ['shortlist', lead.id] });
    },
  });
  if (lead.stage === 'lost' || lead.stage === 'booked') return null;
  const first = lead.name.split(' ')[0];
  return (
    <Card className="p-5">
      <SectionTitle
        action={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'matches', label: `Fits ${first}${m.data?.total ? ` (${m.data.total})` : ''}` },
              { value: 'shortlist', label: `Shortlist (${lead.shortlist.length})` },
            ]}
          />
        }
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-ai-600" /> Properties
        </span>
      </SectionTitle>
      {tab === 'matches' ? (
        !m.data ? (
          <p className="text-sm text-slate-500">Finding matches…</p>
        ) : !m.data.qualified ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Matches need their budget, location and type. Fill those in “Looking for” and they'll appear here.</p>
        ) : !m.data.items.length ? (
          <p className="text-sm text-slate-500">Nothing live fits right now. Try widening their budget or areas.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {m.data.items.map((it) => {
                const on = picked.includes(it.property.id);
                return (
                  <div key={it.property.id} className={clsx('relative rounded-2xl border p-3 transition', on ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200')}>
                    <button onClick={() => setPicked(on ? picked.filter((x) => x !== it.property.id) : [...picked, it.property.id])} className={clsx('absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border', on ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-300 bg-white')} aria-label="Select">
                      {on && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <Link to={`/properties/${it.property.id}`} className="flex gap-3 pr-6">
                      <PropertyCover property={it.property} className="h-14 w-16 shrink-0 rounded-lg" iconSize="h-5 w-5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{priceLabel(it.property)}</p>
                        <p className="truncate text-xs text-slate-700">{it.property.title}</p>
                        <Badge tone={FIT[it.fit].tone} className="mt-1">
                          {FIT[it.fit].label}
                        </Badge>
                      </div>
                    </Link>
                    <Reasons reasons={it.reasons} />
                    <div className="mt-2 flex gap-1">
                      <button onClick={() => rate.mutate({ propertyId: it.property.id, status: 'liked' })} className="rounded-md p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="They like it">
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => rate.mutate({ propertyId: it.property.id, status: 'rejected' })} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Not for them — hide">
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{picked.length ? `${picked.length} selected` : 'Select properties to send them together.'}</p>
              <Button size="sm" variant="primary" icon={<Send className="h-3.5 w-3.5" />} disabled={!picked.length} onClick={() => setSharing(true)}>
                Send to {first}
              </Button>
            </div>
          </>
        )
      ) : (
        <ul className="divide-y divide-slate-100">
          {!sl.data?.items.length && <li className="py-3 text-sm text-slate-500">Nothing shared or visited yet.</li>}
          {sl.data?.items.map((s) => (
            <li key={s.property.id} className="flex items-center gap-3 py-2">
              <PropertyCover property={s.property} className="h-10 w-12 shrink-0 rounded-lg" iconSize="h-4 w-4" />
              <Link to={`/properties/${s.property.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{s.property.title}</p>
                <p className="text-xs text-slate-500">
                  {priceLabel(s.property)} · {keyFacts(s.property).slice(0, 2).join(' · ')}
                </p>
              </Link>
              <Badge tone={s.status === 'liked' ? 'green' : s.status === 'rejected' ? 'red' : s.status === 'visited' ? 'ai' : 'slate'}>{s.status === 'liked' ? 'Liked' : s.status === 'rejected' ? 'Not for them' : s.status === 'visited' ? 'Visited' : 'Shared'}</Badge>
            </li>
          ))}
        </ul>
      )}
      {sharing && (
        <ShareDialog
          lead={lead}
          propertyIds={picked}
          onClose={() => {
            setSharing(false);
            setPicked([]);
          }}
        />
      )}
    </Card>
  );
}

/** On a property page: which open customers this suits. */
function BuyersWhoFit({ property }: { property: Property }) {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['buyers', property.id], queryFn: () => api.get<{ items: { lead: { id: string; name: string; stage: Stage; temperature: 'hot' | 'warm' | 'cold'; owner: string | null }; fit: Fit; reasons: Reason[] }[] }>(`/matching/property/${property.id}`), enabled: property.listing === 'live' && property.availability !== 'sold' });
  if (property.listing !== 'live' || property.availability === 'sold' || property.availability === 'booked') return null;
  return (
    <Card className="p-5">
      <SectionTitle>Buyers who fit {q.data ? `(${q.data.items.length})` : ''}</SectionTitle>
      {!q.data ? (
        <p className="text-sm text-slate-500">Looking…</p>
      ) : !q.data.items.length ? (
        <p className="text-sm text-slate-500">No open customer {can('lead.viewAll') ? '' : 'of yours '}fits this one right now.</p>
      ) : (
        <ul className="space-y-3">
          {q.data.items.slice(0, 6).map((b) => (
            <li key={b.lead.id}>
              <Link to={`/leads/${b.lead.id}`} className="flex items-center gap-2">
                <span className={clsx('h-2 w-2 rounded-full', TEMP_DOT[b.lead.temperature])} />
                <span className="flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-800">{b.lead.name}</span>
                <Badge tone={FIT[b.fit].tone}>{FIT[b.fit].label}</Badge>
              </Link>
              <p className="ml-4 text-xs text-slate-400">
                {STAGE_META[b.lead.stage].label}
                {can('lead.viewAll') && b.lead.owner ? ` · ${b.lead.owner}` : ''}
              </p>
              <div className="ml-4">
                <Reasons reasons={b.reasons} max={2} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

leadSlots.top.push(LeadMatches);
slots.propertySide.unshift(BuyersWhoFit);
