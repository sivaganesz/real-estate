import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake } from 'lucide-react';
import { DEAL_STATUS_LABEL, formatINR } from '@estate/shared';
import { api } from '../lib/api';
import { DEAL_TONE, fromLakhs, type Deal } from '../lib/deals';
import type { Lead } from '../lib/leads';
import { priceLabel, type Property } from '../lib/property';
import { Badge, Button, Card, ErrorNote, Input, Modal, SectionTitle } from '../components/ui';
import { DealDrawer } from '../components/DealDrawer';
import { useToast } from '../components/toast';
import { leadSlots } from '../slots-leads';

/** On a customer's page: their negotiations and bookings, or a way to start one. */
function LeadDeals({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const q = useQuery({ queryKey: ['deals', 'lead', lead.id], queryFn: () => api.get<{ items: Deal[] }>(`/deals?lead=${lead.id}`) });
  const deals = q.data?.items ?? [];
  const live = deals.filter((d) => d.status !== 'cancelled');
  const canStart = !['new', 'lost'].includes(lead.stage);
  if (!deals.length && !canStart) return null;
  return (
    <Card className="p-5">
      <SectionTitle
        action={
          canStart && (
            <Button size="sm" variant="ghost" onClick={() => setStarting(true)}>
              + Negotiate
            </Button>
          )
        }
      >
        <span className="flex items-center gap-1.5">
          <Handshake className="h-4 w-4 text-brand-700" /> Deals
        </span>
      </SectionTitle>
      {!live.length && <p className="text-sm text-slate-500">No negotiation yet. Start one when they pick a property.</p>}
      <ul className="space-y-2">
        {live.map((d) => (
          <li key={d.id}>
            <button onClick={() => setOpen(d.id)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-brand-300">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-800">{d.property?.title}</span>
                <Badge tone={DEAL_TONE[d.status]}>{DEAL_STATUS_LABEL[d.status]}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.agreedPrice ? `Agreed ${formatINR(d.agreedPrice)}` : `Now at ${formatINR(d.currentPrice)}`} · list {formatINR(d.listPrice)}
                {d.status === 'booked' && ` · ${formatINR(d.paid)} received`}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {open && <DealDrawer id={open} onClose={() => setOpen(null)} />}
      {starting && <StartDeal lead={lead} onClose={() => setStarting(false)} onStarted={(id) => { setStarting(false); setOpen(id); }} />}
    </Card>
  );
}

function StartDeal({ lead, onClose, onStarted }: { lead: Lead; onClose: () => void; onStarted: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pick, setPick] = useState<string | null>(null);
  const [offer, setOffer] = useState('');
  const shortlist = useQuery({ queryKey: ['shortlist', lead.id], queryFn: () => api.get<{ items: { status: string; property: Property }[] }>(`/matching/shortlist/${lead.id}`) });
  const options = (shortlist.data?.items ?? []).filter((s) => s.status !== 'rejected' && s.property.listing === 'live' && ['available', 'held'].includes(s.property.availability));
  const start = useMutation({
    mutationFn: () => api.post<{ deal: Deal }>('/deals', { leadId: lead.id, propertyId: pick, offer: offer ? fromLakhs(offer) : undefined }),
    onSuccess: (r) => {
      for (const k of ['deals', 'lead', 'leads', 'board', 'timeline']) void qc.invalidateQueries({ queryKey: [k] });
      toast('Negotiation started');
      onStarted(r.deal.id);
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Negotiate with ${lead.name.split(' ')[0]}`}
      footer={
        <Button variant="primary" disabled={!pick} loading={start.isPending} onClick={() => start.mutate()}>
          Start
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Which property? These are on their shortlist.</p>
        {!options.length && <p className="text-sm text-amber-700">Nothing available on their shortlist. Share or like a property from the matches first.</p>}
        {options.map((s) => (
          <button key={s.property.id} onClick={() => setPick(s.property.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${pick === s.property.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
            <span className="truncate">{s.property.title}</span>
            <span className="shrink-0 text-xs text-slate-500">
              {priceLabel(s.property)} {s.status === 'liked' && '· 👍'}
            </span>
          </button>
        ))}
        <Input inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Their first offer in lakhs (optional)" />
        <ErrorNote error={start.error} />
      </div>
    </Modal>
  );
}

leadSlots.side.unshift(LeadDeals);
