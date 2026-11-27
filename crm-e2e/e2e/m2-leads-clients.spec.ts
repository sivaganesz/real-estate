/**
 * M2 Leads, Qualification & Clients e2e journey (plan §8.3 M2; master prompt §8, §9, §10, §12.3, §12.6).
 * Every step goes through the real UI as the role that would do it, and checks the saved data in the persisted store:
 * paste-and-fill of the Rahul Verma enquiry, the duplicate warning, auto-assign, the lead page (score explanation,
 * qualification chips, next best action, generated messages opening wa.me, edit with AI), mark as lost, bulk stage
 * change with undo, saved views, the executive's own-leads scope with HNI "Restricted" and no delete, and the clients
 * list / detail with the documents checklist.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Lead = {
  id: string; name: string; phone: string; ownerId: string | null; stage: string; source: string
  requirement: { configurations: string[]; localities: string[]; budgetMax?: number; possession?: string }
  qualification: { timeline?: string; decisionMakers: string[]; loan?: string }
  lost?: { reason: string }
}
type Client = { id: string; name: string; documents: { name: string; status: string }[] }
type Db = { leads: Lead[]; clients: Client[]; activities: { kind: string; refs: { kind: string; id: string }[]; channel?: string }[]; savedViews?: { name: string }[] }

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)
const lead = async (page: Page, name: string) => (await readDb(page)).leads.find((l) => l.name === name)

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

const RAHUL = "Hi, I'm Rahul Verma, 9845012345. Looking for a 3BHK in Whitefield or Sarjapur, budget around 1.2 Cr, ready to move, need it in 2–3 months. Wife will also decide."

test('manager: paste-and-fill the Rahul Verma enquiry, duplicate warning, auto-assign on save', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'role-manager')
  await expect(page.getByTestId('leads-page')).toBeVisible()

  // duplicate warning first: Mohammed Irfan's phone typed by hand
  await page.getByTestId('leads-add').click()
  const sheet = page.getByRole('dialog')
  await sheet.getByTestId('lead-name').fill('Irfan M')
  await sheet.getByLabel('Mobile').first().fill('98450 98765')
  const dup = sheet.getByTestId('duplicate-warning')
  await expect(dup).toBeVisible()
  await expect(dup).toContainText('Mohammed Irfan')
  await expect(dup).toContainText('Arjun Mehta')
  await expect(dup.getByRole('link', { name: 'Open existing' }).first()).toHaveAttribute('href', /\/leads\/LEAD-/)
  // closing a dirty sheet asks first
  await page.keyboard.press('Escape')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click()
  await expect(sheet).toBeHidden()

  // paste-and-fill
  await page.getByTestId('leads-paste').click()
  await sheet.getByTestId('paste-text').fill(RAHUL)
  await sheet.getByTestId('paste-extract').click()
  await expect(sheet.getByTestId('lead-name')).toHaveValue('Rahul Verma')
  await expect(sheet.getByText('Demo AI').first()).toBeVisible()
  // only the missing essential (source) is asked as chips
  await sheet.getByRole('button', { name: 'Walk-in', exact: true }).first().click()
  await sheet.getByTestId('lead-next').click()
  await expect(sheet.getByTestId('fit-line')).toBeVisible()
  await sheet.getByTestId('lead-next').click()
  await expect(sheet.getByTestId('lead-timeline').getByRole('button', { pressed: true })).toHaveCount(1)
  await expect(sheet.getByTestId('lead-decision').getByRole('button', { name: 'Spouse' })).toHaveAttribute('aria-pressed', 'true')
  await sheet.getByTestId('lead-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
  await expect(page.getByText(/Assigned to|assigned to/).first()).toBeVisible()

  const rahul = (await lead(page, 'Rahul Verma'))!
  expect(rahul.phone).toBe('+919845012345')
  expect(rahul.requirement.configurations).toEqual(['3BHK'])
  expect(rahul.requirement.localities).toEqual(['Whitefield', 'Sarjapur Road'])
  expect(rahul.requirement.budgetMax).toBe(12_000_000)
  expect(rahul.requirement.possession).toBe('ready')
  expect(rahul.qualification.timeline).toBe('m1to3')
  expect(rahul.qualification.decisionMakers).toContain('spouse')
  expect(rahul.ownerId).not.toBeNull()
  expect(consoleProblems).toEqual([])
})

test('lead page: score explanation, qualification chips, Hinglish message to wa.me, edit with AI, mark as lost', async ({ page, consoleProblems }) => {
  await page.goto('/leads/LEAD-1004')
  await switchTo(page, 'role-manager')
  const main = page.locator('main')
  await expect(page.getByTestId('lead-page')).toBeVisible()
  await expect(main).not.toContainText(/BANT/i)

  await page.getByTestId('score-why').click()
  await expect(page.getByRole('dialog').or(page.locator('[data-slot="popover-content"]')).first()).toContainText(/Budget|Engagement|Stage/)
  await page.keyboard.press('Escape')

  // qualification: 3 of 4 known, asks only the missing decision maker, the chip saves
  const qual = page.getByTestId('qualification-card')
  await expect(qual).toContainText('3 of 4 known')
  await qual.getByRole('button', { name: 'Spouse', exact: true }).click()
  await expect(qual).toContainText('4 of 4 known')
  expect((await lead(page, 'Mohammed Irfan'))!.qualification.decisionMakers).toContain('spouse')

  // next best action is AI-worded with the badge
  await expect(page.getByTestId('next-action')).toContainText('Demo AI')

  // generated message in Hinglish, opening wa.me prefilled, and logging the send
  const composer = page.getByTestId('message-composer')
  const english = await composer.getByTestId('msg-text').inputValue()
  await composer.getByTestId('msg-tone-hinglish').click()
  await expect.poll(() => composer.getByTestId('msg-text').inputValue()).not.toBe(english)
  const send = composer.getByTestId('msg-send')
  await expect(send).toHaveAttribute('href', /^https:\/\/wa\.me\/919845098765\?text=/)
  const before = (await readDb(page)).activities.length
  const popup = page.waitForEvent('popup')
  await send.click()
  await (await popup).close()
  await expect.poll(async () => (await readDb(page)).activities.length).toBe(before + 1)

  // edit with AI
  const edit = page.getByTestId('edit-with-ai')
  await edit.getByTestId('aiedit-text').fill('change budget to 1.5 Cr and add Hebbal')
  await edit.getByTestId('aiedit-read').click()
  await edit.getByTestId('aiedit-apply').click()
  await expect.poll(async () => (await lead(page, 'Mohammed Irfan'))!.requirement.budgetMax).toBe(15_000_000)
  expect((await lead(page, 'Mohammed Irfan'))!.requirement.localities).toContain('Hebbal')

  // mark as lost needs a reason
  await page.getByTestId('mark-lost').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('stage-confirm')).toBeVisible()
  await dialog.getByRole('combobox').last().click()
  await page.getByRole('option', { name: 'Bought elsewhere' }).click()
  await dialog.getByTestId('stage-confirm').click()
  await expect.poll(async () => (await lead(page, 'Mohammed Irfan'))!.lost?.reason).toBe('boughtElsewhere')
  expect(consoleProblems).toEqual([])
})

test('manager list: Unassigned tab, bulk stage change with undo, saved view', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'role-manager')
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.getByRole('button', { name: /^Unassigned \d+$/ }).click()
  await expect(page).toHaveURL(/tab=unassigned/)
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  await expect(page.locator('tbody')).toContainText('Unassigned')

  // bulk stage → Negotiation, then Undo restores both
  const names = await rows.locator('p.font-semibold').evaluateAll((els) => els.slice(0, 2).map((e) => (e.firstChild?.textContent ?? '').trim()))
  const stagesBefore = await Promise.all(names.map(async (n) => (await lead(page, n))!.stage))
  await rows.nth(0).getByRole('checkbox').click()
  await rows.nth(1).getByRole('checkbox').click()
  await page.getByTestId('bulk-stage').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Negotiation' }).click()
  await page.getByTestId('bulk-stage-confirm').click()
  await expect.poll(async () => (await lead(page, names[0]))!.stage).toBe('negotiation')
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await lead(page, names[0]))!.stage).toBe(stagesBefore[0])
  expect((await lead(page, names[1]))!.stage).toBe(stagesBefore[1])

  // saved view: filter hot, save, clear, re-apply
  await page.getByRole('button', { name: /^All \d+$/ }).click()
  await page.getByRole('button', { name: /Hot leads/i }).first().click()
  await page.getByTestId('saved-views').click()
  await page.getByRole('menuitem', { name: /Save current view/ }).click()
  await page.getByTestId('view-name').fill('My hot ones')
  await page.getByTestId('view-save').click()
  await expect(page.getByText('View “My hot ones” saved')).toBeVisible()
  await page.getByTestId('saved-views').click()
  await expect(page.getByRole('menuitem', { name: /My hot ones/ })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(consoleProblems).toEqual([])
})

test('executive: own leads only, no Unassigned tab or delete, HNI restricted, other leads blocked', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'profile-u-sneha')
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Unassigned \d+$/ })).toHaveCount(0)
  await expect(page.locator('tbody tr').first()).toBeVisible()
  const db = await readDb(page)
  const own = db.leads.filter((l) => l.ownerId === 'u-sneha').map((l) => l.name)
  const shown = await page.locator('tbody tr p.font-semibold').evaluateAll((els) => els.map((e) => (e.firstChild?.textContent ?? '').trim()))
  expect(shown.length).toBeGreaterThan(0)
  for (const n of shown) expect(own).toContain(n)

  await page.locator('tbody tr').first().getByRole('checkbox').click()
  await expect(page.getByTestId('bulk-stage')).toBeVisible()
  await expect(page.getByTestId('bulk-delete')).toHaveCount(0)

  // Lakshmi Narayanan is a potential HNI: Sneha sees "Restricted"
  await page.goto('/leads/LEAD-1007')
  await expect(page.getByTestId('hni-restricted')).toBeVisible()
  // Arjun's lead is not reachable
  await page.goto('/leads/LEAD-1004')
  await expect(page.getByTestId('lead-page')).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('clients: list, detail, documents checklist moves a document to verified', async ({ page, consoleProblems }) => {
  await page.goto('/clients')
  await switchTo(page, 'role-manager')
  await expect(page.getByTestId('clients-page')).toBeVisible()
  await page.locator('tbody tr').first().click()
  await expect(page).toHaveURL(/\/clients\/CL-\d+$/)
  await expect(page.getByTestId('client-journey')).toBeVisible()
  const id = page.url().split('/').pop()!
  const docs = page.getByTestId('client-docs')
  const c = (await readDb(page)).clients.find((x) => x.id === id)!
  const pending = c.documents.find((d) => d.status !== 'verified')
  if (pending) {
    await docs.getByRole('group').filter({ hasText: 'Verified' }).nth(c.documents.indexOf(pending)).getByRole('button', { name: 'Verified' }).click()
    await expect.poll(async () => (await readDb(page)).clients.find((x) => x.id === id)!.documents.find((d) => d.name === pending.name)?.status).toBe('verified')
  }
  expect(consoleProblems).toEqual([])
})

test('executive Arjun: next best action completes the overdue task, request reassignment notifies the manager', async ({ page, consoleProblems }) => {
  await page.goto('/leads/LEAD-1004')
  await switchTo(page, 'profile-u-arjun')
  await expect(page.getByTestId('lead-page')).toBeVisible()
  await expect(page.getByTestId('qa-assign')).toHaveCount(0)
  await expect(page.getByTestId('lead-more')).toBeVisible()

  // the next best action is the overdue call task: one click closes it
  await page.getByTestId('next-action-do').click()
  await expect.poll(async () => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db')!) as { state: { db: { tasks: { id: string; status: string }[] } } }).state.db.tasks.find((x) => x.id === 'TSK-1001')?.status)).toBe('done')

  const before = await page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db')!) as { state: { db: { notifications: unknown[] } } }).state.db.notifications.length)
  await page.getByTestId('qa-request').click()
  await page.getByRole('dialog').getByRole('textbox').fill('Client wants a Tamil speaker')
  await page.getByTestId('request-reassign-send').click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect.poll(async () => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db')!) as { state: { db: { notifications: unknown[] } } }).state.db.notifications.length)).toBeGreaterThan(before)
  expect(consoleProblems).toEqual([])
})

test('admin: bulk delete confirms and Undo brings the leads back', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'role-admin')
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  const total = (await readDb(page)).leads.length
  await rows.nth(0).getByRole('checkbox').click()
  await rows.nth(1).getByRole('checkbox').click()
  await page.getByTestId('bulk-delete').click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: /Delete/ }).click()
  await expect.poll(async () => (await readDb(page)).leads.length).toBe(total - 2)
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(async () => (await readDb(page)).leads.length).toBe(total)
  expect(consoleProblems).toEqual([])
})

test('phone: leads (every view), lead page and clients have no sideways scroll @phone', async ({ page, consoleProblems }) => {
  for (const url of ['/leads?view=focus', '/leads?view=table', '/leads?view=cards', '/leads/LEAD-1004', '/clients', '/clients/CL-1013']) {
    await page.goto(url)
    await expect(page.locator('main h1')).toBeVisible()
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), url).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
  }
  expect(consoleProblems).toEqual([])
})
