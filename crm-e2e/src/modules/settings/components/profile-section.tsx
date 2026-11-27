/**
 * Profile and preferences (everyone, `settings.preferences`): your name, mobile and languages; your availability;
 * theme and language for this browser. The theme / language picker is ported from
 * wireframe-rebuild/src/features/settings/settings-page.tsx (option cards with a live preview, arrow keys move).
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Chip } from '@/components/shared/chip'
import { FormField } from '@/components/shared/form-field'
import { PhoneInput } from '@/components/shared/phone-input'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Input } from '@/components/ui/input'
import { LANGUAGES_SPOKEN } from '@/domain/catalogue'
import type { Availability } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { LANGUAGES, setLanguage, type Language } from '@/i18n'
import { addDaysToDay, localDay } from '@/lib/dates'
import { fmtDate } from '@/lib/format'
import { toE164 } from '@/lib/phone'
import { THEMES, useTheme, type ThemeChoice } from '@/lib/theme'
import { roleTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { setAvailability, updateUser } from '@/services/users'
import { SaveBar } from './save-bar'

const THEME_ICON: Record<ThemeChoice, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

export function ProfileSection() {
  const { t, i18n } = useTranslation(['settings', 'common', 'shell'])
  const { user, can } = usePermission()
  const [theme, setTheme] = useTheme()
  const now = useNow()
  const saved = useMemo(() => ({ name: user.name, phone: user.phone, languages: [...user.languages] }), [user])
  const [d, setD] = useState(saved)
  const [tried, setTried] = useState(false)
  const [base, setBase] = useState(saved)
  // a save (or Undo) elsewhere replaces the draft with the stored value
  if (base !== saved) {
    setBase(saved)
    setD(saved)
  }
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const nameError = !d.name.trim() ? t('common:validation.required') : undefined
  const phoneError = d.phone.trim() && !toE164(d.phone) ? t('common:validation.invalidPhone') : undefined
  const valid = !nameError && !phoneError

  const save = () => {
    setTried(true)
    if (!valid) return
    try {
      updateUser(user.id, { name: d.name.trim(), phone: d.phone, languages: d.languages })
      toast.success(t('settings:profile.saved'))
    } catch (e) {
      toastError(e)
    }
  }
  const changeAvailability = (a: Availability) => {
    try {
      setAvailability(user.id, a, a === 'onLeave' ? addDaysToDay(localDay(now), 3) : undefined)
      toast.success(t('settings:profile.availabilityChanged', { status: t(`common:availability.${a}`) }))
    } catch (e) {
      toastError(e)
    }
  }
  const changeLeaveUntil = (until: string) => {
    try {
      setAvailability(user.id, 'onLeave', until || undefined)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('settings:profile.you')} description={t('settings:profile.youHint')}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} size="lg" role={user.role} availability={user.availability} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{user.name}</p>
              <p className="flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
                <span className={cn('inline-flex h-5 items-center rounded-full px-2 font-medium', roleTone[user.role].soft, roleTone[user.role].text)}>{t(`common:roles.${user.role}`)}</span>
                {user.email}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('settings:profile.name')} required error={tried ? nameError : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="profile-name" />}
            </FormField>
            <FormField label={t('settings:profile.phone')} optional error={tried ? phoneError : undefined}>
              {({ id, describedBy, invalid }) => <PhoneInput id={id} describedBy={describedBy} invalid={invalid} value={d.phone} onChange={(v) => setD({ ...d, phone: v })} />}
            </FormField>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t('settings:profile.languages')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES_SPOKEN.map((l) => (
                <Chip key={l} size="sm" pressed={d.languages.includes(l)} onClick={() => setD({ ...d, languages: d.languages.includes(l) ? d.languages.filter((x) => x !== l) : [...d.languages, l] })}>
                  {t(`settings:language.${l}`)}
                </Chip>
              ))}
            </div>
          </fieldset>
          <SaveBar dirty={dirty} valid={valid} onSave={save} onDiscard={() => setD(saved)} testId="profile-save" />
        </div>
      </SectionCard>

      {can('user.setAvailability', { ownerId: user.id }) && (
        <SectionCard title={t('settings:profile.availability')} description={t('settings:profile.availabilityHint')}>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<Availability>
              variant="pill" value={user.availability} onChange={changeAvailability} label={t('settings:profile.availability')}
              segments={(['available', 'inVisit', 'onLeave'] as const).map((a) => ({ value: a, label: t(`common:availability.${a}`) }))}
            />
            {user.availability === 'onLeave' && (
              <label className="flex items-center gap-2 text-sm">
                {t('settings:profile.backOn')}
                <Input type="date" className="w-44" value={user.leaveUntil ?? ''} min={localDay(now)} onChange={(e) => changeLeaveUntil(e.target.value)} />
                {user.leaveUntil && <span className="text-meta text-muted-foreground">{fmtDate(user.leaveUntil, i18n.language)}</span>}
              </label>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('settings:profile.prefs')} description={t('settings:profile.prefsHint')} bodyClassName="flex flex-col gap-6">
        <Choice label={t('shell:theme.label')} hint={t('settings:profile.themeHint')} columns={3}>
          {THEMES.map((v) => {
            const Icon = THEME_ICON[v]
            return (
              <Option
                key={v} on={theme === v} onSelect={() => setTheme(v)} preview={<ThemePreview choice={v} />} testId={`theme-${v}`}
                title={<><Icon className="size-4" aria-hidden="true" /> {t(`shell:theme.${v}`)}</>} detail={t(`settings:profile.theme.${v}`)}
              />
            )
          })}
        </Choice>
        <Choice label={t('shell:language.label')} hint={t('settings:profile.languageHint')} columns={2}>
          {LANGUAGES.map((lang) => (
            <Option
              key={lang} on={i18n.language === lang} onSelect={() => setLanguage(lang)} lang={lang} testId={`lang-${lang}`}
              title={t(`shell:language.${lang}`)} detail={<LanguageSample lang={lang} />}
            />
          ))}
        </Choice>
      </SectionCard>
    </div>
  )
}

/** A labelled group of option cards that behaves as one radio group (arrow keys move between them). */
function Choice({ label, hint, columns, children }: { label: string; hint: string; columns: 2 | 3; children: ReactNode }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="mb-2.5 text-sm text-muted-foreground">{hint}</p>
      <div
        role="radiogroup" aria-label={label}
        onKeyDown={(e) => {
          if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return
          const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')]
          const i = radios.indexOf(document.activeElement as HTMLButtonElement)
          const next = radios[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + radios.length) % radios.length]
          e.preventDefault()
          next.focus()
          next.click()
        }}
        className={cn('grid gap-3', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:max-w-2xl')}
      >
        {children}
      </div>
    </div>
  )
}

function Option({ on, onSelect, title, detail, preview, lang, testId }: { on: boolean; onSelect: () => void; title: ReactNode; detail: ReactNode; preview?: ReactNode; lang?: string; testId?: string }) {
  return (
    <button
      type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={onSelect} lang={lang} data-testid={testId}
      className={cn(
        'relative flex flex-col gap-2.5 rounded-xl border bg-card p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'border-primary ring-1 ring-primary' : 'hover:border-ring/50 hover:bg-muted/40',
      )}
    >
      {preview}
      <span className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">{title}</span>
        <span aria-hidden="true" className={cn('grid size-5 shrink-0 place-items-center rounded-full border', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
          {on && <Check className="size-3.5" />}
        </span>
      </span>
      <span className="text-sm text-muted-foreground">{detail}</span>
    </button>
  )
}

/** A tiny window drawn with the theme's own colours: `.light` / `.dark` re-scope the tokens for this box. */
function ThemePreview({ choice }: { choice: ThemeChoice }) {
  const pane = (mode: 'light' | 'dark') => (
    <span className={cn(mode, 'flex h-full flex-1 gap-1.5 bg-background p-2')}>
      <span className="flex w-1/4 flex-col gap-1 rounded-sm bg-card p-1">
        <span className="h-1.5 rounded-full bg-primary" />
        <span className="h-1.5 rounded-full bg-muted" />
        <span className="h-1.5 rounded-full bg-muted" />
      </span>
      <span className="flex flex-1 flex-col gap-1 rounded-sm bg-card p-1.5">
        <span className="h-1.5 w-2/3 rounded-full bg-foreground/70" />
        <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground/40" />
        <span className="mt-auto h-2.5 w-1/3 rounded-sm bg-primary" />
      </span>
    </span>
  )
  return (
    <span aria-hidden="true" className="flex h-20 overflow-hidden rounded-lg border">
      {choice === 'system' ? <>{pane('light')}{pane('dark')}</> : pane(choice)}
    </span>
  )
}

/** A few words in the language itself, so people can recognise it whichever language the page is in. */
function LanguageSample({ lang }: { lang: Language }) {
  const { i18n } = useTranslation()
  const t = i18n.getFixedT(lang)
  return <>{t('shell:nav.properties')} · {t('shell:nav.leads')} · {t('shell:nav.appointments')}</>
}
