/**
 * Missing-field questions (master prompt §12.3 step 4, DESIGN_SYSTEM §11.9): a compact checklist of short questions,
 * each with quick-pick chips ("When is the client planning to buy?" [Immediately] [1–3 months] …). Essential ones are
 * marked; answering calls `onAnswer(field, value)` and the form fills that field (marked as a manual answer).
 */
import { CircleCheck, CircleDot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AIQuestion } from '@/ai/types'
import { Chip } from '@/components/shared/chip'
import { cn } from '@/lib/utils'

export function MissingQuestions({ questions, answered, onAnswer, onFocusField, className }: {
  questions: AIQuestion[]
  /** Fields already answered (shown ticked). */
  answered?: ReadonlySet<string>
  onAnswer: (field: string, value: unknown) => void
  /** For questions without chips: focus the form field so the user types it. */
  onFocusField?: (field: string) => void
  className?: string
}) {
  const { t } = useTranslation(['ai', 'catalogue', 'leads'])
  if (!questions.length) return null
  const open = questions.filter((q) => !answered?.has(q.field))
  return (
    <section aria-label={t('ai:questions.title')} className={cn('rounded-lg border border-ai-border/60 bg-card p-3', className)}>
      <h3 className="mb-2 flex items-center justify-between text-meta font-semibold text-ai">
        {t('ai:questions.title')}
        <span className="font-normal text-muted-foreground tabular-nums">{t('ai:questions.left', { count: open.length })}</span>
      </h3>
      <ul className="flex flex-col gap-2.5">
        {questions.map((q) => {
          const done = answered?.has(q.field)
          return (
            <li key={q.field} className="flex flex-col gap-1.5">
              <p className={cn('flex items-start gap-1.5 text-sm', done && 'text-muted-foreground line-through')}>
                {done ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <CircleDot className={cn('mt-0.5 size-4 shrink-0', q.essential ? 'text-warning' : 'text-muted-foreground')} aria-hidden="true" />}
                <span>
                  {t(q.prompt)}
                  {q.essential && !done && <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 text-micro font-semibold text-warning">{t('ai:questions.essential')}</span>}
                </span>
              </p>
              {!done && (
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {q.chips?.map((c) => (
                    <Chip key={String(c.label)} size="sm" tone="ai" onClick={() => onAnswer(q.field, c.value)}>{t(c.label)}</Chip>
                  ))}
                  {!q.chips && onFocusField && (
                    <Chip size="sm" dashed tone="ai" onClick={() => onFocusField(q.field)}>{t('ai:questions.typeIt')}</Chip>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
