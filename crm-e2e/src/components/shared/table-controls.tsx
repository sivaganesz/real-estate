/** Table toolbar controls (DESIGN_SYSTEM §11.7): the density toggle and the column visibility menu. */
import { Columns3, Rows3, Rows4 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Density } from './data-table'

export function DensityToggle({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  const { t } = useTranslation('ui')
  const next: Density = value === 'comfortable' ? 'compact' : 'comfortable'
  const Icon = value === 'comfortable' ? Rows3 : Rows4
  return (
    <Button variant="secondary" size="icon" onClick={() => onChange(next)} aria-label={t(`table.density.${next}`)} title={t(`table.density.${next}`)}>
      <Icon />
    </Button>
  )
}

export function ColumnMenu({ columns, hidden, onChange }: {
  columns: { key: string; label: string; locked?: boolean }[]
  hidden: ReadonlySet<string>
  onChange: (next: Set<string>) => void
}) {
  const { t } = useTranslation('ui')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('table.columns')} title={t('table.columns')}><Columns3 /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('table.columns')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.key} disabled={c.locked} checked={!hidden.has(c.key)}
            onCheckedChange={(on) => {
              const next = new Set(hidden)
              if (on) next.delete(c.key)
              else next.add(c.key)
              onChange(next)
            }}
            onSelect={(e) => e.preventDefault()}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
