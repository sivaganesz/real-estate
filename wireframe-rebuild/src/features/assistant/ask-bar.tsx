/**
 * The Ask bar (decision 1, 26 Nov): in the top bar on every page, opened with "/" or Ctrl K (⌘K on a Mac);
 * on a phone, a round button above the bottom bar. On a lead's page it knows the lead ("he", "this lead").
 */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useStore } from '@/store/db'
import { cn } from '@/lib/utils'
import { AssistantBox } from './assistant-box'

/** Typing "/" in a field types a slash; only outside fields does it open the bar. */
const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export function AskBar() {
  const { t } = useTranslation()
  const { db } = useStore()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const leadId = /^\/leads\/(LEAD-\d+)/.exec(pathname)?.[1]
  const lead = db.leads.find((l) => l.id === leadId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setOpen(true) }
      else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) { e.preventDefault(); setOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const first = lead?.name.split(' ')[0]
  const examples = lead
    ? [t('ai.ex.call', { name: first }), t('ai.ex.visit', { name: first }), t('ai.ex.offer', { name: first })]
    : [t('ai.ex.newLead'), t('ai.ex.whoReady'), t('ai.ex.overdue'), t('ai.ex.plots')]

  return (
    <>
      {/* top bar (tablet and up) */}
      <button type="button" onClick={() => setOpen(true)}
        className="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-primary/25 bg-accent/40 px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent max-md:hidden lg:w-72">
        <Sparkles className="size-4 shrink-0 text-violet" aria-hidden />
        <span className="truncate">{t('ai.barPlaceholder')}</span>
        <kbd className="ml-auto rounded border bg-card px-1.5 font-sans text-xs text-muted-foreground max-lg:hidden">Ctrl K</kbd>
      </button>
      {/* phone: a round button, above a page's bottom bar */}
      <button type="button" onClick={() => setOpen(true)} aria-label={t('ai.barPlaceholder')}
        className={cn('fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden', leadId ? 'bottom-24' : 'bottom-5')}>
        <Sparkles className="size-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[8vh] max-h-[84vh] translate-y-0 gap-0 overflow-y-auto p-4 sm:max-w-2xl">
          <DialogTitle className="sr-only">{t('ai.barTitle')}</DialogTitle>
          <DialogDescription className="mb-2 pr-6 text-xs">
            {lead ? t('ai.aboutLead', { name: lead.name }) : t('ai.barHint')}
          </DialogDescription>
          <AssistantBox key={String(open)} mode="bar" leadId={leadId} autoFocus examples={examples} placeholder={t('ai.barPlaceholder')} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
