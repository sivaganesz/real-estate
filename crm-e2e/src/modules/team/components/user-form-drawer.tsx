/**
 * Add or edit a user (admin; master prompt §5.4): name, role, manager (executives), phone, email, cities and languages.
 * Manual, or AI: paste or speak a line ("Add Priya Nair as an executive under Rohit, priya@…, 98450 11122, Chennai,
 * Tamil") and the simulated reader fills the same form, marks what it filled (Iris) and lists what is still missing.
 * Nothing saves until Save; closing with changes asks first.
 */
import { useMemo, useState } from 'react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getAI } from '@/ai'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { EffortSaved } from '@/components/ai/effort-saved'
import { VoiceButton } from '@/components/ai/voice-button'
import { Chip } from '@/components/shared/chip'
import { Drawer } from '@/components/shared/drawer'
import { FormField } from '@/components/shared/form-field'
import { PhoneInput } from '@/components/shared/phone-input'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CITY_NAMES, LANGUAGES_SPOKEN } from '@/domain/catalogue'
import type { FieldMeta, ID, Role, User } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { ROLES } from '@/lib/permissions'
import { createUser, openLeadCount, updateUser, type UserPatch } from '@/services/users'
import { EMPTY_USER_DRAFT, extractUser, validateUserDraft, type UserDraft, type UserFieldError } from '../lib/user-input'
import { RedistributeDialog } from './redistribute-dialog'

const AI_META: FieldMeta = { origin: 'ai', confidence: 0.9 }

export function UserFormDrawer({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** The user being edited; omitted to add a new one. */
  editing?: User
  onSaved?: (id: ID) => void
}) {
  const { t } = useTranslation(['team', 'common'])
  const users = useDb((db) => db.users)
  const leads = useDb((x) => x.leads)
  const managers = useMemo(() => users.filter((u) => u.role === 'manager' && u.status === 'active'), [users])
  const initial = useMemo<UserDraft>(() => (editing
    ? { name: editing.name, role: editing.role, managerId: editing.managerId, phone: editing.phone, email: editing.email, cities: [...editing.cities], languages: [...editing.languages] }
    : { ...EMPTY_USER_DRAFT, managerId: managers[0]?.id }), [editing, managers])
  // mounted fresh each time it opens (callers render it only while open)
  const [d, setD] = useState<UserDraft>(initial)
  const [aiFields, setAiFields] = useState<Set<keyof UserDraft>>(new Set())
  const [missing, setMissing] = useState<(keyof UserDraft)[]>([])
  const [paste, setPaste] = useState('')
  const [reading, setReading] = useState(false)
  const [filledCount, setFilledCount] = useState<number | null>(null)
  const [tried, setTried] = useState(false)
  const [handOver, setHandOver] = useState<(UserPatch & { role: Role }) | null>(null)

  const errors = validateUserDraft(d, users, editing?.id)
  const errorOf = (field: keyof UserDraft) => {
    const e: UserFieldError | undefined = tried ? errors.find((x) => x.field === field) : undefined
    return e ? t(`team:form.errors.${e.key}`) : undefined
  }
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)
  const edit = <K extends keyof UserDraft>(k: K, v: UserDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    // a hand edit removes the AI marker from that field
    setAiFields((s) => {
      if (!s.has(k)) return s
      const next = new Set(s)
      next.delete(k)
      return next
    })
  }
  const toggleIn = (k: 'cities' | 'languages', v: string) => edit(k, d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v])
  const meta = (k: keyof UserDraft) => (aiFields.has(k) ? AI_META : undefined)

  const read = (text = paste) => {
    if (!text.trim()) return
    setReading(true)
    // the reader is synchronous; a short pause lets people see the fields fill in
    window.setTimeout(() => {
      const x = extractUser(text, managers)
      setD((cur) => ({ ...cur, ...x.fields }))
      setAiFields(new Set(x.filled))
      setMissing(x.missing)
      setFilledCount(x.filled.length)
      setReading(false)
      if (!x.filled.length) toast.info(t('team:form.ai.nothing'))
    }, 350)
  }

  const save = () => {
    setTried(true)
    if (errors.length) {
      toast.error(t('team:form.fixErrors'))
      return
    }
    try {
      const managerId = d.role === 'executive' ? d.managerId : undefined
      if (editing) {
        const patch = { name: d.name.trim(), role: d.role, managerId, phone: d.phone, email: d.email.trim(), cities: d.cities, languages: d.languages }
        // an executive moving to another role hands their open leads over first (same choices as deactivation)
        if (editing.role === 'executive' && d.role !== 'executive' && openLeadCount({ leads }, editing.id) > 0) {
          setHandOver(patch)
          return
        }
        updateUser(editing.id, patch)
        toast.success(t('team:form.updated', { name: d.name.trim() }))
        onSaved?.(editing.id)
      } else {
        const { id } = createUser({ name: d.name, role: d.role, managerId, phone: d.phone, email: d.email, cities: d.cities, languages: d.languages.length ? d.languages : ['English'] })
        toast.success(t('team:form.created', { name: d.name.trim(), role: t(`common:roles.${d.role}`) }))
        onSaved?.(id)
      }
      onOpenChange(false)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Drawer
      open={open} onOpenChange={onOpenChange} size="lg" dirty={dirty}
      title={editing ? t('team:form.editTitle', { name: editing.name }) : t('team:form.addTitle')}
      subtitle={editing ? t('team:form.editSubtitle') : t('team:form.addSubtitle')}
      footer={(
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} data-testid="user-save">{editing ? t('common:actions.save') : t('team:form.add')}</Button>
        </>
      )}
    >
      {!editing && (
        <section className="flex flex-col gap-3 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-4" aria-label={t('team:form.ai.title')}>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-ai" aria-hidden="true" />
            <span className="text-sm font-medium">{t('team:form.ai.title')}</span>
            <DemoAIBadge mode={getAI().mode} />
          </div>
          <Textarea
            value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={t('team:form.ai.placeholder')}
            aria-label={t('team:form.ai.title')} data-testid="user-paste"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ai" size="sm" onClick={() => read()} disabled={!paste.trim() || reading} aria-busy={reading} data-testid="user-extract">
              {reading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
              {t('team:form.ai.extract')}
            </Button>
            <VoiceButton size="icon-sm" onText={(text, final) => {
              setPaste(text)
              if (final) read(text)
            }} />
            <Chip tone="ai" size="sm" onClick={() => setPaste(t('team:form.ai.sample'))}>{t('team:form.ai.trySample')}</Chip>
            {filledCount !== null && <EffortSaved count={filledCount} className="ml-auto" />}
          </div>
          {filledCount !== null && missing.length > 0 && (
            <p className="text-meta text-muted-foreground" data-testid="user-missing">
              {t('team:form.ai.missing', { fields: missing.map((m) => t(`team:form.${m}`)).join(', ') })}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <AIField meta={meta('name')} className="sm:col-span-2">
          <FormField label={t('team:form.name')} required error={errorOf('name')} labelEnd={<AIFieldMarker meta={meta('name')} />}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={d.name} onChange={(e) => edit('name', e.target.value)} autoComplete="off" data-testid="user-name" />}
          </FormField>
        </AIField>

        <AIField meta={meta('role')} className="sm:col-span-2">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium">{t('team:form.role')}<AIFieldMarker meta={meta('role')} /></span>
            <Segmented<Role>
              variant="pill" value={d.role} onChange={(r) => edit('role', r)} label={t('team:form.role')}
              segments={ROLES.map((r) => ({ value: r, label: t(`common:roles.${r}`) }))}
            />
            <p className="text-xs text-muted-foreground">{t(`common:roleDescriptions.${d.role}`)}</p>
          </div>
        </AIField>

        {d.role === 'executive' && (
          <AIField meta={meta('managerId')} className="sm:col-span-2">
            <FormField label={t('team:form.managerId')} required error={errorOf('managerId')} labelEnd={<AIFieldMarker meta={meta('managerId')} />}>
              {({ id, describedBy, invalid }) => (
                <Select value={d.managerId ?? ''} onValueChange={(v) => edit('managerId', v)}>
                  <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={invalid} className="w-full"><SelectValue placeholder={t('team:form.pickManager')} /></SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </AIField>
        )}

        <AIField meta={meta('email')}>
          <FormField label={t('team:form.email')} required error={errorOf('email')} labelEnd={<AIFieldMarker meta={meta('email')} />}>
            {({ id, describedBy, invalid }) => <Input id={id} type="email" aria-describedby={describedBy} aria-invalid={invalid} value={d.email} onChange={(e) => edit('email', e.target.value)} autoComplete="off" data-testid="user-email" />}
          </FormField>
        </AIField>

        <AIField meta={meta('phone')}>
          <FormField label={t('team:form.phone')} optional error={errorOf('phone')} labelEnd={<AIFieldMarker meta={meta('phone')} />}>
            {({ id, describedBy, invalid }) => <PhoneInput id={id} describedBy={describedBy} invalid={invalid} value={d.phone} onChange={(v) => edit('phone', v)} />}
          </FormField>
        </AIField>

        <AIField meta={meta('cities')} className="sm:col-span-2">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{t('team:form.cities')} <span className="font-normal text-muted-foreground">{t('common:optional')}</span><AIFieldMarker meta={meta('cities')} /></legend>
            <div className="flex flex-wrap gap-1.5">
              {CITY_NAMES.map((c) => <Chip key={c} size="sm" pressed={d.cities.includes(c)} onClick={() => toggleIn('cities', c)}>{c}</Chip>)}
            </div>
          </fieldset>
        </AIField>

        <AIField meta={meta('languages')} className="sm:col-span-2">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{t('team:form.languages')} <span className="font-normal text-muted-foreground">{t('common:optional')}</span><AIFieldMarker meta={meta('languages')} /></legend>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES_SPOKEN.map((l) => <Chip key={l} size="sm" pressed={d.languages.includes(l)} onClick={() => toggleIn('languages', l)}>{t(`team:language.${l}`)}</Chip>)}
            </div>
          </fieldset>
        </AIField>
      </div>
      {handOver && editing && (
        <RedistributeDialog
          open user={editing} onOpenChange={(o) => { if (!o) setHandOver(null) }}
          roleChange={{ patch: handOver, onDone: () => { onSaved?.(editing.id); onOpenChange(false) } }}
        />
      )}
    </Drawer>
  )
}
