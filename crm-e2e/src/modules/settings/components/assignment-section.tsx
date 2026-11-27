/**
 * Assignment rules and automation (master prompt §10; `rules.configure`: admin all, manager team level).
 * - Auto-assign on / off (new leads, imports and AI-created leads go through the engine when on), with today's count.
 * - A workload cap per executive (optional).
 * - Rules by location, property type, language and source: add (manually or in words), edit, switch, delete (Undo).
 *   Managers edit their team's rules; company-wide rules are read-only for them.
 * - "Who would get a new lead?": try the engine on a sample lead and see the pick and why, before turning rules on.
 */
import { useMemo, useState } from 'react'
import { Lock, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getAI } from '@/ai'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { EffortSaved } from '@/components/ai/effort-saved'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { IconTile } from '@/components/shared/icon-tile'
import { SectionCard } from '@/components/shared/section-card'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptySettings } from '@/components/illustrations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CITY_NAMES, LANGUAGES_SPOKEN, LEAD_SOURCES, PROPERTY_TYPES } from '@/domain/catalogue'
import type { AssignmentRule, LeadSource, PropertyType } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { pickAssignee } from '@/lib/assignment'
import { localDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { deleteRule, setAutoAssign, setRuleEnabled, updateSettings } from '@/services/settings'
import { RULE_ICON, ruleValueLabel } from '../lib/rule-look'
import { RuleEditor } from './rule-editor'
import { SaveBar } from './save-bar'

const TYPES = Object.keys(PROPERTY_TYPES) as PropertyType[]

export function AssignmentSection() {
  const { t } = useTranslation(['settings', 'common', 'catalogue'])
  const db = useWholeDb()
  const now = useNow()
  const { user, scope } = usePermission()
  // team-level rule editing (managers): only their own reports and their own team's rules
  const isManager = scope('rules.configure') === 'team'
  const settings = db.settings.assignment
  const [editing, setEditing] = useState<AssignmentRule | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AssignmentRule | null>(null)
  const [cap, setCap] = useState(settings.maxActivePerExec ? String(settings.maxActivePerExec) : '')
  const savedCap = settings.maxActivePerExec ? String(settings.maxActivePerExec) : ''

  // the executives these rules can name: the whole floor for admins, the manager's own reports for managers
  const people = useMemo(() => db.users.filter((u) => u.role === 'executive' && u.status === 'active' && (!isManager || u.managerId === user.id)), [db.users, isManager, user.id])
  const rules = settings.rules.filter((r) => !isManager || r.scope === 'global' || r.scope.managerId === user.id)
  const editable = (r: AssignmentRule) => !isManager || (r.scope !== 'global' && r.scope.managerId === user.id)
  const today = localDay(now)
  const autoToday = db.assignments.filter((a) => a.mode === 'auto' && localDay(a.at) === today).length
  const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name ?? id

  const toggleAuto = (on: boolean) => {
    try {
      const r = setAutoAssign(on)
      toastUndo(on ? t('settings:assignment.autoOn') : t('settings:assignment.autoOff'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const capNum = cap.trim() === '' ? undefined : Number(cap)
  const capValid = capNum === undefined || (Number.isInteger(capNum) && capNum >= 1 && capNum <= 200)
  const saveCap = () => {
    try {
      const r = updateSettings('assignment', { maxActivePerExec: capNum })
      toastUndo(t('settings:assignment.capSaved'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const toggleRule = (r: AssignmentRule, on: boolean) => {
    try {
      setRuleEnabled(r.id, on)
      toast.success(on ? t('settings:rules.enabled') : t('settings:rules.disabled'))
    } catch (e) {
      toastError(e)
    }
  }
  const remove = (r: AssignmentRule) => {
    try {
      const res = deleteRule(r.id)
      toastUndo(t('settings:rules.deleted'), res.undoToken)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('settings:assignment.autoTitle')} description={t('settings:assignment.autoBody')}>
        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <span className="min-w-0">
              <span className="block font-medium">{t('settings:assignment.autoLabel')}</span>
              <span className="block text-meta text-muted-foreground">{settings.autoAssign ? t('settings:assignment.autoOnHint') : t('settings:assignment.autoOffHint')}</span>
            </span>
            <Switch checked={settings.autoAssign} onCheckedChange={toggleAuto} aria-label={t('settings:assignment.autoLabel')} data-testid="auto-assign-switch" />
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {autoToday > 0 ? <EffortSaved count={autoToday} kind="leads" /> : <p className="text-meta text-muted-foreground">{t('settings:assignment.noneToday')}</p>}
            {isManager && <p className="text-meta text-muted-foreground">{t('settings:assignment.managerNote')}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cap" className="text-sm font-medium">{t('settings:assignment.cap')} <span className="font-normal text-muted-foreground">{t('common:optional')}</span></label>
            <div className="flex items-center gap-2">
              <Input id="cap" type="number" inputMode="numeric" min={1} max={200} value={cap} onChange={(e) => setCap(e.target.value)} className="w-36" aria-invalid={!capValid} placeholder={t('settings:assignment.capNone')} />
              <span className="text-meta text-muted-foreground">{t('settings:assignment.capHint')}</span>
            </div>
          </div>
          <SaveBar dirty={cap !== savedCap} valid={capValid} invalidText={t('settings:errors.range', { min: 1, max: 200 })} onSave={saveCap} onDiscard={() => setCap(savedCap)} />
        </div>
      </SectionCard>

      <SectionCard
        title={t('settings:rules.title')} description={t('settings:rules.body')}
        action={<Button onClick={() => setEditing('new')} disabled={!people.length} data-testid="rule-add"><Plus aria-hidden="true" />{t('settings:rules.add')}</Button>}
      >
        {rules.length === 0 ? (
          <EmptyState compact illustration={EmptySettings} title={t('settings:rules.emptyTitle')} body={t('settings:rules.emptyBody')}
            primary={<Button variant="secondary" onClick={() => setEditing('new')} disabled={!people.length}><Plus aria-hidden="true" />{t('settings:rules.add')}</Button>} />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="rule-list">
            {rules.map((r) => {
              const Icon = RULE_ICON[r.kind]
              const can = editable(r)
              return (
                <li key={r.id} className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-3', !r.enabled && 'bg-muted/40')} data-testid={`rule-${r.id}`}>
                  <IconTile icon={Icon} tone={r.enabled ? 'info' : 'neutral'} />
                  <div className="min-w-48 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{t(`settings:rules.kind.${r.kind}`)}</span>
                      {': '}
                      {r.values.map((v) => ruleValueLabel(t, r.kind, v)).join(', ')}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
                      {t('settings:rules.goesTo')}
                      {r.userIds.length ? r.userIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-0.5 text-foreground"><UserAvatar name={nameOf(id)} size="xs" />{nameOf(id)}</span>
                      )) : <span className="text-warning">{t('settings:rules.nobody')}</span>}
                      <span aria-hidden="true">·</span>
                      {r.scope === 'global' ? t('settings:rules.scopeGlobal') : t('settings:rules.scopeTeam', { name: nameOf(r.scope.managerId) })}
                    </p>
                  </div>
                  {can ? (
                    <div className="flex items-center gap-1">
                      <Switch checked={r.enabled} onCheckedChange={(on) => toggleRule(r, on)} aria-label={t('settings:rules.toggle')} />
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={t('settings:rules.edit')}><Pencil aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(r)} aria-label={t('settings:rules.delete')} className="text-muted-foreground hover:text-danger"><Trash2 aria-hidden="true" /></Button>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-meta text-muted-foreground"><Lock className="size-3" aria-hidden="true" />{r.enabled ? t('settings:rules.on') : t('settings:rules.off')}</span>
                      </TooltipTrigger>
                      <TooltipContent>{t('settings:rules.readOnly')}</TooltipContent>
                    </Tooltip>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-meta text-muted-foreground">{t('settings:rules.order')}</p>
      </SectionCard>

      <Simulator managerId={isManager ? user.id : undefined} />

      {editing && <RuleEditor open={!!editing} onOpenChange={(o) => !o && setEditing(null)} rule={editing === 'new' ? undefined : editing} people={people} />}
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} tone="danger"
        title={t('settings:rules.deleteTitle')} description={t('settings:rules.deleteBody')} confirmLabel={t('settings:rules.delete')}
        onConfirm={() => {
          if (deleting) remove(deleting)
          setDeleting(null)
        }}
      />
    </div>
  )
}

/** Runs the engine on a made-up lead so people can see what their rules do. */
function Simulator({ managerId }: { managerId?: string }) {
  const { t } = useTranslation(['settings', 'catalogue', 'common'])
  const db = useWholeDb()
  const [city, setCity] = useState(CITY_NAMES[0])
  const [type, setType] = useState<PropertyType>('apartment')
  const [language, setLanguage] = useState('English')
  const [source, setSource] = useState<LeadSource>('website')
  const pick = useMemo(() => pickAssignee({
    lead: { requirement: { cities: [city], localities: [], propertyTypes: [type], configurations: [], budgetFlexPct: 10, possession: 'any', facing: [], amenities: [], mustHaves: [], purpose: 'sale' }, source, preferredLanguage: language },
    users: db.users, leads: db.leads, settings: db.settings.assignment, managerId,
  }), [city, type, language, source, db, managerId])
  const nameOf = (id: string | null) => (id ? db.users.find((u) => u.id === id)?.name : undefined) ?? t('settings:simulator.nobody')
  const field = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <label className="flex min-w-36 flex-1 flex-col gap-1.5 text-sm font-medium">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  )
  return (
    <SectionCard title={t('settings:simulator.title')} description={t('settings:simulator.body')} icon={Sparkles}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {field(t('settings:simulator.city'), city, setCity, CITY_NAMES.map((c) => ({ value: c, label: c })))}
          {field(t('settings:simulator.type'), type, (v) => setType(v as PropertyType), TYPES.map((x) => ({ value: x, label: t(`catalogue:propertyType.${x}`) })))}
          {field(t('settings:simulator.language'), language, setLanguage, LANGUAGES_SPOKEN.map((l) => ({ value: l, label: t(`settings:language.${l}`) })))}
          {field(t('settings:simulator.source'), source, (v) => setSource(v as LeadSource), LEAD_SOURCES.map((s) => ({ value: s, label: t(`catalogue:source.${s}`) })))}
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-soft/30 p-4" data-testid="simulator-result" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            {pick.userId && <UserAvatar name={nameOf(pick.userId)} size="sm" />}
            <span className="text-sm font-semibold">{pick.userId ? t('settings:simulator.goesTo', { name: nameOf(pick.userId) }) : t('settings:simulator.queue')}</span>
            <span className="text-meta text-muted-foreground">· {t(`catalogue:assignmentReason.${pick.reason.key}`)}</span>
            <DemoAIBadge mode={getAI().mode} className="ml-auto" />
          </div>
          {pick.candidates.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={t('settings:simulator.pool')}>
              {pick.candidates.map((id) => (
                <li key={id} className={cn('inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-meta', id === pick.userId && 'border-primary/40 bg-primary-soft text-primary')}>
                  <UserAvatar name={nameOf(id)} size="xs" />{nameOf(id)} <span className="tabular-nums text-muted-foreground">{t('settings:simulator.open', { count: pick.workload[id] ?? 0 })}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-meta text-muted-foreground">{t('settings:simulator.note')}</p>
        </div>
      </div>
    </SectionCard>
  )
}
