/**
 * M3 Properties & Matching journeys (plan §8.3 M3, master prompt §13, §14): paste-and-fill a property and save it,
 * the list (plain-words search chips, views, status tabs, bulk status with Undo), permissions per role (an executive
 * edits only what they created, only admin deletes), matching lead → properties with Shortlist / Share (logged) /
 * Schedule visit / Not interested (excluded), property → buyers, the matching assistant, and Booked removing a
 * property from every match list while the owners of interested leads are notified. Phone: no sideways scroll.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Shortlist = { propertyId: string; status: string }
type Db = {
  properties: { id: string; title: string; status: string; createdBy: string; price: number; configuration?: string; location: { locality: string; city: string }; facing?: string; possession: { status: string } }[]
  leads: { id: string; name: string; shortlist: Shortlist[] }[]
  notifications: { id: string; userId: string }[]
  activities: { id: string; type: string; leadId?: string; refs?: unknown }[]
}

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)
const shortlistOf = async (page: Page, leadId: string, propertyId: string) =>
  (await readDb(page)).leads.find((l) => l.id === leadId)?.shortlist.find((s) => s.propertyId === propertyId)?.status

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) {
    await picker.getByTestId('role-executive').click()
  }
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

/** Opening wa.me must not leave the app during a test: record the URL instead. */
async function stubWindowOpen(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { __opened: string[] }).__opened = []
    window.open = ((url?: string | URL) => { (window as unknown as { __opened: string[] }).__opened.push(String(url)); return null }) as typeof window.open
  })
}

test('paste-and-fill a listing, check the form, save it and land on its page', async ({ page, consoleProblems }) => {
  await page.goto('/properties')
  await page.getByTestId('paste-property').click()
  await expect(page).toHaveURL(/\/properties\/new\?paste=1$/)
  // "Paste a listing" opens the form with the visible AI box focused
  const box = page.locator('[data-testid=paste-text]:visible')
  await expect(box).toBeFocused()
  await box.fill('2.5BHK 1200 sqft east facing in Kondapur 85 L ready to move')
  await page.getByTestId('paste-extract').last().click()
  // the form is filled, ₹ / sq ft is computed, nothing is saved yet
  await expect(page.getByTestId('pf-locality')).toHaveValue('Kondapur')
  await expect(page.getByTestId('pf-ppsf')).toContainText('7,083')
  await expect(page.locator('[data-testid=demo-ai-badge]:visible').first()).toBeVisible()
  const before = (await readDb(page)).properties.length
  expect(before).toBe(20)

  await page.getByTestId('property-save').click()
  await expect(page.getByTestId('property-page')).toBeVisible()
  await expect(page).toHaveURL(/\/properties\/PRP-\d+$/)
  const db = await readDb(page)
  expect(db.properties.length).toBe(before + 1)
  const created = db.properties.at(-1)!
  expect(created.price).toBe(8_500_000)
  expect(created.location.locality).toBe('Kondapur')
  expect(created.facing).toBe('E')
  expect(created.possession.status).toBe('ready')
  expect(created.createdBy).toBe('u-arjun')
  await expect(page.getByTestId('key-facts')).toBeVisible()
  await expect(page.getByTestId('price-check')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('a manual property needs the essentials before it saves', async ({ page, consoleProblems }) => {
  await page.goto('/properties/new')
  await page.getByTestId('property-save').click()
  await expect(page.getByRole('alert').filter({ hasText: /locality|price|area/i }).first()).toBeVisible()
  await expect(page).toHaveURL(/\/properties\/new$/)
  expect((await readDb(page)).properties.length).toBe(20)
  expect(consoleProblems).toEqual([])
})

test('the list reads plain words, switches views and tabs, and bulk-changes status with Undo', async ({ page, consoleProblems }) => {
  await page.goto('/properties')
  await switchTo(page, 'role-admin')
  await expect(page.getByTestId('property-card').first()).toBeVisible()

  await page.getByRole('searchbox').or(page.getByRole('textbox', { name: /search/i })).first().fill('3BHK Whitefield under 1.5 Cr')
  await expect(page.getByTestId('search-reading')).toBeVisible()
  await expect(page.getByTestId('property-card')).toHaveCount(1)
  await expect(page.getByTestId('property-card')).toContainText('Aranya Greens')
  await page.getByRole('button', { name: /clear all/i }).click()

  // views
  await page.getByRole('group', { name: /view/i }).getByRole('button', { name: /table/i }).click()
  await expect(page.locator('main table')).toBeVisible()
  await page.getByRole('group', { name: /view/i }).getByRole('button', { name: /locality/i }).click()
  await expect(page.getByTestId('locality-groups')).toBeVisible()
  await page.getByRole('group', { name: /view/i }).getByRole('button', { name: /cards/i }).click()
  await expect(page.getByTestId('property-grid')).toBeVisible()

  // status tabs with counts
  await page.getByRole('navigation', { name: /status/i }).getByRole('button', { name: /^sold/i }).click()
  await expect(page.getByTestId('property-card')).toHaveCount(3)
  await page.getByRole('navigation', { name: /status/i }).getByRole('button', { name: /^available/i }).click()
  const available = await page.getByTestId('property-card').count()
  expect(available).toBeGreaterThan(5)

  // bulk: select two → On hold → Undo
  const cards = page.getByTestId('property-card')
  const ids = [
    (await cards.nth(0).locator('h3 a').getAttribute('href'))!.split('/').pop()!,
    (await cards.nth(1).locator('h3 a').getAttribute('href'))!.split('/').pop()!,
  ]
  await cards.nth(0).getByTestId('property-card-select').click()
  await cards.nth(1).getByTestId('property-card-select').click()
  const bar = page.getByRole('toolbar')
  await expect(bar).toContainText('2')
  await bar.getByRole('button', { name: /status/i }).click()
  await page.getByRole('menuitem', { name: /on hold/i }).click()
  await expect.poll(async () => (await readDb(page)).properties.filter((p) => ids.includes(p.id)).map((p) => p.status)).toEqual(['onHold', 'onHold'])
  await page.getByRole('button', { name: /^undo$/i }).click()
  await expect.poll(async () => (await readDb(page)).properties.filter((p) => ids.includes(p.id)).map((p) => p.status)).toEqual(['available', 'available'])

  // a selection hidden by a filter is not acted on: the bar counts only what is on screen
  await cards.nth(0).getByTestId('property-card-select').click()
  await expect(bar.getByRole('button', { name: /delete/i })).toBeVisible()
  await page.getByRole('navigation', { name: /status/i }).getByRole('button', { name: /^sold/i }).click()
  await expect(page.getByRole('toolbar')).toHaveCount(0)
  await page.getByRole('navigation', { name: /status/i }).getByRole('button', { name: /^available/i }).click()
  await expect(bar).toBeVisible()
  await bar.getByRole('button', { name: /clear/i }).click()

  // an executive: no delete, no export; status is locked when a selected listing is someone else's
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/properties')
  const sneha = page.getByTestId('property-card').filter({ hasText: 'Marina Vista' })
  await sneha.getByTestId('property-card-select').click()
  await expect(bar.getByRole('button', { name: /delete/i })).toHaveCount(0)
  await expect(bar.getByRole('button', { name: /export/i })).toHaveCount(0)
  await expect(bar.getByRole('button', { name: /status/i })).toBeDisabled()
  expect(consoleProblems).toEqual([])
})

test('permissions: an executive edits only their own listings, only admin deletes', async ({ page, consoleProblems }) => {
  await page.goto('/properties/PRP-1004')
  await switchTo(page, 'profile-u-arjun')
  // Sneha's listing: Arjun can look, not edit, not delete, not change its status
  await expect(page.getByTestId('property-page')).toBeVisible()
  await expect(page.getByTestId('property-edit')).toHaveCount(0)
  await expect(page.getByTestId('property-edit-locked')).toHaveAttribute('title', /only change records you own/i)
  await expect(page.getByTestId('property-status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^delete property$/i })).toHaveCount(0)
  await page.goto('/properties/PRP-1004/edit')
  await expect(page.getByTestId('no-access').or(page.getByText(/only edit|can't edit|cannot edit|created/i).first())).toBeVisible()

  // his own listing: edit and save
  await page.goto('/properties/PRP-1002')
  await page.getByTestId('property-edit').click()
  await expect(page.getByTestId('pf-title')).toBeVisible()
  await page.getByTestId('pf-title').fill('Neelam Heights 2 BHK corner, Hebbal')
  await page.getByTestId('property-save').click()
  await expect(page.getByTestId('property-page')).toBeVisible()
  await expect(page.locator('main h1')).toHaveText('Neelam Heights 2 BHK corner, Hebbal')
  expect((await readDb(page)).properties.find((p) => p.id === 'PRP-1002')?.title).toBe('Neelam Heights 2 BHK corner, Hebbal')

  // the manager can edit anything but cannot delete; admin deletes with confirm + Undo
  await switchTo(page, 'role-manager')
  await page.goto('/properties/PRP-1004')
  await expect(page.getByTestId('property-edit')).toBeVisible()
  await expect(page.getByRole('button', { name: /^delete property$/i })).toHaveCount(0)
  await switchTo(page, 'role-admin')
  await page.goto('/properties/PRP-1004')
  await page.getByRole('button', { name: /^delete property$/i }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: /delete/i }).click()
  await expect(page).toHaveURL(/\/properties$/)
  await expect.poll(async () => (await readDb(page)).properties.some((p) => p.id === 'PRP-1004')).toBe(false)
  await page.getByRole('button', { name: /^undo$/i }).click()
  await expect.poll(async () => (await readDb(page)).properties.some((p) => p.id === 'PRP-1004')).toBe(true)
  expect(consoleProblems).toEqual([])
})

test('matching a buyer: shortlist, share on WhatsApp (logged), schedule visit, not interested', async ({ page, consoleProblems }) => {
  await stubWindowOpen(page)
  await page.goto('/matching?lead=LEAD-1003')
  await expect(page.getByTestId('match-count')).toBeVisible()
  const grid = page.getByTestId('match-grid')
  await expect(grid.getByTestId('property-card').first()).toBeVisible()
  // percentage ring + label on every card; booked / sold never appear
  const titles = await grid.locator('h3').allInnerTexts()
  for (const gone of ['Deccan Pearl', 'Bayview', 'Tamarind', 'Row house', 'Ground-floor shop', 'Warehouse']) expect(titles.join('|')).not.toContain(gone)
  const first = grid.getByTestId('property-card').first()
  const propertyId = (await first.locator('h3 a').getAttribute('href'))!.split('/').pop()!
  await expect(first.getByRole('button', { name: /why|match/i }).first()).toBeVisible()

  // shortlist
  await first.getByRole('button', { name: /^shortlist$/i }).click()
  await expect.poll(() => shortlistOf(page, 'LEAD-1003', propertyId)).toBe('shortlisted')

  // share: message → open WhatsApp → logged as shared
  await first.getByRole('button', { name: /share/i }).click()
  const dialog = page.getByTestId('share-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('share-message')).not.toBeEmpty()
  await dialog.getByTestId('share-open-whatsapp').click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => shortlistOf(page, 'LEAD-1003', propertyId)).toBe('shared')
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual([expect.stringContaining('wa.me/')])

  // schedule a site visit: the appointment dialog opens prefilled
  await first.getByRole('button', { name: /schedule/i }).click()
  const visit = page.getByRole('dialog')
  await expect(visit).toBeVisible()
  await expect(visit).toContainText('Ananya Iyer')
  await page.keyboard.press('Escape')
  await expect(visit).toBeHidden()

  // not interested: the card leaves the list and stays out
  await first.getByRole('button', { name: /not interested/i }).click()
  await expect.poll(() => shortlistOf(page, 'LEAD-1003', propertyId)).toBe('notInterested')
  await expect(grid.locator(`h3 a[href$="/${propertyId}"]`)).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('match-count')).toBeVisible()
  await expect(page.locator(`[data-testid=match-grid] h3 a[href$="/${propertyId}"]`)).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('a property page lists matched buyers and shares the listing with one of them', async ({ page, consoleProblems }) => {
  await stubWindowOpen(page)
  await page.goto('/properties/PRP-1002')
  const matched = page.getByTestId('matched-leads')
  await expect(matched.getByTestId('match-list').locator('li').first()).toBeVisible()
  await expect(matched).toContainText('Ananya Iyer')
  const activitiesBefore = (await readDb(page)).activities.length

  await page.getByRole('button', { name: /share with a lead/i }).click()
  const pick = page.getByRole('dialog')
  await pick.getByRole('button', { name: /Mohammed Irfan/ }).click()
  await pick.getByRole('button', { name: /write the message/i }).click()
  const share = page.getByTestId('share-dialog')
  await expect(share).toContainText('Mohammed Irfan')
  await share.getByRole('button', { name: /hinglish/i }).click()
  await expect(share.getByTestId('share-message')).not.toBeEmpty()
  await share.getByRole('button', { name: /write with ai/i }).click()
  await expect(share.getByTestId('demo-ai-badge')).toBeVisible()
  await share.getByTestId('share-open-whatsapp').click()
  await expect(share).toBeHidden()
  await expect.poll(() => shortlistOf(page, 'LEAD-1004', 'PRP-1002')).toBe('shared')
  expect((await readDb(page)).activities.length).toBeGreaterThan(activitiesBefore)
  // the AI listing copy is only applied after "Use"
  await page.getByTestId('listing-copy-generate').click()
  await expect(page.getByTestId('listing-copy').getByTestId('demo-ai-badge')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('matching a property ranks buyers, and the assistant reads who and what', async ({ page, consoleProblems }) => {
  await page.goto('/matching?property=PRP-1001')
  await switchTo(page, 'role-admin')
  await page.goto('/matching?property=PRP-1001')
  await expect(page.getByTestId('match-count')).toBeVisible()
  const list = page.getByTestId('match-list').first()
  await expect(list.locator('li').first()).toBeVisible()
  await expect(list.locator('li').first()).toContainText(/Strong|Good|Fair|Weak|%|match/i)

  await page.goto('/matching')
  await page.getByTestId('matching-ask').fill("properties within Priya's budget in Whitefield")
  await page.getByTestId('matching-assistant').getByRole('button', { name: /ask/i }).click()
  await expect(page).toHaveURL(/lead=LEAD-1001/)
  await expect(page.getByTestId('match-reading')).toContainText('Whitefield')
  await expect(page.getByTestId('lead-summary')).toContainText('Priya Sharma')

  await page.getByTestId('matching-ask').fill('which leads fit PRP-1002')
  await page.getByTestId('matching-assistant').getByRole('button', { name: /ask/i }).click()
  await expect(page).toHaveURL(/property=PRP-1002/)
  await expect(page.getByTestId('property-summary')).toContainText('Neelam Heights')
  expect(consoleProblems).toEqual([])
})

test('marking a property Booked takes it out of every match list and tells interested leads\' owners', async ({ page, consoleProblems }) => {
  await page.goto('/matching?lead=LEAD-1001')
  await switchTo(page, 'role-admin')
  await page.goto('/matching?lead=LEAD-1001')
  await expect(page.locator('[data-testid=match-grid] h3 a[href$="/PRP-1001"]')).toHaveCount(1)
  const notesBefore = (await readDb(page)).notifications.length

  await page.goto('/properties/PRP-1001')
  await page.getByTestId('property-status').click()
  await page.getByTestId('status-booked').click()
  await page.getByRole('alertdialog').getByRole('button', { name: /booked/i }).click()
  await expect.poll(async () => (await readDb(page)).properties.find((p) => p.id === 'PRP-1001')?.status).toBe('booked')
  await expect.poll(async () => (await readDb(page)).notifications.length).toBeGreaterThan(notesBefore)
  await expect(page.getByTestId('matched-leads')).not.toContainText('%')

  await page.goto('/matching?lead=LEAD-1001')
  await expect(page.getByTestId('match-count')).toBeVisible()
  await expect(page.locator('[data-testid=match-grid] h3 a[href$="/PRP-1001"]')).toHaveCount(0)
  await page.goto('/matching?property=PRP-1001')
  await expect(page.getByTestId('match-count')).toBeVisible()
  await expect(page.getByTestId('match-list')).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('every executive sees only their own buyers in matching', async ({ page, consoleProblems }) => {
  for (const [profile, own, other] of [['profile-u-arjun', 'Priya Sharma', 'Divya Menon'], ['profile-u-sneha', 'Divya Menon', 'Priya Sharma'], ['profile-u-vikram', 'Pooja Agarwal', 'Priya Sharma']] as const) {
    await page.goto('/matching')
    await switchTo(page, profile)
    await page.goto('/matching')
    await page.getByTestId('match-pick-lead').click()
    await expect(page.getByRole('option', { name: new RegExp(own) })).toBeVisible()
    await expect(page.getByRole('option', { name: new RegExp(other) })).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
  expect(consoleProblems).toEqual([])
})

test('properties, a property and matching fit a 375 px phone, in English and Tamil @phone', async ({ page, consoleProblems }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const urls = ['/properties', '/properties/PRP-1001', '/properties/new', '/properties/PRP-1002/edit', '/matching?lead=LEAD-1001', '/matching?property=PRP-1002']
  for (const lang of ['en', 'ta']) {
    await page.goto('/properties')
    await page.evaluate((l) => localStorage.setItem('crm-e2e-lang', l), lang)
    for (const url of urls) {
      await page.goto(url)
      await expect(page.locator('main h1').first()).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${lang} ${url}`).toBeLessThanOrEqual(0)
    }
  }
  expect(consoleProblems).toEqual([])
})
