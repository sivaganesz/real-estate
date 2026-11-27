/**
 * Saved views for the Leads list (master prompt §8): the current user's named filter + sort sets. Pick one to apply,
 * "Save current view…" stores the filters that are on, and each view can be deleted (with Undo through re-saving).
 */
import { useState } from 'react'
import { Bookmark, BookmarkPlus, Check, ChevronDown, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { SavedView } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { filterCount, filtersFromView, sameFilters, viewFromFilters, type LeadFilters } from '@/lib/lead-queries'
import { deleteView, saveView } from '@/services/settings'

export function SavedViewsMenu({ filters, onApply }: { filters: LeadFilters; onApply: (f: LeadFilters, name: string) => void }) {
  const { t } = useTranslation('leads')
  const user = useCurrentUser()
  const all = useDb((db) => db.savedViews)
  const views = all.filter((v) => v.userId === user.id && v.module === 'leads')
  const active = views.find((v) => sameFilters(filtersFromView(v), filters))
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const save = () => {
    const clean = name.trim()
    if (!clean) return
    try {
      const existing = views.find((v) => v.name.toLowerCase() === clean.toLowerCase())
      saveView({ id: existing?.id, module: 'leads', name: clean, ...viewFromFilters(filters) })
      toast.success(t('views.saved', { name: clean }))
      setNaming(false)
      setName('')
    } catch (e) {
      toastError(e)
    }
  }
  const remove = (v: SavedView) => {
    try {
      deleteView(v.id)
      toast.success(t('views.deleted', { name: v.name }), {
        action: { label: t('common:actions.undo'), onClick: () => saveView({ module: v.module, name: v.name, filters: v.filters, sort: v.sort }) },
      })
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" data-testid="saved-views">
            <Bookmark />
            <span className="max-w-32 truncate">{active?.name ?? t('views.label')}</span>
            <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t('views.mine')}</DropdownMenuLabel>
          {views.length === 0 && <p className="px-2 py-1.5 text-meta text-muted-foreground">{t('views.none')}</p>}
          {views.map((v) => (
            <DropdownMenuItem key={v.id} onSelect={() => onApply(filtersFromView(v), v.name)} className="group/view">
              {active?.id === v.id ? <Check className="text-primary" /> : <Bookmark className="opacity-50" />}
              <span className="flex-1 truncate">{v.name}</span>
              <button
                type="button" aria-label={t('views.delete', { name: v.name })}
                className="rounded-sm p-0.5 text-muted-foreground opacity-60 hover:bg-danger-soft hover:text-danger hover:opacity-100"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(v) }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!filterCount(filters) && !filters.sort} onSelect={() => { setName(active?.name ?? ''); setNaming(true) }}>
            <BookmarkPlus />{t('views.saveCurrent')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('views.saveTitle')}</DialogTitle>
            <DialogDescription>{t('views.saveBody')}</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('views.namePlaceholder')} aria-label={t('views.name')}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }} data-testid="view-name" />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNaming(false)}>{t('common:actions.cancel')}</Button>
            <Button onClick={save} disabled={!name.trim()} data-testid="view-save">{t('views.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
