/**
 * What to tell a buyer about a property — chosen by why they're buying (from spec-system-wireframe "pitchFor").
 * Returns i18n keys with values, so the talking points follow the language switch.
 * Only facts customers may see are used: nearby places in Customer view, approvals whose document is uploaded.
 */
import type { Database, Lead, Property } from '@/data/types'
import { inr } from '@/lib/format'
import { placesFor, priceCheck } from '@/lib/property'

export type Point = { key: string; values?: Record<string, string | number> }

export function pitchFor(lead: Lead, p: Property, db: Database): Point[] {
  const s = p.specs
  const out: Point[] = []
  const visible = placesFor(p, db.settings, 'customer')
  const near = (cat: string) => visible.filter((x) => x.categoryId === cat && x.status === 'existing')[0]
  const place = (cat: string) => { const x = near(cat); if (x) out.push({ key: 'pitch.place', values: { place: cat, km: x.distanceKm } }) }
  const road = [p.location.roadWidthFt ? `${p.location.roadWidthFt} ft` : '', p.location.roadType?.toLowerCase() ?? ''].filter(Boolean).join(' ')
  const market = () => {
    const pc = priceCheck(p, db)
    if (pc.position) out.push({ key: `pitch.market_${pc.position}`, values: { range: `${inr(pc.min)}–${inr(pc.max)}` } })
    if (pc.soldAvg) out.push({ key: 'pitch.soldAvg', values: { v: inr(pc.soldAvg) } })
  }
  const upcoming = () => {
    const f = visible.filter((x) => x.status !== 'existing')[0]
    if (f) out.push({ key: 'pitch.upcoming', values: { status: f.status, name: f.name, km: f.distanceKm } })
  }
  const approvals = () => {
    const ok = p.approvals.filter((a) => a.status !== 'pending').map((a) => a.approvalId)
    if (ok.length) out.push({ key: 'pitch.approvals', values: { list: ok.join(',') } })
  }

  switch (lead.purpose) {
    case 'ownUse':
    case 'secondHome':
      place('school'); place('hospital'); place('busStop')
      if (road) out.push({ key: 'pitch.road', values: { road } })
      if (s.water) out.push({ key: 'pitch.water', values: { v: String(s.water).toLowerCase() } })
      if (p.type === 'plot') approvals()
      else if (s.possession) out.push({ key: 'pitch.raw', values: { v: String(s.possession) } })
      break
    case 'investment':
      market(); upcoming(); approvals()
      break
    case 'rentalIncome':
      if (s.occupancy) out.push({ key: 'pitch.raw', values: { v: String(s.occupancy) } })
      if (s.rentalIncome) out.push({ key: 'pitch.rent', values: { rent: inr(Number(s.rentalIncome)), yield: ((Number(s.rentalIncome) * 12 / p.price) * 100).toFixed(1) } })
      if (s.maintenance) out.push({ key: 'pitch.maintenance', values: { v: inr(Number(s.maintenance)) } })
      place('railway'); place('busStop'); market()
      break
    case 'businessUse':
      if (s.commCategory) out.push({ key: 'pitch.raw', values: { v: String(s.commCategory) } })
      if (s.frontage) out.push({ key: 'pitch.frontage', values: { ft: Number(s.frontage) } })
      if (road) out.push({ key: 'pitch.road', values: { road } })
      if (s.permittedUsage) out.push({ key: 'pitch.permitted', values: { v: String(s.permittedUsage).toLowerCase() } })
      if (s.parking) out.push({ key: 'pitch.parking', values: { v: String(s.parking).toLowerCase() } })
      place('highway')
      break
    default:
      market()
  }
  return out.slice(0, 5)
}
