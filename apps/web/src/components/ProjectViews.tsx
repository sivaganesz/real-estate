import clsx from 'clsx';
import { formatINR, type PlannedUnit } from '@estate/shared';

/**
 * Drawings of a project's units: a grid (floors × flats, rows of plots) and an
 * illustrated master plan (site plan or tower elevation). Every unit is a button.
 */

export type UnitState = 'available' | 'held' | 'booked' | 'sold' | 'draft' | 'new';

export const STATE_STYLE: Record<UnitState, { label: string; fill: string; stroke: string; text: string; cls: string }> = {
  available: { label: 'Available', fill: '#e3f4e8', stroke: '#6fbf88', text: '#1d6b36', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-300 hover:bg-emerald-100' },
  held: { label: 'On hold', fill: '#fff4d6', stroke: '#e9b949', text: '#8a5a00', cls: 'bg-amber-50 text-amber-800 ring-amber-300 hover:bg-amber-100' },
  booked: { label: 'Booked', fill: '#ffe9cc', stroke: '#e39a1f', text: '#8a4b00', cls: 'bg-orange-50 text-orange-800 ring-orange-300 hover:bg-orange-100' },
  sold: { label: 'Sold', fill: '#fde8e8', stroke: '#e08a84', text: '#9b1c14', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  draft: { label: 'Draft', fill: '#ffffff', stroke: '#cbd5e1', text: '#64748b', cls: 'bg-white text-slate-500 ring-slate-300 ring-dashed hover:bg-slate-50' },
  new: { label: 'New', fill: '#eef2ff', stroke: '#a5b4fc', text: '#3730a3', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
};

export type DrawUnit = PlannedUnit & { state: UnitState; id?: string; dim?: boolean; selected?: boolean };

export function Legend({ states = ['available', 'held', 'booked', 'sold'] as UnitState[] }: { states?: UnitState[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      {states.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: STATE_STYLE[s].fill, boxShadow: `inset 0 0 0 1px ${STATE_STYLE[s].stroke}` }} /> {STATE_STYLE[s].label}
        </span>
      ))}
    </div>
  );
}

/** Floors × flats for one tower, top floor first, with the ground floor below. */
export function TowerGrid({ units, onPick, compact }: { units: DrawUnit[]; onPick?: (u: DrawUnit) => void; compact?: boolean }) {
  const floors = [...new Set(units.map((u) => u.floor ?? 0))].sort((a, b) => b - a);
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <tbody>
          {floors.map((f) => (
            <tr key={f}>
              <td className="pr-1 text-right text-[11px] text-slate-400">F{f}</td>
              {units
                .filter((u) => (u.floor ?? 0) === f)
                .sort((a, b) => a.pos - b.pos)
                .map((u) => (
                  <td key={u.unitNumber}>
                    <UnitCell u={u} onPick={onPick} compact={compact} />
                  </td>
                ))}
            </tr>
          ))}
          <tr>
            <td />
            <td colSpan={99} className="rounded-md bg-slate-100 py-1 text-center text-[10px] uppercase tracking-wide text-slate-400">
              Ground · entrance, lobby & parking
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Blocks of plots as rows, with roads between them and the park at the end. */
export function SiteGrid({ units, onPick, compact }: { units: DrawUnit[]; onPick?: (u: DrawUnit) => void; compact?: boolean }) {
  const blocks = [...new Set(units.map((u) => u.blockIndex))].sort((a, b) => a - b);
  return (
    <div className="space-y-1.5 overflow-x-auto">
      <Road label="Main road · entrance" />
      {blocks.map((b, i) => {
        const row = units.filter((u) => u.blockIndex === b).sort((a, c) => a.pos - c.pos);
        return (
          <div key={b}>
            <p className="mb-1 text-[11px] font-medium text-slate-500">{row[0]?.blockName}</p>
            <div className="flex flex-wrap gap-1">
              {row.map((u) => (
                <UnitCell key={u.unitNumber} u={u} onPick={onPick} compact={compact} />
              ))}
            </div>
            {i < blocks.length - 1 && i % 2 === 0 && <Road label="30 ft road" />}
          </div>
        );
      })}
      <div className="rounded-lg bg-emerald-100/70 py-2 text-center text-[11px] font-medium text-emerald-800">Park · open space reserve (OSR)</div>
    </div>
  );
}

function Road({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-2 rounded-md bg-slate-200/70 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
      <span className="h-px flex-1 border-t border-dashed border-white" />
      {label}
      <span className="h-px flex-1 border-t border-dashed border-white" />
    </div>
  );
}

function UnitCell({ u, onPick, compact }: { u: DrawUnit; onPick?: (u: DrawUnit) => void; compact?: boolean }) {
  const s = STATE_STYLE[u.state];
  return (
    <button
      type="button"
      disabled={!onPick}
      onClick={() => onPick?.(u)}
      title={`${u.unitNumber} · ${u.kindLabel} · ${u.area.toLocaleString('en-IN')} sq.ft${u.price ? ` · ${formatINR(u.price)}` : ''} · ${s.label}`}
      className={clsx(
        'flex flex-col items-center justify-center rounded-lg text-center ring-1 transition',
        compact ? 'h-11 w-[58px]' : 'h-14 w-[74px]',
        s.cls,
        u.dim && 'opacity-25',
        u.selected && 'ring-2 ring-slate-900',
        u.corner && 'outline outline-1 outline-offset-1 outline-slate-300',
      )}
    >
      <span className={clsx('font-semibold', compact ? 'text-[10px]' : 'text-xs')}>{u.unitNumber}</span>
      <span className="text-[10px] opacity-80">{u.state === 'sold' ? 'Sold' : compact ? u.kindLabel.replace(' ft', '') : u.price ? formatINR(u.price) : u.kindLabel}</span>
    </button>
  );
}

/* ---------------- Master plan: illustrated drawings ---------------- */

/**
 * The site as a drawing: main road and gate at the top, blocks of plots with
 * internal roads, a park with a pond at the bottom, and a compass.
 */
export function SitePlanArt({ units, onPick }: { units: DrawUnit[]; onPick: (u: DrawUnit) => void }) {
  const blocks = [...new Set(units.map((u) => u.blockIndex))].sort((a, b) => a - b);
  const W = 1000;
  const margin = 70;
  const usable = W - margin * 2;
  let y = 96;
  const shapes: { u: DrawUnit; x: number; y: number; w: number; h: number }[] = [];
  const roads: { y: number; label: string }[] = [];
  const labels: { x: number; y: number; text: string }[] = [];
  blocks.forEach((b, i) => {
    const row = units.filter((u) => u.blockIndex === b).sort((a, c) => a.pos - c.pos);
    // Long blocks split into two back-to-back rows, as plotted layouts usually are.
    const perRow = row.length > 14 ? Math.ceil(row.length / 2) : row.length;
    const rows = Math.ceil(row.length / perRow);
    const maxL = Math.max(...row.map((u) => u.l ?? 40));
    const h = Math.min(88, Math.max(54, maxL * 1.3));
    const cell = usable / perRow;
    labels.push({ x: margin - 10, y: y + (rows * h) / 2, text: row[0]?.block ?? '' });
    row.forEach((u, k) => {
      const r = Math.floor(k / perRow);
      const c = k % perRow;
      shapes.push({ u, x: margin + c * cell + 2, y: y + r * h + 2, w: cell - 4, h: h - 4 });
    });
    y += rows * h;
    if (i < blocks.length - 1) {
      roads.push({ y: y + 6, label: i % 2 === 0 ? '30 FT ROAD' : '24 FT ROAD' });
      y += 34;
    }
  });
  const parkY = y + 20;
  const H = parkY + 170;
  const trees = Array.from({ length: 18 }, (_, i) => ({ x: margin + 20 + ((i * 137) % (usable - 40)), y: parkY + 26 + ((i * 53) % 110) }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Site plan">
      <defs>
        <pattern id="grass" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#d9eed1" />
          <circle cx="3" cy="3" r="0.8" fill="#bcdcae" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="18" fill="#f4f1ea" />
      {/* main road and gate */}
      <rect x="0" y="18" width={W} height="46" fill="#c9cdd3" />
      <line x1="0" y1="41" x2={W} y2="41" stroke="#fff" strokeWidth="2" strokeDasharray="18 14" />
      <text x="24" y="46" fontSize="13" fontWeight="600" fill="#4b5563">
        40 FT MAIN ROAD
      </text>
      <rect x={W / 2 - 40} y="62" width="80" height="22" rx="4" fill="#94a3b8" />
      <text x={W / 2} y="77" fontSize="11" textAnchor="middle" fontWeight="700" fill="#fff">
        ENTRANCE
      </text>
      {roads.map((r) => (
        <g key={r.y}>
          <rect x={margin - 8} y={r.y} width={usable + 16} height="22" fill="#d6d9de" />
          <text x={W / 2} y={r.y + 15} fontSize="10" textAnchor="middle" fill="#6b7280">
            {r.label}
          </text>
        </g>
      ))}
      {labels.map((l) => (
        <text key={l.text + l.y} x={l.x} y={l.y + 5} fontSize="16" fontWeight="700" textAnchor="end" fill="#64748b">
          {l.text}
        </text>
      ))}
      {shapes.map(({ u, x, y: sy, w, h }) => {
        const s = STATE_STYLE[u.state];
        return (
          <g key={u.unitNumber} onClick={() => onPick(u)} className="cursor-pointer" opacity={u.dim ? 0.25 : 1}>
            <title>{`${u.unitNumber} · ${u.kindLabel} · ${s.label}${u.price ? ` · ${formatINR(u.price)}` : ''}`}</title>
            <rect x={x} y={sy} width={w} height={h} rx="3" fill={s.fill} stroke={u.selected ? '#0f172a' : s.stroke} strokeWidth={u.selected ? 3 : 1.2} />
            {u.corner && <path d={`M ${x} ${sy + 10} L ${x + 10} ${sy}`} stroke={s.stroke} strokeWidth="2" />}
            <text x={x + w / 2} y={sy + h / 2 - 2} fontSize={w > 50 ? 11 : 9} fontWeight="700" textAnchor="middle" fill={s.text}>
              {u.unitNumber.split('-')[1] ?? u.unitNumber}
            </text>
            {w > 44 && (
              <text x={x + w / 2} y={sy + h / 2 + 11} fontSize="8.5" textAnchor="middle" fill={s.text} opacity="0.8">
                {u.kindLabel.replace(' ft', '')}
              </text>
            )}
          </g>
        );
      })}
      {/* park with a pond and trees */}
      <rect x={margin - 8} y={parkY} width={usable + 16} height="150" rx="14" fill="url(#grass)" stroke="#a7d39a" />
      <path d={`M ${margin + 10} ${parkY + 120} C ${margin + 220} ${parkY + 20}, ${margin + 420} ${parkY + 160}, ${W - margin - 10} ${parkY + 40}`} stroke="#efe6d2" strokeWidth="10" fill="none" strokeLinecap="round" />
      <ellipse cx={W - margin - 170} cy={parkY + 80} rx="70" ry="34" fill="#a9d6ee" stroke="#7fbfe0" />
      <path d={`M ${W - margin - 200} ${parkY + 82} q 12 -6 24 0 M ${W - margin - 160} ${parkY + 92} q 12 -6 24 0`} stroke="#fff" strokeWidth="2" fill="none" />
      {trees.map((t, i) => (
        <g key={i}>
          <circle cx={t.x} cy={t.y} r="9" fill="#7cbf6b" />
          <circle cx={t.x - 3} cy={t.y - 3} r="4" fill="#9ad18a" />
        </g>
      ))}
      <text x={margin + 6} y={parkY + 20} fontSize="12" fontWeight="700" fill="#3f7a35">
        PARK · OPEN SPACE (OSR)
      </text>
      {/* compass */}
      <g transform={`translate(${W - 40} ${parkY - 30})`}>
        <circle r="18" fill="#fff" stroke="#cbd5e1" />
        <path d="M 0 -13 L 5 4 L 0 1 L -5 4 Z" fill="#334155" />
        <text y="-21" fontSize="10" textAnchor="middle" fontWeight="700" fill="#334155">
          N
        </text>
      </g>
    </svg>
  );
}

/**
 * One tower as an elevation: sky, a roof, every flat a window with a balcony,
 * and the lobby at the bottom.
 */
export function BuildingArt({ units, name, onPick }: { units: DrawUnit[]; name: string; onPick: (u: DrawUnit) => void }) {
  const floors = Math.max(1, ...units.map((u) => u.floor ?? 1));
  const per = Math.max(1, ...units.map((u) => u.pos + 1));
  const winW = 64;
  const winH = 30;
  const gap = 10;
  const floorH = winH + 16;
  const bw = per * (winW + gap) + gap + 40;
  const W = Math.max(520, bw + 160);
  const bx = (W - bw) / 2;
  const top = 70;
  const lobby = 56;
  const H = top + floors * floorH + lobby + 40;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-3xl" role="img" aria-label={`${name} elevation`}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe8fb" />
          <stop offset="1" stopColor="#f3f9ff" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} rx="18" fill="url(#sky)" />
      <circle cx={W - 70} cy="54" r="22" fill="#fde68a" opacity="0.9" />
      <g fill="#fff" opacity="0.9">
        <ellipse cx="90" cy="60" rx="38" ry="12" />
        <ellipse cx="120" cy="52" rx="26" ry="11" />
      </g>
      <rect x="0" y={H - 40} width={W} height="40" fill="#cfd8c8" />
      {/* building body */}
      <rect x={bx} y={top - 14} width={bw} height="14" rx="3" fill="#94a3b8" />
      <rect x={bx + 8} y={top} width={bw - 16} height={floors * floorH + lobby} fill="#e7e2d8" stroke="#cbc3b4" />
      <text x={W / 2} y={top - 22} fontSize="14" fontWeight="700" textAnchor="middle" fill="#334155">
        {name}
      </text>
      {Array.from({ length: floors }, (_, i) => floors - i).map((f, row) => (
        <g key={f}>
          <text x={bx - 8} y={top + row * floorH + floorH / 2 + 4} fontSize="10" textAnchor="end" fill="#64748b">
            {f}
          </text>
          {units
            .filter((u) => u.floor === f)
            .map((u) => {
              const s = STATE_STYLE[u.state];
              const x = bx + 20 + u.pos * (winW + gap);
              const y = top + row * floorH + 6;
              return (
                <g key={u.unitNumber} onClick={() => onPick(u)} className="cursor-pointer" opacity={u.dim ? 0.25 : 1}>
                  <title>{`${u.unitNumber} · ${u.kindLabel} · ${s.label}${u.price ? ` · ${formatINR(u.price)}` : ''}`}</title>
                  <rect x={x} y={y} width={winW} height={winH} rx="3" fill={s.fill} stroke={u.selected ? '#0f172a' : s.stroke} strokeWidth={u.selected ? 3 : 1.2} />
                  <line x1={x + winW / 2} y1={y + 2} x2={x + winW / 2} y2={y + winH - 2} stroke={s.stroke} strokeWidth="0.8" opacity="0.6" />
                  <rect x={x - 3} y={y + winH} width={winW + 6} height="4" rx="1" fill="#b8b0a2" />
                  <text x={x + winW / 2} y={y + winH / 2 + 4} fontSize="10" fontWeight="700" textAnchor="middle" fill={s.text}>
                    {u.unitNumber}
                  </text>
                </g>
              );
            })}
        </g>
      ))}
      {/* lobby */}
      <rect x={W / 2 - 40} y={top + floors * floorH + 10} width="80" height={lobby - 10} rx="3" fill="#7c8ea6" />
      <line x1={W / 2} y1={top + floors * floorH + 10} x2={W / 2} y2={top + floors * floorH + lobby} stroke="#cbd5e1" />
      <text x={W / 2} y={top + floors * floorH + lobby + 22} fontSize="10" textAnchor="middle" fill="#475569">
        LOBBY · PARKING
      </text>
    </svg>
  );
}
