/**
 * Message templates (admin, `settings.templates`): WhatsApp / SMS / email texts per purpose in English or Hinglish,
 * used by the follow-up assistant and the share actions. Placeholders ({{firstName}}, {{property}}, {{time}}…) are
 * filled per lead. Add or edit by hand, or "Draft with AI" (simulated, Demo AI badge); a live preview shows the text
 * with sample values; delete asks first and offers Undo.
 */
import { useMemo, useState } from 'react'
import { Mail, MessageCircle, MessageSquare, Pencil, Plus, Trash2, Wand2, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getAI } from '@/ai'
import { AIFieldMarker } from '@/components/ai/ai-field'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { Callout } from '@/components/shared/callout'
import { Chip } from '@/components/shared/chip'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterPill } from '@/components/shared/filter-pill'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { EmptySettings } from '@/components/illustrations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MESSAGE_PURPOSES } from '@/domain/catalogue'
import type { MessagePurpose, MessageTemplate } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { firstName, inrShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { deleteTemplate, saveTemplate } from '@/services/settings'
import { PLACEHOLDERS, draftTemplate, fillTemplate, groupTemplates, smsParts, unknownPlaceholders } from '../lib/settings-logic'

const CHANNEL_ICON: Record<MessageTemplate['channel'], LucideIcon> = { whatsapp: MessageCircle, sms: MessageSquare, email: Mail }
const CHANNELS: MessageTemplate['channel'][] = ['whatsapp', 'sms', 'email']
type Draft = Omit<MessageTemplate, 'id'> & { id?: string }

export function TemplatesSection() {
  const { t } = useTranslation(['settings', 'catalogue'])
  const templates = useDb((db) => db.settings.templates)
  const [channels, setChannels] = useState<string[]>([])
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null)
  const sample = useSample()
  const groups = useMemo(() => groupTemplates(templates.filter((x) => !channels.length || channels.includes(x.channel)), MESSAGE_PURPOSES), [templates, channels])

  const remove = (tpl: MessageTemplate) => {
    try {
      const r = deleteTemplate(tpl.id)
      toastUndo(t('settings:templates.deleted'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <SectionCard
      title={t('settings:templates.title')} description={t('settings:templates.body', { p1: '{{firstName}}', p2: '{{property}}' })}
      action={<Button onClick={() => setEditing({ purpose: 'followUp', channel: 'whatsapp', tone: 'english', body: '' })} data-testid="template-add"><Plus aria-hidden="true" />{t('settings:templates.add')}</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPill label={t('settings:templates.channel')} selected={channels} onChange={setChannels}
          options={CHANNELS.map((c) => ({ value: c, label: t(`settings:templates.channels.${c}`), count: templates.filter((x) => x.channel === c).length }))} />
        <span className="text-meta text-muted-foreground">{t('settings:templates.count', { count: templates.length })}</span>
      </div>
      {templates.length === 0 ? (
        <EmptyState compact illustration={EmptySettings} title={t('settings:templates.emptyTitle')} body={t('settings:templates.emptyBody')} />
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('settings:templates.noneForChannel')}</p>
      ) : (
        <div className="flex flex-col gap-5" data-testid="template-list">
          {groups.map((g) => (
            <section key={g.purpose} aria-label={t(`catalogue:messagePurpose.${g.purpose}`)}>
              <h3 className="mb-2 text-caption font-semibold tracking-[0.06em] text-subtle-foreground uppercase [:lang(ta)_&]:tracking-normal [:lang(ta)_&]:normal-case">{t(`catalogue:messagePurpose.${g.purpose}`)}</h3>
              <ul className="grid gap-3 lg:grid-cols-2">
                {g.items.map((tpl) => {
                  const Icon = CHANNEL_ICON[tpl.channel]
                  return (
                    <li key={tpl.id} className="flex flex-col gap-2 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex size-6 items-center justify-center rounded-md', tpl.channel === 'whatsapp' ? 'bg-success-soft text-success' : 'bg-info-soft text-info')}><Icon className="size-3.5" aria-hidden="true" /></span>
                        <span className="text-meta font-medium">{t(`settings:templates.channels.${tpl.channel}`)}</span>
                        <span className="rounded-full bg-muted px-2 text-micro font-semibold text-muted-foreground">{t(`settings:templates.tones.${tpl.tone}`)}</span>
                        <span className="ml-auto flex">
                          <Button variant="ghost" size="icon-xs" onClick={() => setEditing({ ...tpl })} aria-label={t('settings:templates.edit')}><Pencil aria-hidden="true" /></Button>
                          <Button variant="ghost" size="icon-xs" onClick={() => setDeleting(tpl)} aria-label={t('settings:templates.delete')} className="text-muted-foreground hover:text-danger"><Trash2 aria-hidden="true" /></Button>
                        </span>
                      </div>
                      <p className="line-clamp-3 text-sm whitespace-pre-line text-foreground/90">{fillTemplate(tpl.body, sample)}</p>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {editing && <TemplateEditor draft={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} tone="danger"
        title={t('settings:templates.deleteTitle')} description={t('settings:templates.deleteBody')} confirmLabel={t('settings:templates.delete')}
        onConfirm={() => {
          if (deleting) remove(deleting)
          setDeleting(null)
        }}
      />
    </SectionCard>
  )
}

/** Sample values for previews: the current user as the agent, a demo buyer and property. */
function useSample() {
  const { t } = useTranslation('settings')
  const { user } = usePermission()
  return { firstName: t('templates.sample.firstName'), agent: firstName(user.name), property: t('templates.sample.property'), time: t('templates.sample.time'), map: 'maps.app.goo.gl/xyz', price: inrShort(11_500_000), link: 'realspec.in/s/abc' }
}

function TemplateEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { t } = useTranslation(['settings', 'catalogue', 'common'])
  const [d, setD] = useState<Draft>(draft)
  const [aiBody, setAiBody] = useState(false)
  const sample = useSample()
  const unknown = unknownPlaceholders(d.body)
  const insert = (p: string) => {
    setD((x) => ({ ...x, body: `${x.body}${x.body && !x.body.endsWith(' ') ? ' ' : ''}{{${p}}}` }))
  }
  const ai = () => {
    setD((x) => ({ ...x, body: draftTemplate(x.purpose, x.channel, x.tone) }))
    setAiBody(true)
  }
  const save = () => {
    try {
      saveTemplate(d)
      toast.success(d.id ? t('settings:templates.updated') : t('settings:templates.added'))
      onClose()
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" data-testid="template-editor">
        <DialogHeader>
          <DialogTitle>{d.id ? t('settings:templates.editTitle') : t('settings:templates.addTitle')}</DialogTitle>
          <DialogDescription>{t('settings:templates.editorBody')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('settings:templates.purpose')}
            <Select value={d.purpose} onValueChange={(v) => setD({ ...d, purpose: v as MessagePurpose })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{MESSAGE_PURPOSES.map((p) => <SelectItem key={p} value={p}>{t(`catalogue:messagePurpose.${p}`)}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            {t('settings:templates.channel')}
            <Segmented<MessageTemplate['channel']> variant="pill" value={d.channel} onChange={(channel) => setD({ ...d, channel })} label={t('settings:templates.channel')}
              segments={CHANNELS.map((c) => ({ value: c, label: t(`settings:templates.channels.${c}`) }))} />
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            {t('settings:templates.tone')}
            <Segmented<MessageTemplate['tone']> variant="pill" value={d.tone} onChange={(tone) => setD({ ...d, tone })} label={t('settings:templates.tone')}
              segments={(['english', 'hinglish'] as const).map((x) => ({ value: x, label: t(`settings:templates.tones.${x}`) }))} />
          </div>
        </div>
        <div className={cn('flex flex-col gap-1.5 rounded-md', aiBody && 'ai-filled -mx-2 px-2 py-1.5')}>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="tpl-body" className="flex items-center gap-1.5 text-sm font-medium">{t('settings:templates.message')}<AIFieldMarker meta={aiBody ? { origin: 'ai', confidence: 0.9 } : undefined} /></label>
            <Button variant="ai" size="sm" className="ml-auto" onClick={ai} data-testid="template-ai"><Wand2 aria-hidden="true" />{t('settings:templates.draftAi')}</Button>
            <DemoAIBadge mode={getAI().mode} />
          </div>
          <Textarea id="tpl-body" rows={5} value={d.body} onChange={(e) => {
            setD({ ...d, body: e.target.value })
            setAiBody(false)
          }} data-testid="template-body" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-meta text-muted-foreground">{t('settings:templates.insert')}</span>
            {PLACEHOLDERS.map((p) => <Chip key={p} size="sm" dashed onClick={() => insert(p)}>{`{{${p}}}`}</Chip>)}
          </div>
          <p className="text-meta text-muted-foreground tabular-nums">
            {t('settings:templates.length', { count: d.body.length })}
            {d.channel === 'sms' && ` · ${t('settings:templates.smsParts', { count: smsParts(d.body) })}`}
          </p>
        </div>
        {unknown.length > 0 && <Callout tone="warning">{t('settings:templates.unknown', { list: unknown.map((u) => `{{${u}}}`).join(', ') })}</Callout>}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('settings:templates.preview')}</span>
          <div className={cn('max-w-md rounded-2xl rounded-bl-sm p-3 text-sm whitespace-pre-line', d.channel === 'whatsapp' ? 'bg-success-soft' : 'bg-muted')} data-testid="template-preview">
            {d.body.trim() ? fillTemplate(d.body, sample) : <span className="text-muted-foreground">{t('settings:templates.previewEmpty')}</span>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} disabled={!d.body.trim()} data-testid="template-save">{t('common:actions.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
