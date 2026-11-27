/**
 * Light, dark or "match my device". Ported from wireframe-rebuild/src/lib/theme.ts (key renamed to crm-e2e-theme).
 * The colours live in index.css (`:root` light, `.dark` dark); this only puts `.dark` and `color-scheme` on <html>.
 * index.html applies the saved choice before the page draws, so a dark page never flashes white.
 * The default (nothing saved yet) is "system", the same rule the pre-paint script in index.html uses.
 */
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export const THEMES: ThemeChoice[] = ['light', 'dark', 'system']
export const THEME_STORAGE_KEY = 'crm-e2e-theme'

function stored(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system' // storage blocked: follow the device
  }
}

let current: ThemeChoice = typeof window === 'undefined' ? 'system' : stored()
const listeners = new Set<() => void>()
const deviceDark = () => window.matchMedia('(prefers-color-scheme: dark)')

export function isDarkApplied(): boolean {
  return current === 'dark' || (current === 'system' && deviceDark().matches)
}

function apply() {
  const dark = isDarkApplied()
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function setTheme(choice: ThemeChoice) {
  current = choice
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    /* storage blocked: lasts for this visit */
  }
  apply()
  listeners.forEach((l) => l())
}

/** Once, at start: apply the saved choice and follow the device while "match my device" is on. */
export function initTheme() {
  apply()
  deviceDark().addEventListener('change', () => {
    if (current === 'system') {
      apply()
      listeners.forEach((l) => l())
    }
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, () => current, () => 'system' as ThemeChoice)
  return [choice, setTheme]
}

/** true while dark colours are on screen (resolves "system"). */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDarkApplied, () => false)
}
