import type { ReactNode } from 'react';
import { PillNav } from '@/components/PillNav';
import type { PillNavItem } from '@/components/PillNav';

/** Settings tabs grow per phase (PRD ADM-SET-02); later ones are shown greyed out. */
const TABS: PillNavItem[] = [
  { label: 'Company info', to: '/settings/company' },
  { label: 'Property types & amenities', to: '/settings/property-types' },
  { label: 'Visit slots', phase: 'Phase 3' },
];

/** The Settings top navbar at the top of the content, with the tab's actions on the right. */
export function SettingsNav({ actions }: { actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <PillNav label="Settings" items={TABS} />
      {actions && <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
