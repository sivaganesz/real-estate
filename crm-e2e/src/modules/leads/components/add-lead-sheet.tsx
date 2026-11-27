/**
 * Add lead as a 3-step side sheet over the list (agreed UX from wireframe-rebuild's add-lead-sheet.tsx): the AI
 * paste box on top of step 1, Back / Next, and Save from any step once name, phone or e-mail, and source are set.
 * Closing with unsaved input asks first. After saving, the new lead opens.
 */
import { useEffect, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Drawer } from '@/components/shared/drawer'
import { Button } from '@/components/ui/button'
import { LeadEditorBody, LeadEditorFooter } from './lead-editor'
import { useLeadEditor } from './use-lead-editor'

export function AddLeadSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation(['leads', 'ui'])
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const close = () => { setDirty(false); onOpenChange(false) }
  return (
    <>
      <Drawer open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} dirty={dirty} size="lg"
        // the sheet primitive caps right sheets at max-w-sm through a data-[side] variant; restate the 640 px width (requests-m2-leads-clients.md R1)
        className="max-md:data-[side=right]:w-full max-md:data-[side=right]:max-w-none md:data-[side=right]:w-[640px] md:data-[side=right]:max-w-[640px]" title={t('leads:add.title')} subtitle={t('leads:add.subtitle')}>
        {/* the body remounts on every opening so each lead starts clean */}
        {open && <SheetBody onDirty={setDirty} onClose={close} onCancel={() => (dirty ? setAsking(true) : close())} />}
      </Drawer>
      <ConfirmDialog
        open={asking} onOpenChange={setAsking} tone="danger"
        title={t('ui:drawer.discardTitle')} description={t('ui:drawer.discardBody')}
        confirmLabel={t('ui:drawer.discard')} cancelLabel={t('ui:drawer.keepEditing')}
        onConfirm={close}
      />
    </>
  )
}

function SheetBody({ onClose, onCancel, onDirty }: { onClose: () => void; onCancel: () => void; onDirty: (d: boolean) => void }) {
  const { t } = useTranslation('leads')
  const navigate = useNavigate()
  const ed = useLeadEditor({ onSaved: (id) => { onClose(); navigate(paths.lead(id)) } })
  useEffect(() => onDirty(ed.dirty), [ed.dirty, onDirty])
  return (
    <>
      <div className="-mt-2 flex justify-end">
        <Button variant="ghost" size="xs" onClick={() => { onClose(); navigate(paths.newLead()) }}>
          <Maximize2 />{t('add.fullPage')}
        </Button>
      </div>
      <LeadEditorBody ed={ed} layout="steps" />
      <footer className="sticky -bottom-6 z-[1] -mx-5 -mb-5 mt-auto flex flex-wrap items-center justify-between gap-2 border-t bg-popover/95 p-4 backdrop-blur md:-mx-6 md:-mb-6">
        <LeadEditorFooter ed={ed} layout="steps" onCancel={onCancel} />
      </footer>
    </>
  )
}
