import { FileText, MapPin, Sparkles, Wand2, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FactSource } from '@/data/types'
import { cn } from '@/lib/utils'

const LOOK: Partial<Record<FactSource, { icon: LucideIcon; className: string }>> = {
  ai: { icon: Sparkles, className: 'bg-violet-soft text-violet' },
  google: { icon: MapPin, className: 'bg-success-soft text-success' },
  auto: { icon: Wand2, className: 'bg-muted text-muted-foreground' },
  file: { icon: FileText, className: 'bg-muted text-muted-foreground' },
}

/** Where a value came from, beside its label: ✨ AI, Google, auto, File. A value the team typed has no tag. */
export function SourceTag({ source, className }: { source?: FactSource; className?: string }) {
  const { t } = useTranslation()
  const look = source && LOOK[source]
  if (!look) return null
  const Icon = look.icon
  return (
    <span title={t(`source.${source}Hint`)}
      className={cn('inline-flex h-4 cursor-help items-center gap-0.5 rounded px-1 align-[1px] text-micro font-semibold [&_svg]:size-2.5', look.className, className)}>
      <Icon aria-hidden /> {t(`source.${source}`)}
    </span>
  )
}
