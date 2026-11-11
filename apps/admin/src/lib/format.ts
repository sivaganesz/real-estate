const DAY = 24 * 60 * 60 * 1000;

const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const date = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today, 9:12 am", "Yesterday", "3 days ago", "2 months ago", or "—". */
export function formatLastSeen(iso: string | null, now = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
  if (days <= 0) return `Today, ${time.format(then)}`;
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  return date.format(then);
}

/** "expires in 2 days" / "expires today" / "expired". */
export function formatExpiry(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return 'link expired';
  const days = Math.floor(ms / DAY);
  if (days === 0) return 'expires today';
  return `expires in ${days} day${days === 1 ? '' : 's'}`;
}

export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
