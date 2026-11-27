import { useCallback, useState } from 'react'

/** Legend state: hidden series (click toggles) and the hovered one (others dim to 35%). */
export function useSeriesToggle() {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [hovered, setHovered] = useState<string | null>(null)
  const toggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const opacity = (key: string) => (hovered && hovered !== key ? 0.35 : 1)
  return { hidden, hovered, toggle, setHovered, opacity }
}
