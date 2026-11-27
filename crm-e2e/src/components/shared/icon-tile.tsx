/** Icon tile (DESIGN_SYSTEM §8): a 32/36 px rounded square in a soft tone with the icon in the solid tone. */
import type { LucideIcon } from 'lucide-react'
import { TONE, type Tone, type ToneClasses } from '@/lib/tones'
import { cn } from '@/lib/utils'

const SIZE = { sm: 'size-7 [&_svg]:size-3.5', md: 'size-8 [&_svg]:size-4', lg: 'size-9 [&_svg]:size-[18px]', xl: 'size-12 [&_svg]:size-6' } as const

export function IconTile({ icon: Icon, tone = 'primary', classes, size = 'md', className }: {
  icon: LucideIcon
  tone?: Tone
  /** Domain classes (stage / appointment): soft background + solid icon colour via `text-foreground`-safe fill. */
  classes?: ToneClasses
  size?: keyof typeof SIZE
  className?: string
}) {
  const c = classes ?? TONE[tone]
  return (
    <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center justify-center rounded-md', SIZE[size], c.soft, classes ? 'text-foreground' : c.text, className)}>
      <Icon strokeWidth={1.75} />
    </span>
  )
}
