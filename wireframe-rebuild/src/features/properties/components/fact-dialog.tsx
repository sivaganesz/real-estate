import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLabels } from '@/lib/labels'
import { useStore } from '@/store/db'
import type { FactDef } from '@/data/catalogue'
import type { Property } from '@/data/types'

/** "＋ Add" on a missing fact opens exactly that fact — one field, not a form. */
export function FactDialog({ property, fact, onClose }: { property: Property; fact: FactDef | null; onClose: () => void }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { updateProperty } = useStore()
  const [value, setValue] = useState('')
  if (!fact) return null
  const label = L.fact(fact.key, fact.label)

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    const v = fact.kind === 'number' ? Number(value) : value.trim()
    updateProperty(property.id, (p) => { p.specs[fact.key] = v }, t('history.factAdded', { fact: label, value: L.factValue(fact, v) }))
    toast.success(t('fact.saved', { fact: label }))
    setValue('')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('fact.addTitle', { fact: label })}</DialogTitle>
            <DialogDescription>{property.title}</DialogDescription>
          </DialogHeader>
          {fact.kind === 'select' ? (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="w-full" aria-label={label}><SelectValue placeholder={t('fact.choose')} /></SelectTrigger>
              <SelectContent>{fact.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <Input autoFocus aria-label={label} type={fact.kind === 'number' ? 'number' : fact.kind === 'month' ? 'month' : 'text'}
                min={fact.kind === 'number' ? 0 : undefined} step="any" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={!value.trim()}>{t('action.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
