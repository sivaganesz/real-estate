/**
 * A link to any record by reference (the assistant's "links to the changed records", notifications, timelines).
 * The label comes from the store; a deleted record shows its id, not a broken link.
 */
import { Building2, CalendarDays, Contact, FileText, ListChecks, Upload, User, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { pathFor } from '@/app/paths'
import type { EntityKind, EntityRef } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { selectionLabel } from '@/ai/context'
import { cn } from '@/lib/utils'

const ICON: Record<EntityKind, LucideIcon> = {
  lead: Users, client: Contact, property: Building2, appointment: CalendarDays, task: ListChecks, user: User,
  importJob: Upload, draft: FileText, settings: FileText,
}

export function EntityLink({ refTo, className, icon = true, onNavigate }: { refTo: EntityRef; className?: string; icon?: boolean; onNavigate?: () => void }) {
  const label = useDb((db) => selectionLabel(db, refTo))
  const Icon = ICON[refTo.kind]
  return (
    <Link
      to={pathFor(refTo)} onClick={onNavigate}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', className)}
    >
      {icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{label ?? refTo.id}</span>
    </Link>
  )
}
