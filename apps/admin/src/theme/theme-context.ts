import { createContext, useContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** localStorage key; also read by the inline script in index.html (before first paint). */
export const THEME_STORAGE_KEY = 're-admin-theme';

export interface ThemeContextValue {
  /** What the user chose. */
  theme: ThemePreference;
  /** What is actually shown ("system" resolved to light or dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
