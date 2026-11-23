import { Link } from 'react-router'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/** Placeholder for screens planned in docs/03-properties-module.md but not built yet (P3 Add, P4 Check import). */
export function ComingNextPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles /></span>
      <h1 className="text-xl font-semibold">{t('next.title')}</h1>
      <p className="text-muted-foreground">{t('next.body')}</p>
      <Button asChild variant="outline"><Link to="/properties">{t('property.back')}</Link></Button>
    </div>
  )
}
