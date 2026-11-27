/** Import kinds as the pages show them: icon, tone, the permission they need, and the sample files to try. */
import { Building2, FileImage, FileSpreadsheet, FileText, Home, LandPlot, Store, Users, type LucideIcon } from 'lucide-react'
import { paths } from '@/app/paths'
import type { ImportJob, ImportKind } from '@/domain/types'
import type { Action } from '@/lib/permissions'
import type { Tone } from '@/lib/tones'
import type { SheetKind } from './fields'

export const KIND_ICON: Record<ImportKind, LucideIcon> = {
  leads: Users, apartments: Building2, villas: Home, plots: LandPlot, commercial: Store, document: FileText,
}
export const KIND_TONE: Record<ImportKind, Tone> = {
  leads: 'primary', apartments: 'info', villas: 'success', plots: 'warning', commercial: 'violet', document: 'ai',
}
/** The i18n key of a kind's one-line description: leads promise auto-assignment only while it is switched on. */
export const kindBodyKey = (kind: ImportKind, autoAssign: boolean) =>
  kind === 'leads' && !autoAssign ? 'import:kind.leads.bodyManual' : `import:kind.${kind}.body`
export const kindPermission = (kind: ImportKind): Action =>
  kind === 'leads' ? 'import.leads' : kind === 'document' ? 'import.document' : 'import.properties'

export type Sample = { file: string; kind: SheetKind | 'document'; type: 'csv' | 'xlsx' | 'pdf' | 'image' }
/** The files in public/samples (scripts/make-samples.mjs). `kind` is the wizard each one opens in. */
export const SAMPLES: Sample[] = [
  { file: 'leads-99acres-export.csv', kind: 'leads', type: 'csv' },
  { file: 'builder-price-list-custom.xlsx', kind: 'apartments', type: 'xlsx' },
  { file: 'apartment-brochure.pdf', kind: 'document', type: 'pdf' },
  { file: 'visiting-card.png', kind: 'document', type: 'image' },
  { file: 'handwritten-requirement.jpg', kind: 'document', type: 'image' },
]
export const sampleKey = (file: string) => file.replace(/\.[^.]+$/, '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

export const ACCEPT_SHEETS = ['.xlsx', '.xls', '.csv']
export const ACCEPT_DOCS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.txt']
export const MAX_FILE_MB = 10

export const JOB_STATUS_TONE: Record<ImportJob['status'], Tone> = { completed: 'success', partial: 'warning', failed: 'danger', cancelled: 'neutral' }
export const FILE_ICON: Record<ImportJob['fileType'], LucideIcon> = { xlsx: FileSpreadsheet, csv: FileSpreadsheet, pdf: FileText, image: FileImage, text: FileText }
export type CountKey = 'imported' | 'updated' | 'drafts' | 'duplicates' | 'errors'
export const COUNT_TONE: Record<CountKey, Tone> = { imported: 'success', updated: 'info', drafts: 'ai', duplicates: 'warning', errors: 'danger' }
export const COUNT_KEYS: CountKey[] = ['imported', 'updated', 'drafts', 'duplicates', 'errors']

/** The wizard a sample opens in, with the file preloaded. */
export const sampleHref = (s: Sample) => `${paths.importKind(s.kind)}?sample=${encodeURIComponent(s.file)}`
