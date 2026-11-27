/**
 * The AI summary of a report (master prompt §12.7, Reports): 3–5 observations worked out from the numbers on the page
 * (simulated AI: rules over real data, so it carries the Demo AI badge). Each line opens the records behind it; "Ask
 * the assistant" opens the global panel for follow-up questions.
 */
import { ChevronRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import type { DB } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { inrShort } from '@/lib/format'
import { TONE } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import { reportSummary, type Drill, type ReportData } from '../lib/report-data'

export function ReportSummary({ data, db, onDrill }: { data: ReportData; db: DB; onDrill: (d: Drill) => void }) {
  const { t } = useTranslation(['reports', 'catalogue'])
  const { can } = usePermission()
  const openPanel = useSessionStore((s) => s.setAiPanelOpen)
  const lines = reportSummary(data, db.users)
  return (
    <SectionCard
      title={<span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground"><Sparkles className="size-3.5" /></span>{t('reports:summary.title')}</span>}
      action={<DemoAIBadge mode="simulated" />} className="h-full" data-testid="report-summary"
    >
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('reports:summary.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lines.map((l) => {
            const params: Record<string, string | number> = { ...l.params }
            if (typeof params.value === 'number') params.value = inrShort(params.value)
            for (const [k, key] of Object.entries(l.tParams ?? {})) params[k] = t(key)
            const text = t(`reports:summary.${l.key}`, params)
            return (
              <li key={l.key}>
                {l.drill ? (
                  <button type="button" onClick={() => onDrill(l.drill!)} className="group flex w-full items-start gap-2.5 rounded-md p-1.5 text-left text-sm hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" data-testid="summary-line">
                    <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE[l.tone].solid)} />
                    <span className="flex-1">{text}</span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-50 group-hover:opacity-100" aria-hidden="true" />
                  </button>
                ) : (
                  <p className="flex items-start gap-2.5 p-1.5 text-sm"><span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE[l.tone].solid)} />{text}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {can('ai.use') && (
        <Button size="sm" variant="ghost" className="mt-3 text-ai hover:bg-ai-soft hover:text-ai" onClick={() => openPanel(true)}>
          <Sparkles />{t('reports:summary.ask')}
        </Button>
      )}
    </SectionCard>
  )
}
