/**
 * Light, dark or "match my device" — chosen in Settings, remembered in this browser (per user once there is a login).
 * The colours themselves live in index.css (`:root` light, `.dark` dark); this only puts `.dark` on <html>.
 * index.html applies the saved choice before the page draws, so a dark page never flashes white.
 */
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export const THEMES: ThemeChoice[] = ['light', 'dark', 'system']
const KEY = 'realspec-rebuild-theme'

function stored(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'system' ? v : 'light'
  } catch {
    return 'light' // storage blocked: the default
  }
}

let current: ThemeChoice = stored()
const listeners = new Set<() => void>()
const deviceDark = () => window.matchMedia('(prefers-color-scheme: dark)')

function apply() {
  const dark = current === 'dark' || (current === 'system' && deviceDark().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function setTheme(choice: ThemeChoice) {
  current = choice
  try { localStorage.setItem(KEY, choice) } catch { /* storage blocked: lasts for this visit */ }
  apply()
  listeners.forEach((l) => l())
}

/** Once, at start: apply the saved choice and follow the device while "match my device" is on. */
export function initTheme() {
  apply()
  deviceDark().addEventListener('change', () => { if (current === 'system') apply() })
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => current, () => 'light' as ThemeChoice)
  return [choice, setTheme]
}
