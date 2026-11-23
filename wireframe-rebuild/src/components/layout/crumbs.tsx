/**
 * Breadcrumbs in the top bar, as in spec-system-wireframe ("Specification data / Properties / PROP-1002").
 * A page calls useCrumbs([...]); the top bar shows them. The last one is the current page (bold).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Crumb = { label: string; to?: string }
type Ctx = { crumbs: Crumb[]; setCrumbs: (c: Crumb[]) => void }
const CrumbsContext = createContext<Ctx>({ crumbs: [], setCrumbs: () => undefined })

export function CrumbsProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  return <CrumbsContext.Provider value={{ crumbs, setCrumbs }}>{children}</CrumbsContext.Provider>
}

export const useCrumbsValue = () => useContext(CrumbsContext).crumbs

/** Set the top bar's breadcrumbs for this page. */
export function useCrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useContext(CrumbsContext)
  const key = JSON.stringify(crumbs)
  useEffect(() => { setCrumbs(JSON.parse(key) as Crumb[]) }, [key, setCrumbs])
}
