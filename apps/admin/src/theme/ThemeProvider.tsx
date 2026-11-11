import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { THEME_STORAGE_KEY, ThemeContext } from './theme-context';
import type { Theme, ThemeContextValue } from './theme-context';

/** Light is the default; anything other than a saved "dark" (e.g. an old "system") means light. */
function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // storage blocked (private mode, policies)
  }
}

/**
 * Light / dark theme, remembered per browser. The `dark` class on <html> switches the CSS
 * variables in index.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisted; the choice still applies for this visit.
    }
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
