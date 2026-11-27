/**
 * M4 Appointments & Tasks journeys (foundation-plan §8.3 M4, master prompt §16 / §17 tasks), driven through the real
 * UI and the real profile switcher. Each test starts from a fresh seed (see fixtures.ts) and asserts that the change
 * reached the persisted store, not only the screen, and that the console stayed clean.
 *
 * Seed facts used (data/seed/appointments.ts, relative to "today"): Vikram has a site visit with LEAD-1012 at
 * day+5 11:30; Arjun has an upcoming office meeting APT-1008 (day+1 11:00, office location with a map link) and a
 * past site visit still waiting for its outcome; APT-1007 belongs to Vikram.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Appt = { id: string; type: string; status: string; start: string; ownerId: string; leadId?: string; propertyIds: string[]; outcome?: { result: string }; cancelReason?: string }
type Task = { id: string; title: string; status: string; type: string; dueAt: string; ownerId: string; leadId?: string; appointmentId?: string; callResult?: string; autoReason?: string }
type Lead = { id: string; name: string; ownerId: string | null; stage: string }
type Db = { appointments: Appt[]; tasks: Task[]; leads: Lead[]; activities: { kind: string; leadId?: string }[] }

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(page.getByTestId('profile-picker')).toBeHidden()
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d }
/** Raw i18next keys that leaked to the screen ("kpi.today", "appointments:title"). */
const LEAKED_KEY = /\b(appointments|tasks|domain|catalogue|common):[a-z]|\b(kpi|view|filter|form|outcome|row|tab|quick|assistant|actions|detail|bulk|group|empty|legend|grid|slots|conflict)\.[a-z][A-Za-z]+\b/

test('calendar: four views, legend and executive filters, current-time line, no leaked keys', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  await page.getByTestId('sidebar').getByTestId('nav-appointments').click()
  await expect(page.getByTestId('appointments-page')).toBeVisible()
  await expect(page.getByTestId('time-grid')).toBeVisible()
  const hour = new Date().getHours()
  if (hour >= 8 && hour < 20) await expect(page.getByTestId('now-line')).toHaveCount(1)

  // colour-by-type legend chips filter the grid
  const allEvents = await page.getByTestId('calendar-event').count()
  expect(allEvents).toBeGreaterThan(3)
  await page.getByTestId('legend-siteVisit').click()
  await expect(page.getByTestId('legend-siteVisit')).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.getByTestId('calendar-event').count()).toBeLessThan(allEvents)
  await page.getByTestId('legend-siteVisit').click()
  await expect.poll(() => page.getByTestId('calendar-event').count()).toBe(allEvents)

  // managers get the executive filter
  await expect(page.getByRole('button', { name: /Executive/ })).toBeVisible()

  for (const [label, testId] of [['Day', 'time-grid'], ['Month', 'month-grid'], ['List', 'agenda-list'], ['Week', 'time-grid']] as const) {
    await page.getByRole('navigation', { name: 'Calendar view' }).getByRole('button', { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`view=${label.toLowerCase()}`))
    await expect(page.getByTestId(testId)).toBeVisible()
  }
  await expect(page.locator('body')).not.toContainText(LEAKED_KEY)

  // executives see only their own calendar and no executive filter
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/appointments?view=list')
  await expect(page.getByTestId('agenda-list')).toBeVisible()
  await expect(page.getByRole('button', { name: /Executive/ })).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('book from a calendar slot: a double booking warns ("Book anyway") but never blocks', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  const before = await readDb(page)
  const day = dayKey(plusDays(5))
  const clash = before.appointments.find((a) => a.ownerId === 'u-vikram' && a.start.startsWith('') && dayKey(new Date(a.start)) === day)!
  expect(clash).toBeTruthy()
  const lead = before.leads.find((l) => l.ownerId === 'u-vikram' && l.id !== clash.leadId && !['booked', 'lost'].includes(l.stage))!

  await page.goto(`/appointments?view=day&date=${day}`)
  // filter the calendar to Vikram so a clicked slot books for him
  await page.getByRole('button', { name: /Executive/ }).click()
  await page.getByRole('option', { name: /Vikram/ }).click()
  await page.keyboard.press('Escape')
  const clashHour = new Date(clash.start).getHours()
  await page.getByRole('button', { name: new RegExp(`^Book at ${clashHour % 12 || 12}:00`, 'i') }).click()

  const form = page.getByTestId('appointment-form')
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: 'Office meeting' }).click()
  await form.getByRole('combobox').first().click()
  await page.getByRole('option', { name: new RegExp(`^${lead.name}`) }).click()
  await expect(form.getByTestId('conflict-warning')).toContainText('Vikram')
  await expect(form.getByTestId('conflict-warning')).toContainText('already has')
  await expect(form.getByTestId('slot-suggestions').getByTestId('demo-ai-badge')).toBeVisible()
  await expect(form.getByTestId('appointment-save')).toHaveText('Book anyway')
  await form.getByTestId('appointment-save').click()
  await expect(form).toBeHidden()

  await expect.poll(async () => (await readDb(page)).appointments.length).toBe(before.appointments.length + 1)
  const created = (await readDb(page)).appointments.find((a) => !before.appointments.some((b) => b.id === a.id))!
  expect(created).toMatchObject({ type: 'officeMeeting', ownerId: 'u-vikram', leadId: lead.id })
  expect(dayKey(new Date(created.start))).toBe(day)
  expect(consoleProblems).toEqual([])
})

test('paste-and-fill books a site visit and moves the lead stage', async ({ page, consoleProblems }) => {
  await page.goto('/appointments')
  await switchTo(page, 'profile-u-arjun')
  const before = await readDb(page)
  await page.getByTestId('book-ai').click()
  const form = page.getByTestId('appointment-form')
  await form.getByTestId('paste-text').fill('Site visit with Priya tomorrow 11 am at Aranya Greens')
  await form.getByTestId('paste-extract').click()
  await expect(form.getByTestId('demo-ai-badge').first()).toBeVisible()
  await expect(form.getByRole('combobox').first()).toContainText('Priya Sharma')
  await expect(form.getByText('Aranya Greens').first()).toBeVisible()
  await form.getByTestId('appointment-save').click()
  await expect(form).toBeHidden()

  await expect.poll(async () => (await readDb(page)).appointments.length).toBe(before.appointments.length + 1)
  const after = await readDb(page)
  const created = after.appointments.find((a) => !before.appointments.some((b) => b.id === a.id))!
  expect(created).toMatchObject({ type: 'siteVisit', leadId: 'LEAD-1001', ownerId: 'u-arjun' })
  expect(created.propertyIds.length).toBeGreaterThan(0)
  expect(dayKey(new Date(created.start))).toBe(dayKey(plusDays(1)))
  expect(new Date(created.start).getHours()).toBe(11)
  const priya = after.leads.find((l) => l.id === 'LEAD-1001')!
  expect(['new', 'contacted', 'qualified']).not.toContain(priya.stage)
  expect(consoleProblems).toEqual([])
})

test('a site visit booked from a lead page moves its stage (E6)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const before = await readDb(page)
  const lead = before.leads.find((l) => l.ownerId === 'u-arjun' && ['new', 'contacted', 'qualified'].includes(l.stage))!
  expect(lead).toBeTruthy()
  await page.goto(`/leads/${lead.id}`)
  await page.getByTestId('qa-visit').first().click()
  const form = page.getByTestId('appointment-form')
  await expect(form).toBeVisible()
  await expect(form.getByRole('combobox').first()).toContainText(lead.name)
  await form.locator('button', { hasText: 'Add property' }).click()
  await page.getByRole('dialog').last().locator('ul button').first().click()
  await page.keyboard.press('Escape')
  await form.getByTestId('slot-suggestions').getByRole('button').first().click()
  await form.getByTestId('appointment-save').click()
  await expect(form).toBeHidden()
  await expect.poll(async () => (await readDb(page)).leads.find((l) => l.id === lead.id)!.stage).toBe('siteVisitScheduled')
  expect((await readDb(page)).appointments.some((a) => a.leadId === lead.id && a.type === 'siteVisit' && !before.appointments.some((b) => b.id === a.id))).toBe(true)
  expect(consoleProblems).toEqual([])
})

test('detail: AI prep points, WhatsApp confirmation with map link, confirm, cancel with reason and Undo', async ({ page, consoleProblems }) => {
  await page.goto('/appointments')
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/appointments/APT-1008')
  await expect(page.getByTestId('appointment-page')).toBeVisible()

  const prep = page.getByTestId('visit-prep')
  await expect(prep).toBeVisible()
  await expect(prep.getByTestId('demo-ai-badge')).toBeVisible()
  await expect(prep.getByTestId('ai-points').locator('li').first()).toBeVisible()

  const wa = page.getByTestId('whatsapp-confirm')
  await expect(wa).toBeVisible()
  await expect(wa.getByTestId('whatsapp-text')).toHaveValue(/google\.com\/maps/)
  await expect(wa.getByTestId('whatsapp-send')).toHaveAttribute('href', /wa\.me/)
  await expect(page.getByTestId('map-link')).toHaveAttribute('href', /google\.com\/maps/)

  await page.getByTestId('appt-confirm').click()
  await expect(page.getByTestId('appointment-status')).toHaveText('Confirmed')
  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === 'APT-1008')!.status).toBe('confirmed')

  await page.getByTestId('appt-more').click()
  await page.getByTestId('appt-cancel').click()
  const dlg = page.getByTestId('cancel-dialog')
  await expect(dlg).toBeVisible()
  await dlg.getByRole('button').filter({ hasText: /client/i }).first().click()
  await dlg.getByTestId('cancel-confirm').click()
  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === 'APT-1008')!.status).toBe('cancelled')
  expect((await readDb(page)).appointments.find((a) => a.id === 'APT-1008')!.cancelReason).toBeTruthy()
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === 'APT-1008')!.status).toBe('confirmed')
  expect(consoleProblems).toEqual([])
})

test('outcome: describe the visit, apply the AI follow-up + stage, save completes it and creates the follow-up', async ({ page, consoleProblems }) => {
  await page.goto('/appointments')
  await switchTo(page, 'profile-u-arjun')
  const before = await readDb(page)
  const dayAgo = Date.now() - 86_400_000
  const pending = before.appointments.find((a) => a.ownerId === 'u-arjun' && a.type === 'siteVisit' && ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start).getTime() < dayAgo)!
  expect(pending).toBeTruthy()
  const stageBefore = before.leads.find((l) => l.id === pending.leadId)!.stage

  await page.goto(`/appointments/${pending.id}`)
  await page.getByTestId('appt-outcome').click()
  const dlg = page.getByTestId('outcome-dialog')
  await expect(dlg).toBeVisible()
  await dlg.getByRole('button', { name: /Describe the visit/ }).click()
  await dlg.getByRole('textbox', { name: /Describe the visit/ }).fill('Visit went well, they really liked it. Wife was there. Worried about the price. Want to meet again next week to negotiate.')
  await dlg.getByTestId('outcome-extract').click()
  await expect(dlg.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1)
  const suggestion = dlg.getByTestId('outcome-suggestion')
  await expect(suggestion).toBeVisible()
  await expect(suggestion.getByTestId('demo-ai-badge')).toBeVisible()
  await suggestion.getByTestId('apply-suggestion').click()
  await dlg.getByTestId('outcome-save').click()
  await expect(dlg).toBeHidden()

  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === pending.id)!.status).toBe('completed')
  const after = await readDb(page)
  const done = after.appointments.find((a) => a.id === pending.id)! as Appt & { outcome?: { result: string; nextFollowUpAt?: string } }
  expect(done.outcome?.result).toBe('interested')
  // the applied AI follow-up time is stored and drives the E7 post-visit task
  expect(done.outcome?.nextFollowUpAt).toBeTruthy()
  const followUp = after.tasks.find((x) => x.appointmentId === pending.id && x.status === 'open')
  expect(followUp?.dueAt).toBe(done.outcome?.nextFollowUpAt)
  // the stage moved forward (the applied suggestion, at least "site visit done")
  const stageAfter = after.leads.find((l) => l.id === pending.leadId)!.stage
  expect(stageAfter).not.toBe(stageBefore)
  await expect(page.getByTestId('visit-summary')).toBeVisible()
  await expect(page.getByTestId('visit-summary').getByTestId('demo-ai-badge')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('reschedule from a free slot, no-show with Undo, delete with confirm and Undo', async ({ page, consoleProblems }) => {
  await page.goto('/appointments')
  await switchTo(page, 'role-manager')

  // reschedule APT-1012 (Vikram, day+5) to a suggested free slot → status "rescheduled", new time stored
  await page.goto('/appointments/APT-1012')
  const original = (await readDb(page)).appointments.find((a) => a.id === 'APT-1012')!
  await page.getByTestId('appt-reschedule').click()
  const dlg = page.getByTestId('reschedule-dialog')
  await expect(dlg.getByTestId('slot-suggestions').getByTestId('demo-ai-badge')).toBeVisible()
  await dlg.getByTestId('slot-suggestions').getByRole('button').first().click()
  await dlg.getByTestId('reschedule-save').click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === 'APT-1012')!.status).toBe('rescheduled')
  expect((await readDb(page)).appointments.find((a) => a.id === 'APT-1012')!.start).not.toBe(original.start)

  // no-show on a past appointment still waiting for its outcome, then Undo
  const past = (await readDb(page)).appointments.find((a) => ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start).getTime() < Date.now() - 86_400_000)!
  await page.goto(`/appointments/${past.id}`)
  await page.getByTestId('appt-more').click()
  await page.getByTestId('appt-noShow').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'No-show' }).click()
  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === past.id)!.status).toBe('noShow')
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await readDb(page)).appointments.find((a) => a.id === past.id)!.status).toBe(past.status)

  // delete with confirm, lands back on the calendar, Undo restores it
  await page.goto('/appointments/APT-1013')
  await page.getByTestId('appt-more').click()
  await page.getByTestId('appt-delete').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/appointments\?view=day/)
  await expect.poll(async () => (await readDb(page)).appointments.some((a) => a.id === 'APT-1013')).toBe(false)
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await readDb(page)).appointments.some((a) => a.id === 'APT-1013')).toBe(true)
  expect(consoleProblems).toEqual([])
})

test('an executive cannot open someone else\'s appointment', async ({ page, consoleProblems }) => {
  await page.goto('/appointments')
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/appointments/APT-1007')
  await expect(page.getByTestId('appointment-page')).toHaveCount(0)
  await expect(page.getByText("This appointment isn't yours")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('tasks: tabs, quick add, call result with auto retry, reschedule with Undo, bulk complete', async ({ page, consoleProblems }) => {
  await page.goto('/tasks')
  await switchTo(page, 'profile-u-arjun')
  await expect(page.getByTestId('tasks-page')).toBeVisible()
  for (const tab of ['overdue', 'today', 'upcoming', 'done']) await expect(page.getByTestId(`tab-count-${tab}`)).toBeVisible()
  const before = await readDb(page)
  expect(before.tasks.length).toBeGreaterThan(0)

  // quick add: title + due chip + lead
  await page.getByTestId('quick-title').fill('Send the brochure to Priya')
  await page.getByTestId('quick-add').getByRole('combobox').click()
  await page.getByRole('option', { name: /^Priya Sharma/ }).click()
  await page.getByTestId('quick-submit').click()
  await expect.poll(async () => (await readDb(page)).tasks.some((x) => x.title === 'Send the brochure to Priya' && x.leadId === 'LEAD-1001')).toBe(true)

  // complete a call task with "Not reachable" → the automatic retry task appears (E4)
  const call = before.tasks.find((x) => x.ownerId === 'u-arjun' && x.status === 'open' && x.type === 'call' && x.leadId)!
  expect(call).toBeTruthy()
  await page.getByTestId('tasks-page').getByPlaceholder(/Search/).fill(call.title)
  for (const tab of ['Overdue', 'Today', 'Upcoming']) {
    await page.getByRole('navigation', { name: 'Task tabs' }).getByRole('button', { name: new RegExp(`^${tab}`) }).click()
    if (await page.getByTestId('task-row').filter({ hasText: call.title }).count()) break
  }
  const row = page.getByTestId('task-row').filter({ hasText: call.title }).first()
  await row.getByTestId('task-done').click()
  await page.getByTestId('call-result').getByTestId('call-notReachable').click()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.id === call.id)!.status).toBe('done')
  const afterCall = await readDb(page)
  expect(afterCall.tasks.find((x) => x.id === call.id)!.callResult).toBe('notReachable')
  expect(afterCall.tasks.filter((x) => x.leadId === call.leadId && x.status === 'open' && !before.tasks.some((b) => b.id === x.id)).length).toBeGreaterThan(0)
  await page.getByTestId('tasks-page').getByPlaceholder(/Search/).fill('')

  // reschedule chips with Undo
  await page.getByRole('navigation', { name: 'Task tabs' }).getByRole('button', { name: /^Upcoming/ }).click()
  const target = page.getByTestId('task-row').first()
  const title = (await target.locator('p').first().innerText()).trim()
  const original = (await readDb(page)).tasks.find((x) => x.title === title && x.status === 'open')!
  await target.getByTestId('task-reschedule').click()
  await page.getByRole('menuitem', { name: 'Next week' }).click()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.id === original.id)!.dueAt).not.toBe(original.dueAt)
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await readDb(page)).tasks.find((x) => x.id === original.id)!.dueAt).toBe(original.dueAt)

  // bulk complete everything on the Upcoming tab
  const openUpcoming = await page.getByTestId('task-row').count()
  expect(openUpcoming).toBeGreaterThan(1)
  await page.getByTestId('select-all').click()
  await page.getByTestId('bulk-complete').click()
  await expect(page.getByTestId('tab-count-upcoming')).toHaveText('0')
  expect(consoleProblems).toEqual([])
})

test('tasks with AI: say it in your words → confirm, and the Follow-up Assistant suggests a time and drafts', async ({ page, consoleProblems }) => {
  await page.goto('/tasks')
  await switchTo(page, 'profile-u-arjun')
  const before = await readDb(page)

  await page.getByTestId('quick-add').getByRole('button', { name: /Say it in your words/ }).click()
  await page.getByTestId('quick-ai-text').fill('Remind me to call Priya Sharma tomorrow at 5 pm about the loan')
  await page.getByTestId('quick-ai-read').click()
  await expect(page.getByTestId('quick-add').getByTestId('demo-ai-badge')).toBeVisible()
  await expect(page.getByTestId('action-proposal')).toBeVisible()
  // nothing is created before Confirm
  expect((await readDb(page)).tasks.length).toBe(before.tasks.length)
  await page.getByTestId('proposal-confirm').click()
  await expect.poll(async () => (await readDb(page)).tasks.length).toBe(before.tasks.length + 1)
  const created = (await readDb(page)).tasks.find((x) => !before.tasks.some((b) => b.id === x.id))!
  expect(created.leadId).toBe('LEAD-1001')
  expect(dayKey(new Date(created.dueAt))).toBe(dayKey(plusDays(1)))

  await page.getByTestId('open-assistant').click()
  const list = page.getByTestId('assistant-list')
  await expect(list).toBeVisible()
  await expect(page.getByTestId('demo-ai-badge').first()).toBeVisible()
  const card = list.getByTestId('assistant-card').first()
  const toggle = card.locator('button[aria-expanded]').first()
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(card.getByRole('textbox')).not.toHaveValue('')
  const snapshot = await readDb(page)
  const useTime = page.getByTestId('assistant-use-time').first()
  if (await useTime.count()) {
    await useTime.click()
    await expect.poll(async () => JSON.stringify((await readDb(page)).tasks.map((x) => x.dueAt))).not.toBe(JSON.stringify(snapshot.tasks.map((x) => x.dueAt)))
  }
  expect(consoleProblems).toEqual([])
})

test('Tamil: calendar and tasks render without leaked keys', async ({ page, consoleProblems }) => {
  await page.goto('/appointments')
  await page.getByTestId('topbar').getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta')
  for (const v of ['week', 'month', 'list']) {
    await page.goto(`/appointments?view=${v}`)
    await expect(page.getByTestId('appointments-page')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(LEAKED_KEY)
  }
  await page.goto('/appointments/APT-1008')
  await expect(page.getByTestId('appointment-page')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(LEAKED_KEY)
  await page.goto('/tasks')
  await expect(page.getByTestId('tasks-page')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(LEAKED_KEY)
  expect(consoleProblems).toEqual([])
})

test('phone: calendar defaults to the day view and nothing scrolls sideways @phone', async ({ page, consoleProblems }) => {
  for (const url of ['/appointments', '/appointments?view=month', '/appointments?view=list', '/appointments/APT-1001', '/tasks']) {
    await page.goto(url)
    await expect(page.locator('main h1')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, url).toBeLessThanOrEqual(0)
  }
  await page.goto('/appointments')
  await expect(page).toHaveURL(/\/appointments$/)
  await expect(page.getByTestId('time-grid')).toBeVisible()
  expect(consoleProblems).toEqual([])
})
