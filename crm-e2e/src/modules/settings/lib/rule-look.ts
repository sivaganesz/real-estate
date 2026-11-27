/** How an assignment rule is drawn: an icon per kind, and the label of a value (sources and types via the catalogue). */
import type { TFunction } from 'i18next'
import { Building2, Languages, MapPin, Megaphone, type LucideIcon } from 'lucide-react'
import type { AssignmentRule } from '@/domain/types'

export const RULE_ICON: Record<AssignmentRule['kind'], LucideIcon> = { location: MapPin, propertyType: Building2, language: Languages, source: Megaphone }

/** Locations and languages are shown as stored; sources and property types through `catalogue`. */
export const ruleValueLabel = (t: TFunction, kind: AssignmentRule['kind'], v: string): string =>
  kind === 'source' ? t(`catalogue:source.${v}`) : kind === 'propertyType' ? t(`catalogue:propertyType.${v}`) : v
