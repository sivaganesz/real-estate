import { Building2, Factory, House, LandPlot, Store, Tractor, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Media, PropertyTypeKey } from '@/data/types'

/**
 * A property photo. The seed has no real photos yet, so an empty `url` draws a placeholder:
 * a soft colour per property type with the type's icon. The design system (or sample photos) replaces it.
 */
const LOOK: Record<PropertyTypeKey, { icon: LucideIcon; bg: string }> = {
  plot: { icon: LandPlot, bg: 'from-emerald-100 to-lime-50 text-emerald-700/50' },
  flat: { icon: Building2, bg: 'from-sky-100 to-indigo-50 text-sky-700/50' },
  house: { icon: House, bg: 'from-amber-100 to-orange-50 text-amber-700/50' },
  commercial: { icon: Store, bg: 'from-violet-100 to-fuchsia-50 text-violet-700/50' },
  agri: { icon: Tractor, bg: 'from-lime-100 to-yellow-50 text-lime-700/50' },
  industrial: { icon: Factory, bg: 'from-slate-200 to-zinc-50 text-slate-600/50' },
}

export function PropertyPhoto({
  type, media, className, iconClassName, alt,
}: { type: PropertyTypeKey; media?: Media; className?: string; iconClassName?: string; alt: string }) {
  if (media?.url) return <img src={media.url} alt={alt} className={cn('object-cover', className)} loading="lazy" />
  const { icon: Icon, bg } = LOOK[type]
  return (
    <div role="img" aria-label={alt} className={cn('flex items-center justify-center bg-gradient-to-br', bg, className)}>
      <Icon className={cn('size-10', iconClassName)} strokeWidth={1.25} />
    </div>
  )
}
