/** Choose a lead the current user can see (open leads first, then the rest), shown as "Name · locality". */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OPEN_STAGES } from '@/domain/catalogue'
import type { ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { visible } from '@/services/queries/visibility'

export function LeadSelect({ value, onChange, id, invalid, describedBy, disabled }: {
  value?: ID
  onChange: (id: ID) => void
  id?: string
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
}) {
  const { t } = useTranslation('domain')
  const db = useWholeDb()
  const user = useCurrentUser()
  const [open, closed] = useMemo(() => {
    const all = visible.leads(db, user).sort((a, b) => a.name.localeCompare(b.name))
    return [all.filter((l) => OPEN_STAGES.includes(l.stage)), all.filter((l) => !OPEN_STAGES.includes(l.stage))]
  }, [db, user])
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="w-full">
        <SelectValue placeholder={t('form.chooseLead')} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectGroup>
          <SelectLabel>{t('form.openLeads')}</SelectLabel>
          {open.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}{l.requirement.localities[0] ? ` · ${l.requirement.localities[0]}` : ''}</SelectItem>)}
        </SelectGroup>
        {closed.length > 0 && (
          <SelectGroup>
            <SelectLabel>{t('form.closedLeads')}</SelectLabel>
            {closed.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
