/** Seeded settings and saved views (foundation-plan §6.4). */
import type { SavedView, Settings } from '@/domain/types'
import { DEFAULT_SETTINGS } from '@/domain/catalogue'
import { ARJUN, MANAGER_ID, SNEHA, VIKRAM } from './users'

export function seedSettings(): Settings {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    assignment: {
      autoAssign: true,
      rrCursor: ARJUN,
      rules: [
        { id: 'rule-location-south', kind: 'location', values: ['Hyderabad', 'Chennai'], userIds: [SNEHA], enabled: true, scope: 'global' },
        { id: 'rule-source-cp', kind: 'source', values: ['channelPartner'], userIds: [VIKRAM], enabled: false, scope: 'global' },
      ],
    },
  }
}

export function seedSavedViews(): SavedView[] {
  const execViews = (userId: string, n: number): SavedView[] => [
    { id: `SV-${1000 + n}`, userId, module: 'leads', name: 'Hot', filters: { temperature: ['hot'] }, sort: { key: 'score', dir: 'desc' } },
    { id: `SV-${1001 + n}`, userId, module: 'tasks', name: 'Overdue', filters: { due: 'overdue' }, sort: { key: 'dueAt', dir: 'asc' } },
  ]
  return [
    ...execViews(ARJUN, 1),
    ...execViews(SNEHA, 3),
    ...execViews(VIKRAM, 5),
    { id: 'SV-1007', userId: MANAGER_ID, module: 'leads', name: 'Unassigned', filters: { owner: 'unassigned' }, sort: { key: 'createdAt', dir: 'asc' } },
    { id: 'SV-1008', userId: MANAGER_ID, module: 'pipeline', name: 'Stalled', filters: { aging: 'stalled' } },
  ]
}
