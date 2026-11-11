import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/theme-context';

/** One-click light / dark switch. Shows the icon of the mode you'd switch to. */
export function ThemeToggle({
  className,
  side = 'top',
}: {
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={label}
            onClick={toggleTheme}
            className={cn('shrink-0', className)}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </Button>
        }
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
