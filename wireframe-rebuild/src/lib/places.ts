/** Every place a lead can name: each city and its localities (catalogue CITIES), for pickers that add a place and its city. */
import { CITIES } from '@/data/catalogue'

export type Place = { name: string; city: string; isCity: boolean }
export const ALL_PLACES: Place[] = Object.entries(CITIES).flatMap(([city, locs]) => [{ name: city, city, isCity: true }, ...locs.map((name) => ({ name, city, isCity: false }))])
export const placesMatching = (q: string, n = 6): Place[] => (q.trim() ? ALL_PLACES.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, n) : [])
