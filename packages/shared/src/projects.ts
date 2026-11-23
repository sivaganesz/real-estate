import { z } from 'zod';
import type { ProjectStatus, PropertyType } from './property';

/**
 * A project's layout is described once — towers with a floor plan, or blocks
 * of plots — and every unit (number, type, size, facing, price) follows from it.
 * The same planner runs in the browser (live preview) and on the server (units).
 */

export const FLAT_TYPES = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK', 'Studio', 'Shop', 'Office'] as const;
export const DEFAULT_FLAT_AREA: Record<string, number> = { Studio: 450, '1 BHK': 650, '2 BHK': 1150, '3 BHK': 1450, '4 BHK': 2100, '5 BHK': 2800, Shop: 400, Office: 1200 };

export const PROJECT_APPROVALS = [
  { name: 'RERA', desc: 'RERA registration' },
  { name: 'DTCP / CMDA', desc: 'Layout or building plan approval' },
  { name: 'Bank approved', desc: 'Home loans approved by banks' },
  { name: 'OC / CC', desc: 'Occupancy / completion certificate' },
] as const;

const Tower = z.object({
  name: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(4),
  floors: z.number().int().min(1).max(80),
  /** Flat type at each position on a floor; every floor repeats it. */
  plan: z.array(z.string().min(1)).min(1).max(20),
});

const PlotBlock = z.object({
  name: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(4),
  /** Width × length in feet, per plot, in order. */
  plots: z.array(z.object({ w: z.number().positive(), l: z.number().positive() })).min(1).max(300),
  /** Villa communities: bedrooms and built-up area per villa. */
  bedrooms: z.number().int().min(1).max(10).nullish(),
  builtUp: z.number().positive().nullish(),
});

export const ProjectLayout = z.object({
  flatTypes: z.array(z.object({ type: z.string().min(1), area: z.number().positive() })).default([]),
  towers: z.array(Tower).max(20).default([]),
  plotBlocks: z.array(PlotBlock).max(40).default([]),
  pricing: z
    .object({
      rate: z.number().nonnegative().nullish(),
      floorRise: z.number().nonnegative().default(0),
      cornerPct: z.number().min(0).max(50).default(5),
    })
    .default({}),
});
export type ProjectLayout = z.infer<typeof ProjectLayout>;

export type LayoutKind = 'towers' | 'blocks';
export const layoutKind = (t: PropertyType): LayoutKind => (t === 'apartment' || t === 'commercial' ? 'towers' : 'blocks');

export const PROJECT_STATUS_LABELS: Record<LayoutKind, Record<ProjectStatus, string>> = {
  towers: { upcoming: 'Pre-launch', under_construction: 'Under construction', ready: 'Ready to move' },
  blocks: { upcoming: 'Pre-launch', under_construction: 'Under development', ready: 'Ready for registration' },
};

/** East at the left end, West at the right, North/South alternating in between. */
export function facingAt(pos: number, count: number, block = 0, kind: LayoutKind = 'towers') {
  if (kind === 'blocks') return block % 2 ? 'South' : 'North';
  if (pos === 0) return 'East';
  if (pos === count - 1) return 'West';
  return pos % 2 ? 'North' : 'South';
}

export type PlannedUnit = {
  block: string;
  blockName: string;
  blockIndex: number;
  unitNumber: string;
  floor: number | null;
  pos: number;
  kindLabel: string;
  area: number;
  facing: string;
  corner: boolean;
  w?: number;
  l?: number;
  land?: number;
  bedrooms: number | null;
  price: number | null;
};

const bhk = (t: string) => Number(t.match(/^(\d)\s*BHK/i)?.[1] ?? 0) || null;

export function plannedUnits(type: PropertyType, layout: ProjectLayout): PlannedUnit[] {
  const out: PlannedUnit[] = [];
  const { rate, floorRise = 0, cornerPct = 5 } = layout.pricing ?? {};
  if (layoutKind(type) === 'towers') {
    layout.towers.forEach((t, ti) => {
      for (let f = 1; f <= t.floors; f++) {
        t.plan.forEach((ft, i) => {
          const area = layout.flatTypes.find((x) => x.type === ft)?.area ?? DEFAULT_FLAT_AREA[ft] ?? 1000;
          out.push({
            block: t.code,
            blockName: t.name,
            blockIndex: ti,
            unitNumber: `${t.code}${f}${String(i + 1).padStart(2, '0')}`,
            floor: f,
            pos: i,
            kindLabel: ft,
            area,
            facing: facingAt(i, t.plan.length),
            corner: false,
            bedrooms: bhk(ft),
            price: rate ? Math.round(area * (rate + floorRise * (f - 1))) : null,
          });
        });
      }
    });
  } else {
    layout.plotBlocks.forEach((b, bi) => {
      b.plots.forEach((pl, i) => {
        const land = Math.round(pl.w * pl.l);
        // Villas are priced on built-up area; plots on land.
        const area = b.builtUp ?? land;
        const corner = i === 0 || i === b.plots.length - 1;
        out.push({
          block: b.code,
          blockName: b.name,
          blockIndex: bi,
          unitNumber: `${b.code}-${String(i + 1).padStart(2, '0')}`,
          floor: null,
          pos: i,
          kindLabel: `${pl.w}×${pl.l} ft`,
          area,
          facing: facingAt(i, b.plots.length, bi, 'blocks'),
          corner,
          w: pl.w,
          l: pl.l,
          land,
          bedrooms: b.bedrooms ?? null,
          price: rate ? Math.round(area * rate * (corner ? 1 + cornerPct / 100 : 1)) : null,
        });
      });
    });
  }
  return out;
}

export type Completion = { pct: number; missing: string[]; next: { label: string; gain: number }[] };

/** How complete a project's setup is, and the most valuable next steps. */
export function projectCompletion(p: {
  type?: PropertyType | null;
  name?: string | null;
  city?: string | null;
  locality?: string | null;
  status?: string | null;
  developer?: string | null;
  possessionDate?: unknown;
  landAcres?: number | null;
  description?: string | null;
  amenities?: string[] | null;
  approvalBadges?: { name: string; documentUrl?: string | null }[] | null;
  pricing?: { rate?: number | null } | null;
  unitCount: number;
}): Completion {
  const req: [string, boolean][] = [
    ['project type', !!p.type],
    ['name', !!p.name],
    ['city', !!p.city],
    ['locality', !!p.locality],
    ['construction status', !!p.status],
    [p.type && layoutKind(p.type) === 'blocks' ? 'blocks of plots' : 'towers & floors', p.unitCount > 0],
  ];
  const missing = req.filter(([, ok]) => !ok).map(([k]) => k);
  const badges = p.approvalBadges ?? [];
  const uploaded = badges.filter((b) => b.documentUrl).length;
  const parts = {
    basics: 4 * req.slice(0, 5).filter(([, ok]) => ok).length + (p.developer ? 3 : 0) + (p.possessionDate || p.landAcres ? 2 : 0),
    layout: p.unitCount > 0 ? 20 : 0,
    pricing: p.pricing?.rate ? 15 : 0,
    amenities: Math.round((Math.min(p.amenities?.length ?? 0, 4) / 4) * 15),
    description: p.description ? 10 : 0,
    approvals: badges.length ? 7 + Math.round((8 * uploaded) / badges.length) : 0,
  };
  const pct = Math.min(100, Object.values(parts).reduce((a, b) => a + b, 0));
  const next: Completion['next'] = [];
  if (!p.unitCount) next.push({ label: 'Add the layout', gain: 20 });
  if (!p.pricing?.rate) next.push({ label: 'Add pricing', gain: 15 });
  if ((p.amenities?.length ?? 0) < 4) next.push({ label: 'Add amenities', gain: 15 - parts.amenities });
  if (!p.description) next.push({ label: 'Add a short description', gain: 10 });
  if (!badges.length) next.push({ label: 'Add approvals (RERA, DTCP…)', gain: 7 });
  else if (uploaded < badges.length) next.push({ label: 'Upload approval documents', gain: 15 - parts.approvals });
  if (!p.developer) next.push({ label: 'Add the developer', gain: 3 });
  next.sort((a, b) => b.gain - a.gain);
  return { pct, missing, next: next.slice(0, 3) };
}
