import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Check, ChevronUp, Lock, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/empty-state'
import { Page } from '@/components/app/page-header'
import { SidePanel } from '@/components/app/side-panel'
import { useCrumbs } from '@/components/layout/crumbs'
import { amenityList, typeFacts } from '@/data/catalogue'
import type { Property, PropertyTypeKey } from '@/data/types'
import { inr, inrShort } from '@/lib/format'
import {
  type AssistantThread, applyFacts, type ChatMsg, draftFromRecord, draftIntoRecord, draftScore, draftToProperty, type Draft, EMPTY_DRAFT,
  changesFor, type Decision, type Fact, findDuplicate, missingKeys, type NewChatMsg, nextStep, type OptionalStep, priceOutlier, type Question, questionFor,
  readMessage, readNewThings, setFact,
} from '@/lib/assistant'
import { decideValues } from './chat-panel'
import { leadsForProperty } from '@/lib/matching'
import { photoCount } from '@/lib/property'
import { useCan, useStore, userName } from '@/store/db'
import { CompletionRing } from '../components/property-bits'
import { ChatPanel, type ChatHandlers } from './chat-panel'
import { DetailsDrawer, DRAWER_TABS, type DrawerTab } from './details-drawer'
import type { FocusTarget, FormHandlers } from './details-form'
import { SummaryCard, type AddTarget } from './summary-card'
import { useFactText } from './use-fact-text'

/**
 * Add a property with the AI assistant: /properties/new, and a saved draft at /properties/:id/edit.
 * The draft is saved as a property with status "draft" once its type is known, together with the conversation,
 * so anyone allowed can pick it up again. Managers publish; executives submit it for a manager's approval.
 */
export function AddPropertyPage() {
  const { id, tab } = useParams()
  const { t } = useTranslation()
  const { db, user } = useStore()
  const can = useCan()
  const record = id ? db.properties.find((p) => p.id === id) : undefined
  // a published property opens in Edit with AI: the same page, where each change is confirmed and saved straight to it
  const editing = !!record && record.status !== 'draft'
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.properties'), to: '/properties' },
    ...(editing ? [{ label: record.id, to: `/properties/${record.id}` }, { label: t('action.editWithAi') }]
      : [{ label: record ? `${t('props.add')} · ${record.id}` : t('props.add') }])])

  const blocked = id && !record ? 'notFound'
    : editing ? (!can('property.manage') || record.archived ? 'editNotAllowed' : null)
      : !can('property.add') ? 'notAllowed' : record && !can('property.seeDrafts') && record.created.by !== user.id ? 'notYours' : null
  if (blocked) {
    return (
      <Page>
        <EmptyState icon={blocked === 'notFound' ? SearchX : Lock} title={t(`assistant.${blocked}`)}
          action={<Button asChild variant="outline">{editing ? <Link to={`/properties/${record.id}`}>{t('assistant.backToProperty')}</Link> : <Link to="/properties">{t('property.back')}</Link>}</Button>} />
      </Page>
    )
  }
  const drawer = (DRAWER_TABS as readonly string[]).includes(tab ?? '') ? (tab as DrawerTab) : null
  return <Assistant key={`${record?.id ?? 'new'}${editing ? ':edit' : ''}`} record={record} editing={editing} drawer={drawer} />
}

const SKIP_WORDS = /^(skip|no|nope|not now|later|none|nothing|done|no thanks|that'?s all|next)\b/i

function Assistant({ record, editing, drawer }: { record?: Property; editing: boolean; drawer: DrawerTab | null }) {
  const { t } = useTranslation()
  const ft = useFactText()
  const navigate = useNavigate()
  const { db, user, today, addProperty, updateProperty, updateSettings, deleteProperty } = useStore()
  const can = useCan()
  const manager = can('property.manage')

  const [working, setDraft] = useState<Draft>(() => (record ? draftFromRecord(record) : EMPTY_DRAFT))
  // photos and approvals can also change in the drawer's Media and Legal tabs, which write to the saved draft: read them from it
  const draft: Draft = record ? { ...working, photos: photoCount(record), approvals: record.approvals.map((a) => a.approvalId) } : working
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const [thread, setThread] = useState<AssistantThread>(() => {
    // Edit with AI starts afresh each time: no questions, it waits to be told what changed
    if (editing) return { chat: [{ id: 0, from: 'ai', kind: 'text', key: 'assistant.edit.hello' }], passed: ['photos', 'amenities'], dupChecked: true }
    const th: AssistantThread = record?.assistant ?? {
      chat: record
        ? [{ id: 0, from: 'ai', kind: 'text', key: 'assistant.resume' }, { id: 1, ...stepMsg(draftFromRecord(record), []) } as ChatMsg]
        : [{ id: 0, from: 'ai', kind: 'text', key: 'assistant.hello' }],
      passed: [],
    }
    // a manager opening a draft sent for approval is asked to approve it or send it back
    const lastMsg = th.chat[th.chat.length - 1]
    if (record?.submitted && manager && !(lastMsg?.from === 'ai' && lastMsg.kind === 'review')) {
      return { ...th, chat: [...th.chat, { id: (lastMsg?.id ?? 0) + 1, from: 'ai', kind: 'review' }] }
    }
    return th
  })
  const [summaryOpen, setSummaryOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const submitted = !!record?.submitted
  const publishLabel = manager ? t('action.publish') : t('assistant.submit')
  const docs = {
    uploaded: record?.approvals.filter((a) => a.status !== 'pending').map((a) => a.approvalId) ?? [],
    any: !!record?.documents.length,
  }
  const score = draftScore(draft, docs)
  const missing = missingKeys(draft).filter((k) => !k.startsWith('spec:?'))
  const last = thread.chat[thread.chat.length - 1]
  const asking = last?.from === 'ai' && last.kind === 'ask' ? last.q.key : undefined

  /* ---------- saving: every change goes to the draft record ---------- */

  /** Add messages (they get the next ids). */
  const said = (chat: ChatMsg[], ...ms: NewChatMsg[]): ChatMsg[] => {
    let n = chat.reduce((m, x) => Math.max(m, x.id), -1)
    return [...chat, ...ms.map((m) => ({ ...m, id: ++n }) as ChatMsg)]
  }

  const commit = (d: Draft, chat: ChatMsg[], th: Partial<Omit<AssistantThread, 'chat'>> = {}, historyText = '') => {
    const next: AssistantThread = { ...thread, ...th, chat }
    setDraft(d)
    setThread(next)
    if (record && editing) {
      // Edit with AI writes straight to the published property; the conversation isn't kept
      updateProperty(record.id, (p) => { draftIntoRecord(p, d); if (d.status) p.status = d.status }, historyText)
    } else if (record) {
      // the manager's approve / send back message is shown afresh each time, not saved with the draft
      updateProperty(record.id, (p) => { draftIntoRecord(p, d); p.assistant = { ...next, chat: next.chat.filter((m) => m.from === 'user' || m.kind !== 'review') } }, historyText)
    } else if (d.type) {
      // the first save: the draft becomes a property record, and the address moves to it
      const newId = addProperty((pid) => ({ ...draftToProperty(d, pid, user.id, today, 'draft'), assistant: next }), t('history.draftAi'))
      navigate(`/properties/${newId}/edit${drawer ? '/' + drawer : ''}`, { replace: true })
    }
  }

  /* ---------- the drawer: "Review all details" ---------- */

  const base = record ? `/properties/${record.id}/edit` : '/properties/new'
  const openDrawer = (tab: DrawerTab, target?: string) => {
    setSummaryOpen(false)
    if (target) setFocus((f) => ({ target, n: (f?.n ?? 0) + 1 }))
    navigate(`${base}/${tab}`, { replace: !!drawer })
  }
  const closeDrawer = () => navigate(base, { replace: true })

  /* ---------- the checks after every change, and what the assistant says next ---------- */

  /**
   * The checks that can raise a decision card: a possible duplicate (once, when type, locality and area are known),
   * and an unusual price per sq.ft. (whenever the price or area changes).
   */
  const checks = (d: Draft, pendingIn: Decision[]) => {
    let pending = pendingIn
    let dupChecked = thread.dupChecked
    if (!dupChecked && d.type && d.locality && d.areaSqft) {
      dupChecked = true
      const other = findDuplicate(d, db.properties, record?.id)
      if (other) pending = [{ kind: 'dup', id: other.id }, ...pending]
    }
    if (d.price !== draft.price || d.areaSqft !== draft.areaSqft) {
      pending = pending.filter((x) => x.kind !== 'priceCheck')
      const odd = priceOutlier(d, db.properties, record?.id)
      if (odd) pending = [...pending, odd]
    }
    return { pending, dupChecked }
  }
  /** The next decision card if there is one, otherwise the next step (none in Edit with AI: it waits to be told). */
  const nextMsg = (d: Draft, passed: OptionalStep[], pending: Decision[]): NewChatMsg | null =>
    pending[0] ? { from: 'ai', kind: 'decide', d: pending[0] } : editing ? null : stepMsg(d, passed)
  const sameMsg = (a: ChatMsg, b: NewChatMsg) => JSON.stringify({ ...a, id: 0 }) === JSON.stringify({ ...b, id: 0 })

  /** Save a change from the chat, run the checks and add what the assistant says next. */
  const advance = (d: Draft, chat: ChatMsg[], o: { passed?: OptionalStep[]; pending?: Decision[]; history?: string; ask?: Question } = {}) => {
    const passed = o.passed ?? thread.passed
    const c = checks(d, o.pending ?? thread.pending ?? [])
    const next = o.ask ? { from: 'ai', kind: 'ask', q: o.ask } as NewChatMsg : nextMsg(d, passed, c.pending)
    const lastMsg = chat[chat.length - 1]
    commit(d, !next || (lastMsg && sameMsg(lastMsg, next)) ? chat : said(chat, next), { passed, pending: c.pending, dupChecked: c.dupChecked }, o.history)
  }

  /**
   * A change made in the form. When it answers what the assistant is asking (or makes its last step out of date),
   * its last message is swapped for the new next step, so the chat carries on from where the listing now is.
   */
  const formCommit = (d: Draft, historyText: string) => {
    const c = checks(d, thread.pending ?? [])
    const step = nextMsg(d, thread.passed, c.pending)
    let chat = thread.chat
    const lastMsg = chat[chat.length - 1]
    if (lastMsg?.from === 'ai' && ['ask', 'photos', 'amenities', 'approvals', 'ready', 'decide'].includes(lastMsg.kind)) {
      if (step && !sameMsg(lastMsg, step)) chat = [...chat.slice(0, -1), { ...step, id: lastMsg.id } as ChatMsg]
    } else if (step?.from === 'ai' && step.kind === 'decide') chat = said(chat, step)
    commit(d, chat, { pending: c.pending, dupChecked: c.dupChecked }, historyText)
  }

  const form: FormHandlers = {
    onSet: (key, value) => {
      const d = setFact(draft, key, value)
      const label = key === 'priceOnRequest' ? '' : ft.label(key, d.type)
      const text = key === 'priceOnRequest' ? t(value ? 'history.priceHidden' : 'history.priceShown')
        : value === undefined ? t('history.formCleared', { fact: label })
          : t('history.formSet', { fact: label, value: ft.value(key, value, d.type) })
      formCommit(d, text)
    },
    onAmenity: (name) => {
      const on = !draft.amenities.includes(name)
      const d = { ...draft, amenities: on ? [...draft.amenities, name] : draft.amenities.filter((a) => a !== name), sources: { ...draft.sources, amenities: 'team' as const } }
      formCommit(d, t('history.amenities'))
    },
    onApproval: (approvalId) => {
      const on = !draft.approvals.includes(approvalId)
      const d = { ...draft, approvals: on ? [...draft.approvals, approvalId] : draft.approvals.filter((a) => a !== approvalId) }
      formCommit(d, t(on ? 'history.approvalAdded' : 'history.approvalRemoved', { approval: ft.approval(approvalId) }))
    },
    onNewApproval: (name) => {
      const label = name.replace(/^./, (c) => c.toUpperCase())
      const existing = db.settings.approvalTypes.find((a) => a.label.toLowerCase() === label.toLowerCase())
      const approvalId = existing?.id ?? 'x_' + label.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!existing) updateSettings((s) => { s.approvalTypes.push({ id: approvalId, label, documentName: `${label} document` }) })
      if (draft.approvals.includes(approvalId)) return
      formCommit({ ...draft, approvals: [...draft.approvals, approvalId] }, t(existing ? 'history.approvalAdded' : 'history.approvalCreated', { approval: label }))
      toast.success(t(existing ? 'documents.badgeAdded' : 'documents.badgeCreated', { approval: label }))
    },
    onExtraDetail: (label, value) => {
      const list = draft.extraDetails ?? []
      const had = list.some((x) => x.label === label)
      const next = value === undefined ? list.filter((x) => x.label !== label)
        : had ? list.map((x) => (x.label === label ? { ...x, value } : x)) : [...list, { label, value, added: { by: user.id, at: today } }]
      formCommit({ ...draft, extraDetails: next },
        value === undefined ? t('history.formCleared', { fact: label }) : had ? t('history.formSet', { fact: label, value }) : t('history.detailNewOnly', { label, value }))
    },
    onExact: (how) => {
      const d = { ...draft, exactLocation: !!how, sources: { ...draft.sources, exactLocation: 'team' as const } }
      formCommit(d, how ? t(`history.exactLocation.${how}`) : t('history.exactRemoved'))
      if (how) toast.success(t('location.exactSet'))
    },
  }

  const filledText = (facts: Fact[], d: Draft) => t('history.aiFilled', { facts: [...new Set(facts.map((f) => ft.label(f.key, d.type)))].join(', ') })
  const addCards = (cards: Decision[]) => {
    const pending = [...(thread.pending ?? [])]
    for (const c of cards) if (!pending.some((x) => JSON.stringify(x) === JSON.stringify(c))) pending.push(c)
    return pending
  }

  /* ---------- the conversation ---------- */

  const onSend = (text: string) => {
    let chat = said(thread.chat, { from: 'user', text })
    if (/^(publish|submit|send (it )?for approval)\b/i.test(text)) return publish(chat)
    if (/\b(what('?s| is)?\s+(missing|left|pending|needed)|still needed)\b/i.test(text)) {
      chat = said(chat, missing.length ? { from: 'ai', kind: 'text', key: 'assistant.stillNeeded', values: { list: missing.map((k) => ft.label(k, draft.type)).join(', ') } }
        : { from: 'ai', kind: 'text', key: 'assistant.allIn' })
      return commit(draft, chat)
    }
    if (last?.from === 'ai' && (last.kind === 'photos' || last.kind === 'amenities') && SKIP_WORDS.test(text)) return skip(last.kind, chat)

    // a status ("mark it reserved") is a change only for a published property
    const read = readMessage(text, draft, asking).filter((f) => editing || f.key !== 'status')
    const type = (read.find((f) => f.key === 'type')?.value as PropertyTypeKey | undefined) ?? draft.type
    const extra = readNewThings(text, draft, { amenities: amenityList(db.settings), facts: type ? typeFacts(type, db.settings) : [] })
    // what needs the team's decision becomes a card: "45" (lakh or crore?), a pasted map link, new amenities and details
    const cards: Decision[] = []
    const unit = read.find((f) => f.key === 'priceUnit')
    if (unit) cards.push({ kind: 'priceUnit', n: unit.value as number })
    if (read.some((f) => f.key === 'exactLocation')) cards.push({ kind: 'pin' })
    extra.amenities.forEach((name) => cards.push({ kind: 'newAmenity', name }))
    extra.details.forEach((x) => cards.push({ kind: 'newDetail', ...x }))
    const facts = read.filter((f) => f.key !== 'priceUnit' && f.key !== 'exactLocation')
    for (const f of extra.facts) if (!facts.some((x) => x.key === f.key)) facts.push(f)

    if (!facts.length && !cards.length) return advance(draft, said(chat, { from: 'ai', kind: 'text', key: editing ? 'assistant.edit.notUnderstood' : 'assistant.notUnderstood' }))
    if (editing && facts.length) {
      // Edit with AI: nothing is changed until the manager confirms it — "Save these changes?" with old → new
      const changes = changesFor(draft, facts)
      if (changes.length) cards.unshift({ kind: 'changes', changes, facts })
      else if (!cards.length) return advance(draft, said(chat, { from: 'ai', kind: 'text', key: 'assistant.edit.same' }))
      return advance(draft, chat, { pending: addCards(cards) })
    }
    const d = facts.length ? applyFacts(draft, facts) : draft
    advance(d, facts.length ? said(chat, { from: 'ai', kind: 'read', facts }) : chat, { pending: addCards(cards), history: facts.length ? filledText(facts, d) : '' })
  }

  // the Ask bar hands "add a property …" over as ?say=… : it becomes the first message, once
  const [params, setParams] = useSearchParams()
  const said0 = params.get('say')
  useEffect(() => { if (said0 && !editing) { setParams({}, { replace: true }); onSend(said0) } }, [said0]) // eslint-disable-line react-hooks/exhaustive-deps
  const onAnswer = (q: Question, value: string | number, label: string) => {
    const facts: Fact[] = [{ key: q.key, value }]
    const d = applyFacts(draft, facts)
    advance(d, said(thread.chat, { from: 'user', text: label }), { history: filledText(facts, d) })
  }

  const skip = (step: OptionalStep, chat: ChatMsg[]) => {
    const passed = [...new Set([...thread.passed, step])]
    const reply: NewChatMsg = step === 'photos' ? { from: 'ai', kind: 'text', key: 'assistant.photosSkipped' }
      : draft.amenities.length ? { from: 'ai', kind: 'text', key: 'assistant.amenitiesDone', values: { count: draft.amenities.length } }
        : { from: 'ai', kind: 'text', key: 'assistant.amenitiesNone' }
    advance(draft, said(chat, reply), { passed, history: step === 'amenities' && draft.amenities.length ? t('history.amenities') : '' })
  }
  const onSkip = (step: OptionalStep) =>
    skip(step, said(thread.chat, { from: 'user', text: step === 'photos' ? t('assistant.skipForNow') : draft.amenities.length ? t('action.done') : t('assistant.skip') }))

  const onAmenity = (name: string) => {
    const d = { ...draft, amenities: draft.amenities.includes(name) ? draft.amenities.filter((a) => a !== name) : [...draft.amenities, name], sources: { ...draft.sources, amenities: 'team' as const } }
    commit(d, thread.chat)
  }

  const onApproval = (approvalId: string) => {
    const on = !draft.approvals.includes(approvalId)
    const d = { ...draft, approvals: on ? [...draft.approvals, approvalId] : draft.approvals.filter((a) => a !== approvalId) }
    const reply: NewChatMsg = { from: 'ai', kind: 'text', key: on ? 'assistant.approvalTicked' : 'assistant.approvalRemoved', values: { approval: ft.approval(approvalId) } }
    advance(d, said(thread.chat, reply),
      { history: on ? t('history.approvalAdded', { approval: ft.approval(approvalId) }) : t('history.approvalRemoved', { approval: ft.approval(approvalId) }) })
  }

  const onPhotoFiles = (count: number) => {
    if (!count) return
    const d = { ...draft, photos: draft.photos + count }
    const passed = [...new Set([...thread.passed, 'photos' as const])]
    const chat = said(thread.chat, { from: 'user', text: t('assistant.photosMsg', { count }) }, { from: 'ai', kind: 'text', key: 'assistant.photosAdded', values: { count } })
    advance(d, chat, { passed, history: t('history.photos', { count }) })
  }

  /* ---------- decision cards ---------- */

  const onDecide = (choice: string) => {
    const x = thread.pending?.[0]
    if (!x) return
    const rest = (thread.pending ?? []).slice(1)
    let chat = said(thread.chat, { from: 'user', text: t(`assistant.decide.${x.kind}.${choice}`, decideValues(x, ft.value('type', draft.type))) })
    const say = (key: string, values?: Record<string, string | number>) => { chat = said(chat, { from: 'ai', kind: 'text', key, values }) }
    let d = draft
    let history = ''
    let ask: Question | undefined
    const now = { by: user.id, at: today }
    switch (x.kind) {
      case 'dup': {
        if (choice === 'same') return openDuplicate(x.id)
        say('assistant.decide.dup.kept', { id: x.id })
        history = t('history.dupChecked', { id: x.id })
        break
      }
      case 'newAmenity': {
        if (choice === 'skip') { say('assistant.decide.newAmenity.skipped', { name: x.name }); break }
        if (choice === 'list') updateSettings((s) => { if (!amenityList(s).includes(x.name)) s.amenities = [...(s.amenities ?? []), x.name] })
        d = { ...d, amenities: [...new Set([...d.amenities, x.name])], sources: { ...d.sources, amenities: 'ai' } }
        say(choice === 'list' ? 'assistant.decide.newAmenity.addedList' : 'assistant.decide.newAmenity.addedOnly', { name: x.name })
        history = t(choice === 'list' ? 'history.amenityNewList' : 'history.amenityNewOnly', { name: x.name })
        break
      }
      case 'newDetail': {
        if (choice === 'skip') { say('assistant.decide.newDetail.skipped', { label: x.label }); break }
        if (choice === 'type' && d.type) {
          const type = d.type
          const key = 'x_' + x.label.toLowerCase().replace(/[^a-z0-9]/g, '')
          updateSettings((s) => {
            if (!(s.extraFacts ?? []).some((f) => f.type === type && f.key === key)) {
              s.extraFacts = [...(s.extraFacts ?? []), { type, key, label: x.label, kind: x.number ? 'number' : 'text', added: now, fromPropertyId: record?.id }]
            }
          })
          d = applyFacts(d, [{ key: `spec:${key}`, value: x.number ? Number(x.value.replace(/,/g, '')) : x.value }])
          say('assistant.decide.newDetail.addedType', { label: x.label, value: x.value, type: ft.value('type', type) })
          history = t('history.detailNewType', { label: x.label, value: x.value, type: ft.value('type', type) })
        } else {
          d = { ...d, extraDetails: [...(d.extraDetails ?? []).filter((e) => e.label !== x.label), { label: x.label, value: x.value, added: now }] }
          say('assistant.decide.newDetail.addedOnly', { label: x.label, value: x.value })
          history = t('history.detailNewOnly', { label: x.label, value: x.value })
        }
        break
      }
      case 'priceUnit': {
        const v = choice === 'lakh' ? x.n * 1e5 : choice === 'crore' ? x.n * 1e7 : x.n
        d = applyFacts(d, [{ key: 'price', value: v }])
        say('assistant.decide.priceUnit.set', { price: inrShort(v) })
        history = t('history.formSet', { fact: ft.label('price'), value: inrShort(v) })
        break
      }
      case 'priceCheck': {
        if (choice === 'change') { ask = questionFor(d, 'price'); break }
        say('assistant.decide.priceCheck.kept')
        history = t('history.priceChecked', { rate: inr(x.ppsf) })
        break
      }
      case 'changes': {
        if (choice === 'cancel') { say('assistant.decide.changes.cancelled'); break }
        d = applyFacts({ ...d, titleEdited: true }, x.facts.filter((f) => f.key !== 'type'))
        const list = [...new Set(x.changes.map((c) => ft.label(c.key, d.type)))].join(', ')
        say('assistant.decide.changes.saved', { list })
        history = t('history.editedAi', { changes: list })
        break
      }
      case 'pin': {
        if (choice === 'again') { ask = questionFor(d, 'exactLocation'); break }
        if (choice === 'later') { say('assistant.decide.pin.notNow'); break }
        d = { ...d, exactLocation: true, sources: { ...d.sources, exactLocation: 'google' } }
        say('assistant.decide.pin.confirmed')
        history = t('history.pinConfirmed')
        break
      }
    }
    advance(d, chat, { pending: rest, history, ask })
  }

  /** "Yes, open it": this draft is dropped and the one we already have opens instead. */
  const openDuplicate = (id: string) => {
    const other = db.properties.find((p) => p.id === id)
    if (!record || !other) return
    deleteProperty(record.id)
    if (other.status !== 'draft') {
      navigate(`/properties/${other.id}`)
      toast(t('assistant.decide.dup.discardedListed', { id: record.id, other: other.id }))
    } else if (can('property.seeDrafts') || other.created.by === user.id) {
      navigate(`/properties/${other.id}/edit`)
      toast(t('assistant.decide.dup.discardedDraft', { id: record.id, other: other.id }))
    } else {
      navigate('/properties')
      toast(t('assistant.decide.dup.discardedHidden', { id: record.id, other: other.id }))
    }
  }

  /** A checklist row's button (as in spec-system-wireframe): photos open the file picker, documents the Legal tab, anything else its field in the form. */
  const onAdd = (target: AddTarget) => {
    setSummaryOpen(false)
    if (target === 'photos') return fileRef.current?.click()
    if (target === 'legal') return openDrawer('legal')
    openDrawer('details', target)
  }

  const onTitle = (title: string) => {
    const d = applyFacts(draft, [{ key: 'title', value: title }], 'team')
    commit(d, thread.chat, {}, t('history.titleChanged', { title }))
  }

  /* ---------- publishing ---------- */

  const publish = (chat = thread.chat) => {
    // an open decision card (a possible duplicate, a price to confirm) is answered first
    if (thread.pending?.length) return commit(draft, said(chat, { from: 'ai', kind: 'text', key: 'assistant.decide.first' }, { from: 'ai', kind: 'decide', d: thread.pending[0] }))
    if (missing.length) {
      return commit(draft, said(chat, { from: 'ai', kind: 'text', key: 'assistant.notYet', values: { list: missing.map((k) => ft.label(k, draft.type)).join(', ') } }))
    }
    if (!record) return
    if (!manager) {
      const next: AssistantThread = { ...thread, chat: said(chat, { from: 'ai', kind: 'text', key: 'assistant.submittedMsg' }) }
      setThread(next)
      updateProperty(record.id, (p) => { draftIntoRecord(p, draft); p.submitted = { by: user.id, at: today }; p.assistant = next }, t('history.submitted'))
      toast.success(t('assistant.submittedToast'))
      return
    }
    // a manager publishing a draft that was sent for approval approves it
    const approvedBy = record.submitted ? userName(db, record.submitted.by) : ''
    let published: Property | undefined
    updateProperty(record.id, (p) => {
      draftIntoRecord(p, draft)
      p.status = 'available'
      p.listedAt = today
      delete p.submitted
      delete p.assistant // the conversation belongs to the draft; Edit with AI starts afresh
      published = structuredClone(p)
    }, approvedBy ? t('history.approvedAi', { name: approvedBy }) : t('history.publishedAi'))
    navigate(`/properties/${record.id}`)
    const fit = published ? leadsForProperty(published, db.leads, db.settings) : []
    toast.success(approvedBy ? t('assistant.review.approvedToast', { name: approvedBy }) : t('property.published'), {
      description: fit.length ? t('property.publishedFit', { count: fit.length }) : t('property.publishedNoFit'),
      action: fit.length ? { label: t('matches.notify'), onClick: () => toast.success(t('matches.notified', { count: new Set(fit.map((m) => m.lead.ownerId)).size })) } : undefined,
    })
  }

  /** A manager sends a draft back to the person who submitted it: it is an ordinary draft again, with a note in its chat. */
  const sendBack = () => {
    if (!record?.submitted) return
    const name = userName(db, record.submitted.by)
    const chat = said(thread.chat.filter((m) => m.from === 'user' || m.kind !== 'review'),
      { from: 'user', text: t('assistant.review.sendBack') }, { from: 'ai', kind: 'text', key: 'assistant.review.sentBack', values: { name } })
    const next: AssistantThread = { ...thread, chat }
    setThread(next)
    updateProperty(record.id, (p) => { delete p.submitted; p.assistant = next }, t('history.sentBack', { name }))
    toast(t('assistant.review.sentBackToast', { name }))
  }

  /** Edit with AI: back to the property page (every confirmed change is already saved). */
  const done = () => {
    if (!record) return
    navigate(`/properties/${record.id}`)
    toast.success(t('assistant.edit.doneToast', { id: record.id }))
  }

  const h: ChatHandlers = {
    onSend, onAnswer, onPhotos: () => fileRef.current?.click(), onSkip, onAmenity, onApproval, onDecide, onPublish: () => publish(),
    onApprove: () => publish(), onSendBack: sendBack,
  }
  const footer = editing ? (
    <>
      <p className="mb-3 flex items-center gap-1.5 text-sm text-success"><Check className="size-4 shrink-0" /> {t('assistant.edit.savedTo', { id: record?.id })}</p>
      <Button size="lg" className="w-full" onClick={done}>{t('assistant.edit.done')}</Button>
    </>
  ) : submitted && manager ? (
    <div className="flex gap-2">
      <Button size="lg" variant="outline" onClick={sendBack}>{t('assistant.review.sendBack')}</Button>
      <Button size="lg" className="flex-1" disabled={missing.length > 0} onClick={() => publish()}><Check /> {t('assistant.review.approve')}</Button>
    </div>
  ) : submitted ? (
    <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info">{t('assistant.review.waitingNote')}</p>
  ) : undefined
  const summary = (
    <SummaryCard draft={draft} score={score} docs={docs} submitted={submitted} publishLabel={publishLabel} status={editing ? record?.status : undefined}
      footer={footer} canWrite onTitle={onTitle} onAdd={onAdd} onReview={() => openDrawer('details')} onPublish={() => publish()} />
  )

  return (
    <Page wide className="pb-5">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onPhotoFiles(e.target.files?.length ?? 0); e.target.value = '' }} />

      {/* phone and tablet: the summary folds into a bar above the chat */}
      <button type="button" onClick={() => setSummaryOpen(true)}
        className="mb-3 flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left shadow-card lg:hidden">
        <CompletionRing score={score} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{draft.title || t('assistant.newProperty')}</span>
          <span className={missing.length ? 'text-meta text-danger' : 'text-meta text-success'}>
            {missing.length ? t('assistant.neededCount', { count: missing.length }) : t('assistant.allIn')}
          </span>
        </span>
        <span className="flex items-center gap-1 text-sm text-primary">{t('assistant.summary')} <ChevronUp className="size-4" /></span>
      </button>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(21.25rem,27.5rem)]">
        <div className="lg:h-[calc(100svh-5.9375rem)]">
          <ChatPanel chat={thread.chat} draft={draft} score={score} publishLabel={publishLabel} canWrite examples={!record} h={h} inputRef={inputRef}
            placeholder={editing ? t('assistant.edit.placeholder') : undefined} submittedBy={record?.submitted ? userName(db, record.submitted.by) : undefined} />
        </div>
        <aside className="max-lg:hidden"><div className="sticky top-[4.375rem]">{summary}</div></aside>
      </div>

      <SidePanel open={summaryOpen} onOpenChange={setSummaryOpen} title={t('assistant.summary')} className="lg:hidden">
        <div className="pb-4 [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none">{summary}</div>
      </SidePanel>

      <DetailsDrawer tab={drawer} onTab={(tab) => openDrawer(tab)} onClose={closeDrawer} draft={draft} record={record} canWrite focus={focus} h={form} />
    </Page>
  )
}

/** The assistant's next message for a draft. */
function stepMsg(d: Draft, passed: OptionalStep[]): NewChatMsg {
  const s = nextStep(d, passed)
  return s.kind === 'ask' ? { from: 'ai', kind: 'ask', q: s.q } : { from: 'ai', kind: s.kind }
}
