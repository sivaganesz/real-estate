import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { extractLeadFields } from './extract-lead'

const now = new Date(2026, 10, 27, 10, 0, 0)
const db = buildSeed(now)
const read = (text: string) => extractLeadFields(text, { now, db })

describe('extractLead (simulated)', () => {
  it('reads the master prompt §12.3 Rahul Verma example completely', () => {
    const x = read("Hi, I'm Rahul Verma, 9845012345. Looking for a 3BHK in Whitefield or Sarjapur, budget around 1.2 Cr, ready to move, need it in 2–3 months. Wife will also decide.")
    const f = x.fields
    expect(f.name).toBe('Rahul Verma')
    expect(f.phone).toBe('+919845012345')
    expect(f.requirement?.configurations).toEqual(['3BHK'])
    expect(f.requirement?.propertyTypes).toEqual(['apartment'])
    expect(f.requirement?.localities).toEqual(['Whitefield', 'Sarjapur Road'])
    expect(f.requirement?.cities).toEqual(['Bengaluru'])
    expect(f.requirement?.budgetMax).toBe(12_000_000)
    expect(f.requirement?.budgetPreferred).toBe(12_000_000)
    expect(f.requirement?.possession).toBe('ready')
    expect(f.qualification?.timeline).toBe('m1to3')
    expect(f.qualification?.decisionMakers).toContain('spouse')
    expect(f.qualification?.authority).toBe('joint')
    // marked as AI-filled, and only the source is still essential
    expect(x.meta.name).toEqual({ origin: 'ai', confidence: 0.9 })
    expect(x.meta['requirement.budgetMax']?.origin).toBe('ai')
    expect(x.missing).toEqual(['source'])
    expect(x.questions[0].field).toBe('source')
    expect(x.questions[0].chips?.length).toBeGreaterThan(3)
    expect(x.filledCount).toBeGreaterThanOrEqual(10)
    expect(x.mode).toBe('simulated')
  })

  it('reads "+91 98450 12345", a lakh range, east facing and sq ft from a portal enquiry', () => {
    const x = read('Name: priya nair\nMobile: +91 98450 12345\nEmail: Priya.Nair@gmail.com\nRequirement: 2 or 3 BHK east facing flat in Gachibowli, 1200 sqft, budget 85-95 L. Saw your ad on 99acres.')
    expect(x.fields.name).toBe('Priya Nair')
    expect(x.fields.phone).toBe('+919845012345')
    expect(x.fields.email).toBe('priya.nair@gmail.com')
    expect(x.fields.source).toBe('acres99')
    expect(x.fields.requirement?.configurations).toEqual(['2BHK', '3BHK'])
    expect(x.fields.requirement?.facing).toEqual(['E'])
    expect(x.fields.requirement?.cities).toEqual(['Hyderabad'])
    expect(x.fields.requirement?.budgetMin).toBe(8_500_000)
    expect(x.fields.requirement?.budgetMax).toBe(9_500_000)
    expect(x.fields.requirement?.areaMinSqft).toBe(1080)
    expect(x.missing).toEqual([])
  })

  it('reads "85 lakhs", 2.5BHK, a loan, NRI and parents from a WhatsApp message', () => {
    const x = read("Hello sir, this is Karthik Subramanian from Dubai. NRI. Want a 2.5BHK in OMR Chennai under 85 lakhs, will need home loan. Parents will decide finally, they stay in Chennai. Planning in 6 months.")
    expect(x.fields.name).toBe('Karthik Subramanian')
    expect(x.fields.isNri).toBe(true)
    expect(x.fields.nriCountry).toBe('UAE')
    expect(x.fields.requirement?.configurations).toEqual(['2.5BHK'])
    expect(x.fields.requirement?.localities).toEqual(['OMR'])
    expect(x.fields.requirement?.budgetMax).toBe(8_500_000)
    expect(x.fields.qualification?.loan).toBe('needed')
    expect(x.fields.qualification?.decisionMakers).toContain('parents')
    expect(x.fields.qualification?.timeline).toBe('m3to6')
    expect(x.missing).toEqual(['phone', 'source'])
  })

  it('reads a lowercase voice transcript with "85 L" and "immediately"', () => {
    const x = read('my name is anita desai my number is 98201 55667 looking for villa in baner pune around 2.4 crore need it immediately investment purpose')
    expect(x.fields.name).toBe('Anita Desai')
    expect(x.fields.phone).toBe('+919820155667')
    expect(x.fields.requirement?.propertyTypes).toEqual(['villa'])
    expect(x.fields.requirement?.localities).toEqual(['Baner'])
    expect(x.fields.requirement?.budgetMax).toBe(24_000_000)
    expect(x.fields.qualification?.timeline).toBe('immediate')
    expect(x.fields.qualification?.buyerPurpose).toBe('investment')
  })

  it('reads a call note with "1.2 Cr to 1.5 Cr", under construction and a referral', () => {
    const x = read('Call from Mr. Suresh Patil (referred by Arjun). 4 BHK in Powai or Thane, 1.2 Cr to 1.5 Cr, under construction is fine, possession Dec 2027. Just exploring for now. 9930011223')
    expect(x.fields.name).toBe('Suresh Patil')
    expect(x.fields.source).toBe('referral')
    expect(x.fields.phone).toBe('+919930011223')
    expect(x.fields.requirement?.configurations).toEqual(['4BHK+'])
    expect(x.fields.requirement?.localities).toEqual(['Powai', 'Thane'])
    expect(x.fields.requirement?.cities).toEqual(['Mumbai'])
    expect(x.fields.requirement?.budgetMin).toBe(12_000_000)
    expect(x.fields.requirement?.budgetMax).toBe(15_000_000)
    expect(x.fields.requirement?.possession).toBe('underConstruction')
    expect(x.fields.requirement?.possessionBy).toBe('2027-12-31')
    expect(x.fields.qualification?.timeline).toBe('exploring')
  })

  it('never takes a greeting as the name, and asks for what is missing', () => {
    const x = read('Hi, interested in plots near Kokapet. Please call back.')
    expect(x.fields.name).toBeUndefined()
    expect(x.fields.requirement?.propertyTypes).toEqual(['plot'])
    expect(x.fields.requirement?.localities).toEqual(['Kokapet'])
    expect(x.missing).toEqual(['name', 'phone', 'source'])
    expect(x.questions.map((q) => q.field)).toEqual(expect.arrayContaining(['name', 'phone', 'source', 'requirement.budgetMax', 'qualification.timeline']))
  })

  it('reads a "Name, phone" first line and a "here" signature, and flags duplicates by phone', () => {
    const existing = db.leads[0]
    const digits = existing.phone.slice(-10)
    const x = read(`Neha Kapoor, ${digits.slice(0, 5)} ${digits.slice(5)} - walk-in today, wants 2 BHK semi furnished in Noida for rent`)
    expect(x.fields.name).toBe('Neha Kapoor')
    expect(x.fields.source).toBe('walkIn')
    expect(x.fields.requirement?.furnishing).toBe('semi')
    expect(x.fields.requirement?.purpose).toBe('rent')
    expect(x.duplicates).toEqual([{ leadId: existing.id, by: 'phone' }])
    expect(read('Hi, Deepak here. 3 bhk in Kharadi under 1 cr').fields.name).toBe('Deepak')
  })

  it('does not read the phone number as a budget or an area', () => {
    const x = read('Rakesh 9845012345 wants 3bhk Hebbal')
    expect(x.fields.requirement?.budgetMax).toBeUndefined()
    expect(x.fields.requirement?.areaMinSqft).toBeUndefined()
    expect(x.fields.name).toBe('Rakesh')
  })
})
