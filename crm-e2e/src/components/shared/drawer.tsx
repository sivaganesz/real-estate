/**
 * Drawer / side panel (DESIGN_SYSTEM §11.8). Ported from wireframe-rebuild/src/components/app/side-panel.tsx and
 * extended: 480 px (preview) or 640 px (form, AI review) from the right; full-screen on phones (or a bottom sheet
 * with `rounded-t-2xl` for short actions); a sticky header with title, subtitle and actions, a scrolling body, a
 * sticky footer (secondary left, primary right); and an unsaved-changes guard ("Discard changes?").
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from './confirm-dialog'

export function Drawer({ open, onOpenChange, title, subtitle, headerActions, footer, children, size = 'md', dirty, phone = 'full', className, bodyClassName }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  subtitle?: ReactNode
  /** Icon buttons next to close (expand to page, more). */
  headerActions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /** md 480 px · lg 640 px */
  size?: 'md' | 'lg'
  /** Unsaved changes: closing asks first. */
  dirty?: boolean
  /** On phones: full screen (forms) or a bottom sheet (short actions). */
  phone?: 'full' | 'bottom'
  className?: string
  bodyClassName?: string
}) {
  const { t } = useTranslation('ui')
  const isPhone = useMediaQuery('(max-width: 767px)')
  const [asking, setAsking] = useState(false)
  const requestChange = (next: boolean) => {
    if (!next && dirty) setAsking(true)
    else onOpenChange(next)
  }
  const bottom = isPhone && phone === 'bottom'
  return (
    <>
      <Sheet open={open} onOpenChange={requestChange}>
        <SheetContent
          side={bottom ? 'bottom' : 'right'}
          className={cn(
            'gap-0 p-0 shadow-xl',
            bottom ? 'max-h-[90svh] rounded-t-2xl' : isPhone ? 'w-full max-w-none sm:max-w-none' : size === 'lg' ? 'w-[640px] sm:max-w-[640px]' : 'w-[480px] sm:max-w-[480px]',
            className,
          )}
        >
          <header className="sticky top-0 z-[1] flex items-start gap-3 border-b bg-popover/95 px-5 py-4 pr-14 backdrop-blur md:px-6">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
              {subtitle ? <SheetDescription className="mt-0.5">{subtitle}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
            </div>
            {headerActions && <div className="flex shrink-0 items-center gap-1">{headerActions}</div>}
          </header>
          <div className={cn('flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5 md:p-6', bodyClassName)}>{children}</div>
          {footer && (
            <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
              {footer}
            </footer>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t('drawer.discardTitle')}
        description={t('drawer.discardBody')}
        confirmLabel={t('drawer.discard')}
        cancelLabel={t('drawer.keepEditing')}
        tone="danger"
        onConfirm={() => onOpenChange(false)}
      />
    </>
  )
}
