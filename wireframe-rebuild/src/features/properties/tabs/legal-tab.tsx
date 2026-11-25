/**
 * Legal & documents — all optional (from spec-system-wireframe):
 * approval badges (RERA, building approval, any the team creates) each need their document; until it's uploaded the badge
 * says "document pending" and matching shows the property only as a Conditional match. Other documents are optional.
 * Verified is an extra step for an Admin or Sales manager. The listing never says "100% legally clear".
 */
import { useState, type FormEvent } from 'react'
import { Award, BadgeCheck, Eye, FileText, Plus, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/app/callout'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import { USUAL_DOCS } from '@/data/catalogue'
import { fmtDate } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useCan, useStore, userName } from '@/store/db'
import type { Audit, Property } from '@/data/types'

export function LegalTab({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const { db, user, today, updateProperty, updateSettings } = useStore()
  const can = useCan()
  const manager = can('property.manage')
  const editable = !p.archived
  // a badge or document added by mistake can be taken off again: by anyone while the property is a draft, by a manager once it's published
  const canRemove = editable && (manager || p.status === 'draft')
  const [newApproval, setNewApproval] = useState<{ name: string; doc: string } | null>(null)
  const [newDoc, setNewDoc] = useState<string | null>(null)
  const types = db.settings.approvalTypes
  const label = (id: string) => t(`approval.${id}`, { defaultValue: types.find((x) => x.id === id)?.label ?? id })
  const docName = (kind: string, name: string) => t(`doc.${kind}`, { defaultValue: name })
  const who = (a?: Audit) => (a ? [userName(db, a.by), fmtDate(a.at, i18n.language)].filter(Boolean).join(', ') : '')
  const now: Audit = { by: user.id, at: today }
  const mock = (file: string) => toast(t('documents.opening', { file }))

  /* approvals */
  const uploadApproval = (id: string) => {
    const again = !!p.approvals.find((a) => a.approvalId === id)?.file
    updateProperty(p.id, (x) => { const a = x.approvals.find((y) => y.approvalId === id); if (a) Object.assign(a, { status: 'uploaded', file: `${id}-document${again ? '-v2' : ''}.pdf`, uploaded: now, verified: undefined }) },
      t(again ? 'history.approvalReplaced' : 'history.approvalUploaded', { approval: label(id) }))
    toast.success(t('documents.uploadedToast', { approval: label(id) }))
  }
  const verifyApproval = (id: string, on: boolean) =>
    updateProperty(p.id, (x) => { const a = x.approvals.find((y) => y.approvalId === id); if (a) Object.assign(a, on ? { status: 'verified', verified: now } : { status: 'uploaded', verified: undefined }) },
      t(on ? 'history.approvalVerified' : 'history.verifyUndone', { name: label(id) }))
  const removeApproval = (id: string) => {
    updateProperty(p.id, (x) => { x.approvals = x.approvals.filter((y) => y.approvalId !== id) }, t('history.approvalRemoved', { approval: label(id) }))
    toast(t('documents.removed', { name: label(id) }))
  }
  const addApproval = (id: string) => {
    updateProperty(p.id, (x) => { if (!x.approvals.some((y) => y.approvalId === id)) x.approvals.push({ approvalId: id, status: 'pending' }) }, t('history.approvalAdded', { approval: label(id) }))
    toast.success(t('documents.badgeAdded', { approval: label(id) }))
  }
  const createApproval = (e: FormEvent) => {
    e.preventDefault()
    if (!newApproval?.name.trim()) return
    const name = newApproval.name.trim().replace(/^./, (c) => c.toUpperCase())
    const existing = types.find((x) => x.label.toLowerCase() === name.toLowerCase())
    const id = existing?.id ?? 'x_' + name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!existing) updateSettings((s) => { s.approvalTypes.push({ id, label: name, documentName: newApproval.doc.trim() || `${name} document` }) })
    updateProperty(p.id, (x) => { if (!x.approvals.some((y) => y.approvalId === id)) x.approvals.push({ approvalId: id, status: 'pending' }) },
      t(existing ? 'history.approvalAdded' : 'history.approvalCreated', { approval: name }))
    toast.success(t(existing ? 'documents.badgeAdded' : 'documents.badgeCreated', { approval: name }))
    setNewApproval(null)
  }

  /* other documents */
  const addDoc = (kind: string, name: string) => {
    const file = (kind === 'other' ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : kind) + '.pdf'
    updateProperty(p.id, (x) => { x.documents.push({ id: `${x.id}-doc-${Date.now()}`, name, kind, file, uploaded: now }) }, t('history.docUploaded', { name: docName(kind, name) }))
    toast.success(t('documents.docUploaded', { name: docName(kind, name) }))
  }
  const verifyDoc = (id: string, on: boolean, name: string) =>
    updateProperty(p.id, (x) => { const d = x.documents.find((y) => y.id === id); if (d) d.verified = on ? now : undefined }, t(on ? 'history.docVerified' : 'history.verifyUndone', { name }))
  const removeDoc = (id: string, name: string) => {
    updateProperty(p.id, (x) => { x.documents = x.documents.filter((y) => y.id !== id) }, t('history.docRemoved', { name }))
    toast(t('documents.removed', { name }))
  }

  const addable = types.filter((x) => !p.approvals.some((a) => a.approvalId === x.id))
  const usual = USUAL_DOCS[p.type].filter((k) => !p.documents.some((d) => d.kind === k))
  const onListing = p.approvals.filter((a) => a.status !== 'pending').map((a) => label(a.approvalId) + (a.status === 'verified' ? ' ✓' : ''))
  const pendingNames = p.approvals.filter((a) => a.status === 'pending').map((a) => label(a.approvalId))

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title={t('documents.approvals')} description={t('documents.approvalsIntro')}
        action={<><StatusChip tone="neutral" variant="outline">{t('documents.optional')}</StatusChip>
          {manager && editable && <Button size="sm" variant="outline" onClick={() => setNewApproval({ name: '', doc: '' })}><Plus /> {t('documents.newApproval')}</Button>}</>}>
        {p.approvals.length ? (
          <ul className="flex flex-col gap-2">
            {p.approvals.map((a) => (
              <li key={a.approvalId} className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-3', a.status === 'pending' && 'border-warning/40 bg-warning-soft/60')}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><Award className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{label(a.approvalId)}
                    {a.status === 'pending' ? <StatusChip tone="warning">{t('documents.pending')}</StatusChip>
                      : a.status === 'verified' ? <StatusChip tone="success" icon={<BadgeCheck />}>{t('documents.verified')}</StatusChip>
                        : <StatusChip tone="info">{t('documents.uploaded')}</StatusChip>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.file ? <>{a.file}{a.uploaded && ` · ${t('documents.uploadedBy', { who: who(a.uploaded) })}`}{a.verified && ` · ${t('documents.verifiedBy', { who: who(a.verified) })}`}</>
                      : t('documents.needs', { doc: types.find((x) => x.id === a.approvalId)?.documentName ?? '' })}
                  </p>
                </div>
                {editable && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.file ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => mock(a.file!)}><Eye /> {t('documents.view')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => uploadApproval(a.approvalId)}>{t('documents.replace')}</Button>
                        {manager && <Button size="sm" variant="outline" onClick={() => verifyApproval(a.approvalId, a.status !== 'verified')}>{a.status === 'verified' ? t('documents.undoVerify') : t('documents.markVerified')}</Button>}
                      </>
                    ) : <Button size="sm" onClick={() => uploadApproval(a.approvalId)}><Upload /> {t('documents.uploadDoc')}</Button>}
                    {canRemove && <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger" aria-label={t('documents.remove', { name: label(a.approvalId) })} onClick={() => removeApproval(a.approvalId)}><X /></Button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t('documents.noBadges')}</p>}

        {editable && addable.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted-foreground">{t('documents.addBadge')}</span>
            {addable.map((x) => <Button key={x.id} size="sm" variant="outline" className="rounded-full" onClick={() => addApproval(x.id)}><Plus /> {label(x.id)}</Button>)}
          </div>
        )}
        {newApproval && (
          <form onSubmit={createApproval} className="mt-4 grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
            <Input autoFocus value={newApproval.name} onChange={(e) => setNewApproval({ ...newApproval, name: e.target.value })} placeholder={t('documents.approvalNameHint')} aria-label={t('documents.approvalName')} />
            <Input value={newApproval.doc} onChange={(e) => setNewApproval({ ...newApproval, doc: e.target.value })} placeholder={t('documents.approvalDocHint')} aria-label={t('documents.approvalDoc')} />
            <p className="text-xs text-muted-foreground sm:col-span-2">{t('documents.newApprovalRule')}</p>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={!newApproval.name.trim()}>{t('documents.createAndAdd', { id: p.id })}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setNewApproval(null)}>{t('action.cancel')}</Button>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard title={t('documents.other')} action={<><StatusChip tone="neutral" variant="outline">{t('documents.optional')}</StatusChip>
        {editable && <Button size="sm" variant="outline" onClick={() => setNewDoc('')}><Upload /> {t('documents.uploadDoc')}</Button>}</>}>
        {p.documents.length ? (
          <ul className="flex flex-col gap-2">
            {p.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><FileText className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{docName(d.kind, d.name)} {d.verified && <StatusChip tone="success" icon={<BadgeCheck />}>{t('documents.verified')}</StatusChip>}</p>
                  <p className="text-xs text-muted-foreground">{d.file} · {t('documents.uploadedBy', { who: who(d.uploaded) })}{d.verified ? ` · ${t('documents.verifiedBy', { who: who(d.verified) })}` : ''}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => mock(d.file)}><Eye /> {t('documents.view')}</Button>
                {manager && editable && (
                  <Button size="sm" variant="ghost" onClick={() => verifyDoc(d.id, !d.verified, docName(d.kind, d.name))}>{d.verified ? t('documents.undoVerify') : t('documents.markVerified')}</Button>
                )}
                {canRemove && (
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger" aria-label={t('documents.remove', { name: docName(d.kind, d.name) })} onClick={() => removeDoc(d.id, docName(d.kind, d.name))}><X /></Button>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t('documents.noneYet')}</p>}

        {editable && usual.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted-foreground">{t('documents.usualFor', { type: L.type(p.type).toLowerCase() })}</span>
            {usual.map((k) => <Button key={k} size="sm" variant="outline" className="rounded-full" onClick={() => addDoc(k, t(`doc.${k}`))}><Upload /> {t(`doc.${k}`)}</Button>)}
          </div>
        )}
        {newDoc !== null && (
          <form onSubmit={(e) => { e.preventDefault(); if (newDoc.trim()) { addDoc('other', newDoc.trim()); setNewDoc(null) } }} className="mt-4 flex flex-wrap gap-2 rounded-lg border bg-muted/40 p-3">
            <Input autoFocus value={newDoc} onChange={(e) => setNewDoc(e.target.value)} placeholder={t('documents.docNameHint')} aria-label={t('documents.docName')} className="min-w-0 flex-1 bg-card" />
            <Button type="submit" size="sm" disabled={!newDoc.trim()}><Upload /> {t('documents.upload')}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setNewDoc(null)}>{t('action.cancel')}</Button>
          </form>
        )}
      </SectionCard>

      <Callout tone="neutral" title={t('documents.onListing')}>
        {onListing.length ? onListing.join(' · ') : t('documents.noListingBadges')}
        {pendingNames.length > 0 && <> {t('documents.shownOnce', { list: pendingNames.join(', ') })}</>}
        <span className="mt-1 block text-xs">{t('documents.privacy')} {t('documents.neverClear')}</span>
      </Callout>
    </div>
  )
}
