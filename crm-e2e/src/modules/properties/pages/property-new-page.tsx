/** Add a property (master prompt §13): the dynamic form with paste-and-fill / voice beside it. `?paste=1` opens with the AI box focused. */
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { blankProperty } from '../lib/form'
import { PropertyForm } from '../components/property-form'

/** "Paste a listing" lands here: focus whichever paste box is on screen (beside the form on wide screens, above it on small). */
function focusPasteBox() {
  const boxes = [...document.querySelectorAll<HTMLTextAreaElement>('[data-testid="paste-text"]')]
  const box = boxes.find((b) => b.offsetParent !== null)
  box?.focus()
  box?.scrollIntoView({ block: 'center' })
}

export default function PropertyNewPage() {
  const { t } = useTranslation('properties')
  const initial = useMemo(() => blankProperty(), [])
  const [params] = useSearchParams()
  const paste = params.get('paste') === '1'
  useEffect(() => {
    if (!paste) return
    const id = window.requestAnimationFrame(focusPasteBox)
    return () => window.cancelAnimationFrame(id)
  }, [paste])
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader title={t('form.newTitle')} subtitle={t('form.newSubtitle')} />
      <PropertyForm initial={initial} />
    </div>
  )
}
