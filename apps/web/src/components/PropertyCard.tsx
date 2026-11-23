import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Building2, Factory, Home, LandPlot, Store, Trees } from 'lucide-react';
import type { PropertyType } from '@estate/shared';
import { AVAILABILITY_TONE, availabilityLabel, keyFacts, priceLabel, type Property } from '../lib/property';
import { Badge } from './ui';

const COVER: Record<PropertyType, { from: string; to: string; icon: typeof Home }> = {
  apartment: { from: '#0f766e', to: '#5eead4', icon: Building2 },
  villa: { from: '#7c3aed', to: '#c4b5fd', icon: Home },
  plot: { from: '#b45309', to: '#fcd34d', icon: LandPlot },
  commercial: { from: '#1d4ed8', to: '#93c5fd', icon: Store },
  agricultural: { from: '#15803d', to: '#bef264', icon: Trees },
  industrial: { from: '#475569', to: '#cbd5e1', icon: Factory },
};

/** The first photo, or a calm generated cover so a listing never looks broken. */
export function PropertyCover({ property, className, iconSize = 'h-10 w-10' }: { property: Pick<Property, 'type' | 'media' | 'title'>; className?: string; iconSize?: string }) {
  const photo = property.media?.find((m) => m.kind === 'photo');
  if (photo) return <img src={photo.url} alt={property.title} className={clsx('object-cover', className)} loading="lazy" />;
  const c = COVER[property.type];
  const Icon = c.icon;
  return (
    <div className={clsx('relative flex items-center justify-center overflow-hidden', className)} style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 -left-4 h-32 w-32 rounded-full bg-white/10" />
      <Icon className={clsx('relative text-white/85', iconSize)} strokeWidth={1.4} />
    </div>
  );
}

export function PropertyCard({ p, footer, compact }: { p: Property; footer?: React.ReactNode; compact?: boolean }) {
  const facts = keyFacts(p);
  return (
    <Link to={`/properties/${p.id}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="relative">
        <PropertyCover property={p} className={clsx('w-full', compact ? 'h-28' : 'h-40')} />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {p.listing !== 'live' ? (
            <Badge tone={p.listing === 'draft' ? 'amber' : 'slate'} className="bg-white/95 shadow-sm">
              {p.listing === 'draft' ? 'Draft' : 'Archived'}
            </Badge>
          ) : (
            <Badge tone={AVAILABILITY_TONE[p.availability]} className="bg-white/95 shadow-sm">
              {availabilityLabel(p.availability)}
            </Badge>
          )}
          {p.purpose !== 'sale' && <Badge className="bg-white/95 capitalize shadow-sm">For {p.purpose}</Badge>}
        </div>
        {p.media.length > 1 && <span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{p.media.length} photos</span>}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-lg font-semibold tracking-tight text-slate-900">{priceLabel(p)}</p>
        <p className="mt-0.5 line-clamp-1 text-sm font-medium text-slate-700 group-hover:text-brand-800">{p.title}</p>
        <p className="line-clamp-1 text-xs text-slate-500">{[p.locality, p.city].filter(Boolean).join(', ') || '—'}</p>
        {facts.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {facts.map((f) => (
              <span key={f} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                {f}
              </span>
            ))}
          </div>
        )}
        {p.listing === 'draft' && !p.readiness.ready && <p className="mt-2 text-[11px] text-amber-700">Needs {p.readiness.missing.map((m) => m.label.toLowerCase()).join(', ')}</p>}
        {footer && <div className="mt-auto pt-3">{footer}</div>}
      </div>
    </Link>
  );
}
