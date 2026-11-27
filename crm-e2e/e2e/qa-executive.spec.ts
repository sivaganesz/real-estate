/**
 * QA – Sales Executive journeys (master prompt §5, §6, §8–§12, §14, §16, §17; ROLE_RESEARCH §1 and §5.1; DEMO_SCRIPT §3).
 * Walks the working day of all three executive accounts (Arjun, Sneha, Vikram) through the real profile switcher:
 * Today (ranked priorities and their one-click actions writing real data), own-data-only scoping, adding leads by hand
 * and by paste-and-fill (the §12.3 Rahul Verma enquiry plus three other phrasings), the duplicate warning, the
 * qualification card, the lead page actions, the calendar (four views, double-booking warning, visit outcome), tasks,
 * the pipeline (Lost reason, Booked amount), matching both ways, My performance, and the blocked areas.
 *
 * Tests named "(EXE-n)" pin a bug found in QA round 1: they assert the CORRECT behaviour and fail until it is fixed.
 */
import type { Locator, Page } from '@playwright/test'
import { expect as baseExpect, test } from './fixtures.ts'

// the dev server shares the machine with other agents' servers: give first paints and lazy routes more room
const expect = baseExpect.configure({ timeout: 15_000 })
test.beforeEach(({}, testInfo) => { testInfo.setTimeout(Math.max(testInfo.timeout, 90_000)) })

type Task = { id: string; title: string; status: string; type: string; dueAt: string; ownerId: string; leadId?: string; callResult?: string }
type Lead = {
  id: string; name: string; phone: string; email?: string; ownerId: string | null; stage: string; source: string; deletedAt?: string
  requirement: { configurations: string[]; localities: string[]; propertyTypes: string[]; budgetMin?: number; budgetMax?: number; possession?: string; facing: string[] }
  qualification: { timeline?: string; decisionMakers: string[]; loan?: string; buyerPurpose?: string }
  lost?: { reason: string }; deal?: { propertyId?: string; bookingAmount?: number }
  shortlist: { propertyId: string; status: string }[]
}
type Appt = { id: string; type: string; status: string; start: string; ownerId: string; leadId?: string; propertyIds: string[] }
type Db = {
  leads: Lead[]; tasks: Task[]; appointments: Appt[]; clients: { id: string }[]
  activities: { id: string; kind: string; refs: { kind: string; id: string }[] }[]
  notifications: { id: string; userId: string; kind: string; params: Record<string, unknown> }[]
  properties: { id: string; title: string; status: string }[]
}

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)
const leadByName = async (page: Page, name: string) => (await readDb(page)).leads.find((l) => l.name === name && !l.deletedAt)

const EXECS = [
  { testId: 'profile-u-arjun', id: 'u-arjun', first: 'Arjun' },
  { testId: 'profile-u-sneha', id: 'u-sneha', first: 'Sneha' },
  { testId: 'profile-u-vikram', id: 'u-vikram', first: 'Vikram' },
] as const

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
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

/** Today at hh:mm local time: the seed is relative to "now", so fixing the clock makes time-of-day items deterministic. */
function todayAt(h: number, m = 0) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d }

const rows = (page: Page) => page.getByTestId('priority-item')
const rowNames = (page: Page) => rows(page).evaluateAll((els) => els.map((e) => e.querySelector('a')?.textContent ?? ''))
const rowIds = (page: Page) => rows(page).evaluateAll((els) => els.map((e) => e.id))

/** Picks a day in the shared date field (popover with a month calendar). */
async function pickDay(page: Page, scope: Locator, day: Date) {
  await scope.locator('button', { hasText: 'Pick a date' }).first().click()
  const long = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const us = day.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const cell = page.getByRole('button', { name: new RegExp(`^(${long}|${us})$`) })
  if (!(await cell.count())) await page.getByRole('button', { name: /next month/i }).last().click()
  await cell.first().click()
}

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

/** Client-side navigation (no full reload): the shared dev machine makes full page loads slow. */
async function go(page: Page, url: string) {
  await page.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')) }, url)
}

async function askPanel(page: Page, text: string) {
  if (!(await page.getByTestId('ai-panel').isVisible())) await page.keyboard.press('Control+k')
  await expect(page.getByTestId('ai-panel')).toBeVisible()
  const answers = page.getByTestId('ai-answer')
  const n = await answers.count()
  await page.getByTestId('ai-input').fill(text)
  await page.getByTestId('ai-input').press('Enter')
  await expect(answers).toHaveCount(n + 1)
  return answers.last()
}

// ───────────────────────────── Today ─────────────────────────────

test('Arjun\'s morning: greeting, ranked priorities, and Call / WhatsApp / Done / Reschedule / Log outcome write real data and re-rank', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await stubWindowOpen(page)
  // a real tel: navigation opens the OS dialer prompt, which freezes a headless page: keep the click, skip the dialer
  await page.addInitScript(() => document.addEventListener('click', (e) => { if ((e.target as Element | null)?.closest?.('a[href^="tel:"]')) e.preventDefault() }, true))
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await expect(page.getByTestId('today-executive')).toBeVisible()
  await expect(page.locator('main h1')).toHaveText(/^Good (morning|afternoon|evening), Arjun$/)
  await expect(page.getByTestId('today-brief')).toContainText(/Today you have/)
  await expect(page.getByTestId('today-brief').getByTestId('demo-ai-badge')).toBeVisible()
  await expect(page.locator('main')).not.toContainText(/BANT/)

  // ranking follows ROLE_RESEARCH §5.1 plus EXE-2: new uncalled leads, visits soon, overdue, ended-visit outcome, post-visit, hot, stale, due today
  const order = ['uncalledNew', 'visitSoon', 'overdueTask', 'visitOutcome', 'postVisitCall', 'hotNoContact', 'stale', 'dueToday']
  const kinds = await rows(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind ?? ''))
  expect(kinds.length).toBeGreaterThan(2)
  expect([...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(kinds)
  for (const r of await rows(page).all()) await expect(r.getByTestId('reason-chip')).toBeVisible()

  // WhatsApp on the top row opens wa.me prefilled and logs a message on the lead
  const top = rows(page).first()
  const topName = (await rowNames(page))[0]
  const topLead = (await leadByName(page, topName))!
  const actsBefore = (await readDb(page)).activities.length
  await top.getByTestId('today-wa').click()
  await expect.poll(async () => (await readDb(page)).activities.length).toBeGreaterThan(actsBefore)
  expect((await readDb(page)).activities.slice(actsBefore).some((a) => a.refs.some((r) => r.id === topLead.id))).toBe(true)

  // Call opens the Log outcome popover; Connected logs the call and the list re-ranks
  const callRow = rows(page).filter({ has: page.getByTestId('today-log') }).first()
  const callId = await callRow.getAttribute('id')
  await callRow.getByTestId('today-call').click()
  await expect(page.getByTestId('log-outcome')).toBeVisible()
  await page.getByTestId('result-connected').click()
  await page.getByTestId('log-save').click()
  await expect.poll(() => rowIds(page)).not.toContain(callId)

  // Done completes the task in the store; Undo brings it back
  const doneRow = rows(page).filter({ has: page.getByTestId('today-done') }).first()
  const doneId = (await doneRow.getAttribute('id'))!
  const taskId = doneId.replace(/^today-item-[a-zA-Z]+-task-/, '')
  await doneRow.getByTestId('today-done').click()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.id === taskId)?.status).toBe('done')
  await expect.poll(() => rowIds(page)).not.toContain(doneId)
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.id === taskId)?.status).toBe('open')
  await expect.poll(() => rowIds(page)).toContain(doneId)

  // Reschedule an overdue follow-up to tomorrow: the stored due time moves and the row leaves today's list
  const resRow = rows(page).filter({ has: page.getByTestId('today-done') }).first()
  const resId = (await resRow.getAttribute('id'))!
  const resTask = resId.replace(/^today-item-[a-zA-Z]+-task-/, '')
  await resRow.getByTestId('today-reschedule').click()
  await page.locator('[data-testid^="slot-"]').filter({ hasText: /tomorrow/i }).first().click()
  await expect.poll(async () => dayKey(new Date((await readDb(page)).tasks.find((x) => x.id === resTask)!.dueAt))).toBe(dayKey(plusDays(1)))
  await expect.poll(() => rowIds(page)).not.toContain(resId)

  // Log outcome "Busy" on a call task creates the automatic retry (E4)
  const busyRow = rows(page).filter({ has: page.getByTestId('today-log') }).filter({ has: page.getByTestId('today-done') }).first()
  if (await busyRow.count()) {
    const busyName = (await busyRow.locator('a').first().textContent())!
    const busyLead = (await leadByName(page, busyName))!
    const before = await readDb(page)
    await busyRow.getByTestId('today-log').click()
    await page.getByTestId('result-busy').click()
    await page.getByTestId('log-save').click()
    await expect.poll(async () => (await readDb(page)).tasks.filter((x) => x.leadId === busyLead.id && x.status === 'open' && !before.tasks.some((b) => b.id === x.id)).length).toBeGreaterThan(0)
  }
  await page.screenshot({ path: 'notes/screens/qa/executive/today-arjun-after-actions.png', fullPage: true })
  expect(consoleProblems).toEqual([])
})

test('every executive gets their own Today with their own name, brief and list', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  const lists: string[] = []
  for (const e of EXECS) {
    await switchTo(page, e.testId)
    await expect(page.locator('main h1')).toContainText(e.first)
    await expect(page.getByTestId('today-manager')).toHaveCount(0)
    await expect(page.getByTestId('today-admin')).toHaveCount(0)
    await expect(rows(page).first()).toBeVisible()
    const db = await readDb(page)
    const own = new Set(db.leads.filter((l) => l.ownerId === e.id).map((l) => l.name))
    const names = await rowNames(page)
    for (const n of names) expect(own.has(n), `${e.first} sees ${n}`).toBe(true)
    lists.push(names.join('|'))
    await page.screenshot({ path: `notes/screens/qa/executive/today-${e.first.toLowerCase()}.png`, fullPage: true })
  }
  expect(new Set(lists).size).toBe(3)
  expect(consoleProblems).toEqual([])
})

test('Log outcome "Not reachable" on a non-call follow-up keeps the work open or plans a retry (EXE-1)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  // TSK-1002 "Collect PAN copy from Karthik for the offer letter" (type document, overdue)
  const row = page.locator('#today-item-overdueTask-task-TSK-1002')
  await expect(row).toBeVisible()
  const before = await readDb(page)
  await row.getByTestId('today-log').click()
  await page.getByTestId('result-notReachable').click()
  await expect(page.getByTestId('log-outcome')).toContainText(/retry|again/i)
  await page.getByTestId('log-save').click()
  await expect(row).toHaveCount(0)
  const after = await readDb(page)
  const stillOpen = after.tasks.find((x) => x.id === 'TSK-1002')?.status === 'open'
  const retry = after.tasks.some((x) => x.leadId === 'LEAD-1002' && x.status === 'open' && !before.tasks.some((b) => b.id === x.id))
  await page.screenshot({ path: 'notes/screens/qa/executive/exe-1-not-reachable-closes-task.png', fullPage: true })
  // the PAN copy was never collected: the task must not silently disappear with nothing left to chase it
  expect(stillOpen || retry).toBe(true)
  expect(consoleProblems).toEqual([])
})

test('visits still waiting for their outcome appear in Your priorities (EXE-2)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const db = await readDb(page)
  const pending = db.appointments.filter((a) => a.ownerId === 'u-arjun' && a.type === 'siteVisit' && ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start).getTime() < Date.now() - 86_400_000)
  expect(pending.length).toBeGreaterThan(0)
  const names = pending.map((a) => db.leads.find((l) => l.id === a.leadId)!.name)
  await expect(rows(page).first()).toBeVisible()
  await page.screenshot({ path: 'notes/screens/qa/executive/exe-2-outcome-not-prioritised.png', fullPage: true })
  // ROLE_RESEARCH §1 "Log call and visit outcomes" / pain point "visit feedback stays in a notebook"
  expect(await rowNames(page)).toEqual(expect.arrayContaining(names))
  expect(consoleProblems).toEqual([])
})

test('Today brief and reasons use the same 12-hour time as the rest of the app (EXE-3)', async ({ page, consoleProblems }) => {
  // 13:30 local: Ananya Iyer's 3 PM call is "soon" and shows in the brief and the list
  await page.clock.setFixedTime(todayAt(13, 30))
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await expect(page.locator('#today-appts')).toContainText('3:00 PM')
  await expect(rows(page).filter({ hasText: 'Ananya Iyer' }).first()).toBeVisible()
  await page.getByTestId('today-hero').screenshot({ path: 'notes/screens/qa/executive/exe-3-24h-time.png' })
  await expect(page.getByTestId('today-hero')).not.toContainText(/(?<!\d)(1[3-9]|2[0-3]):[0-5]\d(?!\d)/)
  await expect(page.getByTestId('priority-list')).not.toContainText(/(?<!\d)(1[3-9]|2[0-3]):[0-5]\d(?!\d)/)
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── Scope and blocked areas ─────────────────────────────

test('each executive sees only their own leads, deals and appointments, and is blocked from team, activity, admin settings, delete and assign', async ({ page, consoleProblems }) => {
  test.setTimeout(300_000)
  await page.goto('/today')
  for (const e of EXECS) {
    await switchTo(page, e.testId)
    const db = await readDb(page)
    const own = new Set(db.leads.filter((l) => l.ownerId === e.id && !l.deletedAt).map((l) => l.name))
    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar.getByTestId('nav-team')).toHaveCount(0)
    await expect(sidebar.getByTestId('nav-activity')).toHaveCount(0)

    // leads list (table): own only, no Unassigned tab, no bulk delete, no assign
    await sidebar.getByTestId('nav-leads').click()
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await expect(page.locator('tbody tr').first()).toBeVisible()
    const shown = await page.locator('tbody tr p.font-semibold').evaluateAll((els) => els.map((x) => (x.firstChild?.textContent ?? '').trim()))
    expect(shown.length).toBe(own.size)
    for (const n of shown) expect(own.has(n), `${e.first} sees lead ${n}`).toBe(true)
    await expect(page.getByRole('button', { name: /^Unassigned \d+$/ })).toHaveCount(0)
    await page.locator('tbody tr').first().getByRole('checkbox').click()
    await expect(page.getByTestId('bulk-stage')).toBeVisible()
    await expect(page.getByTestId('bulk-delete')).toHaveCount(0)
    await expect(page.locator('main').getByRole('button', { name: /assign|export/i })).toHaveCount(0)

    // a lead of their own: no Assign, no Delete in the menu, Request reassignment instead
    const mine = db.leads.find((l) => l.ownerId === e.id && !['lost', 'converted'].includes(l.stage))!
    await go(page, `/leads/${mine.id}`)
    await expect(page.getByTestId('lead-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('qa-assign')).toHaveCount(0)
    await expect(page.getByTestId('qa-request')).toBeEnabled()
    await page.getByTestId('lead-more').first().click()
    await expect(page.getByRole('menuitem', { name: /delete/i })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /^(re)?assign/i })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /request reassignment/i })).toBeVisible()
    await page.keyboard.press('Escape')

    // someone else's lead by URL
    const other = db.leads.find((l) => l.ownerId && l.ownerId !== e.id)!
    await go(page, `/leads/${other.id}`)
    await expect(page.getByTestId('lead-page')).toHaveCount(0)
    await expect(page.getByText("This lead isn't on your list")).toBeVisible({ timeout: 20_000 })

    // pipeline: own deals only, no executive filter
    await go(page, '/pipeline')
    await expect(page.getByTestId('pipeline-board')).toBeVisible({ timeout: 20_000 })
    const cards = await page.getByTestId('deal-card').evaluateAll((els) => els.map((x) => x.querySelector('a')?.textContent ?? ''))
    expect(cards.length).toBeGreaterThan(0)
    for (const n of cards) expect(own.has(n), `${e.first} sees deal ${n}`).toBe(true)
    await expect(page.getByRole('button', { name: /^Executive/ })).toHaveCount(0)

    // appointments: own only
    await go(page, '/appointments?view=list')
    await expect(page.getByTestId('agenda-list')).toBeVisible({ timeout: 20_000 })
    const list = await page.getByTestId('agenda-list').innerText()
    const othersAppts = db.appointments.filter((a) => a.ownerId !== e.id).map((a) => db.leads.find((l) => l.id === a.leadId)?.name).filter((n): n is string => !!n && !own.has(n))
    for (const n of othersAppts) expect(list, `${e.first} sees ${n}'s appointment`).not.toContain(n)
    await expect(page.getByRole('button', { name: /Executive/ })).toHaveCount(0)

    // blocked routes show NoAccess inside the shell
    for (const url of ['/team', '/activity', '/settings/users', '/settings/assignment', '/settings/pipeline']) {
      await go(page, url)
      await expect(page.getByTestId('no-access'), url).toBeVisible({ timeout: 20_000 })
    }
    // Settings is profile only
    await go(page, '/settings')
    await expect(page.getByTestId('profile-name')).toBeVisible()
    // Import is single-document only
    await go(page, '/import')
    await expect(page.getByTestId('hub-limited')).toBeVisible()
    await go(page, '/today')
  }
  await go(page, '/team')
  await page.screenshot({ path: 'notes/screens/qa/executive/blocked-team.png' })
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── Adding leads ─────────────────────────────

test('Vikram adds a lead by hand: the duplicate warning (own and someone else\'s), acknowledge, save, owned by himself', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'profile-u-vikram')
  const db = await readDb(page)
  const own = db.leads.find((l) => l.ownerId === 'u-vikram' && l.phone)!
  const sneha = db.leads.find((l) => l.ownerId === 'u-sneha' && l.phone)!

  await page.getByTestId('leads-add').click()
  const sheet = page.getByRole('dialog')
  await sheet.getByTestId('lead-name').fill('Farah Khan')
  await sheet.getByLabel('Mobile').first().fill(sneha.phone.slice(3))
  const dup = sheet.getByTestId('duplicate-warning')
  await expect(dup).toBeVisible()
  await expect(dup).toContainText(sneha.name)
  await expect(dup).toContainText('Not on your list')
  await expect(dup.getByRole('link', { name: 'Open existing' })).toHaveCount(0)
  await sheet.getByLabel('Mobile').first().fill(own.phone.slice(3))
  await expect(dup).toContainText(own.name)
  await expect(dup.getByRole('link', { name: 'Open existing' })).toHaveAttribute('href', `/leads/${own.id}`)
  await sheet.screenshot({ path: 'notes/screens/qa/executive/duplicate-warning.png' })

  // a different person on a new number: no warning, saves straight away, owned by Vikram
  await sheet.getByLabel('Mobile').first().fill('91230 45678')
  await expect(dup).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Phone call', exact: true }).first().click()
  await sheet.getByTestId('lead-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
  const farah = (await leadByName(page, 'Farah Khan'))!
  expect(farah).toMatchObject({ phone: '+919123045678', ownerId: 'u-vikram', source: 'phone', stage: 'new' })
  // it shows on his Today as a new lead to call
  await page.getByTestId('sidebar').getByTestId('nav-today').click()
  await expect(rows(page).filter({ hasText: 'Farah Khan' }).first()).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('Save lead with an unacknowledged duplicate tells the user why nothing happened', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'profile-u-arjun')
  const own = (await readDb(page)).leads.find((l) => l.ownerId === 'u-arjun' && l.phone)!
  await page.getByTestId('leads-add').click()
  const sheet = page.getByRole('dialog')
  await sheet.getByTestId('lead-name').fill('Test Duplicate')
  await sheet.getByLabel('Mobile').first().fill(own.phone.slice(3))
  await expect(sheet.getByTestId('duplicate-warning')).toBeVisible()
  await sheet.getByRole('button', { name: 'Walk-in', exact: true }).first().click()
  const count = (await readDb(page)).leads.length
  await sheet.getByTestId('lead-save').click()
  await page.waitForTimeout(500)
  expect((await readDb(page)).leads.length).toBe(count)
  await sheet.screenshot({ path: 'notes/screens/qa/executive/duplicate-unacknowledged-toast.png' })
  // the click must explain itself: an error on the "save anyway" checkbox, an alert, or a toast
  await expect(sheet.locator('[aria-invalid="true"], [role="alert"]').or(page.locator('[data-sonner-toast]')).first()).toBeVisible()
  // ticking "save anyway" then saves it
  await sheet.getByTestId('duplicate-warning').getByRole('checkbox').click()
  await sheet.getByTestId('lead-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
  expect(consoleProblems).toEqual([])
})

const RAHUL = "Hi, I'm Rahul Verma, 9845012345. Looking for a 3BHK in Whitefield or Sarjapur, budget around 1.2 Cr, ready to move, need it in 2–3 months. Wife will also decide."

async function pasteAndExtract(page: Page, text: string) {
  await page.getByTestId('leads-paste').click()
  const sheet = page.getByRole('dialog')
  await sheet.getByTestId('paste-text').fill(text)
  await sheet.getByTestId('paste-extract').click()
  await expect(sheet.getByTestId('effort-saved').or(sheet.getByText(/fields? auto-filled/)).first()).toBeVisible()
  return sheet
}
async function walkToSave(page: Page, sheet: Locator) {
  await sheet.getByTestId('lead-next').click()
  await expect(sheet.getByTestId('fit-line')).toBeVisible()
  await sheet.getByTestId('lead-next').click()
  await sheet.getByTestId('lead-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
}

test('Arjun pastes the §12.3 Rahul Verma enquiry: every field is read, only the source is asked, saved to Arjun', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'profile-u-arjun')
  const sheet = await pasteAndExtract(page, RAHUL)
  await expect(sheet.getByTestId('lead-name')).toHaveValue('Rahul Verma')
  await expect(sheet.getByText('Where did this enquiry come from?')).toBeVisible()
  await sheet.getByRole('button', { name: 'Walk-in', exact: true }).first().click()
  await sheet.getByTestId('lead-next').click()
  await sheet.getByTestId('lead-next').click()
  await expect(sheet).toContainText('4 of 4 known')
  await expect(sheet).not.toContainText(/BANT/)
  await sheet.screenshot({ path: 'notes/screens/qa/executive/paste-rahul-step3.png' })
  await sheet.getByTestId('lead-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
  const r = (await leadByName(page, 'Rahul Verma'))!
  expect(r.phone).toBe('+919845012345')
  expect(r.ownerId).toBe('u-arjun')
  expect(r.requirement.configurations).toEqual(['3BHK'])
  expect(r.requirement.localities).toEqual(['Whitefield', 'Sarjapur Road'])
  expect(r.requirement.budgetMax).toBe(12_000_000)
  expect(r.requirement.possession).toBe('ready')
  expect(r.qualification.timeline).toBe('m1to3')
  expect(r.qualification.decisionMakers).toContain('spouse')
  await expect(page.getByTestId('next-action')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('Vikram pastes a portal-style enquiry (pipes, range budget, 2.5BHK, east facing, pre-approved loan)', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'profile-u-vikram')
  const sheet = await pasteAndExtract(page, 'Name: Karan Malhotra | Mobile: +91 99001 22334 | Email: karan.m@example.com | Requirement: 2.5BHK east facing flat in Electronic City | Budget: 85 L - 95 L | Possession: under construction is fine | Loan pre-approved | Source: 99acres')
  await expect(sheet.getByTestId('lead-name')).toHaveValue('Karan Malhotra')
  // the source was in the message: it is not asked again
  await expect(sheet.getByText('Where did this enquiry come from?')).toHaveCount(0)
  await walkToSave(page, sheet)
  const k = (await leadByName(page, 'Karan Malhotra'))!
  expect(k).toMatchObject({ phone: '+919900122334', email: 'karan.m@example.com', ownerId: 'u-vikram', source: 'acres99' })
  expect(k.requirement.configurations).toEqual(['2.5BHK'])
  expect(k.requirement.localities).toEqual(['Electronic City'])
  expect(k.requirement.facing).toEqual(['E'])
  expect(k.requirement.budgetMin).toBe(8_500_000)
  expect(k.requirement.budgetMax).toBe(9_500_000)
  expect(k.requirement.possession).toBe('underConstruction')
  expect(k.qualification.loan).toBe('preApproved')
  expect(consoleProblems).toEqual([])
})

test('Arjun pastes a call note (Mrs., villa, crore, parents decide, investment, referral)', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'profile-u-arjun')
  const sheet = await pasteAndExtract(page, 'Spoke to Mrs. Lakshmi Iyer (9123456780) today. Parents will decide. Looking for a villa in Sarjapur Road, budget 2.5 crore, for investment, wants to buy immediately. Came through a referral from Anil Kapoor.')
  await expect(sheet.getByTestId('lead-name')).toHaveValue('Lakshmi Iyer')
  await expect(sheet.getByText('Where did this enquiry come from?')).toHaveCount(0)
  await walkToSave(page, sheet)
  const l = (await leadByName(page, 'Lakshmi Iyer'))!
  expect(l).toMatchObject({ phone: '+919123456780', ownerId: 'u-arjun', source: 'referral' })
  expect(l.requirement.propertyTypes).toEqual(['villa'])
  expect(l.requirement.localities).toEqual(['Sarjapur Road'])
  expect(l.requirement.budgetMax).toBe(25_000_000)
  expect(l.qualification.decisionMakers).toContain('parents')
  expect(l.qualification.timeline).toBe('immediate')
  expect(l.qualification.buyerPurpose).toBe('investment')
  expect(consoleProblems).toEqual([])
})

test('Sneha pastes a Hinglish WhatsApp, answers the missing questions as chips, and the qualification card completes (EXE-5)', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'profile-u-sneha')
  const sheet = await pasteAndExtract(page, 'Sir mera naam Anjali Desai hai, number 98861 23456. 2bhk chahiye Hebbal ya Yelahanka mein, budget 75 lakhs tak, loan lagega, 6 mahine mein lena hai')
  await expect(sheet.getByTestId('lead-name')).toHaveValue('Anjali Desai')
  // only the missing essentials are asked, as quick-pick chips
  await expect(sheet.getByText('Where did this enquiry come from?')).toBeVisible()
  await expect(sheet.getByText('Who else decides on the purchase?')).toBeVisible()
  await sheet.getByRole('button', { name: 'WhatsApp', exact: true }).first().click()
  await walkToSave(page, sheet)
  const a = (await leadByName(page, 'Anjali Desai'))!
  expect(a).toMatchObject({ phone: '+919886123456', ownerId: 'u-sneha', source: 'whatsapp' })
  expect(a.requirement.configurations).toEqual(['2BHK'])
  expect(a.requirement.localities).toEqual(['Hebbal', 'Yelahanka'])
  expect(a.requirement.budgetMax).toBe(7_500_000)

  // qualification card on the lead page: 3 of 4 known, the missing decision-maker question as chips
  const qual = page.getByTestId('qualification-card')
  await expect(qual).toContainText('3 of 4 known')
  await expect(page.locator('main')).not.toContainText(/BANT/)
  await qual.getByRole('button', { name: 'Spouse', exact: true }).click()
  await expect(qual).toContainText('4 of 4 known')
  await expect.poll(async () => (await leadByName(page, 'Anjali Desai'))!.qualification.decisionMakers).toContain('spouse')
  await qual.screenshot({ path: 'notes/screens/qa/executive/qualification-card.png' })

  // "loan lagega" = a home loan is needed (§9 Indian-context question)
  expect((await leadByName(page, 'Anjali Desai'))!.qualification.loan).toBe('needed')
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── Lead page ─────────────────────────────

test('Arjun works a lead page: add follow-up, schedule a visit, match properties, change stage', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const db = await readDb(page)
  const lead = db.leads.find((l) => l.ownerId === 'u-arjun' && ['contacted', 'qualified'].includes(l.stage))!
  expect(lead).toBeTruthy()
  await page.goto(`/leads/${lead.id}`)
  await expect(page.getByTestId('lead-page')).toBeVisible({ timeout: 20_000 })
  // the page replaces its own URL once after loading; let that settle before opening a dialog
  await page.waitForTimeout(1500)

  // Add follow-up
  await page.getByTestId('qa-task').click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toContainText('Add a follow-up')
  await dlg.getByRole('textbox').first().fill(`Send floor plans to ${lead.name}`)
  await pickDay(page, dlg, plusDays(1))
  await dlg.getByTestId('task-save').click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.title === `Send floor plans to ${lead.name}`)).toMatchObject({ leadId: lead.id, ownerId: 'u-arjun', status: 'open' })

  // Schedule a site visit with a property and a free slot → stage moves to "Site visit scheduled"
  await page.getByTestId('qa-visit').first().click()
  const form = page.getByTestId('appointment-form')
  await expect(form.getByRole('combobox').first()).toContainText(lead.name)
  await form.locator('button', { hasText: 'Add property' }).click()
  await page.getByRole('dialog').last().locator('ul button').first().click()
  await page.keyboard.press('Escape')
  await form.getByTestId('slot-suggestions').getByRole('button').first().click()
  await form.getByTestId('appointment-save').click()
  await expect(form).toBeHidden()
  await expect.poll(async () => (await readDb(page)).leads.find((l) => l.id === lead.id)!.stage).toBe('siteVisitScheduled')

  // Match properties opens the matches tab with ranked cards
  await page.getByTestId('quick-actions').getByRole('button', { name: /match/i }).click()
  await expect(page).toHaveURL(/tab=matches/)
  await expect(page.getByRole('link', { name: /Open in Matching/ })).toBeVisible()

  // Change stage via the dialog → Negotiation
  await page.getByTestId('quick-actions').getByRole('button', { name: /stage/i }).click()
  const stage = page.getByRole('dialog')
  await stage.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Negotiation' }).click()
  await stage.getByTestId('stage-confirm').click()
  await expect.poll(async () => (await readDb(page)).leads.find((l) => l.id === lead.id)!.stage).toBe('negotiation')
  await page.screenshot({ path: 'notes/screens/qa/executive/lead-page-actions.png', fullPage: true })
  expect(consoleProblems).toEqual([])
})

test('Vikram requests reassignment: the manager is notified; the bell shows no future times (EXE-6) or raw minute counts (EXE-4)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-vikram')
  const pooja = (await leadByName(page, 'Pooja Agarwal'))!
  await page.goto(`/leads/${pooja.id}`)
  const before = (await readDb(page)).notifications.length
  await page.getByTestId('qa-request').click()
  await page.getByRole('dialog').getByRole('textbox').fill('Client prefers a Kannada speaker')
  await page.getByTestId('request-reassign-send').click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect.poll(async () => (await readDb(page)).notifications.length).toBe(before + 1)
  const n = (await readDb(page)).notifications.at(-1)!
  expect(n).toMatchObject({ userId: 'u-rohit', params: { name: 'Pooja Agarwal', owner: 'Vikram Singh', note: 'Client prefers a Kannada speaker' } })
  // the lead stays with Vikram until the manager decides
  expect((await leadByName(page, 'Pooja Agarwal'))!.ownerId).toBe('u-vikram')

  await switchTo(page, 'role-manager')
  await page.getByTestId('bell').click()
  await expect(page.getByText('Vikram Singh asks to reassign Pooja Agarwal')).toBeVisible()
  await page.screenshot({ path: 'notes/screens/qa/executive/exe-6-bell-future-time.png' })
  // a notification made a moment ago reads "now" / "N seconds ago", never "in 4 seconds"
  await expect(page.getByText(/^in \d+ seconds?$/)).toHaveCount(0)
  // EXE-4: "has not called Vivek Malhotra for 1200 minutes" should read in hours like the Today reasons
  await expect(page.getByText(/\b\d{3,} minutes\b/)).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('a match explanation with two wanted amenities renders without React key errors (EXE-7)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  // Deepak Verma wants Clubhouse + Gym: two "has amenity" reasons
  await page.goto('/leads/LEAD-1006?tab=matches')
  const why = page.locator('main').getByRole('button', { name: /\d+%/ })
  await expect(why.first()).toBeVisible()
  for (const b of await why.all()) {
    await b.hover()
    await b.click()
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
  }
  await page.goto('/matching?lead=LEAD-1006')
  await expect(page.getByTestId('match-grid')).toBeVisible()
  await page.getByTestId('match-grid').getByRole('button', { name: /why|match/i }).first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'notes/screens/qa/executive/exe-7-match-explain.png' })
  expect(consoleProblems.filter((p) => /same key/.test(p))).toEqual([])
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── Calendar and tasks ─────────────────────────────

test('Sneha\'s calendar: day, week, month and list views show only her appointments', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-sneha')
  await page.getByTestId('sidebar').getByTestId('nav-appointments').click()
  await expect(page.getByTestId('appointments-page')).toBeVisible()
  for (const [label, testId] of [['Day', 'time-grid'], ['Week', 'time-grid'], ['Month', 'month-grid'], ['List', 'agenda-list']] as const) {
    await page.getByRole('navigation', { name: 'Calendar view' }).getByRole('button', { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`view=${label.toLowerCase()}`))
    await expect(page.getByTestId(testId)).toBeVisible()
    await page.screenshot({ path: `notes/screens/qa/executive/calendar-sneha-${label.toLowerCase()}.png` })
  }
  const db = await readDb(page)
  const own = db.appointments.filter((a) => a.ownerId === 'u-sneha' && new Date(a.start) >= plusDays(-7))
  const text = await page.getByTestId('agenda-list').innerText()
  for (const a of own) expect(text).toContain(db.leads.find((l) => l.id === a.leadId)!.name)
  expect(consoleProblems).toEqual([])
})

test('Vikram books on top of his own visit: the double-booking warning says so, "Book anyway" still books', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-vikram')
  const before = await readDb(page)
  const day = dayKey(plusDays(5))
  const clash = before.appointments.find((a) => a.ownerId === 'u-vikram' && dayKey(new Date(a.start)) === day)!
  expect(clash).toBeTruthy()
  const lead = before.leads.find((l) => l.ownerId === 'u-vikram' && l.id !== clash.leadId && !['booked', 'lost', 'converted'].includes(l.stage))!
  await page.goto(`/appointments?view=day&date=${day}`)
  const h = new Date(clash.start).getHours()
  await page.getByRole('button', { name: new RegExp(`^Book at ${h % 12 || 12}:00`, 'i') }).click()
  const form = page.getByTestId('appointment-form')
  await form.getByRole('button', { name: 'Office meeting' }).click()
  await form.getByRole('combobox').first().click()
  await page.getByRole('option', { name: new RegExp(`^${lead.name}`) }).click()
  await expect(form.getByTestId('conflict-warning')).toContainText('Vikram Singh already has')
  await expect(form.getByTestId('appointment-save')).toHaveText('Book anyway')
  await form.screenshot({ path: 'notes/screens/qa/executive/conflict-warning.png' })
  await form.getByTestId('appointment-save').click()
  await expect(form).toBeHidden()
  await expect.poll(async () => (await readDb(page)).appointments.length).toBe(before.appointments.length + 1)
  const created = (await readDb(page)).appointments.find((a) => !before.appointments.some((b) => b.id === a.id))!
  expect(created).toMatchObject({ ownerId: 'u-vikram', leadId: lead.id, type: 'officeMeeting' })
  expect(consoleProblems).toEqual([])
})

test('completing a visit with an outcome: the stage the dialog shows is the stage that is saved (EXE-8)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const db = await readDb(page)
  const early = ['new', 'contacted', 'qualified', 'siteVisitScheduled']
  const pending = db.appointments.find((a) => a.ownerId === 'u-arjun' && a.type === 'siteVisit' && ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start).getTime() < Date.now() - 3_600_000 && early.includes(db.leads.find((l) => l.id === a.leadId)!.stage))!
  expect(pending).toBeTruthy()
  const stageBefore = db.leads.find((l) => l.id === pending.leadId)!.stage
  await page.goto(`/appointments/${pending.id}`)
  await page.getByTestId('appt-outcome').click()
  const dlg = page.getByTestId('outcome-dialog')
  await dlg.getByTestId('result-interested').click()
  const says = await dlg.innerText()
  await dlg.screenshot({ path: 'notes/screens/qa/executive/exe-8-keep-stage.png' })
  await dlg.getByTestId('outcome-save').click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === pending.id)!.status).toBe('completed')
  const after = await readDb(page)
  const stageAfter = after.leads.find((l) => l.id === pending.leadId)!.stage
  expect(after.tasks.some((x) => x.leadId === pending.leadId && x.status === 'open' && !db.tasks.some((b) => b.id === x.id))).toBe(true)
  // "Keep <current stage>" in the dialog promises no stage change
  if (/\bKeep\b/.test(says)) expect(stageAfter).toBe(stageBefore)
  else expect(stageAfter).not.toBe(stageBefore)
  expect(consoleProblems).toEqual([])
})

test('Sneha\'s tasks: quick add on a lead, then complete it', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-sneha')
  await page.getByTestId('sidebar').getByTestId('nav-tasks').click()
  await expect(page.getByTestId('tasks-page')).toBeVisible()
  await page.getByTestId('quick-title').fill('Send Divya the OMR price sheet')
  await page.getByTestId('quick-add').getByRole('combobox').click()
  await expect(page.getByRole('option', { name: /^Priya Sharma/ })).toHaveCount(0)
  await page.getByRole('option', { name: /^Divya Menon/ }).click()
  await page.getByTestId('quick-submit').click()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.title === 'Send Divya the OMR price sheet')).toMatchObject({ ownerId: 'u-sneha', status: 'open' })
  const id = (await readDb(page)).tasks.find((x) => x.title === 'Send Divya the OMR price sheet')!.id
  await page.getByTestId('tasks-page').getByPlaceholder(/Search/).fill('OMR price sheet')
  for (const tab of ['Today', 'Upcoming', 'Overdue']) {
    await page.getByRole('navigation', { name: 'Task tabs' }).getByRole('button', { name: new RegExp(`^${tab}`) }).click()
    if (await page.getByTestId('task-row').filter({ hasText: 'OMR price sheet' }).count()) break
  }
  await page.getByTestId('task-row').filter({ hasText: 'OMR price sheet' }).first().getByTestId('task-done').click()
  const callResult = page.getByTestId('call-result')
  if (await callResult.isVisible().catch(() => false)) await callResult.getByRole('button').first().click()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.id === id)!.status).toBe('done')
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── Pipeline ─────────────────────────────

test('Sneha drags deals: Booked needs the amount and creates the client, Lost needs a reason', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-sneha')
  await page.getByTestId('sidebar').getByTestId('nav-pipeline').click()
  await expect(page.getByTestId('pipeline-board')).toBeVisible()
  const col = (s: string) => page.getByTestId(`pipeline-column-${s}`)
  const card = (name: string) => page.getByTestId('deal-card').filter({ has: page.getByRole('link', { name, exact: true }) })
  const before = await readDb(page)

  await drag(page, card('Harish Reddy'), col('booked'))
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Booking (token) amount')
  await dialog.getByTestId('stage-confirm').click()
  await expect(dialog).toContainText('Enter the booking amount')
  expect((await leadByName(page, 'Harish Reddy'))!.stage).toBe('negotiation')
  const propertyBox = dialog.getByRole('combobox').nth(1)
  if (!(await propertyBox.textContent())?.includes('·')) { await propertyBox.click(); await page.getByRole('option').first().click() }
  await dialog.getByLabel('Booking (token) amount').fill('5')
  await dialog.getByTestId('stage-confirm').click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await leadByName(page, 'Harish Reddy'))!.stage).toBe('booked')
  const harish = (await leadByName(page, 'Harish Reddy'))!
  expect(harish.deal?.bookingAmount).toBe(500_000)
  const after = await readDb(page)
  expect(after.clients.length).toBe(before.clients.length + 1)
  expect(after.properties.find((p) => p.id === harish.deal?.propertyId)?.status).toBe('booked')
  expect(after.notifications.some((n) => n.userId === 'u-rohit' && n.kind === 'booking' && !before.notifications.some((b) => b.id === n.id))).toBe(true)

  await drag(page, card('Sanjay Gupta'), col('lost'))
  await expect(dialog).toContainText('Why was the lead lost?')
  await dialog.getByTestId('stage-confirm').click()
  await expect(dialog).toContainText('Choose why the lead was lost')
  await dialog.getByRole('combobox').nth(1).click()
  for (const r of ['Budget mismatch', 'Bought elsewhere', 'Not responding', 'Location not suitable', 'Loan rejected', 'Other']) await expect(page.getByRole('option', { name: r })).toBeVisible()
  await page.getByRole('option', { name: 'Budget mismatch' }).click()
  await dialog.getByTestId('stage-confirm').click()
  await expect.poll(async () => (await leadByName(page, 'Sanjay Gupta'))!.lost?.reason).toBe('budgetMismatch')
  await expect(col('lost').getByRole('link', { name: 'Sanjay Gupta', exact: true })).toBeVisible()
  await page.screenshot({ path: 'notes/screens/qa/executive/pipeline-sneha.png', fullPage: true })
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── Matching ─────────────────────────────

test('Arjun matches both ways: buyer → homes (shortlist, WhatsApp share, not interested) and home → his buyers', async ({ page, consoleProblems }) => {
  await stubWindowOpen(page)
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/matching?lead=LEAD-1003')
  const grid = page.getByTestId('match-grid')
  await expect(grid.getByTestId('property-card').first()).toBeVisible()
  const first = grid.getByTestId('property-card').first()
  const propertyId = (await first.locator('h3 a').getAttribute('href'))!.split('/').pop()!
  const status = async () => (await readDb(page)).leads.find((l) => l.id === 'LEAD-1003')!.shortlist.find((s) => s.propertyId === propertyId)?.status
  await first.getByRole('button', { name: /^shortlist$/i }).click()
  await expect.poll(status).toBe('shortlisted')
  await first.getByRole('button', { name: /share/i }).click()
  const share = page.getByTestId('share-dialog')
  await expect(share.getByTestId('share-message')).not.toBeEmpty()
  await share.getByTestId('share-open-whatsapp').click()
  await expect.poll(status).toBe('shared')
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual([expect.stringContaining('wa.me/')])
  await first.getByRole('button', { name: /not interested/i }).click()
  await expect.poll(status).toBe('notInterested')
  await expect(grid.locator(`h3 a[href$="/${propertyId}"]`)).toHaveCount(0)

  // property → buyers: only Arjun's own leads, with one-click actions
  await page.goto('/matching?property=PRP-1002')
  const list = page.getByTestId('match-list').first()
  await expect(list.locator('li').first()).toBeVisible()
  const db = await readDb(page)
  const others = db.leads.filter((l) => l.ownerId !== 'u-arjun').map((l) => l.name)
  const text = await list.innerText()
  for (const n of others) expect(text).not.toContain(n)
  const irfan = list.locator('li').filter({ hasText: 'Mohammed Irfan' })
  await irfan.getByRole('button', { name: /^shortlist$/i }).click()
  await expect.poll(async () => (await readDb(page)).leads.find((l) => l.name === 'Mohammed Irfan')!.shortlist.find((s) => s.propertyId === 'PRP-1002')?.status).toBe('shortlisted')
  await page.screenshot({ path: 'notes/screens/qa/executive/matching-property-arjun.png' })
  expect(consoleProblems).toEqual([])
})

test('Sneha and Vikram only see their own buyers for any available property', async ({ page, consoleProblems }) => {
  test.setTimeout(240_000)
  await page.goto('/today')
  for (const e of EXECS.slice(1)) {
    await switchTo(page, e.testId)
    const db = await readDb(page)
    const others = db.leads.filter((l) => l.ownerId !== e.id).map((l) => l.name)
    for (const p of db.properties.filter((x) => x.status === 'available').slice(0, 6)) {
      await go(page, `/matching?property=${p.id}`)
      await expect(page.getByTestId('match-count')).toBeVisible()
      const text = await page.locator('main').innerText()
      for (const n of others) expect(text, `${e.first} sees ${n} on ${p.id}`).not.toContain(n)
    }
    await go(page, '/today')
  }
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── My performance and AI ─────────────────────────────

test('My performance: each executive gets a personal report with no export', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  for (const e of EXECS) {
    await switchTo(page, e.testId)
    await page.getByTestId('sidebar').getByTestId('nav-reports').click()
    await expect(page.locator('main h1')).toHaveText('My performance')
    await expect(page.getByTestId('report-kpis')).toBeVisible()
    await expect(page.locator('main')).toContainText('Me ·')
    await expect(page.locator('main').getByRole('button', { name: /export|csv|download/i })).toHaveCount(0)
    await page.getByTestId('summary-line').first().click()
    await expect(page.getByTestId('drill-drawer')).toBeVisible()
    const db = await readDb(page)
    const others = db.leads.filter((l) => l.ownerId !== e.id).map((l) => l.name)
    const drawer = await page.getByTestId('drill-drawer').innerText()
    for (const n of others) expect(drawer, `${e.first}'s drill-down lists ${n}`).not.toContain(n)
    await page.keyboard.press('Escape')
    await page.screenshot({ path: `notes/screens/qa/executive/report-${e.first.toLowerCase()}.png`, fullPage: true })
  }
  expect(consoleProblems).toEqual([])
})

test('the assistant refuses what an executive may not do and offers the allowed alternative', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-sneha')
  const del = await askPanel(page, 'delete lead Sanjay Gupta')
  await expect(del).toContainText("can't delete leads")
  await expect(del.getByRole('button', { name: /lost/i })).toBeVisible()
  const asg = await askPanel(page, 'assign Divya Menon to Arjun')
  await expect(asg).toContainText("can't reassign")
  await expect(asg.getByRole('button', { name: /Ask my manager/i })).toBeVisible()
  const team = await askPanel(page, 'Who is overloaded today?')
  await expect(team).toContainText('The team view is for managers and admins.')
  expect((await leadByName(page, 'Sanjay Gupta'))!.ownerId).toBe('u-sneha')
  expect((await leadByName(page, 'Divya Menon'))!.ownerId).toBe('u-sneha')
  expect(consoleProblems).toEqual([])
})

test('asking about another executive\'s lead says it is not on your list instead of answering something else (EXE-9)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  // Divya Menon belongs to Sneha
  const a = await askPanel(page, 'summarise Divya Menon')
  await page.getByTestId('ai-panel').screenshot({ path: 'notes/screens/qa/executive/exe-9-summarise-other-lead.png' })
  await expect(a).toContainText(/Divya|not on your list|can't find|couldn't find/i)
  expect(consoleProblems).toEqual([])
})

test('Today Ask understands a Hinglish follow-up reschedule (EXE-10)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-vikram')
  await page.getByTestId('today-ai-input').fill('Rohan ka follow-up kal shaam 6 baje karo')
  await page.getByTestId('today-ai-input').press('Enter')
  await page.waitForTimeout(800)
  await page.getByTestId('today-ai').screenshot({ path: 'notes/screens/qa/executive/exe-10-hinglish-reschedule.png' })
  await expect(page.getByTestId('today-ai').getByTestId('proposal-confirm')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

// ───────────────────────────── Round 2: assistant commands for Arjun ─────────────────────────────

test('R2: Arjun drives the assistant: create a lead, which properties suit, create task, add note (XAI-1, XAI-4, XAI-6, XAI-7)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const create = await askPanel(page, 'create a lead for Sanjay Mehra 9988776655 looking for villa in Sarjapur under 2 Cr')
  await expect(create).toContainText('Sanjay Mehra')
  await create.getByTestId('proposal-confirm').click()
  const lead = await leadByName(page, 'Sanjay Mehra')
  expect(lead?.ownerId).toBe('u-arjun')
  expect(lead?.requirement.propertyTypes.join()).toMatch(/villa/i)

  const suit = await askPanel(page, 'which properties suit Ananya Iyer?')
  await expect(suit).toContainText('Neelam Heights')

  const task = await askPanel(page, 'create task: send brochure to Deepak tomorrow')
  await expect(task.getByTestId('proposal-confirm')).toBeVisible()
  const before = (await readDb(page)).tasks.length
  await task.getByTestId('proposal-confirm').click()
  await expect.poll(async () => (await readDb(page)).tasks.length).toBe(before + 1)

  const priya0 = (await leadByName(page, 'Priya Sharma'))!
  const note = await askPanel(page, 'add note for Priya: wants east facing')
  await note.getByTestId('proposal-confirm').click()
  const priya = (await leadByName(page, 'Priya Sharma'))!
  expect(priya.requirement.facing).toEqual(priya0.requirement.facing)
  expect((await readDb(page)).activities.some((a) => a.kind === 'note' && a.refs.some((r) => r.id === priya.id))).toBe(true)
  expect(consoleProblems).toEqual([])
})
