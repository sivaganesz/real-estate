import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, MessageCircle, Wand2 } from 'lucide-react';
import { formatINR } from '@estate/shared';
import { api } from '../lib/api';
import { keyFacts, priceLabel, type Property } from '../lib/property';
import { Button, Drawer, ErrorNote, Field, Input, Modal, Textarea } from './ui';
import { PropertyForm, fromProperty, toPayload, type FormState } from './PropertyForm';
import { useToast } from './toast';

export function EditProperty({ property, open, onClose }: { property: Property; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => fromProperty(property));
  const [change, setChange] = useState('');
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Record<string, string>>({});

  /** "Price is now 58 L, add borewell" → only the values mentioned change. */
  const understand = useMutation({
    mutationFn: () => api.post<{ properties: { price: number | null; area: number | null; details: Record<string, unknown>; amenities: string[]; sources: Record<string, string> }[] }>('/properties/extract', { text: change }),
    onSuccess: (r) => {
      const e = r.properties[0];
      if (!e) return;
      const filled = new Set<string>();
      const next = { ...form, details: { ...form.details } };
      if (e.price) {
        next.price = String(e.price);
        filled.add('price');
      }
      if (e.area) {
        next.area = String(e.area);
        filled.add('area');
      }
      for (const [k, v] of Object.entries(e.details ?? {})) {
        if (v === null || v === '') continue;
        next.details[k] = v as string;
        filled.add(`details.${k}`);
      }
      if (e.amenities.length) next.amenities = [...new Set([...next.amenities, ...e.amenities])];
      setForm(next);
      setAiFilled(filled);
      setSources(e.sources);
      setChange('');
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const { type: _t, ...rest } = toPayload(form);
      void _t;
      return api.patch(`/properties/${property.id}`, rest);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['property', property.id] });
      void qc.invalidateQueries({ queryKey: ['properties'] });
      toast('Saved');
      onClose();
    },
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit ${property.code}`}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="mb-5 flex gap-2 rounded-2xl border border-ai-100 bg-ai-50/60 p-2">
        <Input className="border-0 bg-transparent shadow-none focus:ring-0" placeholder='Say what changed: "price is now 58 lakhs, 2 car parks, add gym"' value={change} onChange={(e) => setChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && change.trim() && understand.mutate()} />
        <Button size="sm" variant="ai" icon={<Wand2 className="h-3.5 w-3.5" />} disabled={!change.trim()} loading={understand.isPending} onClick={() => understand.mutate()}>
          Apply
        </Button>
      </div>
      <PropertyForm value={form} onChange={setForm} lockType aiFilled={aiFilled} sources={sources} />
      <div className="mt-3">
        <ErrorNote error={save.error ?? understand.error} />
      </div>
    </Drawer>
  );
}

export function ShareSheet({ property, open, onClose }: { property: Property; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const link = useMutation({ mutationFn: () => api.post<{ path: string }>(`/properties/${property.id}/share`) });
  const url = link.data ? `${window.location.origin}${link.data.path}` : '';
  const message = `Hi! Sharing a property you may like:\n*${property.title}*\n${priceLabel(property)} · ${keyFacts(property).join(' · ')}\n${[property.locality, property.city].filter(Boolean).join(', ')}\n\nPhotos and details: ${url}`;
  if (open && !link.data && !link.isPending && !link.error) link.mutate();
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast(`${what} copied`);
  };
  return (
    <Modal open={open} onClose={onClose} title="Share with a buyer">
      {link.error ? (
        <ErrorNote error={link.error} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">The buyer page shows photos, price, key facts, amenities and approvals with documents. It never shows internal notes, owner details or holds.</p>
          <Field label="Link">
            <div className="flex gap-2">
              <Input readOnly value={url} />
              <Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => copy(url, 'Link')} disabled={!url}>
                Copy
              </Button>
            </div>
          </Field>
          <Field label="WhatsApp message">
            <Textarea rows={6} readOnly value={url ? message : ''} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <Button variant="primary" icon={<MessageCircle className="h-4 w-4" />} disabled={!url}>
                Open WhatsApp
              </Button>
            </a>
            <Button onClick={() => copy(message, 'Message')} disabled={!url}>
              Copy message
            </Button>
            <a href={link.data?.path} target="_blank" rel="noreferrer">
              <Button variant="ghost" icon={<ExternalLink className="h-4 w-4" />} disabled={!url}>
                Preview
              </Button>
            </a>
          </div>
          <p className="text-xs text-slate-400">Tip: share from a lead's page to log it on their timeline.</p>
        </div>
      )}
    </Modal>
  );
}

export function AvailabilityModal({ property, open, onClose }: { property: Property; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('3');
  const change = useMutation({
    mutationFn: (to: string) => api.post(`/properties/${property.id}/availability`, { to, reason: reason || undefined, heldUntil: to === 'held' ? new Date(Date.now() + Number(days) * 86_400_000).toISOString() : undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['property', property.id] });
      void qc.invalidateQueries({ queryKey: ['properties'] });
      toast('Availability updated');
      onClose();
    },
  });
  const a = property.availability;
  return (
    <Modal open={open} onClose={onClose} title="Change availability">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Bookings normally happen through a deal, which sets this for you. Use this for holds, or to correct a unit sold outside the app.
        </p>
        {a !== 'held' && a === 'available' && (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-medium">Hold it</p>
            <p className="text-xs text-slate-500">Keeps it off offers while a buyer decides. Released automatically.</p>
            <div className="mt-2 flex items-center gap-2">
              <Input className="w-20" type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} />
              <span className="text-sm text-slate-500">days</span>
              <Button size="sm" className="ml-auto" onClick={() => change.mutate('held')} loading={change.isPending && change.variables === 'held'}>
                Hold
              </Button>
            </div>
          </div>
        )}
        {a !== 'available' && (
          <Button className="w-full" onClick={() => change.mutate('available')} loading={change.isPending && change.variables === 'available'}>
            Make it available again
          </Button>
        )}
        {(a === 'available' || a === 'held') && (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-medium">Booked or sold outside the app</p>
            <Input className="mt-2" placeholder="Reason (required), e.g. sold directly by owner" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={!reason} onClick={() => change.mutate('booked')}>
                Mark booked
              </Button>
              <Button size="sm" disabled={!reason} onClick={() => change.mutate('sold')}>
                Mark sold
              </Button>
            </div>
          </div>
        )}
        {property.price && <p className="text-xs text-slate-400">Listed at {formatINR(property.price)}</p>}
        <ErrorNote error={change.error} />
      </div>
    </Modal>
  );
}
