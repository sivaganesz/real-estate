import type { PropertyListItem } from '@real-estate/shared';
import { Chip } from '@/components/patterns';
import type { Tone } from '@/components/patterns';

type Summary = PropertyListItem['legalSummary'];

/**
 * "n/total verified" (PROP-54): amber while a mandatory check is open, green when every
 * check is verified, blue in between. Only checks verified by a legal professional count.
 */
export function LegalChip({ summary }: { summary: Summary }) {
  if (summary.total === 0) return <span className="text-xs text-muted-foreground">No checks</span>;
  const open = summary.openMandatory;
  const tone: Tone =
    open.length > 0 ? 'amber' : summary.verified === summary.total ? 'green' : 'blue';
  const hint =
    open.length > 0
      ? `Mandatory checks unresolved: ${open.join(', ')}`
      : 'All mandatory checks verified';
  return (
    <span title={hint} aria-label={`${summary.verified} of ${summary.total} verified. ${hint}`}>
      <Chip tone={tone}>
        {summary.verified}/{summary.total} verified
      </Chip>
    </span>
  );
}
