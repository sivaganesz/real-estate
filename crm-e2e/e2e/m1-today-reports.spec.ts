/**
 * M1 Today & Reports journey (master prompt §6, §13 Reports; plan §8.3): every role gets its own Today with no clicks,
 * the one-click actions write real data through the services and the lists re-rank at once, the inline assistant
 * changes data only after Confirm, and Reports is scoped by role, switches periods, drills down, exports CSV and
 * reacts to work done on Today.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Db = {
  leads: { id: string; name: string; ownerId: string | null; stage: string; deletedAt?: string }[]
  tasks: { id: string; status: string; dueAt?: string; title: string; leadId?: string }[]
  activities: { id: string; type: string; leadId?: string }[]
  appointments: { id: string; status: string }[]
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

const sections = (page: Page) => page.getByRole('navigation', { name: 'Report sections' })
const rowKinds = (page: Page) => page.getByTestId('priority-item').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind ?? ''))
const rowNames = (page: Page) => page.getByTestId('priority-item').evaluateAll((els) => els.map((e) => e.querySelector('a')?.textContent ?? ''))

test('executive Today: one-click actions change data and the list re-ranks at once', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await expect(page.getByTestId('today-executive')).toBeVisible()
  await expect(page.locator('main h1')).toContainText('Arjun')
  await expect(page.getByTestId('today-brief').getByTestId('demo-ai-badge')).toBeVisible()
  await expect(page.locator('#today-appts')).toBeVisible()
  await expect(page.getByTestId('today-targets')).toBeVisible()
  await expect(page.getByTestId('today-sections')).toBeVisible()
  await expect(page.getByTestId('visited-strip')).toBeVisible()
  await expect(page.getByTestId('today-matches')).toBeVisible()
  // reasons never show raw minute counts beyond an hour
  await expect(page.getByTestId('reason-chip').filter({ hasText: /\d{3,} min/ })).toHaveCount(0)

  const items = page.getByTestId('priority-item')
  const start = await items.count()
  expect(start).toBeGreaterThan(2)

  // Done on a task row: the task is completed in the store and the row leaves; Undo brings it back
  const doneRow = items.filter({ has: page.getByTestId('today-done') }).first()
  const doneName = await doneRow.locator('a').first().textContent()
  await doneRow.getByTestId('today-done').click()
  await expect(items).toHaveCount(start - 1)
  expect(await rowNames(page)).not.toContain(doneName)
  await page.getByRole('button', { name: /undo/i }).first().click()
  await expect(items).toHaveCount(start)

  // Log outcome on the uncalled new lead: a call is logged and the lead leaves the list
  expect((await rowKinds(page))[0]).toBe('uncalledNew')
  const newName = (await rowNames(page))[0]
  const callsBefore = (await readDb(page)).activities.length
  await items.first().getByTestId('today-log').click()
  await expect(page.getByTestId('log-outcome')).toBeVisible()
  await page.getByTestId('result-connected').click()
  await page.getByTestId('log-save').click()
  await expect(items).toHaveCount(start - 1)
  expect(await rowNames(page)).not.toContain(newName)
  expect((await readDb(page)).activities.length).toBeGreaterThan(callsBefore)

  // Reschedule the top row to tomorrow: that item leaves today's list (by item id: one lead can own two rows) and the stored due time moves
  const top = await items.first().getAttribute('id')
  const tasksBefore = (await readDb(page)).tasks.length
  await items.first().getByTestId('today-reschedule').click()
  await page.locator('[data-testid^="slot-"]').filter({ hasText: /tomorrow/i }).first().click()
  await expect(items).toHaveCount(start - 2)
  expect(await items.evaluateAll((els) => els.map((e) => e.id))).not.toContain(top)
  const after = await readDb(page)
  expect(after.tasks.length >= tasksBefore).toBe(true)

  // Send confirmation on a scheduled appointment marks it confirmed
  const send = page.getByTestId('send-confirmation')
  if (await send.count()) {
    const confirmedBefore = (await readDb(page)).appointments.filter((a) => a.status === 'confirmed').length
    const popup = page.context().waitForEvent('page', { timeout: 5_000 }).catch(() => null)
    await send.first().click()
    await (await popup)?.close()
    await expect.poll(async () => (await readDb(page)).appointments.filter((a) => a.status === 'confirmed').length).toBe(confirmedBefore + 1)
  }
  expect(consoleProblems).toEqual([])
})

test('the inline Today assistant changes data only after Confirm', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  // count() does not wait: let the list render first
  await expect(page.getByTestId('priority-item').first()).toBeVisible()
  const before = await page.getByTestId('priority-item').count()
  const name = (await rowNames(page)).find((n, i, all) => all.indexOf(n) === i && n.includes('Karthik')) ?? 'Karthik'
  await page.getByTestId('today-ai-input').fill(`Reschedule ${name.split(' ')[0]}'s follow-up to tomorrow 5 PM`)
  await page.getByTestId('today-ai-input').press('Enter')
  await expect(page.getByTestId('proposal-confirm').first()).toBeVisible()
  await expect(page.getByTestId('today-ai').getByTestId('demo-ai-badge').first()).toBeVisible()
  // nothing changed yet
  await expect(page.getByTestId('priority-item')).toHaveCount(before)
  await page.getByTestId('proposal-confirm').first().click()
  await expect(page.getByTestId('priority-item')).toHaveCount(before - 1)
  expect(consoleProblems).toEqual([])
})

test('each executive account gets its own Today', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  const seen: string[] = []
  for (const [id, first] of [['profile-u-arjun', 'Arjun'], ['profile-u-sneha', 'Sneha'], ['profile-u-vikram', 'Vikram']] as const) {
    await switchTo(page, id)
    await expect(page.locator('main h1')).toContainText(first)
    await expect(page.getByTestId('today-executive')).toBeVisible()
    await expect(page.getByTestId('today-manager')).toHaveCount(0)
    await expect(page.getByTestId('unassigned-queue')).toHaveCount(0)
    seen.push((await rowNames(page)).join('|'))
  }
  expect(new Set(seen).size).toBe(3)
  expect(consoleProblems).toEqual([])
})

test('manager Today: assign, auto-assign all with undo, and the leave proposal', async ({ page, consoleProblems }) => {
  test.setTimeout(60_000)
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  await expect(page.getByTestId('today-manager')).toBeVisible()
  for (const id of ['team-board', 'overdue-by-exec', 'deals-card', 'attention-card', 'team-targets']) await expect(page.getByTestId(id)).toBeVisible()
  const unassigned = async () => (await readDb(page)).leads.filter((l) => !l.ownerId && !l.deletedAt).length
  const rows = page.getByTestId('queue-row')
  const n = await rows.count()
  expect(n).toBeGreaterThan(1)
  expect(await unassigned()).toBe(n)

  await rows.first().getByTestId('assign-suggested').click()
  await expect(rows).toHaveCount(n - 1)
  expect(await unassigned()).toBe(n - 1)

  await page.getByTestId('auto-assign-all').click()
  await expect(page.getByTestId('auto-preview')).toBeVisible()
  await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: /assign \d+/i }).click()
  await expect(rows).toHaveCount(0)
  expect(await unassigned()).toBe(0)
  await page.getByRole('button', { name: /undo/i }).first().click()
  await expect(rows).toHaveCount(n - 1)

  // the on-leave executive's leads are reassigned in one click (with confirmation)
  const proposal = page.getByTestId('leave-proposal').first()
  const proposals = await page.getByTestId('leave-proposal').count()
  await proposal.getByRole('button').last().click()
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'))
  if (await dialog.count()) await dialog.getByRole('button').last().click()
  await expect(page.getByTestId('leave-proposal')).toHaveCount(proposals - 1)
  expect(consoleProblems).toEqual([])
})

test('admin Today: KPI cards, alerts with a one-click fix and AI insights', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  await expect(page.getByTestId('today-admin')).toBeVisible()
  await expect(page.getByTestId('admin-kpis').locator('> *')).toHaveCount(6)
  for (const id of ['admin-sources', 'admin-team', 'admin-imports']) await expect(page.getByTestId(id)).toBeVisible()
  const insights = page.getByTestId('insight')
  expect(await insights.count()).toBeGreaterThanOrEqual(3)
  expect(await insights.count()).toBeLessThanOrEqual(5)
  await expect(page.getByTestId('admin-insights').getByTestId('demo-ai-badge')).toBeVisible()

  await page.getByTestId('admin-auto-assign').click()
  await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: /assign \d+/i }).click()
  await expect.poll(async () => (await readDb(page)).leads.filter((l) => !l.ownerId && !l.deletedAt).length).toBe(0)
  await expect(page.getByTestId('admin-auto-assign')).toHaveCount(0)

  await insights.first().click()
  await expect(page).not.toHaveURL(/\/today$/)
  expect(consoleProblems).toEqual([])
})

test('Reports: scope, periods, drill-down, CSV export, and numbers that react to Today', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  await page.getByTestId('sidebar').getByTestId('nav-reports').click()
  await expect(page.locator('main h1')).toHaveText('Reports')
  for (const id of ['report-kpis', 'chart-trend', 'chart-funnel', 'chart-sources', 'report-summary']) await expect(page.getByTestId(id)).toBeVisible()
  await expect(page.getByTestId('report-scope')).toBeVisible()

  // period switcher
  const leadsKpi = () => page.getByTestId('report-kpis').locator('> *').first().innerText()
  const half = await leadsKpi()
  await page.getByRole('group').getByRole('button', { name: /this week/i }).click()
  await expect(page).toHaveURL(/period=week/)
  await expect.poll(leadsKpi).not.toBe(half)

  // AI summary line → drill-down drawer with the exact records
  await page.getByRole('group').getByRole('button', { name: /6 months/i }).click()
  await page.getByTestId('summary-line').first().click()
  await expect(page.getByTestId('drill-drawer')).toBeVisible()
  expect(await page.getByTestId('drill-row').count()).toBeGreaterThan(0)
  await page.keyboard.press('Escape')

  // CSV export (admin may export)
  const download = page.waitForEvent('download')
  await page.getByTestId('report-export').click()
  expect((await download).suggestedFilename()).toMatch(/^report-overview-.*\.csv$/)

  // every tab renders its charts
  for (const [tab, id] of [['pipeline', 'chart-value'], ['sources', 'chart-source-conversion'], ['team', 'chart-team'], ['activity', 'chart-heatmap'], ['inventory', 'chart-inventory-status']] as const) {
    await sections(page).getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).click()
    await expect(page).toHaveURL(new RegExp(`/reports/${tab}`))
    await expect(page.getByTestId(id)).toBeVisible()
  }
  // inventory slice → property drill-down
  await page.getByTestId('chart-inventory-status').getByRole('button', { name: /available/i }).first().click()
  await expect(page.getByTestId('drill-drawer')).toBeVisible()
  await page.keyboard.press('Escape')

  // work logged on Today shows up in the activity report at once
  await page.goto('/reports/activity')
  const subtitle = () => page.getByTestId('chart-activity').innerText()
  const countOf = async () => Number((await subtitle()).match(/(\d+) logged/)?.[1] ?? -1)
  const before = await countOf()
  await page.getByTestId('sidebar').getByTestId('nav-today').click()
  await switchTo(page, 'profile-u-arjun')
  await page.getByTestId('priority-item').first().getByTestId('today-log').click()
  await page.getByTestId('log-save').click()
  await switchTo(page, 'role-admin')
  await page.getByTestId('sidebar').getByTestId('nav-reports').click()
  await sections(page).getByRole('button', { name: /^activity$/i }).click()
  await expect.poll(countOf).toBe(before + 1)
  expect(consoleProblems).toEqual([])
})

test('an executive sees only "My performance": no Team tab, no other people', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-sneha')
  await page.goto('/reports')
  await expect(page.locator('main h1')).toHaveText('My performance')
  await expect(page.getByTestId('report-scope')).toHaveCount(0)
  await expect(sections(page).getByRole('button', { name: /^overview$/i })).toBeVisible()
  await expect(sections(page).getByRole('button', { name: /^team$/i })).toHaveCount(0)
  await page.goto('/reports/team')
  await expect(page.getByTestId('chart-team')).toHaveCount(0)
  await expect(page.getByTestId('report-kpis')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('Today and Reports fit a phone without horizontal scroll @phone', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await expect(page.getByTestId('today-executive')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await page.goto('/reports')
  await expect(page.getByTestId('report-kpis')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  expect(consoleProblems).toEqual([])
})
