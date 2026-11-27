/**
 * Profile switcher (DESIGN_SYSTEM §11.1, foundation-plan §4): exactly three role rows; the Sales Executive row expands
 * inline to the three switchable executives with their active-lead count and availability dot.
 * The sidebar shows it as a popover; the phone topbar avatar opens the same list in a bottom sheet.
 */
import { Check, ChevronDown, ChevronsUpDown, ShieldCheck, Briefcase, UsersRound, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SWITCHABLE_EXECUTIVES } from '@/data/seed/users'
import type { Role, User } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { availabilityTone, roleTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { activeLeadCount } from '@/services/queries/lookups'
import { useSwitchProfile } from './use-switch-profile'

const ROLE_ROWS: { role: Role; icon: LucideIcon }[] = [
  { role: 'admin', icon: ShieldCheck },
  { role: 'manager', icon: UsersRound },
  { role: 'executive', icon: Briefcase },
]

/** The list itself (used in the popover and in the phone sheet). */
export function ProfilePicker({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation(['shell', 'common'])
  const current = useCurrentUser()
  const switchProfile = useSwitchProfile()
  const [execOpen, setExecOpen] = useState(current.role === 'executive')
  const executives = useDb((db) =>
    SWITCHABLE_EXECUTIVES.map((id) => db.users.find((u) => u.id === id)).filter((u): u is User => !!u && u.status === 'active'),
  )
  const counts = useDb((db) => executives.map((u) => activeLeadCount(db, u.id)))

  const pick = (role: Role, userId?: string) => {
    switchProfile(role, userId)
    onDone?.()
  }

  return (
    <div className="flex flex-col gap-1" data-testid="profile-picker">
      <div className="px-2 pt-1 pb-1.5 text-caption font-medium tracking-[0.06em] text-subtle-foreground uppercase [:lang(ta)_&]:tracking-normal">
        {t('shell:profile.chooseRole')}
      </div>
      {ROLE_ROWS.map(({ role, icon: Icon }) => {
        const tone = roleTone[role]
        const active = current.role === role
        const isExec = role === 'executive'
        return (
          <div key={role}>
            <button
              type="button"
              data-testid={`role-${role}`}
              aria-expanded={isExec ? execOpen : undefined}
              onClick={() => (isExec ? setExecOpen((o) => !o) : pick(role))}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active && 'bg-muted',
              )}
            >
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tone.soft, tone.text)}>
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{t(`common:roles.${role}`)}</span>
                <span className="block truncate text-meta text-muted-foreground">{t(`common:roleDescriptions.${role}`)}</span>
              </span>
              {isExec ? (
                <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', execOpen && 'rotate-180')} aria-hidden="true" />
              ) : (
                active && <Check className="size-4 text-primary" aria-label={t('shell:profile.current')} />
              )}
            </button>
            {isExec && execOpen && (
              <div className="mt-0.5 ml-6 flex flex-col gap-0.5 border-l pl-2" role="group" aria-label={t('shell:profile.executives')}>
                {executives.map((u, i) => {
                  const selected = current.id === u.id
                  return (
                    <button
                      key={u.id}
                      type="button"
                      data-testid={`profile-${u.id}`}
                      onClick={() => pick('executive', u.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        selected && 'bg-primary-soft',
                      )}
                    >
                      <UserAvatar name={u.name} size="sm" availability={u.availability} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                        <span className="flex min-w-0 items-center gap-1.5 text-meta text-muted-foreground">
                          <span className={cn('size-1.5 shrink-0 rounded-full', availabilityTone[u.availability].solid)} aria-hidden="true" />
                          <span className="truncate">{t(`common:availability.${u.availability}`)} · <span className="tabular-nums">{t('shell:profile.activeLeads', { count: counts[i] })}</span></span>
                        </span>
                      </span>
                      {selected && <Check className="size-4 text-primary" aria-label={t('shell:profile.current')} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The sidebar card + popover. */
export function ProfileSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { t } = useTranslation(['shell', 'common'])
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  const trigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        data-testid="profile-switcher"
        aria-label={t('shell:profile.label')}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border bg-card text-left shadow-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          collapsed ? 'justify-center p-1.5' : 'p-2',
        )}
      >
        <UserAvatar name={user.name} size="sm" role={user.role} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
              <span className="block truncate text-meta text-muted-foreground">{t(`common:roles.${user.role}`)}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </button>
    </PopoverTrigger>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{user.name} · {t(`common:roles.${user.role}`)}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent side="top" align="start" className="w-72 rounded-lg p-1.5 shadow-lg">
        <ProfilePicker onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
