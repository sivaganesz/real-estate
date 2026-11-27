/**
 * QA – Admin (master prompt §22.1): Meera Iyer's day, driven through the real UI and the real profile switcher, as in
 * ROLE_RESEARCH §3 / §5.3 and DEMO_SCRIPT segment 1. Every write is checked in the persisted store, every test asserts
 * a clean console. Tests for bugs that are still open assert the CORRECT behaviour, so they fail until fixed (the bug id
 * from the QA report is in the test title).
 *
 * Run: PW_DEV_PORT=5301 pnpm exec playwright test -c playwright.dev.config.ts e2e/qa-admin.spec.ts --project=desktop
 */
import fs from 'node:fs'
import type { Page } from '@playwright/test'
import * as XLSX from 'xlsx'
import { expect, test } from './fixtures.ts'

type Lead = { id: string; name: string; ownerId: string | null; stage: string; phone: string; importJobId?: string; createdBy?: string }
type User = { id: string; name: string; role: string; status: string; availability: string; managerId?: string }
type Db = {
  users: User[]
  leads: Lead[]
  properties: { id: string; title: string; status: string; createdVia?: string }[]
  appointments: { id: string; ownerId: string; leadId?: string; start: string; status: string; propertyIds: string[] }[]
  tasks: { id: string; ownerId: string; leadId?: string; status: string }[]
  notifications: { userId: string; kind: string; readAt?: string | null }[]
  activities: { id: string; kind: string; actorId?: string; via?: string }[]
  importJobs: { id: string; kind: string; fileName: string; createdIds: string[]; draftIds: string[] }[]
  drafts: { id: string; kind: string; status: string; createdBy: string; savedAs?: { id: string } }[]
  settings: {
    assignment: { autoAssign: boolean; rules: unknown[] }
    pipeline: { stages: { key: string; label?: string }[]; lostReasons: string[] }
    templates: { id: string; purpose: string; channel: string; tone: string; body: string }[]
    sla: Record<string, number>
    matching: { weights: Record<string, number> }
  }
}

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)
const OPEN = (l: Lead) => !['booked', 'converted', 'lost'].includes(l.stage)
const SHOTS = 'notes/screens/qa/admin'

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

/** Opens the app, becomes Meera (Admin) through the switcher and lands on Today. */
async function asAdmin(page: Page) {
  await page.goto('/today')
  await expect(page.locator('main h1')).toBeVisible({ timeout: 30_000 })
  await switchTo(page, 'role-admin')
  await expect(page.locator('main h1')).toContainText('Meera')
}

const nav = (page: Page, key: string) => page.getByTestId('sidebar').getByTestId(`nav-${key}`).click()

/* ------------------------------------------------------------------------------------------------------------------ */

test('A1–A5 Admin Today: every section, the AI brief, KPIs, alerts and insights with drill-downs', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  const sidebar = page.getByTestId('sidebar')
  // nav order and the Admin group (ROLE_RESEARCH §5.3)
  for (const k of ['today', 'reports', 'leads', 'properties', 'import', 'pipeline', 'appointments', 'team', 'settings', 'activity']) await expect(sidebar.getByTestId(`nav-${k}`)).toBeVisible()
  await expect(sidebar.getByTestId('nav-leads')).toContainText('5')

  const today = page.getByTestId('today-admin')
  await expect(today).toContainText('6 new leads and 4 site visits today, 2 bookings this month and ₹31.92 Cr in the open pipeline. 3 system alerts need a look.')
  await expect(today.getByTestId('demo-ai-badge').first()).toBeVisible()

  const kpis = page.getByTestId('admin-kpis')
  for (const label of ['New leads today', 'Visits today', 'Bookings (month)', 'Pipeline value', 'Conversion', 'Inventory']) await expect(kpis).toContainText(label, { ignoreCase: true })
  await expect(page.getByTestId('kpi-inventory')).toContainText(/Available\s*12/)
  await expect(page.getByTestId('kpi-inventory')).toContainText(/On hold\s*2/)
  await expect(page.getByTestId('kpi-inventory')).toContainText(/Booked\s*3/)
  await expect(page.getByTestId('kpi-inventory')).toContainText(/Sold\s*3/)
  for (const id of ['admin-sources', 'admin-team', 'admin-alerts']) await expect(page.getByTestId(id)).toBeVisible()
  await expect(page.getByTestId('admin-team')).toContainText('Kavya Joshi')

  const alerts = page.getByTestId('admin-alerts')
  await expect(alerts).toContainText('5 leads without an owner')
  await expect(alerts).toContainText('Kavya Joshi is deactivated and still owns 1 open lead')
  await expect(alerts).toContainText('Mohd Irfan (LEAD-1023)')
  await page.screenshot({ path: `${SHOTS}/A1-admin-today.png`, fullPage: true })

  // the duplicate pair links to both leads
  await alerts.getByRole('link', { name: /Mohd Irfan/ }).click()
  await expect(page).toHaveURL(/\/leads\/LEAD-1023$/)
  await page.goBack()

  // insight → its evidence (A5)
  await page.getByRole('link', { name: /Housing\.com converts best: 50% of its 4 leads booked/ }).click()
  await expect(page).toHaveURL(/\/reports\/sources/)
  await expect(page.getByTestId('chart-source-conversion')).toBeVisible()
  await nav(page, 'today')
  await page.getByRole('link', { name: /5 deals are stalled/ }).click()
  await expect(page).toHaveURL(/\/pipeline\?stalled=1/)
  await nav(page, 'today')
  // KPI cards drill into their module
  await page.getByTestId('kpi-inventory').click()
  await expect(page).toHaveURL(/\/properties$/)
  expect(consoleProblems).toEqual([])
})

test('Admin Today one-click fixes: Redistribute Kavya and Auto-assign write real data, the view refreshes, Undo works', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  const alerts = page.getByTestId('admin-alerts')
  const before = await readDb(page)
  const kavyaOpen = before.leads.filter((l) => l.ownerId === 'u-kavya' && OPEN(l))
  expect(kavyaOpen).toHaveLength(1)

  await alerts.getByRole('button', { name: 'Redistribute' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText("Redistribute Kavya Joshi's open leads?")
  // nothing changes before confirm
  expect((await readDb(page)).leads.find((l) => l.id === kavyaOpen[0].id)?.ownerId).toBe('u-kavya')
  await dialog.getByRole('button', { name: 'Assign 1' }).click()
  await expect.poll(async () => (await readDb(page)).leads.find((l) => l.id === kavyaOpen[0].id)?.ownerId).not.toBe('u-kavya')
  const newOwner = (await readDb(page)).leads.find((l) => l.id === kavyaOpen[0].id)!.ownerId
  expect(['u-arjun', 'u-sneha', 'u-vikram']).toContain(newOwner)
  await expect(alerts).not.toContainText('Kavya Joshi is deactivated')

  // Auto-assign the unassigned queue
  const unassigned = before.leads.filter((l) => l.ownerId === null && OPEN(l)).map((l) => l.id)
  expect(unassigned).toHaveLength(5)
  await page.getByTestId('admin-auto-assign').click()
  await expect(page.getByRole('alertdialog')).toContainText('Auto-assign 5 leads?')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Assign 5' }).click()
  await expect.poll(async () => (await readDb(page)).leads.filter((l) => unassigned.includes(l.id) && l.ownerId).length).toBe(5)
  const after = await readDb(page)
  // nobody on leave or deactivated gets one
  for (const id of unassigned) expect(['u-arjun', 'u-sneha', 'u-vikram']).toContain(after.leads.find((l) => l.id === id)!.ownerId)
  await expect(alerts).not.toContainText('leads without an owner')
  await expect(page.getByTestId('sidebar').getByTestId('nav-leads')).not.toContainText('5')
  // each executive is told (assignment notifications)
  expect(after.notifications.length).toBeGreaterThan(before.notifications.length)
  await page.screenshot({ path: `${SHOTS}/A4-alerts-fixed.png`, fullPage: true })

  // Undo the auto-assign from the toast
  // the redistribute toast also offers Undo; the newest toast (auto-assign) is the front one, first in the DOM
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await readDb(page)).leads.filter((l) => unassigned.includes(l.id) && l.ownerId === null).length).toBe(5)
  await expect(alerts).toContainText('5 leads without an owner')
  expect(consoleProblems).toEqual([])
})

test('ADM-1 Admin Today hero tiles all drill down (Unassigned → unassigned leads, Rows imported → import history)', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  // Alerts and Open drafts are buttons; Unassigned and Rows imported should be too
  await page.getByText('Unassigned', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/leads\?tab=unassigned/)
  await nav(page, 'today')
  await page.getByText('Rows imported', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/import/)
  expect(consoleProblems).toEqual([])
})

test('A6–A10 admin assistant: business summary, unsold inventory, duplicates, add property on Confirm, booking refusal', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await asAdmin(page)
  await page.keyboard.press('Control+k')
  const panel = page.getByTestId('ai-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('ai-context')).toContainText('Admin')
  const ask = async (text: string) => {
    const answers = page.getByTestId('ai-answer')
    const n = await answers.count()
    await page.getByTestId('ai-input').fill(text)
    await page.getByTestId('ai-input').press('Enter')
    await expect(answers).toHaveCount(n + 1)
    return answers.last()
  }
  await page.getByTestId('ai-prompt-adm-business').click()
  await expect(page.getByTestId('ai-answer').last()).toContainText('The business at a glance')
  await expect(await ask('Which project has most unsold inventory?')).toContainText('Orchid Villas has the most unsold inventory')
  await expect(await ask('any duplicate leads?')).toContainText('Mohammed Irfan (LEAD-1004) and Mohd Irfan (LEAD-1023)')

  const count = (await readDb(page)).properties.length
  const card = (await ask('add property 2.5BHK 1200 sqft east facing in Kondapur, Hyderabad 85 L ready to move owner Ramesh 98450 12345')).getByTestId('action-proposal')
  await expect(card).toContainText('2.5 BHK Apartment in Kondapur')
  await expect(card).toContainText('₹85 L')
  expect((await readDb(page)).properties.length).toBe(count)
  await card.getByTestId('proposal-confirm').click()
  await expect(card.getByTestId('proposal-done')).toBeVisible()
  await expect.poll(async () => (await readDb(page)).properties.length).toBe(count + 1)

  await expect(await ask('mark Priya as booked')).toContainText('needs the property and the booking amount')
  // the Admin prompt (chip wording) proposes the hand-over of Kavya's lead; it runs only on Confirm
  const handOver = (await ask("Redistribute Kavya's leads")).getByTestId('action-proposal')
  await expect(page.getByTestId('ai-answer').last()).toContainText('Kavya Joshi has 1 open lead')
  await handOver.getByTestId('proposal-confirm').click()
  await expect(handOver.getByTestId('proposal-done')).toBeVisible()
  await expect.poll(async () => (await readDb(page)).leads.filter((l) => l.ownerId === 'u-kavya' && OPEN(l)).length).toBe(0)
  await page.screenshot({ path: `${SHOTS}/A6-assistant.png`, fullPage: true })
  expect(consoleProblems).toEqual([])
})

test('ADM-2 typed ROLE_RESEARCH prompt "Deactivate Kavya and redistribute her leads" offers the hand-over', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.keyboard.press('Control+k')
  await page.getByTestId('ai-input').fill('Deactivate Kavya and redistribute her leads')
  await page.getByTestId('ai-input').press('Enter')
  const answer = page.getByTestId('ai-answer').last()
  // Kavya is already deactivated: the redistribution part should be proposed (as the chip does), not dropped
  await expect(answer).toContainText('Kavya Joshi has 1 open lead')
  await expect(answer.getByTestId('action-proposal')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

/* ------------------------------------------------------------------------------------------------------------------ */

test('user management: add a user by hand, they join the pool; deactivate an executive handing leads to one person; activate again', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await asAdmin(page)
  await nav(page, 'team')
  await expect(page.locator('main h1')).toHaveText('Team')
  await page.getByTestId('add-user').click()
  const drawer = page.getByRole('dialog')
  // required fields block save
  await page.getByTestId('user-save').click()
  await expect(drawer).toBeVisible()
  await page.getByTestId('user-name').fill('Divya Menon')
  await page.getByTestId('user-email').fill('divya.menon@example.com')
  await drawer.getByRole('button', { name: 'Kannada' }).click()
  await page.getByTestId('user-save').click()
  await expect(page).toHaveURL(/\/team\/[\w-]+$/)
  await expect(page.locator('main h1').first()).toHaveText('Divya Menon')
  const divya = (await readDb(page)).users.find((u) => u.name === 'Divya Menon')!
  expect(divya).toMatchObject({ role: 'executive', managerId: 'u-rohit', status: 'active', availability: 'available' })

  // she is in the assignment simulator's pool
  await page.goto('/settings/assignment')
  await expect(page.getByTestId('simulator-result')).toContainText('Divya Menon')

  // deactivate Vikram → everything to Sneha (To one person)
  const before = await readDb(page)
  const vikLeads = before.leads.filter((l) => l.ownerId === 'u-vikram' && OPEN(l)).map((l) => l.id)
  const vikTasks = before.tasks.filter((t) => t.ownerId === 'u-vikram' && t.status === 'open').map((t) => t.id)
  expect(vikLeads.length).toBeGreaterThan(0)
  await nav(page, 'team')
  await page.getByTestId('user-actions-u-vikram').click()
  await page.getByTestId('deactivate-u-vikram').click()
  const dlg = page.getByTestId('redistribute-dialog')
  await expect(dlg).toContainText('Deactivate Vikram Singh?')
  await dlg.getByText('To one person').click()
  await dlg.getByRole('combobox').click()
  await page.getByRole('option', { name: /Sneha Reddy/ }).click()
  await expect(page.getByTestId('redistribute-preview')).toContainText('Sneha Reddy')
  await expect(page.getByTestId('redistribute-preview')).not.toContainText('Arjun Mehta')
  await page.screenshot({ path: `${SHOTS}/team-deactivate-preview.png` })
  await page.getByTestId('redistribute-confirm').click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await readDb(page)).users.find((u) => u.id === 'u-vikram')?.status).toBe('deactivated')
  const after = await readDb(page)
  for (const id of vikLeads) expect(after.leads.find((l) => l.id === id)?.ownerId).toBe('u-sneha')
  for (const id of vikTasks) {
    const t = after.tasks.find((x) => x.id === id)
    if (t?.status === 'open') expect(t.ownerId).toBe('u-sneha')
  }
  // the profile picker no longer offers a deactivated executive
  await page.getByTestId('profile-switcher').click()
  await page.getByTestId('profile-picker').getByTestId('role-executive').click()
  await expect(page.getByTestId('profile-picker').getByTestId('profile-u-vikram')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // activate again
  await page.getByTestId('user-actions-u-vikram').click()
  await page.getByTestId('activate-u-vikram').click()
  await expect.poll(async () => (await readDb(page)).users.find((u) => u.id === 'u-vikram')?.status).toBe('active')
  expect(consoleProblems).toEqual([])
})

test('ADM-3 deactivating an executive sends the receiver one batched notification, not one per lead', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.goto('/team')
  const before = await readDb(page)
  const moved = before.leads.filter((l) => l.ownerId === 'u-arjun' && OPEN(l)).length
  expect(moved).toBeGreaterThan(1)
  await page.getByTestId('user-actions-u-arjun').click()
  await page.getByTestId('deactivate-u-arjun').click()
  await page.getByTestId('redistribute-dialog').getByText('To one person').click()
  await page.getByTestId('redistribute-confirm').click()
  await expect.poll(async () => (await readDb(page)).users.find((u) => u.id === 'u-arjun')?.status).toBe('deactivated')
  const after = await readDb(page)
  const fresh = after.notifications.slice(before.notifications.length).filter((n) => n.userId === 'u-sneha')
  // DEMO_SCRIPT A16 promises "one batched notification each" for bulk hand-overs; the import does that, deactivation sends 1 per lead
  expect(fresh.length).toBe(1)
  expect(consoleProblems).toEqual([])
})

test('assignment rules + auto toggle: a rule from words; auto off leaves a new lead unassigned, auto on assigns it', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await asAdmin(page)
  await nav(page, 'settings')
  await page.getByTestId('settings-tile-assignment').click()
  await expect(page).toHaveURL(/\/settings\/assignment$/)

  // A20: describe the rule in words
  await page.getByTestId('rule-add').click()
  await page.getByTestId('rule-words').fill('Leads from Chennai who speak Tamil go to Sneha')
  await page.getByTestId('rule-read').click()
  await expect(page.getByTestId('rule-also-found')).toContainText(/Location/)
  await page.getByTestId('rule-save').click()
  await expect(page.getByTestId('rule-list')).toContainText('Language: Tamil')
  await expect.poll(async () => (await readDb(page)).settings.assignment.rules.length).toBe(3)

  // auto off
  const sw = page.getByTestId('auto-assign-switch')
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await sw.click()
  await expect.poll(async () => (await readDb(page)).settings.assignment.autoAssign).toBe(false)

  const addLead = async (name: string, mobile: string) => {
    await nav(page, 'leads')
    await page.getByTestId('leads-add').click()
    const sheet = page.getByRole('dialog')
    await sheet.getByTestId('lead-name').fill(name)
    await sheet.getByLabel('Mobile').first().fill(mobile)
    await sheet.getByTestId('lead-source').getByRole('button').first().click()
    await sheet.getByTestId('lead-save').click()
    await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
    return (await readDb(page)).leads.find((l) => l.name === name)!
  }
  const off = await addLead('Ganesh Pillai', '98765 11001')
  expect(off.ownerId).toBeNull()
  await nav(page, 'today')
  await expect(page.getByTestId('admin-alerts')).toContainText('6 leads without an owner')

  // auto on again → the next lead is assigned on save
  await page.goto('/settings/assignment')
  await page.getByTestId('auto-assign-switch').click()
  await expect.poll(async () => (await readDb(page)).settings.assignment.autoAssign).toBe(true)
  const on = await addLead('Harini Subramaniam', '98765 11002')
  expect(['u-arjun', 'u-sneha', 'u-vikram']).toContain(on.ownerId)
  expect(consoleProblems).toEqual([])
})

/* ------------------------------------------------------------------------------------------------------------------ */

test('settings: stage rename reaches the board and lead page; SLA survives reload', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await asAdmin(page)
  await nav(page, 'settings')
  await expect(page.getByTestId('settings-tiles').locator('a')).toHaveCount(8)
  await page.getByTestId('settings-tile-pipeline').click()
  await page.getByLabel('Label for Negotiation').fill('Price talks')
  await page.getByTestId('lost-reasons').locator('li', { hasText: 'Loan rejected' }).getByRole('switch').click()
  await page.getByTestId('pipeline-save').click()
  await expect.poll(async () => (await readDb(page)).settings.pipeline.lostReasons).not.toContain('loanRejected')
  expect((await readDb(page)).settings.pipeline.stages.find((s) => s.key === 'negotiation')?.label).toBe('Price talks')

  await nav(page, 'pipeline')
  await expect(page.locator('main')).toContainText('Price talks')
  await page.goto('/leads/LEAD-1004')
  await expect(page.getByTestId('stage-steps')).toContainText('Price talks')

  // SLA: first call within 30 min
  await page.goto('/settings/sla')
  const first = page.getByTestId('sla-firstResponseMins')
  await first.fill('30')
  await page.getByTestId('sla-save').click()
  await page.reload()
  await expect(page.getByTestId('sla-firstResponseMins')).toHaveValue('30')
  expect(consoleProblems).toEqual([])
})

test('ADM-7 a lost reason switched off in Settings is not offered when a lead is marked lost', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.goto('/settings/pipeline')
  await page.getByTestId('lost-reasons').locator('li', { hasText: 'Loan rejected' }).getByRole('switch').click()
  await page.getByTestId('pipeline-save').click()
  await expect.poll(async () => (await readDb(page)).settings.pipeline.lostReasons).not.toContain('loanRejected')
  await page.goto('/leads/LEAD-1004')
  await page.getByTestId('mark-lost').click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toContainText('Why was the lead lost?')
  await dlg.getByRole('combobox').nth(1).click()
  await expect(page.getByRole('option', { name: 'Budget mismatch' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Loan rejected' })).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('ADM-8 the floating AI button does not cover the settings Save button', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.goto('/settings/pipeline')
  await page.getByLabel('Label for Contacted').fill('Called')
  const save = (await page.getByTestId('pipeline-save').boundingBox())!
  const fab = (await page.getByTestId('ai-fab').boundingBox())!
  const overlap = save.x < fab.x + fab.width && fab.x < save.x + save.width && save.y < fab.y + fab.height && fab.y < save.y + save.height
  expect(overlap).toBe(false)
  expect(consoleProblems).toEqual([])
})

test('ADM-9 a notification that just arrived does not read "in N seconds" (future time)', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.waitForTimeout(1_500)
  await page.goto('/import')
  await page.getByTestId('try-leads99acresExport').click()
  await expect(page.getByTestId('to-check')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('to-check').click()
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button').last().click()
  await expect(page.getByTestId('done-step')).toBeVisible()
  await page.getByTestId('bell').click()
  const item = page.getByTestId('bell-popover').getByTestId('notification-item').filter({ hasText: 'Import finished: leads-99acres-export.csv' })
  await expect(item).toBeVisible()
  await expect(item).not.toContainText(/\bin \d+ seconds?\b/)
  expect(consoleProblems).toEqual([])
})

test('settings: an edited follow-up template is what the lead message composer drafts; matching weights save', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.goto('/settings/templates')
  const followUp = page.getByTestId('template-list').getByRole('region', { name: 'Follow-up' })
  await followUp.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByTestId('template-body').fill('Namaste {{firstName}}, {{agent}} from RealSpec here. Any update on your home search?')
  await expect(page.getByTestId('template-preview')).toContainText('Namaste Priya')
  await page.getByTestId('template-save').click()
  await expect(page.getByTestId('template-list')).toContainText('Any update on your home search?')

  await page.goto('/leads/LEAD-1004')
  const composer = page.getByTestId('message-composer')
  await composer.getByRole('button', { name: 'Follow-up', exact: true }).click()
  await expect.poll(() => composer.getByTestId('msg-text').inputValue()).toContain('Namaste Mohammed, Meera from RealSpec here.')

  await page.goto('/settings/matching')
  const budget = page.getByTestId('weight-budget').getByRole('slider')
  await budget.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('matching-save')).toBeDisabled()
  await page.getByTestId('weights-balance').click()
  await expect(page.getByTestId('weights-sum')).toContainText('1.00')
  await page.getByTestId('matching-save').click()
  await expect.poll(async () => Object.values((await readDb(page)).settings.matching.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  expect(consoleProblems).toEqual([])
})

test('ADM-4 the Offer message fills every placeholder (no "holds until ." with an empty date)', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.goto('/leads/LEAD-1002')
  const composer = page.getByTestId('message-composer')
  await composer.getByRole('button', { name: 'Offer', exact: true }).click()
  await expect.poll(() => composer.getByTestId('msg-text').inputValue()).toContain('Karthik')
  const text = await composer.getByTestId('msg-text').inputValue()
  expect(text).not.toMatch(/until \./)
  expect(text).not.toMatch(/\{\{|\}\}/)
  expect(consoleProblems).toEqual([])
})

test('settings: reset demo data asks first, then restores the seed and keeps the Admin profile', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  // make a mess first
  await page.getByTestId('admin-auto-assign').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Assign 5' }).click()
  await expect.poll(async () => (await readDb(page)).leads.filter((l) => l.ownerId === null && OPEN(l)).length).toBe(0)
  await nav(page, 'settings')
  await page.getByTestId('settings-tile-demo').click()
  await page.getByTestId('demo-reset').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Reset all demo data?')
  expect((await readDb(page)).leads.filter((l) => l.ownerId === null && OPEN(l)).length).toBe(0)
  await dialog.getByRole('button', { name: 'Reset everything' }).click()
  await expect(page.getByText('Demo data reset')).toBeVisible()
  await expect.poll(async () => (await readDb(page)).leads.filter((l) => l.ownerId === null && OPEN(l)).length).toBe(5)
  await expect(page.getByTestId('profile-switcher')).toContainText('Meera Iyer')
  expect(consoleProblems).toEqual([])
})

/* ------------------------------------------------------------------------------------------------------------------ */

test('all-data visibility: Admin sees every lead, property, appointment and person', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  const db = await readDb(page)
  await nav(page, 'leads')
  await expect(page.getByTestId('leads-page')).toBeVisible()
  await expect(page.getByRole('tab', { name: /All/ }).or(page.getByRole('button', { name: /^All/ })).first()).toContainText(String(db.leads.length))
  await page.getByRole('tab', { name: /Unassigned/ }).or(page.getByRole('button', { name: /^Unassigned/ })).first().click()
  await expect(page.locator('main')).toContainText('Aditya Rao')
  // every executive's and the deactivated user's leads are listed
  await page.getByRole('tab', { name: /All/ }).or(page.getByRole('button', { name: /^All/ })).first().click()
  for (const owner of ['Arjun Mehta', 'Sneha Reddy', 'Vikram Singh']) await expect(page.locator('main')).toContainText(owner)

  await nav(page, 'properties')
  await expect(page.locator('main')).toContainText(String(db.properties.length))
  await nav(page, 'appointments')
  await expect(page.locator('main h1')).toBeVisible()
  await nav(page, 'pipeline')
  await expect(page.locator('main')).toContainText('Karthik Subramanian')
  await expect(page.locator('main')).toContainText('Lakshmi Narayanan')
  expect(consoleProblems).toEqual([])
})

test('delete lead and property: confirm first, Undo restores (Admin)', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  const db = await readDb(page)
  const lead = db.leads.find((l) => l.ownerId === 'u-vikram' && OPEN(l))!
  await page.goto(`/leads/${lead.id}`)
  await page.getByTestId('lead-more').click()
  await page.getByRole('menuitem', { name: /Delete/ }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(`Delete ${lead.name}?`)
  expect((await readDb(page)).leads.some((l) => l.id === lead.id)).toBe(true)
  await confirm.getByRole('button', { name: 'Delete lead' }).click()
  await expect(page).toHaveURL(/\/leads$/)
  await expect.poll(async () => (await readDb(page)).leads.some((l) => l.id === lead.id)).toBe(false)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await readDb(page)).leads.some((l) => l.id === lead.id)).toBe(true)

  const prop = db.properties[0]
  await page.goto(`/properties/${prop.id}`)
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await expect(page.getByRole('alertdialog')).toContainText(`Delete ${prop.title}?`)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete property' }).click()
  await expect(page).toHaveURL(/\/properties$/)
  await expect.poll(async () => (await readDb(page)).properties.some((p) => p.id === prop.id)).toBe(false)
  await page.screenshot({ path: `${SHOTS}/delete-property-undo-toast.png` })
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await readDb(page)).properties.some((p) => p.id === prop.id)).toBe(true)
  expect(consoleProblems).toEqual([])
})

/* ------------------------------------------------------------------------------------------------------------------ */

test('import: all 5 templates download as real .xlsx and .csv files that read back with headers and example rows', async ({ page, consoleProblems }, info) => {
  await asAdmin(page)
  await nav(page, 'import')
  await expect(page.getByTestId('import-hub')).toBeVisible()
  await expect(page.getByTestId('template-cards').locator('article')).toHaveCount(5)
  const expected: Record<string, { file: string; first: string }> = {
    apartments: { file: 'apartments-template', first: 'Title' },
    villas: { file: 'villas-houses-template', first: 'Title' },
    plots: { file: 'plots-land-template', first: 'Title' },
    commercial: { file: 'commercial-template', first: 'Title' },
    leads: { file: 'leads-template', first: 'Name' },
  }
  for (const [kind, e] of Object.entries(expected)) {
    for (const type of ['xlsx', 'csv'] as const) {
      const dl = page.waitForEvent('download')
      await page.getByTestId(`download-${kind}-${type}`).click()
      const d = await dl
      expect(d.suggestedFilename()).toBe(`${e.file}.${type}`)
      const path = info.outputPath(d.suggestedFilename())
      await d.saveAs(path)
      const buf = fs.readFileSync(path)
      if (type === 'xlsx') expect(buf.subarray(0, 2).toString('latin1')).toBe('PK') // a real zip (OOXML) workbook
      const wb = XLSX.read(buf)
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 })
      expect(rows[0]?.[0]).toBe(e.first)
      expect(rows.length).toBeGreaterThanOrEqual(3) // headers + 2–3 example rows
      expect(rows.length).toBeLessThanOrEqual(4)
    }
  }
  expect(consoleProblems).toEqual([])
})

test('import: a downloaded leads template uploads back and imports its example rows', async ({ page, consoleProblems }, info) => {
  await asAdmin(page)
  await page.goto('/import')
  const dl = page.waitForEvent('download')
  await page.getByTestId('download-leads-xlsx').click()
  const path = info.outputPath('leads-template.xlsx')
  await (await dl).saveAs(path)
  await page.getByTestId('upload-leads').click()
  await page.getByTestId('sheet-wizard').locator('input[type=file]').setInputFiles(path)
  await expect(page.getByTestId('sheet-wizard')).toContainText('Default template recognised', { timeout: 20_000 })
  await page.getByTestId('to-check').click()
  await expect(page.getByTestId('row-2')).toHaveAttribute('data-status', 'ready')
  const before = await readDb(page)
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button').last().click()
  await expect(page.getByTestId('done-step')).toBeVisible()
  const after = await readDb(page)
  expect(after.leads.length).toBe(before.leads.length + 3)
  expect(consoleProblems).toEqual([])
})

test('import: the 99acres CSV uploaded from disk with a custom mapping change, inline fix, import and auto-assign (A13–A16)', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await asAdmin(page)
  await page.goto('/import/leads')
  await page.getByTestId('sheet-wizard').locator('input[type=file]').setInputFiles('public/samples/leads-99acres-export.csv')
  const wizard = page.getByTestId('sheet-wizard')
  await expect(wizard).toContainText('12 rows · 10 columns · headings on row 1', { timeout: 20_000 })
  await expect(wizard).toContainText('Custom layout')
  await expect(wizard).toContainText('Still to map: Source')
  // custom mapping: the user overrides one column (Message → skipped)
  await wizard.getByRole('combobox', { name: 'CRM field for Message' }).click()
  await page.getByRole('option', { name: /skip|don.t import|not imported/i }).first().click()
  await expect(wizard.getByRole('combobox', { name: 'CRM field for Message' })).not.toContainText('Notes')

  await page.getByTestId('to-check').click()
  await expect(page.getByTestId('row-6')).toHaveAttribute('data-status', 'duplicate')
  await expect(page.getByTestId('row-9')).toHaveAttribute('data-status', 'duplicate')
  const row10 = page.getByTestId('row-10')
  await expect(row10).toHaveAttribute('data-status', 'error')
  await page.getByTestId('fix-10').click()
  await row10.locator('[data-field="phone"] input').fill('98765 43210')
  await row10.locator('[data-field="email"] input').fill('lakshmi.p@example.com')
  await page.getByTestId('recheck-10').click()
  await expect(row10).toHaveAttribute('data-status', 'ready')
  await expect(page.getByTestId('import-confirm')).toContainText('Import 9 rows')
  const before = await readDb(page)
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Import 9 rows' }).click()
  await expect(page.getByTestId('done-step')).toContainText('9 records are in the CRM')
  await expect(page.getByTestId('done-owners')).toBeVisible()
  const after = await readDb(page)
  const job = after.importJobs.find((j) => !before.importJobs.some((b) => b.id === j.id))!
  const created = after.leads.filter((l) => l.importJobId === job.id)
  expect(created).toHaveLength(9)
  expect(created.every((l) => l.ownerId)).toBe(true)
  await page.screenshot({ path: `${SHOTS}/A16-import-done.png`, fullPage: true })
  // the job is in history and the Today import activity
  await page.goto('/import/history')
  await expect(page.getByTestId('import-history')).toContainText('leads-99acres-export.csv')
  await nav(page, 'today')
  await expect(page.locator('main')).toContainText('leads-99acres-export.csv')
  expect(consoleProblems).toEqual([])
})

test('import: the messy builder .xlsx uploaded from disk (custom template) creates properties and drafts', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await asAdmin(page)
  await page.goto('/import/apartments')
  await page.getByTestId('sheet-wizard').locator('input[type=file]').setInputFiles('public/samples/builder-price-list-custom.xlsx')
  const wizard = page.getByTestId('sheet-wizard')
  await expect(wizard).toContainText('"Instructions" tab ignored', { timeout: 20_000 })
  await expect(wizard).toContainText('Super built-up area')
  await page.getByTestId('to-check').click()
  await expect(page.getByTestId('check-step')).toBeVisible()
  const before = await readDb(page)
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button').last().click()
  await expect(page.getByTestId('done-step')).toBeVisible()
  const after = await readDb(page)
  const job = after.importJobs.find((j) => !before.importJobs.some((b) => b.id === j.id))!
  expect(job.createdIds.length).toBeGreaterThanOrEqual(6)
  expect(after.properties.length).toBe(before.properties.length + job.createdIds.length)
  expect(consoleProblems).toEqual([])
})

test('import: brochure PDF, visiting card PNG and handwritten JPG uploaded from disk are read and kept as drafts', async ({ page, consoleProblems }) => {
  test.setTimeout(240_000)
  await asAdmin(page)
  const cases = [
    { file: 'apartment-brochure.pdf', kind: 'Property', drafts: 2, expect: 'Prestige Lakeside' },
    { file: 'visiting-card.png', kind: 'Lead', drafts: 1, expect: 'Ramesh' },
    { file: 'handwritten-requirement.jpg', kind: 'Lead', drafts: 1, expect: '' },
  ]
  for (const c of cases) {
    await page.goto('/import/document')
    await expect(page.getByRole('heading', { name: 'Choose a document' })).toBeVisible()
    await page.getByTestId('document-flow').locator('input[type=file]').setInputFiles(`public/samples/${c.file}`)
    await expect(page.getByTestId('doc-save-draft')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId('document-flow')).toContainText(`Looks like a ${c.kind}`)
    if (c.expect) await expect(page.getByTestId('doc-text')).toHaveValue(new RegExp(c.expect))
    const before = await readDb(page)
    await page.getByTestId('doc-save-draft').click()
    await expect(page.getByTestId('doc-done')).toBeVisible()
    const after = await readDb(page)
    expect(after.drafts.filter((d) => d.status === 'open').length).toBe(before.drafts.filter((d) => d.status === 'open').length + c.drafts)
  }
  // Drafts list → finish the visiting-card lead (needs a source)
  await page.goto('/import/drafts')
  await expect(page.getByTestId('drafts-page')).toBeVisible()
  const db = await readDb(page)
  const card = db.drafts.filter((d) => d.kind === 'lead' && d.status === 'open').at(-2)!
  await page.getByTestId(`draft-open-${card.id}`).click()
  await expect(page.getByTestId('draft-page')).toBeVisible()
  await page.getByTestId('draft-page').getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Walk-in' }).click()
  await page.getByTestId('draft-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-/)
  expect((await readDb(page)).drafts.find((d) => d.id === card.id)?.status).toBe('saved')
  expect(consoleProblems).toEqual([])
})

/* ------------------------------------------------------------------------------------------------------------------ */

test('reports scope All: Everyone, numbers cover the whole business, drill-down and CSV export (A23)', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await nav(page, 'reports')
  await expect(page.locator('main h1')).toHaveText('Reports')
  await expect(page.getByTestId('report-scope')).toContainText('Everyone')
  const db = await readDb(page)
  await expect(page.getByTestId('report-kpis')).toContainText(String(db.leads.length))
  await page.getByTestId('summary-line').first().click()
  await expect(page.getByTestId('drill-drawer')).toBeVisible()
  expect(await page.getByTestId('drill-row').count()).toBe(db.leads.length)
  await page.keyboard.press('Escape')
  // Team tab lists every executive including the deactivated one's history
  await page.getByRole('navigation', { name: 'Report sections' }).getByRole('button', { name: /^team$/i }).click()
  for (const n of ['Arjun Mehta', 'Sneha Reddy', 'Vikram Singh']) await expect(page.getByTestId('table-team')).toContainText(n)
  const dl = page.waitForEvent('download')
  await page.getByTestId('report-export').click()
  expect((await dl).suggestedFilename()).toMatch(/\.csv$/)
  expect(consoleProblems).toEqual([])
})

test('activity log and notifications: admin changes are logged with who and how; the bell marks all read', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  // an admin change to find in the log
  await page.getByTestId('admin-auto-assign').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Assign 5' }).click()
  await nav(page, 'activity')
  const log = page.getByTestId('activity-log')
  await expect(log).toBeVisible()
  await expect(log).toContainText('Meera Iyer')
  await page.getByTestId('activity-ask').fill('changes by Arjun this week')
  await page.getByTestId('activity-ask-go').click()
  await expect(page.getByRole('button', { name: /Person: 1/ })).toContainText('Arjun Mehta')
  await expect(log).not.toContainText('Sneha Reddy')

  await page.getByTestId('bell').click()
  await expect(page.getByTestId('bell-popover')).toBeVisible()
  await page.getByTestId('bell-mark-all').click()
  await expect.poll(async () => (await readDb(page)).notifications.filter((n) => n.userId === 'u-admin' && !n.readAt).length).toBe(0)
  await page.getByTestId('bell-view-all').click()
  await expect(page).toHaveURL(/\/notifications$/)
  await expect(page.getByTestId('notification-item').first()).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('ADM-5 changing an executive with open leads to Sales Manager hands their leads over (no orphaned leads)', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.goto('/team/u-sneha')
  await expect(page.getByTestId('member-header')).toBeVisible()
  const open = (await readDb(page)).leads.filter((l) => l.ownerId === 'u-sneha' && OPEN(l)).length
  expect(open).toBeGreaterThan(0)
  await page.getByTestId('user-actions-u-sneha').click()
  await page.getByRole('menuitem', { name: /Edit/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sales Manager' }).click()
  await page.getByTestId('user-save').click()
  // a hand-over step (like deactivation) must run, or the change must be blocked while she still owns open leads
  const handover = page.getByTestId('redistribute-dialog')
  if (await handover.isVisible().catch(() => false)) await page.getByTestId('redistribute-confirm').click()
  await expect.poll(async () => {
    const db = await readDb(page)
    const sneha = db.users.find((u) => u.id === 'u-sneha')!
    const stillOwned = db.leads.filter((l) => l.ownerId === 'u-sneha' && OPEN(l)).length
    return sneha.role === 'executive' || stillOwned === 0
  }).toBe(true)
  // the Sales Executive picker must not offer a user who is no longer an executive
  const db = await readDb(page)
  if (db.users.find((u) => u.id === 'u-sneha')?.role === 'manager') {
    await page.getByTestId('profile-switcher').click()
    await page.getByTestId('profile-picker').getByTestId('role-executive').click()
    await expect(page.getByTestId('profile-picker').getByTestId('profile-u-sneha')).toHaveCount(0)
  }
  expect(consoleProblems).toEqual([])
})

test('ADM-6 importing a row with an empty Message does not add a blank "[date]" note', async ({ page, consoleProblems }) => {
  await asAdmin(page)
  await page.goto('/import')
  await page.getByTestId('try-leads99acresExport').click()
  await expect(page.getByTestId('to-check')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('to-check').click()
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button').last().click()
  await expect(page.getByTestId('done-step')).toBeVisible()
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null').state.db as { leads: Lead[]; activities: { kind: string; text?: string; refs: { id: string }[] }[] })
  const vikram = db.leads.find((l) => l.name === 'Vikram Singh' && l.importJobId)! // the sample row with an empty Message cell
  const notes = db.activities.filter((a) => a.kind === 'note' && a.refs.some((r) => r.id === vikram.id))
  for (const n of notes) expect(n.text ?? '').not.toMatch(/^\[\d{4}-\d{2}-\d{2}\]\s*$/)
  expect(consoleProblems).toEqual([])
})

/* ------------------------------------------------------------------------------------------------------------------ */
/* QA round 2: one main journey for the Admin, in the order of the owner's brief, through the real UI. */

test('R2 Admin main journey: Today fixes, add user, deactivate with redistribution, auto-assign, stage label, import, reports, activity, reset; ADM-5/7 and VIS-1 re-checks', async ({ page, consoleProblems }) => {
  test.setTimeout(240_000)
  await asAdmin(page)

  // 1 Today: KPIs, insights, alerts with a one-click fix
  const today = page.getByTestId('today-admin')
  await expect(page.getByTestId('admin-kpis')).toBeVisible()
  await expect(page.getByTestId('kpi-inventory')).toBeVisible()
  await expect(today.getByRole('link', { name: /Housing\.com converts best/ })).toBeVisible()
  const alerts = page.getByTestId('admin-alerts')
  await expect(alerts).toContainText('Kavya Joshi is deactivated and still owns 1 open lead')
  await alerts.getByRole('button', { name: 'Redistribute' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Assign 1' }).click()
  await expect(alerts).not.toContainText('Kavya Joshi is deactivated')

  // 2 add a user
  await nav(page, 'team')
  await page.getByTestId('add-user').click()
  await page.getByTestId('user-name').fill('Divya Menon')
  await page.getByTestId('user-email').fill('divya.menon@example.com')
  await page.getByTestId('user-save').click()
  await expect(page.locator('main h1').first()).toHaveText('Divya Menon')
  expect((await readDb(page)).users.find((u) => u.name === 'Divya Menon')).toMatchObject({ role: 'executive', status: 'active' })

  // 3 deactivate an executive with redistribution (auto)
  await nav(page, 'team')
  const vikLeads = (await readDb(page)).leads.filter((l) => l.ownerId === 'u-vikram' && OPEN(l)).map((l) => l.id)
  await page.getByTestId('user-actions-u-vikram').click()
  await page.getByTestId('deactivate-u-vikram').click()
  const dlg = page.getByTestId('redistribute-dialog')
  await expect(dlg).toContainText('Deactivate Vikram Singh?')
  await expect(page.getByTestId('redistribute-preview')).toBeVisible()
  await page.getByTestId('redistribute-confirm').click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await readDb(page)).users.find((u) => u.id === 'u-vikram')?.status).toBe('deactivated')
  const afterDeact = await readDb(page)
  for (const id of vikLeads) expect(afterDeact.leads.find((l) => l.id === id)?.ownerId).not.toBe('u-vikram')
  expect(afterDeact.leads.filter((l) => vikLeads.includes(l.id) && l.ownerId).length).toBe(vikLeads.length)

  // 4 toggle auto-assign off and on
  await page.goto('/settings/assignment')
  const sw = page.getByTestId('auto-assign-switch')
  const was = (await readDb(page)).settings.assignment.autoAssign
  await sw.click()
  await expect.poll(async () => (await readDb(page)).settings.assignment.autoAssign).toBe(!was)
  await sw.click()
  await expect.poll(async () => (await readDb(page)).settings.assignment.autoAssign).toBe(was)

  // 5 change a pipeline stage label + switch off a lost reason (ADM-7 re-check)
  await page.goto('/settings/pipeline')
  await page.getByLabel('Label for Negotiation').fill('Price talks')
  await page.getByTestId('lost-reasons').locator('li', { hasText: 'Loan rejected' }).getByRole('switch').click()
  await page.getByTestId('pipeline-save').click()
  await expect.poll(async () => (await readDb(page)).settings.pipeline.stages.find((s) => s.key === 'negotiation')?.label).toBe('Price talks')
  await nav(page, 'pipeline')
  await expect(page.locator('main')).toContainText('Price talks')
  await page.goto('/leads/LEAD-1004')
  await page.getByTestId('mark-lost').click()
  const lost = page.getByRole('dialog')
  await lost.getByRole('combobox').nth(1).click()
  await expect(page.getByRole('option', { name: 'Budget mismatch' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Loan rejected' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // 6 download one template, import the sample leads CSV
  await page.goto('/import')
  const dl = page.waitForEvent('download')
  await page.getByTestId('download-leads-xlsx').click()
  expect((await dl).suggestedFilename()).toMatch(/\.xlsx$/)
  await page.goto('/import/leads')
  const wizard = page.getByTestId('sheet-wizard')
  await wizard.locator('input[type=file]').setInputFiles('public/samples/leads-99acres-export.csv')
  await expect(wizard).toContainText('12 rows', { timeout: 20_000 })
  await page.getByTestId('to-check').click()
  const row10 = page.getByTestId('row-10')
  await page.getByTestId('fix-10').click()
  await row10.locator('[data-field="phone"] input').fill('98765 43210')
  await row10.locator('[data-field="email"] input').fill('lakshmi.p@example.com')
  await page.getByTestId('recheck-10').click()
  await expect(row10).toHaveAttribute('data-status', 'ready')
  const beforeImp = await readDb(page)
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button', { name: /Import \d+ rows/ }).click()
  await expect(page.getByTestId('done-step')).toBeVisible()
  expect((await readDb(page)).leads.length).toBeGreaterThan(beforeImp.leads.length)

  // 7 all-team reports, activity log
  await nav(page, 'reports')
  await expect(page.getByTestId('report-scope')).toContainText('Everyone')
  await expect(page.getByTestId('report-kpis')).toBeVisible()
  await nav(page, 'activity')
  await expect(page.getByTestId('activity-log')).toContainText('Meera Iyer')

  // 8 ADM-5 re-check: role change of an executive who owns open leads
  await page.goto('/team/u-sneha')
  await page.getByTestId('user-actions-u-sneha').click()
  await page.getByRole('menuitem', { name: /Edit/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sales Manager' }).click()
  await page.getByTestId('user-save').click()
  const handover = page.getByTestId('redistribute-dialog')
  await expect(handover).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('redistribute-confirm').click()
  await expect.poll(async () => {
    const db = await readDb(page)
    return db.leads.filter((l) => l.ownerId === 'u-sneha' && OPEN(l)).length
  }).toBe(0)
  await page.getByTestId('profile-switcher').click()
  await page.getByTestId('profile-picker').getByTestId('role-executive').click()
  await expect(page.getByTestId('profile-picker').getByTestId('profile-u-sneha')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // 9 VIS-1 re-check: dark-mode highlight chip contrast (tone tokens)
  const ratio = await page.evaluate(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
    const probe = document.createElement('span')
    probe.className = 'bg-highlight-soft text-highlight-foreground dark:text-highlight'
    probe.textContent = 'x'
    document.body.appendChild(probe)
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    const rgb = (s: string) => {
      c.clearRect(0, 0, 1, 1)
      c.fillStyle = '#000'
      c.fillStyle = s
      c.fillRect(0, 0, 1, 1)
      return Array.from(c.getImageData(0, 0, 1, 1).data.slice(0, 3))
    }
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const cs = getComputedStyle(probe)
    const a = lum(rgb(cs.color))
    const b = lum(rgb(cs.backgroundColor))
    probe.remove()
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })
  expect(ratio).toBeGreaterThanOrEqual(4.5)

  // 10 Reset demo data
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await page.goto('/settings/demo')
  await page.getByTestId('demo-reset').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset everything' }).click()
  await expect(page.getByText('Demo data reset')).toBeVisible()
  await expect.poll(async () => (await readDb(page)).users.find((u) => u.id === 'u-vikram')?.status).toBe('active')
  await page.screenshot({ path: `${SHOTS}/R2-admin-journey-end.png` })
  expect(consoleProblems).toEqual([])
})
