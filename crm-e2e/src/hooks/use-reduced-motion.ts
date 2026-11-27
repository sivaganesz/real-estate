import { useMediaQuery } from './use-media-query'

/** true when the user asked the OS for less motion (charts, count-ups and staggers switch off). */
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
