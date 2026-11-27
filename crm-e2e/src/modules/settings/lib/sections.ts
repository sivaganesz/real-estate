/** The Settings sections and the permission that guards each (see components/sections.tsx). */
import { Database, GitBranch, Gauge, MessageSquareText, Scale, Shuffle, UserRound, UsersRound, type LucideIcon } from 'lucide-react'
import type { Action } from '@/lib/permissions'
import type { Tone } from '@/lib/tones'

export type SectionKey = 'profile' | 'assignment' | 'pipeline' | 'templates' | 'matching' | 'sla' | 'users' | 'demo'

export const SECTIONS: { key: SectionKey; icon: LucideIcon; tone: Tone; permission: Action }[] = [
  { key: 'profile', icon: UserRound, tone: 'primary', permission: 'settings.preferences' },
  { key: 'assignment', icon: Shuffle, tone: 'info', permission: 'rules.configure' },
  { key: 'pipeline', icon: GitBranch, tone: 'violet', permission: 'settings.pipeline' },
  { key: 'templates', icon: MessageSquareText, tone: 'success', permission: 'settings.templates' },
  { key: 'matching', icon: Scale, tone: 'warning', permission: 'settings.matching' },
  { key: 'sla', icon: Gauge, tone: 'danger', permission: 'settings.matching' },
  { key: 'users', icon: UsersRound, tone: 'neutral', permission: 'user.manage' },
  { key: 'demo', icon: Database, tone: 'neutral', permission: 'demo.reset' },
]

/** Old links (`/settings/scoring`) land on the section that now holds them. */
export const SECTION_ALIASES: Record<string, SectionKey> = { scoring: 'sla', rules: 'assignment', preferences: 'profile' }
