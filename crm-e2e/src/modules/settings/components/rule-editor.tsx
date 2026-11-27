/**
 * Add / edit an assignment rule (master prompt §10.4): kind (location, property type, language, source), the values it
 * matches and the executives it sends those leads to. Manual, or write it in words ("Send Chennai and Hyderabad leads
 * to Sneha") and the simulated reader fills the editor (Iris markers, Demo AI badge). Saves only on Save.
 */
import { useMemo, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getAI } from '@/ai'
import { AIFieldMarker } from '@/components/ai/ai-field'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { Chip } from '@/components/shared/chip'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LEAD_SOURCES, PROPERTY_TYPES } from '@/domain/catalogue'
import type { AssignmentRule, FieldMeta, PropertyType, User } from '@/domain/types'
import { cn } from '@/lib/utils'
import { saveRule } from '@/services/settings'
import { RULE_ICON, ruleValueLabel } from '../lib/rule-look'
import { readRule, ruleValueOptions, type RuleDraft } from '../lib/settings-logic'

const KINDS: AssignmentRule['kind'][] = ['location', 'propertyType', 'language', 'source']
const TYPES = Object.keys(PROPERTY_TYPES) as PropertyType[]
const AI_META: FieldMeta = { origin: 'ai', confidence: 0.9 }

export function RuleEditor({ open, onOpenChange, rule, people }: { open: boolean; onOpenChange: (o: boolean) => void; rule?: AssignmentRule; people: User[] }) {
  const { t } = useTranslation(['settings', 'common', 'catalogue'])
  const label = (kind: AssignmentRule['kind'], v: string) => ruleValueLabel(t, kind, v)
  // mounted fresh each time it opens (the caller renders it only while editing)
  const [d, setD] = useState<RuleDraft>(() => (rule ? { kind: rule.kind, values: [...rule.values], userIds: [...rule.userIds] } : { kind: 'location', values: [], userIds: [] }))
  const [ai, setAi] = useState<Set<keyof RuleDraft>>(new Set())
  const [words, setWords] = useState('')
  const [missing, setMissing] = useState<string[] | null>(null)
  const [alsoFound, setAlsoFound] = useState<string[]>([])
  const options = useMemo(() => ruleValueOptions(d.kind, LEAD_SOURCES, TYPES), [d.kind])
  const handEdit = (k: keyof RuleDraft) => setAi((s) => {
    const n = new Set(s)
    n.delete(k)
    return n
  })
  const toggle = (k: 'values' | 'userIds', v: string) => {
    setD((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }))
    handEdit(k)
  }
  const read = () => {
    const r = readRule(words, people)
    setD((x) => ({ kind: r.rule.kind ?? x.kind, values: r.rule.values ?? (r.rule.kind && r.rule.kind !== x.kind ? [] : x.values), userIds: r.rule.userIds ?? x.userIds }))
    setAi(new Set((['kind', 'values', 'userIds'] as const).filter((k) => k === 'kind' ? !!r.rule.kind : !!r.rule[k]?.length)))
    setMissing(r.missing.map((m) => t(`settings:rules.field.${m}`)))
    setAlsoFound(r.alsoFound.map((k) => t(`settings:rules.kind.${k}`)))
    if (!r.filled) toast.info(t('settings:rules.ai.nothing'))
  }
  const valid = d.values.length > 0 && d.userIds.length > 0
  const save = () => {
    try {
      saveRule({ ...d, id: rule?.id, enabled: rule?.enabled ?? true, scope: rule?.scope ?? 'global' })
      toast.success(rule ? t('settings:rules.updated') : t('settings:rules.added'))
      onOpenChange(false)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl" data-testid="rule-editor">
        <DialogHeader>
          <DialogTitle>{rule ? t('settings:rules.editTitle') : t('settings:rules.addTitle')}</DialogTitle>
          <DialogDescription>{t('settings:rules.editorBody')}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-3" aria-label={t('settings:rules.ai.title')}>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{t('settings:rules.ai.title')}<DemoAIBadge mode={getAI().mode} /></div>
          <div className="flex gap-2">
            <Input value={words} onChange={(e) => setWords(e.target.value)} placeholder={t('settings:rules.ai.placeholder')} aria-label={t('settings:rules.ai.title')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && words.trim()) {
                  e.preventDefault()
                  read()
                }
              }} data-testid="rule-words" />
            <Button variant="ai" onClick={read} disabled={!words.trim()} data-testid="rule-read"><Wand2 aria-hidden="true" />{t('settings:rules.ai.read')}</Button>
          </div>
          {missing && missing.length > 0 && <p className="text-meta text-muted-foreground">{t('settings:rules.ai.missing', { fields: missing.join(', ') })}</p>}
          {alsoFound.length > 0 && <p className="text-meta text-muted-foreground" data-testid="rule-also-found">{t('settings:rules.ai.alsoFound', { kinds: alsoFound.join(', ') })}</p>}
        </section>

        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">{t('settings:rules.field.kind')}<AIFieldMarker meta={ai.has('kind') ? AI_META : undefined} /></span>
          <Segmented<AssignmentRule['kind']>
            variant="pill" value={d.kind} label={t('settings:rules.field.kind')}
            onChange={(kind) => {
              setD((x) => ({ ...x, kind, values: [] }))
              handEdit('kind')
            }}
            segments={KINDS.map((k) => {
              const Icon = RULE_ICON[k]
              return { value: k, label: t(`settings:rules.kind.${k}`), icon: <Icon aria-hidden="true" /> }
            })}
            className="flex-wrap"
          />
        </div>

        <div role="group" aria-labelledby="rule-values" className={cn('flex flex-col gap-1.5 rounded-md transition-colors duration-(--dur-base)', ai.has('values') && 'ai-filled px-2 py-1.5')}>
          <span id="rule-values" className="flex items-center gap-1.5 text-sm font-medium">{t('settings:rules.field.values')}<AIFieldMarker meta={ai.has('values') ? AI_META : undefined} /></span>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {options.map((v) => <Chip key={v} size="sm" pressed={d.values.includes(v)} onClick={() => toggle('values', v)}>{label(d.kind, v)}</Chip>)}
          </div>
        </div>

        <div role="group" aria-labelledby="rule-users" className={cn('flex flex-col gap-1.5 rounded-md transition-colors duration-(--dur-base)', ai.has('userIds') && 'ai-filled px-2 py-1.5')}>
          <span id="rule-users" className="flex items-center gap-1.5 text-sm font-medium">{t('settings:rules.field.userIds')}<AIFieldMarker meta={ai.has('userIds') ? AI_META : undefined} /></span>
          <div className="flex flex-wrap gap-1.5">
            {people.map((u) => (
              <Chip key={u.id} pressed={d.userIds.includes(u.id)} onClick={() => toggle('userIds', u.id)} className="pl-1">
                <UserAvatar name={u.name} size="xs" />{u.name}
              </Chip>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} disabled={!valid} data-testid="rule-save">{t('common:actions.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
