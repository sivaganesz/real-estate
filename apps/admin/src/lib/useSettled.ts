import { useEffect, useState } from 'react';

/** The value after it has stopped changing for `ms`, e.g. to search only once typing pauses. */
export function useSettled<T>(value: T, ms = 600): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
