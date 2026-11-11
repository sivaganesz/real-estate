import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Small icon-only button with a tooltip; `label` is also the accessible name. */
export function IconButton({
  label,
  side = 'top',
  variant = 'ghost',
  size = 'icon-sm',
  ...props
}: ComponentProps<typeof Button> & { label: string; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant={variant} size={size} aria-label={label} {...props} />}
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
