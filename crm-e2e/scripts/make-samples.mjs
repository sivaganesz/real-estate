#!/usr/bin/env node
/**
 * Builds the demo import files in public/samples/ (foundation-plan §8.3 M5). Run: `node scripts/make-samples.mjs`.
 *
 *  - leads-99acres-export.csv        a portal export: good rows, a lead already in the CRM, a repeat inside the file,
 *                                    a bad phone number and a row with no contact at all
 *  - builder-price-list-custom.xlsx  a messy builder sheet: an Instructions tab, a title and contact line above the
 *                                    headings, custom headings ("Rate", "SBA", "Unit Type"), prices as "1.2 Cr", "85 L",
 *                                    "Call" and per-sqft rates, a ground floor, a totals row, and a Lists tab
 *  - apartment-brochure.pdf          a real text PDF (printed from HTML) with a unit price table
 *  - visiting-card.png               a printed visiting card with a requirement note (for OCR)
 *  - handwritten-requirement.jpg     a handwriting-style note on ruled paper (for OCR)
 *
 * The PDF and the images are rendered by Playwright (Edge, or Chromium with PW_CHANNEL=chromium), so the PDF has real
 * text and the images hold real pixels for tesseract.js to read.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'samples')
mkdirSync(out, { recursive: true })
const write = (name, data) => {
  writeFileSync(path.join(out, name), data)
  console.log(`  wrote public/samples/${name}`)
}

// ── 1. 99acres-style lead export (CSV) ───────────────────────────────────────────────────────────────────────────────
const csvRows = [
  ['Name', 'Mobile', 'Email', 'City', 'Locality', 'Property Type', 'BHK', 'Budget', 'Query Date', 'Message'],
  ['Rohit Verma', '98450 77812', 'rohit.verma@example.com', 'Bangalore', 'Whitefield', 'Apartment', '3 BHK', '1.2 Cr', '24/11/2026', 'Looking for ready to move, near ITPL'],
  ['Sangeetha Raman', '+91 99400 12873', 'sangeetha.r@example.com', 'Chennai', 'OMR', 'Flat', '2 BHK', '75 L', '24/11/2026', 'Wants possession within 3 months'],
  ['Aditya Kulkarni', '9822014567', '', 'Pune', 'Baner', 'Apartment', '2BHK', '95 Lakhs', '25/11/2026', 'Investment, rental yield'],
  ['Farhan Qureshi', '09885 123456', 'farhan.q@example.com', 'Hyderabad', 'Gachibowli', 'Villa', '4 BHK', '2.8 Cr', '25/11/2026', 'Gated community only'],
  ['Priya Sharma', '+91 98451 23401', 'priya.sharma@example.com', 'Bangalore', 'Sarjapur Road', 'Apartment', '3 BHK', '1.1 Cr', '25/11/2026', 'Already spoke to an agent'],
  ['Meera Nair', '98860 44120', 'meera.nair@example.com', 'Bangalore', 'Hebbal', 'Apartment', '2 BHK', '85 L', '26/11/2026', 'NRI, in Dubai, prefers WhatsApp'],
  ['Vikram Singh', '98100 55621', 'vikram.s@example.com', 'Gurgaon', 'Dwarka Expressway', 'Apartment', '3 BHK', '1.6 Cr', '26/11/2026', ''],
  ['Rohit Verma', '9845077812', 'rohit.verma@example.com', 'Bangalore', 'Whitefield', 'Apartment', '3 BHK', '1.25 Cr', '26/11/2026', 'Second enquiry, same buyer'],
  ['Lakshmi Prasad', '12345', 'lakshmi.p@example', 'Chennai', 'Porur', 'Plot', '', '45 L', '26/11/2026', 'Plot for a house, 1200 sq ft'],
  ['Arjun Mehta', '98201 66734', 'arjun.mehta@example.com', 'Mumbai', 'Powai', 'Apartment', '2 BHK', '2.1 Cr', '27/11/2026', 'Needs a loan, pre-approved with HDFC'],
  ['', '', '', 'Pune', 'Wakad', 'Apartment', '1 BHK', '55 L', '27/11/2026', 'No name or number on this enquiry'],
  ['Divya Reddy', '97010 23456', 'divya.reddy@example.com', 'Hyderabad', 'Kokapet', 'Apartment', '3 BHK', '1.4 Cr', '27/11/2026', 'Site visit this weekend'],
]
const csv = csvRows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n')
write('leads-99acres-export.csv', `${csv}\r\n`)

// ── 2. Messy builder price list (XLSX) ───────────────────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new()
const instructions = XLSX.utils.aoa_to_sheet([
  ['How to read this price list'],
  ['Prices are all-inclusive of car park, excluding registration and stamp duty.'],
  ['"Call" means the unit is negotiable: speak to the sales office.'],
  ['Contact: sales@sribalaji.example · 080 4123 4567'],
])
XLSX.utils.book_append_sheet(wb, instructions, 'Instructions')
const priceRows = [
  ['Sri Balaji Builders — Lakeview Residency, Hebbal — Price list Nov 2026'],
  ['Sales office: 080 4123 4567 · valid till 31 Dec 2026'],
  [],
  ['Tower', 'Unit No', 'Unit Type', 'SBA', 'Carpet (sft)', 'Rate', 'Facing', 'Floor', 'Possession', 'Locality', 'RERA No', 'Remarks'],
  ['A', 'A-101', '2 BHK', 1180, 890, '85 L', 'East', 'Ground', 'Ready', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', 'Garden facing'],
  ['A', 'A-304', '2 BHK', 1180, 890, '88 L', 'North-East', '3rd', 'Ready', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', ''],
  ['A', 'A-702', '3 BHK', 1640, 1240, '1.2 Cr', 'East', 7, 'Dec 2027', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', 'Corner unit'],
  ['B', 'B-1104', '3 BHK', 1665, 1255, '1.32 Cr', 'W', 11, 'Dec 2027', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', 'Lake view'],
  ['B', 'B-1501', '3.5 BHK', 1890, 1420, 'Call', 'NE', 15, 'Dec 2027', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', 'Price on request'],
  ['B', 'B-1802', '4 BHK', 2310, 1760, '9,800 / sqft', 'E', 18, 'Jun 2028', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', 'Penthouse level'],
  ['C', 'C-202', '2 BHK', 1150, 870, '79.5 L', 'S', 2, 'Ready', '', 'PRM/KA/RERA/1251/309/PR/2311', 'Locality left blank'],
  ['C', 'C-505', '2 BHK', 1150, 870, '8200000', 'North', 5, 'Ready', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', ''],
  ['A', 'A-304', '2 BHK', 1180, 890, '88 L', 'North-East', '3rd', 'Ready', 'Hebbal', 'PRM/KA/RERA/1251/309/PR/2311', 'Repeated row'],
  [],
  ['Total', '', '', 13345, 10075, '', '', '', '', '', '', '9 units'],
]
const priceSheet = XLSX.utils.aoa_to_sheet(priceRows)
priceSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }]
priceSheet['!cols'] = [6, 9, 10, 8, 12, 12, 11, 8, 12, 12, 30, 18].map((wch) => ({ wch }))
XLSX.utils.book_append_sheet(wb, priceSheet, 'Price List')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Facing'], ['East'], ['West'], ['North'], ['South'], ['North-East']]), 'Lists')
write('builder-price-list-custom.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

// ── 3–5. PDF and images through a real browser ─────────────────────────────────────────────────────────────────────
const brochure = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1d2433;margin:40px}
  h1{font-size:30px;margin:0 0 4px} h2{font-size:18px;margin:28px 0 8px;color:#1f5f73}
  .tag{color:#555;font-size:14px} table{border-collapse:collapse;width:100%;font-size:15px}
  td,th{border:1px solid #c9d2dc;padding:8px 10px;text-align:left} th{background:#eef3f6}
  ul{font-size:15px;line-height:1.6} p{font-size:15px;line-height:1.55}
</style></head><body>
  <h1>Prestige Lakeside Habitat</h1>
  <div class="tag">Premium apartments by Prestige Group · Whitefield, Bengaluru</div>
  <p>Spread over 12 acres beside Varthur lake, Lakeside Habitat offers 2 and 3 BHK apartments with a 40,000 sq ft clubhouse,
  swimming pool, gym, kids play area and 24x7 security. Ready to move by December 2027. Vastu compliant, east facing towers.</p>
  <h2>Unit types and prices</h2>
  <table><tr><th>Configuration</th><th>Super built-up area</th><th>Price</th></tr>
    <tr><td>2 BHK</td><td>1,265 sq ft</td><td>Rs. 98 Lakhs onwards</td></tr>
    <tr><td>3 BHK</td><td>1,740 sq ft</td><td>Rs. 1.45 Cr onwards</td></tr>
  </table>
  <h2>Approvals</h2>
  <p>RERA No: PRM/KA/RERA/1251/446/PR/171014/002345 · BBMP approved plan · Bank approvals: SBI, HDFC Bank, ICICI Bank.</p>
  <h2>Site office</h2>
  <p>Whitefield Main Road, Bengaluru 560066 · Call 98450 11223 · sales@prestige-lakeside.example</p>
</body></html>`

const card = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#e9eef2;font-family:Arial,Helvetica,sans-serif}
  .card{width:840px;height:480px;margin:40px;background:#fff;border-radius:18px;box-shadow:0 6px 24px rgba(0,0,0,.15);
        padding:48px 56px;box-sizing:border-box;position:relative;color:#16202c}
  .bar{position:absolute;left:0;top:0;bottom:0;width:18px;background:#1f6f86;border-radius:18px 0 0 18px}
  .name{font-size:44px;font-weight:bold;margin:0} .role{font-size:24px;color:#3d4a5a;margin:6px 0 30px}
  .line{font-size:27px;margin:10px 0} .note{position:absolute;bottom:40px;left:56px;right:56px;font-size:25px;color:#1f3b4d;
        border-top:2px solid #d5dde5;padding-top:16px}
</style></head><body><div class="card"><div class="bar"></div>
  <p class="name">Ramesh Iyer</p><p class="role">Senior Manager, Infosys Ltd</p>
  <p class="line">Mobile: +91 98450 33221</p><p class="line">Email: ramesh.iyer@example.com</p>
  <p class="line">Electronic City, Bengaluru</p>
  <div class="note">Looking for 3 BHK in Whitefield, budget 1.2 Cr, ready to move</div>
</div></body></html>`

const note = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#d9d4c7}
  .paper{width:880px;height:620px;margin:30px;background:#fffdf4;box-sizing:border-box;padding:50px 60px;
         background-image:repeating-linear-gradient(#fffdf4 0 54px,#b9cfe0 54px 56px);transform:rotate(-1.2deg);
         box-shadow:0 8px 20px rgba(0,0,0,.2);font-family:'Segoe Print','Ink Free','Comic Sans MS',cursive;color:#1b2a6b}
  p{font-size:34px;line-height:56px;margin:0}
</style></head><body><div class="paper">
  <p>Name: Kavitha Suresh</p><p>Phone: 98840 12765</p><p>Need 2 BHK flat near Porur, Chennai</p>
  <p>Budget 70 to 80 lakhs</p><p>Ready to move, within 3 months</p><p>Prefers Tamil, call after 6 pm</p>
</div></body></html>`

const channel = process.env.PW_CHANNEL === 'chromium' ? undefined : (process.env.PW_CHANNEL ?? 'msedge')
const browser = await chromium.launch({ channel })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 })
  await page.setContent(brochure)
  write('apartment-brochure.pdf', await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } }))

  await page.setViewportSize({ width: 920, height: 560 })
  await page.setContent(card)
  write('visiting-card.png', await page.screenshot({ type: 'png' }))

  await page.setViewportSize({ width: 940, height: 680 })
  await page.setContent(note)
  write('handwritten-requirement.jpg', await page.screenshot({ type: 'jpeg', quality: 88 }))
} finally {
  await browser.close()
}
console.log('Samples ready.')
