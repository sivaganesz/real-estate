/** The wizard's step strip: numbered dots joined by a line; done steps get a tick, the current one the primary ring. */
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WizardStepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-2" data-testid="wizard-steps">
        {steps.map((s, i) => {
          const done = i < current
          const on = i === current
          return (
            <li key={s} className={cn('flex min-w-0 items-center gap-2', i < steps.length - 1 && 'flex-1')} aria-current={on ? 'step' : undefined}>
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-meta font-semibold tabular-nums transition-colors duration-(--dur-base)',
                  done ? 'bg-primary text-primary-foreground' : on ? 'bg-primary-soft text-primary ring-2 ring-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn('truncate text-ui', on ? 'font-semibold text-foreground' : 'text-muted-foreground', !on && 'max-sm:hidden')}>{s}</span>
              {i < steps.length - 1 && <span aria-hidden="true" className={cn('h-px min-w-4 flex-1', done ? 'bg-primary' : 'bg-border')} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
