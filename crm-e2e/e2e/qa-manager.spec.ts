/**
 * QA – Sales Manager (master prompt §5, §6, §10, §22.1; ROLE_RESEARCH §2 and §5.2; DEMO_SCRIPT segment 2).
 * Rohit Khanna's day through the real profile switcher: the Manager Today (unassigned queue, per-row assign,
 * Auto-assign all, team board, overdue by executive, team visits, stalled deals, needs attention), the assign dialog
 * (workload, availability, conversion, recommended auto), round-robin on ties over several new leads, single and bulk
 * reassignment (both executives' Today, history and notifications), auto-distribution on/off for manual, imported and
 * AI-created leads, team availability, pipeline and reports monitoring, limited settings, and the blocked actions.
 *
 * Tests for bugs that are still open assert the CORRECT behaviour, so they fail until fixed (ids MGR-n in the QA
 * report). Every test checks the console stayed clean.
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Lead = { id: string; name: string; ownerId: string | null; stage: string; source: string; createdAt: string }
type User = { id: string; name: string; role: string; status: string; availability: string; managerId?: string }
type Assignment = { leadId: string; fromUserId: string | null; toUserId: string | null; mode: string; reason: { key: string }; note?: string; by: string }
type Notification = { userId: string; kind: string; params: Record<string, unknown>; ref?: { kind: string; id: string } }
type Db = {
  leads: Lead[]; users: User[]; assignments: Assignment[]; notifications: Notification[]
  tasks: { id: string; leadId?: string; ownerId: string; status: string }[]
  settings: { assignment: { autoAssign: boolean; rrCursor: string | null } }
  importJobs: { id: string; createdBy: string; createdIds: string[] }[]
}

// the engine's open stages (domain/catalogue OPEN_STAGES): everything but converted and lost
const OPEN = ['new', 'contacted', 'qualified', 'siteVisitScheduled', 'siteVisitDone', 'negotiation', 'booked']
const TEAM = ['u-arjun', 'u-sneha', 'u-vikram']

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)
const leadByName = async (page: Page, name: string) => (await readDb(page)).leads.find((l) => l.name === name)!
const workloads = (db: Db, ids: string[]) => Object.fromEntries(ids.map((id) => [id, db.leads.filter((l) => l.ownerId === id && OPEN.includes(l.stage)).length]))
/** The pool auto-assignment may use for Rohit's team: active executives who report to him and are not on leave. */
const pool = (db: Db) => db.users.filter((u) => u.role === 'executive' && u.status === 'active' && u.availability !== 'onLeave' && u.managerId === 'u-rohit').map((u) => u.id)

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

async function asManager(page: Page) {
  await page.goto('/today')
  // the first request to a cold dev server can stall while Vite optimises dependencies: reload once
  if (!(await page.locator('main h1').isVisible({ timeout: 0 }).catch(() => false))) {
    await page.locator('main h1').waitFor({ timeout: 20_000 }).catch(() => page.reload())
  }
  await expect(page.locator('main h1')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('profile-switcher')).toBeVisible()
  await switchTo(page, 'role-manager')
  await expect(page.getByTestId('today-manager')).toBeVisible()
}

async function openToday(page: Page) {
  await page.getByTestId('sidebar').getByTestId('nav-today').click()
  await expect(page).toHaveURL(/\/today$/)
  await expect(page.locator('main h1')).toBeVisible()
}

async function openAi(page: Page) {
  if (!(await page.getByTestId('ai-panel').isVisible())) await page.keyboard.press('Control+k')
  await expect(page.getByTestId('ai-panel')).toBeVisible()
}

async function ask(page: Page, text: string): Promise<Locator> {
  const answers = page.getByTestId('ai-answer')
  const before = await answers.count()
  await page.getByTestId('ai-input').fill(text)
  await page.getByTestId('ai-input').press('Enter')
  await expect(answers).toHaveCount(before + 1)
  return answers.last()
}

async function setAutoAssign(page: Page, on: boolean) {
  await page.getByTestId('sidebar').getByTestId('nav-settings').click()
  await page.getByRole('link', { name: /Assignment rules/ }).first().click()
  await expect(page).toHaveURL(/\/settings\/assignment$/)
  const sw = page.getByTestId('auto-assign-switch')
  if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', String(on))
  await expect.poll(async () => (await readDb(page)).settings.assignment.autoAssign).toBe(on)
}

async function addLeadByHand(page: Page, name: string, mobile: string) {
  await page.getByTestId('sidebar').getByTestId('nav-leads').click()
  await expect(page.getByTestId('leads-page')).toBeVisible()
  await page.getByTestId('leads-add').click()
  const sheet = page.getByRole('dialog')
  await sheet.getByTestId('lead-name').fill(name)
  await sheet.getByLabel('Mobile').first().fill(mobile)
  await sheet.getByRole('button', { name: 'Walk-in', exact: true }).first().click()
  await sheet.getByTestId('lead-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
}

async function importSampleLeads(page: Page) {
  await page.getByTestId('sidebar').getByTestId('nav-import').click()
  await expect(page.getByTestId('import-hub')).toBeVisible()
  await page.getByTestId('try-leads99acresExport').click()
  await expect(page.getByTestId('to-check')).toBeVisible({ timeout: 20_000 })
  // earlier toasts sit over the wizard's bottom-right buttons (and pause while hovered): let them go first
  await page.mouse.move(0, 0)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 20_000 })
  await page.getByTestId('to-check').click()
  await expect(page.getByTestId('check-step')).toBeVisible()
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button').last().click()
  await expect(page.getByTestId('done-step')).toBeVisible()
}

// several journeys switch profiles and reload pages on a dev server shared with other QA runs: allow for a slow machine
test.beforeEach(() => test.setTimeout(90_000))

const shot = (page: Page, name: string) => page.screenshot({ path: `notes/screens/qa/manager/${name}.png`, fullPage: true })

/* ---------------------------------------------------------------- Today */

test('manager Today answers the morning questions without a click', async ({ page, consoleProblems }) => {
  await asManager(page)
  const today = page.getByTestId('today-manager')
  await expect(page.locator('main h1')).toContainText('Rohit')
  // the brief names the queue, overdue, visits, the on-leave executive and stalled deals; chips act on them
  await expect(today).toContainText(/5 leads are waiting for an owner/)
  await expect(today).toContainText(/overdue follow-ups/)
  await expect(today).toContainText(/stalled/)
  await expect(today.getByRole('button', { name: /Auto-assign 5 new leads/ })).toBeVisible()
  await expect(today.getByRole('button', { name: /Reassign Farhan's 2 leads/ })).toBeVisible()

  // unassigned queue: age, source, budget, an AI-suggested owner with its reason, per-row Assign, Auto-assign all
  const queue = page.getByTestId('unassigned-queue')
  await expect(queue.getByTestId('queue-row')).toHaveCount(5)
  await expect(queue.getByTestId('demo-ai-badge').first()).toBeVisible()
  for (const row of await queue.getByTestId('queue-row').all()) {
    await expect(row).toContainText(/₹/)
    await expect(row).toContainText(/Lowest workload|Location rule|Round-robin|rule/)
    await expect(row.getByTestId('assign-suggested')).toBeVisible()
  }
  await expect(queue.getByTestId('auto-assign-all')).toBeVisible()

  // team board: one row per executive with availability, load, calls, visits and overdue
  const board = page.getByTestId('team-board')
  await expect(board.getByTestId('team-row').filter({ hasText: 'Arjun Mehta' })).toContainText('Available')
  await expect(board.getByTestId('team-row').filter({ hasText: 'Vikram Singh' })).toContainText('In a visit')
  await expect(board.getByTestId('team-row').filter({ hasText: 'Farhan Qureshi' })).toContainText('On leave')
  for (const row of await board.getByTestId('team-row').all()) await expect(row).toContainText(/open[\s\S]*calls?[\s\S]*visits?[\s\S]*overdue/)

  // overdue follow-ups by executive expand to the tasks
  const overdue = page.getByTestId('overdue-by-exec')
  await expect(overdue).toContainText('Arjun')
  await overdue.getByRole('button', { name: /Arjun/ }).click()
  await expect(overdue.getByRole('link').filter({ hasText: /Karthik|Mohammed|Ananya|Neha/ }).first()).toBeVisible()

  // team visits today, coloured by executive, with the executive's name on each
  const visits = page.locator('#today-team-visits')
  await expect(visits).toContainText('Team visits today')
  await expect(visits).toContainText('Arjun Mehta')
  await expect(visits).toContainText('Sneha Reddy')
  await expect(visits).toContainText('Vikram Singh')

  // deals to push: stalled and negotiation tabs, linking to the pipeline
  const deals = page.getByTestId('deals-card')
  await expect(deals.getByTestId('deal-row').first()).toBeVisible()
  await expect(deals).toContainText(/days in stage/)
  await deals.getByRole('radio', { name: /Negotiation/ }).or(deals.getByRole('tab', { name: /Negotiation/ })).or(deals.getByRole('button', { name: /Negotiation/ })).first().click()
  await expect(deals.getByTestId('deal-row').filter({ hasText: 'Negotiation' }).first()).toBeVisible()

  // needs attention: the on-leave and deactivated proposals, escalations and high-value leads
  const attention = page.getByTestId('attention-card')
  await expect(attention.getByTestId('leave-proposal').filter({ hasText: 'Farhan Qureshi' })).toBeVisible()
  await expect(attention).toContainText(/not called yet/)
  await expect(attention).toContainText(/budget, untouched/)

  // team target gauges and funnel
  await expect(page.getByTestId('team-targets')).toContainText('Bookings')
  await shot(page, 'mgr-today-desktop')
  expect(consoleProblems).toEqual([])
})

test('per-row Assign: the lead leaves the queue and reaches the executive (Today, bell, history)', async ({ page, consoleProblems }) => {
  await asManager(page)
  const row = page.getByTestId('queue-row').filter({ hasText: 'Aditya Rao' })
  const db0 = await readDb(page)
  const suggestedFirst = (await row.innerText()).match(/\b(Arjun|Sneha|Vikram)\b/)![1]
  const to = db0.users.find((u) => u.name.startsWith(suggestedFirst))!
  await row.getByTestId('assign-suggested').click()
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: `Aditya Rao assigned to ${to.name}` })).toBeVisible()
  await expect(page.getByTestId('queue-row').filter({ hasText: 'Aditya Rao' })).toHaveCount(0)
  await expect(page.getByTestId('queue-row')).toHaveCount(4)
  await expect(page.getByTestId('nav-leads')).toContainText('4')

  const aditya = await leadByName(page, 'Aditya Rao')
  expect(aditya.ownerId).toBe(to.id)
  const db = await readDb(page)
  const asg = db.assignments.filter((a) => a.leadId === aditya.id)
  expect(asg).toHaveLength(1)
  expect(asg[0].by).toBe('u-rohit')
  expect(db.notifications.some((n) => n.userId === to.id && n.kind === 'assignment' && n.ref?.id === aditya.id)).toBe(true)
  // the first-call task moved to the new owner
  expect(db.tasks.some((t) => t.leadId === aditya.id && t.ownerId === to.id && t.status === 'open')).toBe(true)

  // the lead page shows the history
  await page.goto(`/leads/${aditya.id}`)
  await page.getByText(/Assignment history/).first().click()
  await expect(page.getByTestId('assignment-history')).toContainText(to.name)
  await expect(page.getByTestId('assignment-history')).toContainText('Rohit Khanna')

  // the executive sees it on Today and in the bell
  await switchTo(page, `profile-${to.id}`)
  await openToday(page)
  await expect(page.locator('main')).toContainText('Aditya Rao')
  await page.getByTestId('sidebar').getByRole('link', { name: /Notifications/ }).or(page.getByTestId('topbar').getByRole('button', { name: /Notifications/ })).first().click()
  await expect(page.getByText('New lead assigned: Aditya Rao').first()).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('MGR-1: a row\'s suggested owner is right for that row on its own (assigning out of order)', async ({ page, consoleProblems }) => {
  await asManager(page)
  // Mohd Irfan is the 3rd row; its suggestion assumes rows 1 and 2 were assigned first
  const row = page.getByTestId('queue-row').filter({ hasText: 'Mohd Irfan' })
  const label = await row.innerText()
  const before = await readDb(page)
  const load = workloads(before, pool(before))
  await row.getByTestId('assign-suggested').click()
  await expect(page.getByTestId('queue-row').filter({ hasText: 'Mohd Irfan' })).toHaveCount(0)
  const owner = (await leadByName(page, 'Mohd Irfan')).ownerId!
  await shot(page, 'MGR-1-row-suggestion-out-of-order')
  if (/Lowest workload/.test(label)) {
    // "Lowest workload" must be true at the moment the manager clicks
    expect(load[owner], `suggested ${owner} with ${load[owner]} open leads while workloads were ${JSON.stringify(load)}`).toBe(Math.min(...Object.values(load)))
  }
  expect(consoleProblems).toEqual([])
})

test('MGR-2: accepting the AI-suggested owner records why (not "Assigned by hand")', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('queue-row').filter({ hasText: 'Aditya Rao' }).getByTestId('assign-suggested').click()
  await expect(page.getByTestId('queue-row').filter({ hasText: 'Aditya Rao' })).toHaveCount(0)
  const aditya = await leadByName(page, 'Aditya Rao')
  const asg = (await readDb(page)).assignments.find((a) => a.leadId === aditya.id)!
  // the row said "Lowest workload" with a DEMO AI badge; the history should keep that reason
  expect(asg.reason.key).not.toBe('manual')
  expect(consoleProblems).toEqual([])
})

test('MGR-3: a single assign from the queue offers Undo like every other write', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('queue-row').filter({ hasText: 'Rajesh Nair' }).getByTestId('assign-suggested').click()
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Rajesh Nair assigned to' })
  await expect(toast).toBeVisible()
  await shot(page, 'MGR-3-single-assign-no-undo')
  await expect(toast.getByRole('button', { name: /Undo/ })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('Auto-assign all: preview with reasons, on-leave skipped, confirm, Undo restores the queue', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('auto-assign-all').click()
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog')).first()
  await expect(dialog).toContainText('Auto-assign 5 leads?')
  await expect(dialog).toContainText('People on leave are skipped')
  const preview = dialog.getByTestId('auto-preview')
  await expect(preview.locator('li')).toHaveCount(5)
  await expect(preview).not.toContainText('Farhan')
  await expect(preview).toContainText('Round-robin (tied workload)')
  await expect(dialog.getByTestId('demo-ai-badge').first()).toBeVisible()
  const previewText = await preview.innerText()
  await dialog.getByRole('button', { name: 'Assign 5' }).click()

  const toast = page.locator('[data-sonner-toast]').filter({ hasText: '5 leads auto-assigned' })
  await expect(toast).toBeVisible()
  await expect(page.getByTestId('unassigned-queue')).toContainText('The queue is clear')
  await expect(page.getByTestId('unassigned-queue')).toContainText('5 auto-assigned today')
  await expect(page.getByTestId('nav-leads')).not.toContainText('5')

  const db = await readDb(page)
  for (const name of ['Aditya Rao', 'Rajesh Nair', 'Mohd Irfan', 'Tanvi Shah', 'Sunita Patil']) {
    const l = db.leads.find((x) => x.name === name)!
    expect(TEAM).toContain(l.ownerId)
    const a = db.assignments.find((x) => x.leadId === l.id)!
    expect(a.mode).toBe('auto')
    // the preview told the truth
    const first = db.users.find((u) => u.id === l.ownerId)!.name.split(' ')[0]
    expect(previewText).toMatch(new RegExp(`${name}\\s*→\\s*\\S*\\s*${first}`))
  }
  // a tie was broken round-robin and each executive was notified
  expect(db.assignments.some((a) => a.reason.key === 'roundRobinTie')).toBe(true)

  await toast.getByRole('button', { name: /Undo/ }).click()
  await expect(page.getByTestId('queue-row')).toHaveCount(5)
  expect((await leadByName(page, 'Tanvi Shah')).ownerId).toBeNull()
  expect(consoleProblems).toEqual([])
})

test('round-robin: new leads on a workload tie rotate between executives', async ({ page, consoleProblems }) => {
  test.setTimeout(120_000)
  await asManager(page)
  const owners: string[] = []
  const reasons: string[] = []
  for (let i = 0; i < 6; i++) {
    const db = await readDb(page)
    const ids = pool(db)
    const load = workloads(db, ids)
    const low = Math.min(...ids.map((id) => load[id]))
    const tied = ids.filter((id) => load[id] === low).sort()
    const cursor = db.settings.assignment.rrCursor
    const expected = tied.length > 1 ? (tied.find((id) => cursor && id > cursor) ?? tied[0]) : tied[0]

    const name = `QA Robin ${i + 1}`
    await addLeadByHand(page, name, `90000111${String(10 + i)}`)
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: `${name} added` })).toContainText(/Assigned to/)
    const lead = await leadByName(page, name)
    const asg = (await readDb(page)).assignments.find((a) => a.leadId === lead.id)!
    owners.push(lead.ownerId!)
    reasons.push(asg.reason.key)
    expect(asg.mode).toBe('auto')
    expect(lead.ownerId, `lead ${i + 1}: workloads ${JSON.stringify(load)}, cursor ${cursor}`).toBe(expected)
    expect(asg.reason.key).toBe(tied.length > 1 ? 'roundRobinTie' : 'lowestWorkload')
  }
  // the rotation is visible: several ties, and the tie-breaks went to different people
  const tieOwners = owners.filter((_, i) => reasons[i] === 'roundRobinTie')
  expect(tieOwners.length).toBeGreaterThanOrEqual(2)
  expect(new Set(tieOwners).size).toBeGreaterThanOrEqual(2)
  expect(new Set(owners).size).toBe(3)
  expect(consoleProblems).toEqual([])
})

/* ---------------------------------------------------------------- assign dialog and reassignment */

test('assign dialog shows workload, follow-ups, today, conversion and availability; single reassign updates both executives', async ({ page, consoleProblems }) => {
  await asManager(page)
  const harish = await leadByName(page, 'Harish Reddy')
  expect(harish.ownerId).toBe('u-sneha')
  await page.goto(`/leads/${harish.id}`)
  await page.getByRole('button', { name: /^Reassign$/ }).first().click()
  const dialog = page.getByTestId('assign-dialog')
  await expect(dialog).toContainText('Assign Harish Reddy')
  // recommended (auto) with its reason; the current owner is marked
  await expect(dialog.getByTestId('assign-auto')).toContainText('Recommended (auto)')
  await expect(dialog.getByTestId('assign-recommendation')).toContainText(/Recommended: \S+/)
  await expect(dialog.getByTestId('assign-person-u-sneha')).toContainText('Owner now')
  for (const id of TEAM) {
    const p = dialog.getByTestId(`assign-person-${id}`)
    await expect(p).toContainText(/open leads?/)
    await expect(p).toContainText(/converted|No closed leads/)
    await expect(p).toContainText(/follow-ups?/)
    await expect(p).toContainText(/today/)
    await expect(p).toContainText(/Available|In a visit/)
  }
  // on leave: shown with the return date, not pickable; deactivated: not offered
  const farhan = dialog.getByTestId('assign-person-u-farhan')
  await expect(farhan).toContainText(/On leave until/)
  await expect(farhan.getByRole('radio')).toBeDisabled()
  await expect(dialog.getByTestId('assign-person-u-kavya')).toHaveCount(0)
  await shot(page, 'mgr-assign-dialog')

  await dialog.getByTestId('assign-person-u-arjun').click()
  await expect(dialog.getByTestId('assign-confirm')).toHaveText('Assign to Arjun Mehta')
  await dialog.getByRole('textbox').fill('Client wants a Hindi speaker')
  await dialog.getByTestId('assign-confirm').click()
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Assigned to Arjun Mehta' })).toBeVisible()

  const db = await readDb(page)
  expect(db.leads.find((l) => l.id === harish.id)!.ownerId).toBe('u-arjun')
  const last = db.assignments.filter((a) => a.leadId === harish.id).at(-1)!
  expect(last).toMatchObject({ fromUserId: 'u-sneha', toUserId: 'u-arjun', mode: 'manual', by: 'u-rohit', note: 'Client wants a Hindi speaker' })
  expect(db.notifications.some((n) => n.userId === 'u-arjun' && n.kind === 'reassignment' && n.ref?.id === harish.id)).toBe(true)
  expect(db.notifications.some((n) => n.userId === 'u-sneha' && n.kind === 'reassignment' && n.ref?.id === harish.id)).toBe(true)
  expect(db.tasks.filter((t) => t.leadId === harish.id && t.status === 'open').every((t) => t.ownerId === 'u-arjun')).toBe(true)

  // history on the lead page: Sneha → Arjun, by hand, by Rohit, with the note
  await page.getByText(/Assignment history/).first().click()
  const history = page.getByTestId('assignment-history')
  await expect(history).toContainText('Assigned by hand')
  await expect(history).toContainText('Rohit Khanna')
  await expect(history).toContainText('Client wants a Hindi speaker')

  // Arjun: Harish is on Today with the moved follow-up; the bell says so
  await switchTo(page, 'profile-u-arjun')
  await openToday(page)
  await expect(page.locator('main')).toContainText('Harish Reddy')
  await page.goto('/notifications')
  await expect(page.locator('main')).toContainText('Harish Reddy was reassigned from Sneha Reddy')

  // Sneha: Harish is gone from Today and the lead is no longer hers; the bell explains
  await switchTo(page, 'profile-u-sneha')
  await openToday(page)
  // (the 12:00 meeting she already held stays hers to record; the open follow-ups moved)
  await expect(page.locator('main')).not.toContainText('Call Harish about the revised Tellapur offer')
  await page.goto('/notifications')
  await expect(page.locator('main')).toContainText('Harish Reddy moved from you to Arjun Mehta')
  expect(consoleProblems).toEqual([])
})

test('bulk reassign from the Leads table: both executives notified, one Undo restores', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await asManager(page)
  await page.getByTestId('sidebar').getByTestId('nav-leads').click()
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select Harish Reddy' }).click()
  await page.getByRole('checkbox', { name: 'Select Deepak Verma' }).click()
  await page.getByTestId('bulk-assign').click()
  const dialog = page.getByTestId('assign-dialog')
  await expect(dialog).toContainText('Assign 2 leads')
  await expect(dialog.getByTestId('assign-preview')).toContainText('Who gets what')
  await dialog.getByTestId('assign-person-u-vikram').click()
  await dialog.getByTestId('assign-confirm').click()
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: '2 leads assigned to Vikram Singh' })
  await expect(toast).toBeVisible()

  const db = await readDb(page)
  const harish = db.leads.find((l) => l.name === 'Harish Reddy')!
  const deepak = db.leads.find((l) => l.name === 'Deepak Verma')!
  expect(harish.ownerId).toBe('u-vikram')
  expect(deepak.ownerId).toBe('u-vikram')
  const notified = (leadId: string) => db.notifications.filter((n) => n.kind === 'reassignment' && n.ref?.id === leadId).map((n) => n.userId).sort()
  expect(notified(harish.id)).toEqual(['u-sneha', 'u-vikram'])
  expect(notified(deepak.id)).toEqual(['u-arjun', 'u-vikram'])

  // one Undo puts both back
  await toast.getByRole('button', { name: /Undo/ }).click()
  await expect.poll(async () => (await leadByName(page, 'Harish Reddy')).ownerId).toBe('u-sneha')
  expect((await leadByName(page, 'Deepak Verma')).ownerId).toBe('u-arjun')

  // again, then each executive's Today follows the leads
  await page.reload()
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select Harish Reddy' }).click()
  await page.getByRole('checkbox', { name: 'Select Deepak Verma' }).click()
  await page.getByTestId('bulk-assign').click()
  await page.getByTestId('assign-dialog').getByTestId('assign-person-u-vikram').click()
  await page.getByTestId('assign-dialog').getByTestId('assign-confirm').click()
  await expect.poll(async () => (await leadByName(page, 'Deepak Verma')).ownerId).toBe('u-vikram')
  await switchTo(page, 'profile-u-vikram')
  await openToday(page)
  await expect(page.locator('main')).toContainText('Deepak Verma')
  await switchTo(page, 'profile-u-arjun')
  await openToday(page)
  await expect(page.locator('main').getByText('Deepak Verma')).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('MGR-4: the bulk selection clears after a bulk assign', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('sidebar').getByTestId('nav-leads').click()
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select Harish Reddy' }).click()
  await page.getByRole('checkbox', { name: 'Select Deepak Verma' }).click()
  await page.getByTestId('bulk-assign').click()
  await page.getByTestId('assign-dialog').getByTestId('assign-person-u-vikram').click()
  await page.getByTestId('assign-dialog').getByTestId('assign-confirm').click()
  await expect(page.getByTestId('assign-dialog')).toBeHidden()
  await shot(page, 'MGR-4-selection-kept-after-bulk-assign')
  // bulk stage change clears the selection; bulk assign should too
  await expect(page.getByTestId('bulk-assign')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Select Harish Reddy' })).not.toBeChecked()
  expect(consoleProblems).toEqual([])
})

test('Needs attention: reassigning an on-leave executive\'s leads with auto-assign, with Undo', async ({ page, consoleProblems }) => {
  await asManager(page)
  const proposal = page.getByTestId('leave-proposal').filter({ hasText: 'Farhan Qureshi' })
  await proposal.getByRole('button', { name: 'Reassign with auto-assign' }).click()
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: '2 leads of Farhan Qureshi reassigned' })
  await expect(toast).toBeVisible()
  let db = await readDb(page)
  expect(db.leads.filter((l) => l.ownerId === 'u-farhan' && OPEN.includes(l.stage))).toHaveLength(0)
  await expect(page.getByTestId('leave-proposal').filter({ hasText: 'Farhan Qureshi' })).toHaveCount(0)
  await toast.getByRole('button', { name: /Undo/ }).click()
  db = await readDb(page)
  expect(db.leads.filter((l) => l.ownerId === 'u-farhan' && OPEN.includes(l.stage))).toHaveLength(2)
  expect(consoleProblems).toEqual([])
})

test('MGR-9: Needs attention offers "Assign", not "Reassign", for a lead still in the queue', async ({ page, consoleProblems }) => {
  await asManager(page)
  const attention = page.getByTestId('attention-card')
  const row = attention.locator('li').filter({ hasText: 'Still in the unassigned queue' }).first()
  await expect(row).toBeVisible()
  await expect(row.getByRole('button')).toHaveText('Assign')
  expect(consoleProblems).toEqual([])
})

test('team availability: the manager puts Vikram on leave; auto-assign skips him and the dialog greys him out', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('sidebar').getByTestId('nav-team').click()
  await expect(page).toHaveURL(/\/team$/)
  // managers do not create users
  await expect(page.getByRole('button', { name: /Add user/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Change availability for Vikram Singh' }).click()
  await page.getByRole('menuitem', { name: 'On leave' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Mark Vikram Singh on leave')
  await dialog.getByRole('button', { name: 'Mark on leave' }).click()
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Vikram Singh is on leave' })).toBeVisible()
  expect((await readDb(page)).users.find((u) => u.id === 'u-vikram')!.availability).toBe('onLeave')

  await openToday(page)
  await expect(page.getByTestId('team-board').getByTestId('team-row').filter({ hasText: 'Vikram Singh' })).toContainText('On leave')
  await page.getByTestId('auto-assign-all').click()
  await expect(page.getByTestId('auto-preview')).not.toContainText('Vikram')
  await page.keyboard.press('Escape')

  await page.goto('/leads/LEAD-1001')
  await page.getByRole('button', { name: /^Reassign$/ }).first().click()
  await expect(page.getByTestId('assign-dialog').getByTestId('assign-person-u-vikram').getByRole('radio')).toBeDisabled()
  expect(consoleProblems).toEqual([])
})

/* ---------------------------------------------------------------- auto-distribution on / off */

test('auto-distribution off: manual, AI-created and imported leads wait in the queue; on again: auto-assigned', async ({ page, consoleProblems }) => {
  test.setTimeout(120_000)
  await asManager(page)
  await setAutoAssign(page, false)
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Auto-assignment is off' })).toBeVisible()

  // a lead typed by hand
  await page.getByTestId('sidebar').getByTestId('nav-leads').click()
  await page.getByTestId('leads-add').click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByTestId('lead-owner')).toContainText('Leave unassigned')
  await page.keyboard.press('Escape')
  await addLeadByHand(page, 'QA Off Manual', '9000022001')
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'QA Off Manual added' })).toContainText('Waiting in the unassigned queue')
  expect((await leadByName(page, 'QA Off Manual')).ownerId).toBeNull()

  // a lead the assistant created
  await openAi(page)
  const card = (await ask(page, 'add lead Kiran Rao 98450 77711 wants 2BHK in Hebbal budget 70L from website')).getByTestId('action-proposal')
  await card.getByTestId('proposal-confirm').click()
  await expect(card.getByTestId('proposal-done')).toBeVisible()
  expect((await leadByName(page, 'Kiran Rao')).ownerId).toBeNull()
  await page.keyboard.press('Escape')

  // an imported file
  await importSampleLeads(page)
  let db = await readDb(page)
  const job = db.importJobs.at(-1)!
  expect(job.createdIds.length).toBe(8)
  expect(db.leads.filter((l) => job.createdIds.includes(l.id)).every((l) => l.ownerId === null)).toBe(true)

  // all of them land in the manager's queue
  await openToday(page)
  await expect(page.getByTestId('queue-row')).toHaveCount(5 + 1 + 1 + 8)
  await shot(page, 'mgr-auto-off-queue')

  // back on: the next AI-created and hand-typed leads are auto-assigned within the team
  await setAutoAssign(page, true)
  await openAi(page)
  const card2 = (await ask(page, 'add lead Meenal Shah 98450 77722 wants 3BHK in Whitefield budget 1.1 Cr from referral')).getByTestId('action-proposal')
  await card2.getByTestId('proposal-confirm').click()
  await expect(card2.getByTestId('proposal-done')).toBeVisible()
  await page.keyboard.press('Escape')
  await addLeadByHand(page, 'QA On Manual', '9000022002')
  db = await readDb(page)
  for (const name of ['Meenal Shah', 'QA On Manual']) {
    const l = db.leads.find((x) => x.name === name)!
    expect(TEAM).toContain(l.ownerId)
    expect(db.assignments.find((a) => a.leadId === l.id)!.mode).toBe('auto')
  }
  expect(consoleProblems).toEqual([])
})

test('manager lead import with auto-distribution on: rows go to the team, one batched notification each', async ({ page, consoleProblems }) => {
  await asManager(page)
  await importSampleLeads(page)
  await expect(page.getByTestId('done-owners')).toContainText(/Sneha Reddy|Arjun Mehta|Vikram Singh/)
  const db = await readDb(page)
  const job = db.importJobs.at(-1)!
  expect(job.createdBy).toBe('u-rohit')
  const owners = db.leads.filter((l) => job.createdIds.includes(l.id)).map((l) => l.ownerId)
  expect(owners.every((o) => o && TEAM.includes(o))).toBe(true)
  for (const id of new Set(owners)) {
    expect(db.notifications.filter((n) => n.userId === id && n.kind === 'assignment' && n.params.variant === 'assignmentBatch')).toHaveLength(1)
  }
  // the importer hears it finished
  expect(db.notifications.some((n) => n.userId === 'u-rohit' && n.kind === 'importFinished')).toBe(true)
  expect(consoleProblems).toEqual([])
})

test('MGR-5: with auto-distribution off the import Done step does not claim the rows were auto-assigned', async ({ page, consoleProblems }) => {
  await asManager(page)
  await setAutoAssign(page, false)
  await importSampleLeads(page)
  const owners = page.getByTestId('done-owners')
  await shot(page, 'MGR-5-import-done-auto-off')
  await expect(page.getByTestId('done-step')).not.toContainText('Each executive got one notification for the batch')
  await expect(owners).not.toContainText('Auto-assigned')
  expect(consoleProblems).toEqual([])
})

/* ---------------------------------------------------------------- requests, monitoring, reports */

test('MGR-6: an executive\'s reassignment request reaches the manager with the reason and shows on Today', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-vikram')
  await page.goto('/leads/LEAD-1012') // Pooja Agarwal, Vikram's lead
  await page.getByRole('button', { name: /^Request/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('Client prefers a Kannada speaker')
  await dialog.getByRole('button', { name: /Send/ }).click()
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Request sent to your manager' })).toBeVisible()

  await switchTo(page, 'role-manager')
  await page.goto('/notifications')
  const item = page.getByTestId('notification-item').filter({ hasText: 'Vikram Singh asks to reassign Pooja Agarwal' })
  await expect(item).toBeVisible()
  await shot(page, 'MGR-6-request-without-reason')
  // the manager needs the reason to decide
  await expect.soft(item).toContainText('Kannada')
  // and the request belongs in "Needs your attention" (ROLE_RESEARCH §5.2 reassignment suggestions)
  await openToday(page)
  await expect.soft(page.getByTestId('attention-card')).toContainText('Pooja Agarwal')
  // opening it lands on the lead where Reassign is one click
  await page.goto('/notifications')
  await item.getByRole('button').first().click()
  await expect(page).toHaveURL(/\/leads\/LEAD-1012$/)
  await expect(page.getByRole('button', { name: /^Reassign$/ }).first()).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('MGR-11: manager notifications read well and every one opens something', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.goto('/notifications')
  const main = page.locator('main')
  await expect(main).toContainText('Vivek Malhotra')
  // "1200 minutes" should read as hours like the rest of the app ("20 h 0 min")
  await expect.soft(main).not.toContainText(/for \d{3,} minutes/)
  // the "unassigned leads waiting" alert has no link: clicking it does nothing
  const waiting = page.getByTestId('notification-item').filter({ hasText: /unassigned leads are waiting/ })
  await expect(waiting).toBeVisible()
  await waiting.getByRole('button').first().click()
  await expect.soft(page).toHaveURL(/\/today|\/leads\?tab=unassigned/)
  expect(consoleProblems).toEqual([])
})

test('team pipeline monitoring: every executive\'s deals, executive filter, stalled deals with an AI plan', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('deals-card').getByRole('button', { name: /Pipeline/ }).click()
  await expect(page.getByTestId('pipeline-page')).toBeVisible()
  const db = await readDb(page)
  const cards = page.getByTestId('deal-card')
  // the board covers the team: deals from all three executives and unassigned ones
  for (const n of ['Karthik Subramanian', 'Harish Reddy', 'Rohan Deshpande', 'Tanvi Shah']) await expect(cards.filter({ hasText: n }).first()).toBeVisible()
  await page.getByRole('button', { name: /^Executive/ }).click()
  await page.getByRole('option', { name: /Sneha Reddy/ }).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/owner=u-sneha/)
  await expect(cards).toHaveCount(db.leads.filter((l) => l.ownerId === 'u-sneha').length)

  const stalled = page.getByTestId('stalled-panel')
  await expect(stalled.getByTestId('demo-ai-badge').first()).toBeVisible()
  await stalled.getByTestId('stalled-deal').filter({ hasText: 'Sanjay Gupta' }).getByRole('button', { name: 'Plan it' }).click()
  await expect(page.getByTestId('action-proposal').or(page.getByRole('dialog')).first()).toContainText(/Sanjay Gupta/)
  expect(consoleProblems).toEqual([])
})

test('team reports are scoped to Rohit\'s team, with export', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('sidebar').getByTestId('nav-reports').click()
  await expect(page.locator('main')).toContainText('Team: Rohit Khanna', { timeout: 20_000 })
  await expect(page.getByRole('button', { name: /Export CSV/ })).toBeVisible()
  await page.getByTestId('reports-page').getByRole('radio', { name: 'Team', exact: true }).or(page.getByTestId('reports-page').getByRole('button', { name: 'Team', exact: true })).first().click()
  await expect(page).toHaveURL(/\/reports\/team/)
  const main = page.locator('main')
  for (const n of ['Arjun', 'Sneha', 'Vikram']) await expect(main).toContainText(n)
  await expect(main).not.toContainText('Meera Iyer')
  await shot(page, 'mgr-reports-team')
  expect(consoleProblems).toEqual([])
})

/* ---------------------------------------------------------------- limited settings and blocked actions */

test('limited settings: profile and team assignment rules only; the rest shows NoAccess with a reason', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('sidebar').getByTestId('nav-settings').click()
  const tiles = page.getByTestId('settings-tiles')
  await expect(tiles).toContainText('Profile and preferences')
  await expect(tiles).toContainText('Assignment rules')
  for (const hidden of ['Pipeline', 'Message templates', 'Users', 'Demo data']) await expect(tiles).not.toContainText(hidden)
  for (const s of ['pipeline', 'templates', 'matching', 'sla', 'users', 'demo']) {
    await page.goto(`/settings/${s}`)
    await expect(page.getByTestId('no-access')).toBeVisible()
    await expect(page.getByTestId('no-access')).toContainText("isn't available for Sales Manager")
  }
  await expect(page.getByTestId('no-access')).toContainText(/can't do this|Only the admin/)
  await page.goto('/settings/assignment')
  await expect(page.getByTestId('no-access')).toHaveCount(0)
  await expect(page.getByTestId('auto-assign-switch')).toBeEnabled()
  await expect(page.getByTestId('rule-add')).toBeEnabled()
  expect(consoleProblems).toEqual([])
})

test('blocked actions: no property delete, no user management, no property import; AI refuses with the reason', async ({ page, consoleProblems }) => {
  await asManager(page)
  // property: status can change, delete is not offered (list and detail)
  await page.getByTestId('sidebar').getByTestId('nav-properties').click()
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
  await page.goto('/properties/PRP-1001')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0)

  // users: no Add user; a deactivated user's menu has no Activate; the admin is outside the team
  await page.getByTestId('sidebar').getByTestId('nav-team').click()
  await expect(page.getByRole('button', { name: /Add user/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Actions for Kavya Joshi' }).click()
  await expect(page.getByRole('menuitem', { name: /Activate|Deactivate|Change role/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto('/team/u-admin')
  await expect(page.locator('main')).toContainText('Not in your team')

  // property imports: NoAccess with the reason; property templates are marked Admin only; lead import is open
  for (const kind of ['apartments', 'villas', 'plots', 'commercial']) {
    await page.goto(`/import/${kind}`)
    await expect(page.getByTestId('no-access')).toContainText('Bulk property import is kept with the admin')
  }
  await page.goto('/import/leads')
  await expect(page.getByTestId('no-access')).toHaveCount(0)
  await page.goto('/import')
  await expect(page.getByTestId('template-cards')).toContainText('Admin only')

  // the assistant follows the same map and says why
  await openAi(page)
  await expect(await ask(page, 'delete property Aranya Greens')).toContainText('Only the admin can delete properties')
  await expect(await ask(page, 'add a new user Priya Nair as sales executive')).toContainText('Only the admin can add, activate or deactivate users')
  await expect(await ask(page, 'deactivate Kavya')).toContainText('Only the admin')
  expect(consoleProblems).toEqual([])
})

test('MGR-7: the assistant explains property import is admin-only without denying the lead import a manager has', async ({ page, consoleProblems }) => {
  await asManager(page)
  await openAi(page)
  const answer = await ask(page, 'import this property price list')
  await shot(page, 'MGR-7-ai-import-refusal')
  await expect(answer).not.toContainText("Bulk import isn't available for your role")
  await expect(answer).toContainText(/admin/i)
  expect(consoleProblems).toEqual([])
})

test('manager assistant: overload, reassign on leave, assign new leads (confirm before change)', async ({ page, consoleProblems }) => {
  await asManager(page)
  await openAi(page)
  const overload = await ask(page, 'Who is overloaded today?')
  await expect(overload).toContainText('Lightest load')
  const farhan = (await ask(page, "Reassign Farhan's leads, he's on leave")).getByTestId('action-proposal')
  expect((await readDb(page)).leads.filter((l) => l.ownerId === 'u-farhan' && OPEN.includes(l.stage))).toHaveLength(2)
  await farhan.getByTestId('proposal-confirm').click()
  await expect(farhan.getByTestId('proposal-done')).toBeVisible()
  expect((await readDb(page)).leads.filter((l) => l.ownerId === 'u-farhan' && OPEN.includes(l.stage))).toHaveLength(0)
  const assign = (await ask(page, 'Assign new leads')).getByTestId('action-proposal')
  await assign.getByTestId('proposal-confirm').click()
  await expect(assign.getByTestId('proposal-done')).toBeVisible()
  expect((await readDb(page)).leads.filter((l) => l.ownerId === null && OPEN.includes(l.stage))).toHaveLength(0)
  expect(consoleProblems).toEqual([])
})

test('MGR-8: "Who is overloaded?" does not call the lightest executive overloaded', async ({ page, consoleProblems }) => {
  await asManager(page)
  await openAi(page)
  const answer = await ask(page, 'Who is overloaded today?')
  await shot(page, 'MGR-8-overloaded-answer')
  const text = await answer.innerText()
  const lightest = text.match(/Lightest load: ([A-Z][a-z]+ [A-Z][a-z]+)/)![1]
  const headline = text.split('\n')[0]
  expect(headline, `headline "${headline}" names the lightest load ${lightest}`).not.toContain(lightest)
  expect(text).not.toMatch(/\b1 visits\b/)
  expect(consoleProblems).toEqual([])
})

test('MGR-10: the Leads "Unassigned" card counts SLA breaches among the unassigned leads', async ({ page, consoleProblems }) => {
  await asManager(page)
  await page.getByTestId('sidebar').getByTestId('nav-leads').click()
  const card = page.getByTestId('leads-page').getByRole('button', { name: /UNASSIGNED|Unassigned/ }).filter({ hasText: /past the first-call SLA/ }).first()
  const text = await card.innerText()
  const total = Number(text.match(/\n(\d+)\n/)?.[1] ?? text.match(/(\d+)/)![1])
  const past = Number(text.match(/(\d+) past the first-call SLA/)![1])
  await shot(page, 'MGR-10-unassigned-kpi')
  expect(past, `card says ${total} unassigned but ${past} past the SLA`).toBeLessThanOrEqual(total)
  expect(consoleProblems).toEqual([])
})

test('every manager page and sub-page loads without console errors', async ({ page, consoleProblems }) => {
  test.setTimeout(120_000)
  await asManager(page)
  const sidebar = page.getByTestId('sidebar')
  const hrefs = await sidebar.locator('a[data-testid^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
  expect(hrefs).toEqual(expect.arrayContaining(['/today', '/leads', '/pipeline', '/team', '/reports', '/import', '/settings', '/activity']))
  for (const href of hrefs) {
    await sidebar.locator(`a[data-testid^="nav-"][href="${href}"]`).click()
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.getByTestId('no-access')).toHaveCount(0)
  }
  for (const p of ['/team/u-arjun', '/reports/sources', '/reports/team', '/reports/pipeline', '/import/history', '/import/drafts', '/leads?tab=unassigned', '/pipeline?view=list', '/appointments?view=week', '/notifications', '/settings/assignment', '/settings/profile']) {
    await page.goto(p)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.getByTestId('no-access')).toHaveCount(0)
  }
  expect(consoleProblems).toEqual([])
})

/* ---------------------------------------------------------------- round 2: one main journey */

test('R2 manager main journey: queue, assign, auto-assign, reassign, pipeline to Booked, team report, blocked, assistant phrasings', async ({ page, consoleProblems }) => {
  test.setTimeout(240_000)
  await asManager(page)
  const queue = page.getByTestId('unassigned-queue')
  await expect(queue.getByTestId('queue-row')).toHaveCount(5)
  const db0 = await readDb(page)
  const load0 = workloads(db0, pool(db0))

  // MGR-1: assign the 3rd row first, the suggestion must be true for that row on its own
  const irfanRow = queue.getByTestId('queue-row').filter({ hasText: 'Mohd Irfan' })
  const irfanText = await irfanRow.innerText()
  await expect(irfanRow).toContainText(/Lowest workload|Location rule|Round-robin|rule/)
  await irfanRow.getByTestId('assign-suggested').click()
  await expect(queue.getByTestId('queue-row')).toHaveCount(4)
  const irfanOwner = (await leadByName(page, 'Mohd Irfan')).ownerId!
  expect(TEAM).toContain(irfanOwner)
  if (/Lowest workload/.test(irfanText)) expect(load0[irfanOwner]).toBe(Math.min(...Object.values(load0)))

  // Auto-assign all: reasons, no on-leave executive, then confirm
  await queue.getByTestId('auto-assign-all').click()
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog')).first()
  await expect(dialog).toContainText('Auto-assign 4 leads?')
  const preview = dialog.getByTestId('auto-preview')
  await expect(preview.locator('li')).toHaveCount(4)
  await expect(preview).not.toContainText('Farhan')
  for (const li of await preview.locator('li').all()) await expect(li).toContainText(/Lowest workload|Location rule|Round-robin|rule/)
  await dialog.getByRole('button', { name: 'Assign 4' }).click()
  await expect(queue).toContainText('The queue is clear')
  const db1 = await readDb(page)
  expect(db1.leads.filter((l) => l.ownerId === null && OPEN.includes(l.stage))).toHaveLength(0)
  const autos = db1.assignments.filter((a) => a.mode === 'auto' && a.by === 'u-rohit')
  expect(autos).toHaveLength(5) // 4 from Auto-assign all + the accepted per-row suggestion
  const ties = autos.filter((a) => a.reason.key === 'roundRobinTie')
  if (ties.length > 1) expect(new Set(ties.map((a) => a.toUserId)).size, 'round-robin rotates on ties').toBeGreaterThan(1)

  // reassign Harish Reddy (Sneha -> Arjun): history and notifications for both
  const harish = await leadByName(page, 'Harish Reddy')
  await page.goto(`/leads/${harish.id}`)
  await page.getByRole('button', { name: /^Reassign$/ }).first().click()
  const ad = page.getByTestId('assign-dialog')
  await ad.getByTestId('assign-person-u-arjun').click()
  await ad.getByTestId('assign-confirm').click()
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Assigned to Arjun Mehta' })).toBeVisible()
  await page.getByText(/Assignment history/).first().click()
  await expect(page.getByTestId('assignment-history')).toContainText('Arjun Mehta')
  const db2 = await readDb(page)
  expect(db2.notifications.some((n) => n.userId === 'u-arjun' && n.kind === 'reassignment' && n.ref?.id === harish.id)).toBe(true)
  expect(db2.notifications.some((n) => n.userId === 'u-sneha' && n.kind === 'reassignment' && n.ref?.id === harish.id)).toBe(true)
  await switchTo(page, 'profile-u-arjun')
  await openToday(page)
  await expect(page.locator('main')).toContainText('Harish Reddy')
  await switchTo(page, 'role-manager')

  // pipeline: drag a deal to Negotiation, then Booked through the dialog (amount + property)
  await page.getByTestId('sidebar').getByTestId('nav-pipeline').click()
  await expect(page.getByTestId('pipeline-page')).toBeVisible()
  const cardOf = (n: string) => page.getByTestId('deal-card').filter({ has: page.getByRole('link', { name: n, exact: true }) })
  const drag = async (from: Locator, to: Locator) => {
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
  const mover = db2.leads.find((l) => l.stage === 'siteVisitDone' && TEAM.includes(l.ownerId ?? ''))!
  await drag(cardOf(mover.name), page.getByTestId('pipeline-column-negotiation'))
  await expect.poll(async () => (await leadByName(page, mover.name)).stage).toBe('negotiation')
  const m = cardOf(mover.name)
  await m.hover()
  await m.getByTestId('deal-menu').click()
  await page.getByRole('menuitem', { name: 'Booked' }).click()
  const sd = page.getByRole('dialog')
  await sd.getByTestId('stage-confirm').click()
  await expect(sd).toContainText('Enter the booking amount')
  const box = sd.getByRole('combobox').nth(1)
  if (!(await box.textContent())?.includes('·')) {
    await box.click()
    await page.getByRole('option').first().click()
  }
  await sd.getByLabel('Booking (token) amount').fill('2')
  await sd.getByTestId('stage-confirm').click()
  await expect(sd).toBeHidden()
  await expect.poll(async () => (await leadByName(page, mover.name)).stage).toBe('booked')

  // team report
  await page.getByTestId('sidebar').getByTestId('nav-reports').click()
  await expect(page.locator('main')).toContainText('Team: Rohit Khanna', { timeout: 20_000 })
  await page.goto('/reports/team')
  for (const n of ['Arjun', 'Sneha', 'Vikram']) await expect(page.locator('main')).toContainText(n)
  await expect(page.locator('main')).not.toContainText('Meera Iyer')

  // blocked actions
  await page.goto('/properties/PRP-1001')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0)
  await page.goto('/team')
  await expect(page.getByRole('button', { name: /Add user/ })).toHaveCount(0)
  await page.goto('/settings/users')
  await expect(page.getByTestId('no-access')).toBeVisible()

  // assistant phrasings (XAI-10)
  await page.goto('/today')
  await openAi(page)
  for (const q of ['which executive has the best conversion?', 'leads with no follow-up scheduled', 'which leads are hot', 'what should I focus on', 'which deals are close to closing?', 'which leads have not been contacted?', 'Priya ko kal shaam 5 baje call karna hai']) {
    await expect(await ask(page, q), q).not.toContainText("didn't understand")
  }
  expect(consoleProblems).toEqual([])
})
