/**
 * Readable ids from `db.meta.counters`: LEAD-1044, PRP-1021, APT-…, TSK-…, CL-…, ACT-…, NTF-…, ASG-…, IMP-…, DRF-…,
 * SV-…, U-…. The seed sets each counter to its highest id, so new ids continue after it. The id is the display code.
 */
import type { DB, ID } from '@/domain/types'

export type IdPrefix = 'LEAD' | 'PRP' | 'APT' | 'TSK' | 'CL' | 'ACT' | 'NTF' | 'ASG' | 'IMP' | 'DRF' | 'SV' | 'U' | 'MP' | 'RULE'
export const ID_PREFIXES: IdPrefix[] = ['LEAD', 'PRP', 'APT', 'TSK', 'CL', 'ACT', 'NTF', 'ASG', 'IMP', 'DRF', 'SV', 'U', 'MP', 'RULE']

/** Takes the next id for a prefix and advances the counter (on a draft inside commit). */
export function nextId(db: Pick<DB, 'meta'>, prefix: IdPrefix): ID {
  const n = (db.meta.counters[prefix] ?? 1000) + 1
  db.meta.counters[prefix] = n
  return `${prefix}-${n}`
}
