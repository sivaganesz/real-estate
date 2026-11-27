/**
 * Phase 3 integration journeys (master prompt §7, §12.2, §12.3; DESIGN_SYSTEM §10): chart click-throughs open filtered
 * lists, the shared <ModuleAssistant> is on the screens it belongs to, paste-and-fill + voice sit on the Add forms,
 * dynamic breadcrumbs, and the docked assistant no longer squeezes a 1440 px page.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Db = {
  leads: { id: string; name: string; ownerId: string | null; stage: string; source: string }[]
  properties: { id: string; status: string; createdBy?: string }[]
}
const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

test('filtered links: Leads, Pipeline and Properties honour the filter params', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-admin')

  await page.goto('/leads?source=website&view=table')
  await expect(page.getByRole('button', { name: 'Source: 1 chosen' })).toBeVisible()
  // editing the filters drops the link's params
  await page.getByRole('button', { name: 'Clear the Source filter' }).click()
  await expect(page).not.toHaveURL(/source=/)
  await expect(page.getByRole('button', { name: 'Source', exact: true })).toBeVisible()

  await page.goto('/pipeline?stage=negotiation&view=list')
  await expect(page.getByRole('button', { name: 'Stage: 1 chosen' })).toBeVisible()
  const db = await readDb(page)
  const inNegotiation = db.leads.filter((l) => l.stage === 'negotiation').length
  await expect(page.locator('tbody tr')).toHaveCount(inNegotiation)

  await page.goto('/properties?type=villa')
  await expect(page.getByRole('button', { name: /Type: 1 chosen/ })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('a Reports chart click opens the drill-down, and "Open" goes to the filtered list', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  await page.goto('/reports/inventory')
  // breadcrumb names the tab instead of "Report"
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Inventory')
  await page.getByRole('button', { name: /^Booked/ }).first().click()
  const drawer = page.getByTestId('drill-drawer')
  await expect(drawer).toBeVisible()
  await page.getByTestId('drill-open').click()
  await expect(page).toHaveURL(/\/properties\?status=booked/)
  await expect(page.getByTestId('properties-page').or(page.locator('main'))).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('module assistants are mounted where they belong', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await expect(page.getByTestId('assistant-insights')).toBeVisible()

  const db = await readDb(page)
  const mine = db.leads.find((l) => l.ownerId === 'u-arjun' && !['lost', 'converted'].includes(l.stage))!
  await page.goto(`/leads/${mine.id}`)
  await expect(page.getByTestId('assistant-followUp')).toBeVisible()

  // Add lead / Add property / Add appointment: paste-and-fill with voice
  await page.goto('/leads/new')
  await expect(page.getByTestId('paste-text')).toBeVisible()
  await expect(page.getByTestId('voice-button').first()).toBeVisible()
  await page.goto('/properties/new')
  await expect(page.getByTestId('paste-text').first()).toBeAttached()
  await expect(page.getByTestId('voice-button').first()).toBeAttached()

  await page.goto('/import')
  await expect(page.getByTestId('assistant-import')).toBeVisible()

  await switchTo(page, 'role-manager')
  await page.goto('/reports')
  await expect(page.getByTestId('assistant-insights')).toBeVisible()
  await page.goto('/today')
  await expect(page.getByTestId('assistant-insights')).toBeVisible()

  await switchTo(page, 'role-admin')
  const prop = (await readDb(page)).properties.find((p) => p.status === 'available')!
  await page.goto(`/properties/${prop.id}`)
  await expect(page.getByTestId('assistant-propertyEdit')).toBeVisible()
  await page.goto('/settings/assignment')
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).not.toContainText('Settings section')
  expect(consoleProblems).toEqual([])
})

test('the assistant overlays at 1440 px instead of squeezing the lead page', async ({ page, consoleProblems }) => {
  await page.goto('/leads/LEAD-1001')
  const main = page.locator('main')
  const before = (await main.boundingBox())!.width
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('ai-panel')).toBeVisible()
  expect((await main.boundingBox())!.width).toBe(before)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ai-panel')).toBeHidden()
  expect(consoleProblems).toEqual([])
})

test('@phone the lead page with its follow-up assistant fits the phone width', async ({ page, consoleProblems }) => {
  await page.goto('/leads/LEAD-1001')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.getByRole('region', { name: /follow-up assistant/i })).toBeAttached()
  // the page grid used to grow to the widest card (552 px on a 412 px phone), which pushed fixed buttons off screen
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  expect(consoleProblems).toEqual([])
})

/* ---------- master prompt §7: cross-module flows, end to end through the UI ---------- */

type FullDb = {
  leads: { id: string; name: string; ownerId: string | null; stage: string; deal?: { propertyId?: string } }[]
  properties: { id: string; status: string }[]
  appointments: { id: string; leadId?: string; type: string; status: string; ownerId: string }[]
  tasks: { id: string; leadId?: string; status: string; ownerId: string }[]
  notifications: { id: string; userId: string; kind: string; ref?: { kind: string; id: string } }[]
  assignments: { leadId: string; fromUserId: string | null; toUserId: string | null }[]
  activities: { id: string; kind: string; refs: { kind: string; id: string }[] }[]
  clients: { id: string; leadId?: string }[]
}
const readFull = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: FullDb } }).state.db)
const leadTabs = (page: Page) => page.locator('#lead-tabs')

/**
 * Lead ids on the executive's Today priority list (expanded). Today's appointments are left out on purpose: a visit
 * that already happened stays with the person who did it (E3 moves open tasks and future appointments only).
 */
async function todayLeadIds(page: Page) {
  await page.goto('/today')
  await expect(page.getByTestId('today-executive')).toBeVisible()
  const more = page.getByRole('button', { name: /^Show all \d+/ })
  if (await more.isVisible()) await more.click()
  const hrefs = await page.getByTestId('priority-item').locator('a[href^="/leads/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
  return new Set(hrefs.map((h) => h.replace('/leads/', '')))
}

async function moveOnPipelineList(page: Page, name: string, stage: string) {
  await page.goto('/pipeline?view=list')
  await page.locator('main table tbody tr').filter({ hasText: name }).getByRole('button', { name: new RegExp(`Move ${name}|Move to`) }).click()
  await page.getByRole('menuitem', { name: stage, exact: true }).click()
  const confirm = page.getByTestId('stage-confirm')
  if (await confirm.isVisible()) await confirm.click()
}

test('§7 a site visit booked from a lead page: appointment, timeline, stage, calendar, and it survives a reload', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const before = await readFull(page)
  const lead = before.leads.find((l) => l.ownerId === 'u-arjun' && ['new', 'contacted', 'qualified'].includes(l.stage))!
  expect(lead).toBeTruthy()

  await page.goto(`/leads/${lead.id}`)
  await page.getByTestId('qa-visit').first().click()
  const form = page.getByTestId('appointment-form')
  await expect(form).toBeVisible()
  await form.locator('button', { hasText: 'Add property' }).click()
  await page.getByRole('dialog').last().locator('ul button').first().click()
  await page.keyboard.press('Escape')
  await form.getByTestId('slot-suggestions').getByRole('button').first().click()
  await form.getByTestId('appointment-save').click()
  await expect(form).toBeHidden()

  // store: one new site visit for the lead, owned by Arjun, and the stage moved (E6)
  await expect.poll(async () => (await readFull(page)).leads.find((l) => l.id === lead.id)!.stage).toBe('siteVisitScheduled')
  const after = await readFull(page)
  const appt = after.appointments.find((a) => a.leadId === lead.id && a.type === 'siteVisit' && !before.appointments.some((b) => b.id === a.id))!
  expect(appt).toBeTruthy()
  expect(appt.ownerId).toBe('u-arjun')
  expect(after.activities.some((a) => a.kind === 'appointment.created' && a.refs.some((r) => r.id === lead.id))).toBe(true)

  // the lead page shows it: timeline entries for the booking and the stage move, the Appointments tab lists it
  await expect(leadTabs(page)).toContainText('Appointment booked')
  await expect(leadTabs(page)).toContainText('Stage moved to Site visit scheduled')
  await leadTabs(page).getByRole('button', { name: /^Appointments/ }).click()
  await expect(leadTabs(page).getByText(/site visit/i).first()).toBeVisible()

  // the calendar (list view) has it
  await page.goto('/appointments?view=list')
  await expect(page.getByTestId('agenda-list')).toContainText(lead.name)

  // persistence: a reload keeps the appointment, the stage and the timeline
  await page.goto(`/leads/${lead.id}`)
  await page.reload()
  await expect(page.locator('main h1')).toContainText(lead.name)
  await expect(leadTabs(page)).toContainText('Appointment booked')
  const reloaded = await readFull(page)
  expect(reloaded.leads.find((l) => l.id === lead.id)!.stage).toBe('siteVisitScheduled')
  expect(reloaded.appointments.some((a) => a.id === appt.id)).toBe(true)
  expect(consoleProblems).toEqual([])
})

test('§7 booking a deal on the pipeline books its property and takes it out of matching', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  const before = await readFull(page)
  const harish = before.leads.find((l) => l.id === 'LEAD-1008')!
  expect(harish.stage).toBe('negotiation')
  const propertyId = harish.deal!.propertyId!
  expect(before.properties.find((p) => p.id === propertyId)!.status).toBe('available')

  // the property has buyers before the booking
  await page.goto(`/matching?property=${propertyId}`)
  await expect(page.getByTestId('match-count')).toBeVisible()
  await expect(page.getByTestId('match-list')).toHaveCount(1)

  await page.goto('/pipeline')
  await expect(page.getByTestId('pipeline-page')).toBeVisible()
  const card = page.getByTestId('deal-card').filter({ has: page.getByRole('link', { name: 'Harish Reddy', exact: true }) })
  await card.hover()
  await card.getByTestId('deal-menu').click()
  await page.getByRole('menuitem', { name: 'Booked' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Booking (token) amount')
  await dialog.getByLabel('Booking (token) amount').fill('2')
  await dialog.getByTestId('stage-confirm').click()
  await expect(dialog).toBeHidden()

  // E5: the property is booked and a client record exists
  await expect.poll(async () => (await readFull(page)).properties.find((p) => p.id === propertyId)!.status).toBe('booked')
  const after = await readFull(page)
  expect(after.leads.find((l) => l.id === 'LEAD-1008')!.stage).toBe('booked')
  expect(after.clients.some((c) => c.leadId === 'LEAD-1008')).toBe(true)

  // matching no longer offers it, to anyone
  await page.goto(`/matching?property=${propertyId}`)
  await expect(page.getByTestId('match-count')).toBeVisible()
  await expect(page.getByTestId('match-list')).toHaveCount(0)
  const otherBuyer = after.leads.find((l) => l.id !== 'LEAD-1008' && !['booked', 'lost', 'converted'].includes(l.stage))!
  await page.goto(`/matching?lead=${otherBuyer.id}`)
  await expect(page.getByTestId('match-count')).toBeVisible()
  await expect(page.locator(`[data-testid=match-grid] a[href$="/${propertyId}"]`)).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('§7 reassigning a lead moves it between both Todays, writes the history and notifies both people', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const db = await readFull(page)
  const arjunToday = await todayLeadIds(page)
  // a lead of Arjun's on his Today with open work (tasks move with the lead, E3)
  const lead = db.leads.find((l) => l.ownerId === 'u-arjun' && arjunToday.has(l.id) && db.tasks.some((t) => t.leadId === l.id && t.status === 'open'))!
  expect(lead).toBeTruthy()

  await switchTo(page, 'role-manager')
  await page.goto(`/leads/${lead.id}`)
  await page.getByRole('button', { name: /^reassign$/i }).first().click()
  const dialog = page.getByTestId('assign-dialog')
  await expect(dialog).toBeVisible()
  await page.getByTestId('assign-person-u-vikram').click()
  await page.getByTestId('assign-confirm').click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await readFull(page)).leads.find((l) => l.id === lead.id)!.ownerId).toBe('u-vikram')

  const after = await readFull(page)
  expect(after.tasks.filter((t) => t.leadId === lead.id && t.status === 'open').every((t) => t.ownerId === 'u-vikram')).toBe(true)
  expect(after.assignments.some((a) => a.leadId === lead.id && a.fromUserId === 'u-arjun' && a.toUserId === 'u-vikram')).toBe(true)
  expect(after.notifications.some((n) => n.userId === 'u-vikram' && n.kind === 'reassignment' && n.ref?.id === lead.id)).toBe(true)
  expect(after.notifications.some((n) => n.userId === 'u-arjun' && n.kind === 'reassignment' && n.ref?.id === lead.id)).toBe(true)

  // history on the lead page (newest first) and the timeline entry
  await leadTabs(page).getByRole('button', { name: /^Assignment history/ }).click()
  const newest = page.getByTestId('assignment-history').locator('li').first()
  await expect(newest).toContainText('Arjun Mehta')
  await expect(newest).toContainText('Vikram Singh')
  await leadTabs(page).getByRole('button', { name: /^Activity/ }).click()
  await expect(leadTabs(page)).toContainText('Reassigned from Arjun Mehta to Vikram Singh')

  // both Todays: gone from Arjun's, on Vikram's; each has the notification
  await switchTo(page, 'profile-u-arjun')
  expect((await todayLeadIds(page)).has(lead.id)).toBe(false)
  await page.goto('/notifications')
  await expect(page.locator('main')).toContainText(`${lead.name} moved from you to Vikram Singh`)
  await switchTo(page, 'profile-u-vikram')
  expect((await todayLeadIds(page)).has(lead.id)).toBe(true)
  await page.goto('/notifications')
  await expect(page.locator('main')).toContainText(`${lead.name} was reassigned from Arjun Mehta`)
  expect(consoleProblems).toEqual([])
})

test('§7 a pipeline move shows up on the manager Today and in Reports', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  const negotiationTab = () => page.getByTestId('deals-card').getByRole('button', { name: /^Negotiation/ })
  const negotiationCount = async () => Number((await negotiationTab().innerText()).replace(/\D+/g, '') || '0')
  await expect(page.getByTestId('deals-card')).toBeVisible()
  const todayBefore = await negotiationCount()

  const agingNegotiation = async () => {
    const row = page.getByTestId('table-aging').locator('tbody tr').filter({ hasText: /^Negotiation/ })
    return (await row.count()) ? Number(await row.locator('td').nth(1).innerText()) : 0
  }
  await page.goto('/reports/pipeline')
  await expect(page.getByTestId('table-aging')).toBeVisible()
  const reportBefore = await agingNegotiation()

  await moveOnPipelineList(page, 'Divya Menon', 'Negotiation')
  await expect.poll(async () => (await readFull(page)).leads.find((l) => l.name === 'Divya Menon')!.stage).toBe('negotiation')

  await page.getByTestId('sidebar').getByTestId('nav-today').click()
  await expect(page.getByTestId('deals-card')).toBeVisible()
  await expect.poll(negotiationCount).toBe(todayBefore + 1)
  await negotiationTab().click()
  if (todayBefore + 1 <= 6) await expect(page.getByTestId('deals-card').getByTestId('deal-row').filter({ hasText: 'Divya Menon' })).toHaveCount(1)

  await page.getByTestId('sidebar').getByTestId('nav-reports').click()
  await page.getByRole('navigation', { name: 'Report sections' }).getByRole('button', { name: /^pipeline$/i }).click()
  await expect(page.getByTestId('table-aging')).toBeVisible()
  await expect.poll(agingNegotiation).toBe(reportBefore + 1)
  expect(consoleProblems).toEqual([])
})

test('§7 changes persist after a reload, and Reset demo data restores the seed', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  const seed = await readFull(page)
  const divya = seed.leads.find((l) => l.name === 'Divya Menon')!
  expect(divya.stage).toBe('qualified')

  // two changes in two modules: a stage move on the pipeline, a note on the lead page
  await moveOnPipelineList(page, 'Divya Menon', 'Negotiation')
  await expect.poll(async () => (await readFull(page)).leads.find((l) => l.id === divya.id)!.stage).toBe('negotiation')
  await page.goto(`/leads/${divya.id}`)
  await page.getByTestId('activity-composer').getByRole('textbox').fill('Integration check note')
  await page.getByTestId('composer-note').click()
  await expect(leadTabs(page)).toContainText('Integration check note')

  // reload: both changes and the chosen profile are still there
  await page.reload()
  await expect(page.locator('main h1')).toContainText('Divya Menon')
  await expect(leadTabs(page)).toContainText('Integration check note')
  expect((await readFull(page)).leads.find((l) => l.id === divya.id)!.stage).toBe('negotiation')
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('crm-e2e-session') ?? 'null') as { state: { role: string } } | null)
  expect(session?.state.role).toBe('admin')

  // reset asks first, then restores the seed, and the reset survives a reload
  await page.goto('/settings/demo')
  await page.getByTestId('demo-reset').click()
  await expect(page.getByRole('alertdialog').or(page.getByRole('dialog'))).toBeVisible()
  await page.getByRole('button', { name: /reset/i }).last().click()
  await expect.poll(async () => (await readFull(page)).leads.find((l) => l.id === divya.id)!.stage).toBe('qualified')
  await page.reload()
  await expect(page.locator('main h1')).toBeVisible()
  const reset = await readFull(page)
  expect(reset.leads.find((l) => l.id === divya.id)!.stage).toBe('qualified')
  expect(reset.leads.length).toBe(seed.leads.length)
  expect(reset.activities.length).toBe(seed.activities.length)
  await page.goto(`/leads/${divya.id}`)
  await expect(page.locator('main h1')).toContainText('Divya Menon')
  await expect(leadTabs(page)).not.toContainText('Integration check note')
  expect(consoleProblems).toEqual([])
})
