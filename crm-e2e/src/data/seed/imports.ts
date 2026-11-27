/**
 * Three finished import jobs (foundation-plan §6.4). A job in progress lives in the Import page's state; only
 * finished jobs are stored. The builder price list updated 6 existing listings. The 99acres file's imported rows
 * are summarised by its counts (the demo keeps the 23-lead current pipeline from §6.4), so its createdIds is empty.
 */
import type { ImportJob } from '@/domain/types'
import type { Clock } from './dates'
import { ADMIN_ID, MANAGER_ID } from './users'

export function seedImportJobs(c: Clock): ImportJob[] {
  return [
    {
      id: 'IMP-1001', kind: 'apartments', fileName: 'builder-price-list-nov.xlsx', fileType: 'xlsx', template: 'custom',
      createdBy: ADMIN_ID, createdAt: c.ago(3, 'days'), finishedAt: c.ago(3, 'days'), status: 'completed',
      mapping: [
        { column: 'Project', field: 'projectName', confidence: 0.97, method: 'synonym' },
        { column: 'Unit Type', field: 'configuration', confidence: 0.92, method: 'synonym' },
        { column: 'Carpet (sft)', field: 'area.carpet', confidence: 0.88, method: 'fuzzy' },
        { column: 'Rate (Rs)', field: 'price', confidence: 0.9, method: 'value' },
        { column: 'Locality', field: 'location.locality', confidence: 0.95, method: 'synonym' },
        { column: 'RERA No', field: 'rera.number', confidence: 0.99, method: 'template' },
      ],
      counts: { total: 6, imported: 0, updated: 6, skipped: 0, duplicates: 0, errors: 0, drafts: 0 },
      createdIds: [], draftIds: [], errorRows: [],
    },
    {
      id: 'IMP-1002', kind: 'document', fileName: 'neelam-heights-brochure.pdf', fileType: 'pdf', template: 'document',
      createdBy: ADMIN_ID, createdAt: c.ago(2, 'days'), finishedAt: c.ago(2, 'days'), status: 'completed',
      counts: { total: 1, imported: 0, updated: 0, skipped: 0, duplicates: 0, errors: 0, drafts: 1 },
      createdIds: [], draftIds: ['DRF-1001'], errorRows: [],
    },
    {
      id: 'IMP-1003', kind: 'leads', fileName: '99acres-leads.csv', fileType: 'csv', template: 'default',
      createdBy: MANAGER_ID, createdAt: c.ago(1, 'days'), finishedAt: c.ago(1, 'days'), status: 'partial',
      mapping: [
        { column: 'Name', field: 'name', confidence: 1, method: 'template' },
        { column: 'Mobile', field: 'phone', confidence: 1, method: 'template' },
        { column: 'Email', field: 'email', confidence: 1, method: 'template' },
        { column: 'City', field: 'requirement.cities', confidence: 0.95, method: 'template' },
        { column: 'Budget', field: 'requirement.budgetMax', confidence: 0.85, method: 'value' },
        { column: 'Property Type', field: 'requirement.propertyTypes', confidence: 0.9, method: 'synonym' },
      ],
      counts: { total: 40, imported: 34, updated: 0, skipped: 0, duplicates: 4, errors: 2, drafts: 0 },
      createdIds: [], draftIds: [],
      errorRows: [{ row: 17, messages: ['phoneInvalid'] }, { row: 31, messages: ['nameMissing', 'phoneMissing'] }],
    },
  ]
}
