/**
 * M6 Pipeline journey (master prompt §11, foundation-plan §8.3 M6): the kanban by pointer and keyboard, Lost / Booked
 * dialogs (required fields, Cancel returns the card), Undo, list view, filters, the analytics strip, the AI stalled
 * deals + conversion prediction + assistant (Confirm before anything changes), role scoping for admin, manager and the
 * executives, the "Visit scheduled" prompt, and the phone stage tabs + "Move to…" sheet.
 * Runs on the 5176 build (default config) or the M6 dev server (e2e/m6-pipeline.dev.config.ts).
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type DbLead = { id: string; name: string; stage: string; ownerId: string | null; lost?: { reason: string }; deal?: { propertyId?: string; bookingAmount?: number }; stageHistory: { stage: string }[] }
type Db = { leads: DbLead[]; tasks: { leadId?: string; title: string }[]; activities: { leadId?: string; type: string }[] }

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)
const stageOf = async (page: Page, name: string) => (await readDb(page)).leads.find((l) => l.name === name)?.stage

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

async function openPipeline(page: Page, profile: string) {
  await page.goto('/today')
  await switchTo(page, profile)
  await page.getByTestId('sidebar').getByTestId('nav-pipeline').click()
  await expect(page).toHaveURL(/\/pipeline/)
  await expect(page.getByTestId('pipeline-page')).toBeVisible()
}

const column = (page: Page, stage: string) => page.getByTestId(`pipeline-column-${stage}`)
const card = (scope: Page | Locator, name: string) => scope.getByTestId('deal-card').filter({ has: (('page' in scope && typeof scope.page === 'function') ? (scope as Locator).page() : (scope as Page)).getByRole('link', { name, exact: true }) })

async function drag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded()
  const a = (await from.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height - 12)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height - 12, { steps: 4 })
  await to.scrollIntoViewIfNeeded()
  const b = (await to.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + 140, { steps: 12 })
  await page.mouse.up()
}

test('manager: board, pointer drag with Undo, Lost needs a reason and Cancel returns the card', async ({ page, consoleProblems }) => {
  await openPipeline(page, 'role-manager')
  const stages = await page.locator('[data-testid^="pipeline-column-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('pipeline-column-', '')))
  expect(stages).toEqual(['new', 'contacted', 'qualified', 'siteVisitScheduled', 'siteVisitDone', 'negotiation', 'booked', 'converted', 'lost'])
  // every open column shows its ₹ total and share-of-value bar; cards carry the required parts
  await expect(column(page, 'negotiation').getByRole('meter')).toBeVisible()
  await expect(column(page, 'negotiation')).toContainText('₹')
  const harish = card(page, 'Harish Reddy')
  await expect(harish.getByTestId('days-badge')).toBeVisible()
  await expect(harish.getByTestId('deal-prediction')).toContainText('%')
  await expect(page.getByTestId('stalled-marker').first()).toBeVisible()

  // pointer drag New → Contacted, then Undo
  await drag(page, card(page, 'Neha Kulkarni'), column(page, 'contacted'))
  await expect.poll(() => stageOf(page, 'Neha Kulkarni')).toBe('contacted')
  await expect(card(column(page, 'contacted'), 'Neha Kulkarni')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => stageOf(page, 'Neha Kulkarni')).toBe('new')

  // drop on Lost: a reason is required; Cancel leaves the card where it was
  await drag(page, card(page, 'Gaurav Bansal'), column(page, 'lost'))
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Why was the lead lost?')
  await dialog.getByTestId('stage-confirm').click()
  await expect(dialog).toContainText('Choose why the lead was lost')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  expect(await stageOf(page, 'Gaurav Bansal')).toBe('contacted')
  await expect(card(column(page, 'contacted'), 'Gaurav Bansal')).toBeVisible()

  // again, now with a reason
  await drag(page, card(page, 'Gaurav Bansal'), column(page, 'lost'))
  await dialog.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: 'Bought elsewhere' }).click()
  await dialog.getByTestId('stage-confirm').click()
  await expect.poll(async () => (await readDb(page)).leads.find((l) => l.name === 'Gaurav Bansal')?.lost?.reason).toBe('boughtElsewhere')
  await expect(card(column(page, 'lost'), 'Gaurav Bansal')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('manager: keyboard drag, Booked needs property + amount, Visit scheduled offers to book the visit', async ({ page, consoleProblems }) => {
  await openPipeline(page, 'role-manager')

  // keyboard: Space lifts, → moves one column, Space drops
  const pooja = card(page, 'Pooja Agarwal')
  await pooja.focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('Pooja Agarwal is over Qualified.').first()).toBeAttached()
  await page.keyboard.press('ArrowRight')
  // the screen-reader announcement confirms the target before dropping
  await expect(page.getByText('Pooja Agarwal is over Site visit scheduled.').first()).toBeAttached()
  await page.keyboard.press('Space')
  await expect.poll(() => stageOf(page, 'Pooja Agarwal')).toBe('siteVisitScheduled')
  await expect(page.getByText('Pooja Agarwal moved to', { exact: false }).first()).toBeVisible()

  // Booked from the card menu: property and booking amount are required
  const harish = card(page, 'Harish Reddy')
  await harish.hover()
  await harish.getByTestId('deal-menu').click()
  await page.getByRole('menuitem', { name: 'Booked' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Booking (token) amount')
  await dialog.getByTestId('stage-confirm').click()
  await expect(dialog).toContainText('Enter the booking amount')
  expect(await stageOf(page, 'Harish Reddy')).toBe('negotiation')
  const propertyBox = dialog.getByRole('combobox').nth(1)
  if (!(await propertyBox.textContent())?.includes('·')) {
    await propertyBox.click()
    await page.getByRole('option').first().click()
  }
  await dialog.getByLabel('Booking (token) amount').fill('2')
  await dialog.getByTestId('stage-confirm').click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await readDb(page)).leads.find((l) => l.name === 'Harish Reddy')?.deal?.bookingAmount ?? 0).toBeGreaterThan(0)
  expect(await stageOf(page, 'Harish Reddy')).toBe('booked')

  // Mohammed Irfan has no site visit: moving him to Visit scheduled opens the appointment form (it never books by itself)
  const irfan = card(page, 'Mohammed Irfan')
  await irfan.hover()
  await irfan.getByTestId('deal-menu').click()
  await page.getByRole('menuitem', { name: 'Site visit scheduled' }).click()
  await expect(page.getByTestId('appointment-form')).toBeVisible()
  expect(await stageOf(page, 'Mohammed Irfan')).toBe('siteVisitScheduled')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('appointment-form')).toBeHidden()

  // the move is on the lead record (timeline / Today / Reports read the same history)
  const lead = (await readDb(page)).leads.find((l) => l.name === 'Pooja Agarwal')!
  expect(lead.stageHistory.at(-1)?.stage).toBe('siteVisitScheduled')
  expect(consoleProblems).toEqual([])
})

test('manager: list view, filters, analytics strip and KPIs', async ({ page, consoleProblems }) => {
  await openPipeline(page, 'role-manager')
  await expect(page.getByTestId('pipeline-kpis')).toContainText('₹')
  await expect(page.getByTestId('stage-strip')).toBeVisible()
  const analytics = page.getByTestId('stage-analytics')
  await expect(analytics).toContainText('%')
  await expect(analytics).toContainText('Negotiation')

  const allCards = await page.getByTestId('deal-card').count()
  // executive filter (manager only)
  await page.getByRole('button', { name: /^Executive/ }).click()
  await page.getByRole('option', { name: /Sneha Reddy/ }).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/owner=u-sneha/)
  const snehaCards = page.getByTestId('deal-card')
  await expect.poll(() => snehaCards.count()).toBeLessThan(allCards)
  const db = await readDb(page)
  const snehaDeals = db.leads.filter((l) => l.ownerId === 'u-sneha').length
  await expect(snehaCards).toHaveCount(snehaDeals)

  // list view keeps the filter, sorts, and has Move to… per row
  await page.getByRole('radio', { name: 'List' }).or(page.getByRole('button', { name: 'List' })).first().click()
  await expect(page).toHaveURL(/view=list/)
  const rows = page.locator('main table tbody tr')
  await expect(rows).toHaveCount(snehaDeals)
  await rows.filter({ hasText: 'Divya Menon' }).getByRole('button', { name: /Move Divya Menon|Move to/ }).click()
  await page.getByRole('menuitem', { name: 'Site visit scheduled' }).click()
  await expect.poll(() => stageOf(page, 'Divya Menon')).toBe('siteVisitScheduled')

  // stalled only + a search that matches nothing → filtered empty with Clear
  await page.getByTestId('stalled-only').click()
  await page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).first().fill('zzzz-nobody')
  await expect(page.getByText('No deals match these filters', { exact: false }).or(page.getByRole('button', { name: /clear/i })).first()).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await expect(rows).toHaveCount(db.leads.length)
  expect(consoleProblems).toEqual([])
})

test('manager: AI stalled deals plan a task only on Confirm; the assistant moves a deal on Confirm', async ({ page, consoleProblems }) => {
  await openPipeline(page, 'role-manager')
  const panel = page.getByTestId('stalled-panel')
  await expect(panel.getByTestId('demo-ai-badge')).toBeVisible()
  await expect(panel.getByTestId('pipeline-ai-summary')).toBeVisible()
  const first = panel.getByTestId('stalled-deal').first()
  const tasksBefore = (await readDb(page)).tasks.length
  await first.getByTestId('plan-it').click()
  await expect(first.getByTestId('action-proposal')).toBeVisible()
  expect((await readDb(page)).tasks.length).toBe(tasksBefore)
  await first.getByTestId('proposal-confirm').click()
  await expect(first.getByTestId('proposal-done')).toBeVisible()
  expect((await readDb(page)).tasks.length).toBe(tasksBefore + 1)

  const assistant = page.getByTestId('pipeline-assistant')
  await expect(assistant.getByTestId('demo-ai-badge')).toBeVisible()
  await assistant.getByTestId('pipeline-assistant-input').fill('move Karthik Subramanian to site visit done')
  await assistant.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(assistant.getByTestId('action-proposal')).toBeVisible()
  expect(await stageOf(page, 'Karthik Subramanian')).toBe('negotiation')
  await assistant.getByTestId('proposal-confirm').click()
  await expect.poll(() => stageOf(page, 'Karthik Subramanian')).toBe('siteVisitDone')

  // a move to Lost through the assistant still asks for the reason
  await assistant.getByRole('button', { name: 'Ask something else' }).click()
  await assistant.getByTestId('pipeline-assistant-input').fill('move Nisha Kapoor to lost')
  await assistant.getByRole('button', { name: 'Ask', exact: true }).click()
  await assistant.getByTestId('proposal-confirm').click()
  await expect(page.getByRole('dialog')).toContainText('Why was the lead lost?')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  expect(await stageOf(page, 'Nisha Kapoor')).toBe('qualified')
  expect(consoleProblems).toEqual([])
})

test('roles: executives see only their own deals and no executive filter; admin sees everyone', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  const db = await readDb(page)
  for (const [profile, userId] of [['profile-u-arjun', 'u-arjun'], ['profile-u-sneha', 'u-sneha'], ['profile-u-vikram', 'u-vikram']] as const) {
    await switchTo(page, profile)
    await page.getByTestId('sidebar').getByTestId('nav-pipeline').click()
    await expect(page.getByTestId('pipeline-page')).toBeVisible()
    const own = db.leads.filter((l) => l.ownerId === userId)
    await expect(page.getByTestId('deal-card')).toHaveCount(own.length)
    const shown = await page.getByTestId('deal-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-lead')))
    expect(shown.sort()).toEqual(own.map((l) => l.id).sort())
    await expect(page.getByRole('button', { name: /^Executive/ })).toHaveCount(0)
    await expect(page.getByTestId('pipeline-kpis')).toBeVisible()
    await page.getByTestId('sidebar').getByTestId('nav-today').click()
  }
  await switchTo(page, 'role-admin')
  await page.getByTestId('sidebar').getByTestId('nav-pipeline').click()
  await expect(page.getByTestId('deal-card')).toHaveCount(db.leads.length)
  await expect(page.getByRole('button', { name: /^Executive/ })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('Tamil and dark mode render the board without untranslated keys', async ({ page, consoleProblems }) => {
  await openPipeline(page, 'role-manager')
  await page.getByTestId('topbar').getByTestId('language-toggle').click()
  await page.getByTestId('topbar').getByTestId('theme-toggle').click()
  await page.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta')
  await expect(page.locator('html')).toHaveClass(/dark/)
  const text = await page.locator('main').innerText()
  expect(text).not.toMatch(/\bpipeline:|\bcatalogue:|\bdomain:/)
  expect(consoleProblems).toEqual([])
})

test('phone: stage tabs and the Move to… sheet @phone', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  // on a phone the profile picker opens from the avatar in the top bar
  await page.getByTestId('mobile-profile').click()
  await page.getByTestId('profile-picker').getByTestId('role-manager').click()
  await expect(page.getByTestId('profile-picker')).toBeHidden()
  await page.goto('/pipeline')
  const mobile = page.getByTestId('pipeline-mobile')
  await expect(mobile).toBeVisible()
  await mobile.getByRole('tab', { name: /Qualified|Qual/ }).click()
  const divya = card(mobile, 'Divya Menon')
  await expect(divya).toBeVisible()
  await divya.getByTestId('move-to-button').click()
  const sheet = page.getByTestId('move-sheet')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: /^Negotiation/ }).click()
  await expect.poll(() => stageOf(page, 'Divya Menon')).toBe('negotiation')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  expect(consoleProblems).toEqual([])
})
