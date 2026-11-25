import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

/**
 * A button with a small panel under it: filters, row menus. Closes on Esc or a
 * click outside, and gives focus back to its button.
 */
export function Popover({
  trigger,
  buttonClass,
  children,
  align = 'left',
  className,
  label,
}: {
  trigger: (open: boolean) => ReactNode;
  buttonClass: (open: boolean) => string;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button ref={button} type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} className={buttonClass(open)}>
        {trigger(open)}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className={clsx('absolute top-full z-30 mt-2 min-w-[14rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-pop', align === 'right' ? 'right-0' : 'left-0', className)}>
          {children(close)}
        </div>
      )}
    </div>
  );
}
