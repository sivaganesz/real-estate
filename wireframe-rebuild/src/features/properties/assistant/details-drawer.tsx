import { FileText, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { EmptyState } from '@/components/app/empty-state'
import { Segmented } from '@/components/app/segmented'
import type { Property } from '@/data/types'
import type { Draft } from '@/lib/assistant'
import { HistoryTab } from '../tabs/history-tab'
import { LegalTab } from '../tabs/legal-tab'
import { DetailsForm, type FocusTarget, type FormHandlers } from './details-form'
import { MediaTab } from './media-tab'

export const DRAWER_TABS = ['details', 'media', 'legal', 'history'] as const
export type DrawerTab = (typeof DRAWER_TABS)[number]

/**
 * "Review all details": the form, media, documents and history in one drawer that slides in from the right,
 * beside the chat (spec-system-wireframe's drawer). Each tab has its own address, so a refresh keeps it open.
 * Media, documents and history belong to the saved draft, which exists once the property type is known.
 */
export function DetailsDrawer({ tab, onTab, onClose, draft, record, canWrite, focus, h }: {
  tab: DrawerTab | null
  onTab: (tab: DrawerTab) => void
  onClose: () => void
  draft: Draft
  record?: Property
  canWrite: boolean
  focus: FocusTarget | null
  h: FormHandlers
}) {
  const { t } = useTranslation()
  const media = record ? record.media.filter((m) => m.kind === 'photo' || m.kind === 'video').length : 0
  const legal = !record ? 0
    : record.approvals.length ? `${record.approvals.filter((a) => a.status !== 'pending').length}/${record.approvals.length}` : record.documents.length

  const needsRecord = (
    <EmptyState icon={FileText} title={t('drawer.needType')}
      action={<Button variant="outline" onClick={() => onTab('details')}>{t('drawer.tab.details')}</Button>}>
      <p className="max-w-sm text-sm text-muted-foreground">{t('drawer.needTypeHint')}</p>
    </EmptyState>
  )

  return (
    <Sheet open={!!tab} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" showCloseButton={false} className="gap-0 bg-background p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[38.75rem]">
        <div className="flex items-start gap-3 border-b bg-card px-4 pt-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base">{draft.title || t('props.details')}</SheetTitle>
            <SheetDescription className="text-meta">{t('drawer.subtitle')}</SheetDescription>
            <Segmented className="mt-3" label={t('drawer.sections')} value={tab ?? 'details'} onChange={onTab}
              segments={[
                { value: 'details', label: t('drawer.tab.details') },
                { value: 'media', label: t('drawer.tab.media', { count: media }) },
                { value: 'legal', label: t('drawer.tab.legal', { count: legal }) },
                { value: 'history', label: t('drawer.tab.history') },
              ]} />
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={t('drawer.close')} title={t('drawer.close')}><X /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-8 sm:px-5">
          {tab === 'details' && <DetailsForm draft={draft} record={record} canWrite={canWrite} focus={focus} h={h} />}
          {tab === 'media' && (record ? <MediaTab p={record} canWrite={canWrite} /> : needsRecord)}
          {tab === 'legal' && (record ? <LegalTab p={record} /> : needsRecord)}
          {tab === 'history' && (record ? <HistoryTab p={record} /> : needsRecord)}
        </div>
      </SheetContent>
    </Sheet>
  )
}
