/**
 * localStorage when it works, otherwise an in-memory map (private windows, blocked storage, node tests),
 * so the app still runs; changes then last for the visit only.
 */
import type { StateStorage } from 'zustand/middleware'

function memoryStorage(): StateStorage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

function pickStorage(): StateStorage {
  try {
    if (typeof localStorage === 'undefined') return memoryStorage()
    const probe = '__crm-e2e-probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    const fallback = memoryStorage()
    return {
      getItem: (k) => {
        try {
          return localStorage.getItem(k)
        } catch {
          return fallback.getItem(k) as string | null
        }
      },
      setItem: (k, v) => {
        try {
          localStorage.setItem(k, v)
        } catch {
          // quota exceeded or storage revoked: keep the latest state in memory for this visit
          void fallback.setItem(k, v)
        }
      },
      removeItem: (k) => {
        try {
          localStorage.removeItem(k)
        } catch {
          void fallback.removeItem(k)
        }
      },
    }
  } catch {
    return memoryStorage()
  }
}

export const safeStorage: StateStorage = pickStorage()
