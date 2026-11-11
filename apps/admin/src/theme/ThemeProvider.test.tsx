import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TooltipProvider } from '@/components/ui/tooltip';
import { THEME_STORAGE_KEY, useTheme } from './theme-context';
import { ThemeProvider } from './ThemeProvider';

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
    </div>
  );
}

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <ThemeProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light', () => {
    renderWithProvider(<Probe />);
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('switches to dark, sets the class and remembers the choice', () => {
    renderWithProvider(<Probe />);
    act(() => screen.getByText('dark').click());
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    act(() => screen.getByText('light').click());
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('restores a saved dark theme, and treats an old "system" value as light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { unmount } = renderWithProvider(<Probe />);
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    unmount();

    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    renderWithProvider(<Probe />);
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('the toggle button switches between light and dark', async () => {
    renderWithProvider(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
