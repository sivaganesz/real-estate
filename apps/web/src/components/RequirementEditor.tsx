import clsx from 'clsx';
import { PROPERTY_TYPES, PROPERTY_TYPE_LABEL, FINANCING_LABEL, TIMELINE_LABEL, type Requirement } from '@estate/shared';
import { Field, Input, Select } from './ui';
import { usePlaces } from '../lib/property';

const lakhs = (v?: number | null) => (v ? String(+(v / 100_000).toFixed(2)) : '');

/** A compact editor for what a customer wants. Budget is typed in lakhs, as people say it. */
export function RequirementEditor({ value, onChange }: { value: Partial<Requirement>; onChange: (r: Partial<Requirement>) => void }) {
  const places = usePlaces();
  const r = value;
  const set = <K extends keyof Requirement>(k: K, v: Requirement[K] | undefined | null) => onChange({ ...r, [k]: v === '' || v === null ? undefined : v });
  const rent = r.purpose === 'rent';
  const money = (s: string) => (s === '' ? undefined : rent ? Number(s) : Math.round(Number(s) * 100_000));
  return (
    <div className="space-y-3">
      <div>
        <span className="label">Type</span>
        <div className="flex flex-wrap gap-1.5">
          {PROPERTY_TYPES.map((t) => {
            const on = r.types?.includes(t);
            return (
              <button
                type="button"
                key={t}
                onClick={() => set('types', on ? r.types!.filter((x) => x !== t) : [...(r.types ?? []), t])}
                className={clsx('rounded-full border px-2.5 py-1 text-xs', on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600')}
              >
                {PROPERTY_TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="For">
          <Select value={r.purpose ?? 'sale'} onChange={(e) => set('purpose', e.target.value as Requirement['purpose'])}>
            <option value="sale">Buying</option>
            <option value="rent">Renting</option>
            <option value="lease">Lease</option>
          </Select>
        </Field>
        <Field label="BHK (min)">
          <Input type="number" min={1} max={10} value={r.bedrooms ?? ''} onChange={(e) => set('bedrooms', e.target.value ? Number(e.target.value) : undefined)} />
        </Field>
        <Field label={rent ? 'Rent from (₹)' : 'Budget from (lakhs)'}>
          <Input inputMode="decimal" value={rent ? r.budgetMin ?? '' : lakhs(r.budgetMin)} onChange={(e) => set('budgetMin', money(e.target.value))} />
        </Field>
        <Field label={rent ? 'Rent up to (₹)' : 'Budget up to (lakhs)'}>
          <Input inputMode="decimal" value={rent ? r.budgetMax ?? '' : lakhs(r.budgetMax)} onChange={(e) => set('budgetMax', money(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <Input list="req-cities" value={r.city ?? ''} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="Localities (comma separated)">
          <Input list="req-localities" value={(r.localities ?? []).join(', ')} onChange={(e) => set('localities', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        </Field>
        <datalist id="req-cities">{places.data?.cities.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="req-localities">{places.data?.localities.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="When">
          <Select value={r.timeline ?? ''} onChange={(e) => set('timeline', (e.target.value || undefined) as Requirement['timeline'])}>
            <option value="">Not discussed</option>
            {Object.entries(TIMELINE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paying by">
          <Select value={r.financing ?? ''} onChange={(e) => set('financing', (e.target.value || undefined) as Requirement['financing'])}>
            <option value="">Not discussed</option>
            {Object.entries(FINANCING_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Must-haves (comma separated)">
        <Input value={(r.mustHaves ?? []).join(', ')} onChange={(e) => set('mustHaves', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="East facing, Gated community, Near a school" />
      </Field>
    </div>
  );
}
