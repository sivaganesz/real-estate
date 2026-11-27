import { useSyncExternalStore } from 'react'

/** true while the media query matches, e.g. useMediaQuery('(min-width: 1024px)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind's `md` breakpoint: below it, panels open from the bottom (thumb reach). */
export const useIsPhone = () => !useMediaQuery('(min-width: 768px)')
