import { describe, expect, it } from 'vitest'
import {
  excelSerialToDate, readArea, readCity, readConfig, readDate, readFacing, readInt, readPhone, readPossession, readPrice, readPropertyType,
  readSource, readTimeline,
} from './values'

describe('readPrice', () => {
  it('reads lakhs, crores, rupees and bare numbers', () => {
    expect(readPrice('1.2 Cr')).toEqual({ ok: 12_000_000 })
    expect(readPrice('85 L')).toEqual({ ok: 8_500_000 })
    expect(readPrice('95 Lakhs')).toEqual({ ok: 9_500_000 })
    expect(readPrice('₹45,00,000')).toEqual({ ok: 4_500_000 })
    expect(readPrice('Rs. 98 Lakhs onwards')).toEqual({ ok: 9_800_000 })
    expect(readPrice(8200000)).toEqual({ ok: 8_200_000 })
    expect(readPrice(85)).toEqual({ ok: 8_500_000 })
  })
  it('flags "Call" and nonsense, and turns a per-sqft rate into a total when the area is known', () => {
    expect(readPrice('Call')).toMatchObject({ issue: 'priceOnRequest' })
    expect(readPrice('cheap')).toMatchObject({ issue: 'priceInvalid' })
    expect(readPrice('9,800 / sqft', 2310)).toEqual({ ok: 22_638_000, warn: 'ratePerSqft' })
    expect(readPrice('9,800 / sqft')).toMatchObject({ issue: 'rateNeedsArea' })
  })
})

describe('readArea', () => {
  it('reads sq ft, cents, acres and plot sides', () => {
    expect(readArea('1,200 sq.ft')).toMatchObject({ ok: { sqft: 1200, unit: 'sqft' } })
    expect(readArea(1180)).toMatchObject({ ok: { sqft: 1180 } })
    expect(readArea('3 cents')).toMatchObject({ ok: { value: 3, unit: 'cents', sqft: 1307 } })
    expect(readArea('2 acres')).toMatchObject({ ok: { unit: 'acres', sqft: 87120 } })
    expect(readArea('30x40')).toMatchObject({ ok: { sqft: 1200, lengthFt: 30, widthFt: 40 } })
    expect(readArea('big')).toMatchObject({ issue: 'areaInvalid' })
  })
})

describe('other readers', () => {
  it('phones normalise to E.164 and reject short numbers', () => {
    expect(readPhone('098851 23456')).toEqual({ ok: '+919885123456' })
    expect(readPhone('+91 99400 12873')).toEqual({ ok: '+919940012873' })
    expect(readPhone('12345')).toMatchObject({ issue: 'phoneInvalid' })
  })
  it('dates: Excel serials, Indian day-first, month-year', () => {
    expect(excelSerialToDate(46350)).toBe('2026-11-24')
    expect(readDate(46350)).toEqual({ ok: '2026-11-24' })
    expect(readDate('24/11/2026')).toEqual({ ok: '2026-11-24' })
    expect(readDate('Dec 2027')).toEqual({ ok: '2027-12-01' })
    expect(readDate(new Date(2027, 5, 30))).toEqual({ ok: '2027-06-30' })
    expect(readDate('31/02/2026')).toMatchObject({ issue: 'dateInvalid' })
  })
  it('floors, configurations, facings, types, possession', () => {
    expect(readInt('Ground')).toEqual({ ok: 0 })
    expect(readInt('3rd')).toEqual({ ok: 3 })
    expect(readConfig('2 BHK')).toEqual({ ok: '2BHK' })
    expect(readConfig('5 BHK')).toEqual({ ok: '4BHK+' })
    expect(readConfig('3.5 BHK')).toEqual({ ok: '3BHK', warn: 'configRounded' })
    expect(readFacing('North-East')).toEqual({ ok: 'NE' })
    expect(readFacing('East facing')).toEqual({ ok: 'E' })
    expect(readPropertyType('Flat')).toEqual({ ok: 'apartment' })
    expect(readPropertyType('Godown')).toEqual({ ok: 'warehouse' })
    expect(readPossession('Ready to move')).toEqual({ ok: { status: 'ready' } })
    expect(readPossession('Dec 2027')).toEqual({ ok: { status: 'underConstruction', date: '2027-12-01' } })
  })
  it('cities, sources and timelines', () => {
    expect(readCity('Bangalore')).toEqual({ ok: 'Bengaluru' })
    expect(readCity('Gurgaon')).toEqual({ ok: 'NCR' })
    expect(readCity('coimbatore')).toEqual({ ok: 'Coimbatore' })
    expect(readSource('99acres')).toEqual({ ok: 'acres99' })
    expect(readSource('Walk-in')).toEqual({ ok: 'walkIn' })
    expect(readSource('Newspaper')).toEqual({ ok: 'other', warn: 'sourceOther' })
    expect(readTimeline('1-3 months')).toEqual({ ok: 'm1to3' })
    expect(readTimeline('within 3 months')).toEqual({ ok: 'm1to3' })
    expect(readTimeline('Immediate')).toEqual({ ok: 'immediate' })
  })
})
