import { describe, expect, it } from 'vitest'
import { fromAmountField, parseAmountText, toAmountField } from './amount'
import { fmtDate, fmtDateTime, fmtTime, firstName, inr, inrRange, inrShort, initials, num, sqft } from './format'
import { isValidIndianMobile, last10, phoneDisplay, telLink, toE164 } from './phone'
import { localAt, retrySlot } from './dates'
import { fillTemplate, mapsLink, waLink } from './whatsapp'

describe('rupees', () => {
  it('formats in the Indian system', () => {
    expect(inr(4_500_000)).toBe('₹45,00,000')
    expect(inr(12_345_678)).toBe('₹1,23,45,678')
    expect(inr(undefined)).toBe('')
  })
  it('shortens to lakh and crore', () => {
    expect(inrShort(4_500_000)).toBe('₹45 L')
    expect(inrShort(12_000_000)).toBe('₹1.2 Cr')
    expect(inrShort(12_800_000)).toBe('₹1.28 Cr')
    expect(inrShort(8_550_000)).toBe('₹85.5 L')
    expect(inrShort(50_000)).toBe('₹50,000')
  })
  it('formats ranges', () => {
    expect(inrRange(6_000_000, 8_000_000)).toBe('₹60 L – ₹80 L')
    expect(inrRange(undefined, 12_000_000)).toBe('up to ₹1.2 Cr')
    expect(inrRange(5_000_000, undefined)).toBe('from ₹50 L')
    expect(inrRange(5_000_000, 5_000_000)).toBe('₹50 L')
    expect(inrRange(undefined, undefined)).toBe('')
  })
  it('formats numbers and areas', () => {
    expect(num(120000)).toBe('1,20,000')
    expect(sqft(1200)).toBe('1,200 sq.ft.')
    expect(initials('Arjun Mehta')).toBe('AM')
    expect(firstName('  Priya Sharma ')).toBe('Priya')
  })
})

describe('amount fields (L / Cr)', () => {
  it('round-trips', () => {
    expect(toAmountField(12_800_000)).toEqual({ v: '1.28', unit: 'Cr' })
    expect(toAmountField(8_500_000)).toEqual({ v: '85', unit: 'L' })
    expect(toAmountField(undefined, 'Cr')).toEqual({ v: '', unit: 'Cr' })
    expect(fromAmountField({ v: '85', unit: 'L' })).toBe(8_500_000)
    expect(fromAmountField({ v: '1.2', unit: 'Cr' })).toBe(12_000_000)
    expect(fromAmountField({ v: '', unit: 'L' })).toBeUndefined()
    expect(fromAmountField({ v: '-3', unit: 'L' })).toBeUndefined()
  })
  it('reads typed amounts', () => {
    expect(parseAmountText('1.2 Cr')).toBe(12_000_000)
    expect(parseAmountText('1.2cr')).toBe(12_000_000)
    expect(parseAmountText('85 lakhs')).toBe(8_500_000)
    expect(parseAmountText('85 L')).toBe(8_500_000)
    expect(parseAmountText('₹45,00,000')).toBe(4_500_000)
    expect(parseAmountText('85')).toBe(8_500_000)
    expect(parseAmountText('75k')).toBe(75_000)
    expect(parseAmountText('call')).toBeUndefined()
  })
})

describe('phones', () => {
  it('normalises to E.164 and displays +91 98450 12345', () => {
    expect(toE164('98450 12345')).toBe('+919845012345')
    expect(toE164('+91-98450-12345')).toBe('+919845012345')
    expect(toE164('09845012345')).toBe('+919845012345')
    expect(toE164('12345')).toBe('')
    expect(toE164('5845012345')).toBe('')
    expect(phoneDisplay('+919845012345')).toBe('+91 98450 12345')
    expect(last10('+91 98450 12345')).toBe('9845012345')
    expect(isValidIndianMobile('7012345678')).toBe(true)
    expect(telLink('+919845012345')).toBe('tel:+919845012345')
  })
  it('builds WhatsApp and map links', () => {
    expect(waLink('+91 98450 12345', 'Hi Priya')).toBe('https://wa.me/919845012345?text=Hi%20Priya')
    expect(waLink('123')).toBe('')
    expect(mapsLink('Whitefield, Bengaluru')).toBe('https://www.google.com/maps/search/?api=1&query=Whitefield%2C%20Bengaluru')
    expect(fillTemplate('Hi {{firstName}}, see {{property}} {{missing}}', { firstName: 'Priya', property: 'Aranya Greens' })).toBe('Hi Priya, see Aranya Greens')
  })
})

describe('dates', () => {
  it('formats DD MMM YYYY and h:mm a', () => {
    expect(fmtDate('2026-11-05')).toBe('05 Nov 2026')
    expect(fmtDate(new Date(2026, 0, 9, 15, 0).toISOString())).toBe('09 Jan 2026')
    expect(fmtTime(new Date(2026, 0, 9, 15, 5).toISOString())).toBe('3:05 PM')
    expect(fmtDateTime(new Date(2026, 0, 9, 9, 30).toISOString())).toBe('09 Jan 2026, 9:30 AM')
    expect(fmtDate(undefined)).toBe('')
  })
  it('retries a missed call in 2 hours, or at 10:00 the next morning after 19:00', () => {
    const noon = new Date(2026, 10, 27, 12, 0)
    expect(retrySlot(noon)).toBe(new Date(2026, 10, 27, 14, 0).toISOString())
    const evening = new Date(2026, 10, 27, 18, 0)
    expect(retrySlot(evening)).toBe(localAt(evening, 1, '10:00'))
    expect(new Date(retrySlot(evening)).getHours()).toBe(10)
  })
})
