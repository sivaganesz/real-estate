/**
 * The Today greeting hero (DESIGN_SYSTEM §11.9 "Today AI greeting hero"): `rounded-2xl` card with a faint Peacock
 * corner glow and the jaali dot lattice, the date, the greeting in `text-display`, the AI day brief with the Demo AI
 * badge, up to three "Start here" chips, a strip of headline numbers and the inline assistant.
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { IconTile } from '@/components/shared/icon-tile'
import type { Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'

export type HeroStat = { key: string; label: ReactNode; value: ReactNode; icon: LucideIcon; tone: Tone; onClick?: () => void; testId?: string }

const GLOW = { backgroundImage: 'radial-gradient(600px circle at 0 0, color-mix(in oklch, var(--primary) 10%, transparent), transparent 60%)' }
const JAALI = {
  backgroundImage: 'radial-gradient(color-mix(in oklch, var(--border-strong) 55%, transparent) 1px, transparent 1.2px)',
  backgroundSize: '12px 12px',
  maskImage: 'radial-gradient(circle at 100% 0, black, transparent 70%)',
  WebkitMaskImage: 'radial-gradient(circle at 100% 0, black, transparent 70%)',
}

export function TodayHero({ now, name, greeting, brief, chips, stats, assistant }: {
  now: Date
  name: string
  greeting: string
  /** The AI sentences (already translated). */
  brief: ReactNode
  chips?: ReactNode
  stats: HeroStat[]
  assistant?: ReactNode
}) {
  const { t, i18n } = useTranslation('today')
  const date = new Intl.DateTimeFormat(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  return (
    <section data-testid="today-hero" aria-labelledby="today-greeting" className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-card md:p-6" style={GLOW}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2" style={JAALI} />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-meta text-muted-foreground">{date}</p>
          <h1 id="today-greeting" className="mt-1 text-[1.75rem] leading-tight font-[650] tracking-[-0.025em] md:text-display [:lang(ta)_&]:tracking-normal">
            {t(`greeting.${greeting}`, { name })}
          </h1>
          <div className="mt-3 flex max-w-3xl items-start gap-2.5" data-testid="today-brief">
            <span aria-hidden="true" className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <div className="min-w-0 text-sm leading-relaxed text-foreground/90">
              {brief}
              <DemoAIBadge mode="simulated" className="ml-2 align-middle" />
            </div>
          </div>
          {chips && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={t('hero.startHere')}>{chips}</div>}
        </div>
        <ul className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[22rem] lg:grid-cols-2">
          {stats.map((s) => {
            const body = (
              <>
                <IconTile icon={s.icon} tone={s.tone} size="sm" />
                <span className="min-w-0">
                  <span className="block text-lg leading-tight font-[650] tabular-nums">{s.value}</span>
                  <span className="block truncate text-meta text-muted-foreground">{s.label}</span>
                </span>
              </>
            )
            const cls = 'flex w-full items-center gap-2.5 rounded-lg border bg-card/80 p-2.5 text-left backdrop-blur-sm'
            return (
              <li key={s.key} data-testid={s.testId}>
                {s.onClick ? (
                  <button type="button" onClick={s.onClick} className={cn(cls, 'transition-[transform,box-shadow] duration-(--dur-fast) hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}>{body}</button>
                ) : <div className={cls}>{body}</div>}
              </li>
            )
          })}
        </ul>
      </div>
      {assistant && <div className="relative mt-5">{assistant}</div>}
    </section>
  )
}
