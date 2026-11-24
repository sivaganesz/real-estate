import { useAuth } from '../lib/auth';
import { TodayAdmin } from './TodayAdmin';
import { TodayExec } from './TodayExec';
import { TodayManager } from './TodayManager';

/** The first screen of the day, shaped by role: the business, the team, or my day. */
export function Today() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <TodayAdmin />;
  if (user?.role === 'manager') return <TodayManager />;
  return <TodayExec />;
}
