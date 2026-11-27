/**
 * M8 Team, Settings, Notifications & Activity: the main journeys through the real UI, as admin, manager and
 * executives (via the profile switcher). Every write is checked in the persisted store, and every test asserts a
 * clean console. Runs against the 5176 build + preview (playwright.config.ts) or the M8 dev server
 * (e2e/m8-team-settings.dev.config.ts).
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Db = {
  users: { id: string; name: string; role: string; status: string; availability: string; managerId?: string }[]
  leads: { id: string; ownerId: string | null; stage: string }[]
  notifications: { userId: string; readAt?: string | null }[]
  settings: { matching: { weights: Record<string, number> }; assignment: { autoAssign: boolean } }
}

const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } } | null)?.state.db ?? null)
const OPEN = (l: Db['leads'][number]) => !['booked', 'converted', 'lost'].includes(l.stage)

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

async function asAdmin(page: Page, path: string) {
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  await page.goto(path)
  await expect(page.locator('main h1').first()).toBeVisible()
}

test('team: the on-leave prompt reassigns through the assign dialog with a recommended (auto) pick', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/team')
  const before = (await readDb(page))!
  const farhanOpen = before.leads.filter((l) => l.ownerId === 'u-farhan' && OPEN(l)).length
  expect(farhanOpen).toBeGreaterThan(0)

  await page.getByTestId('leave-reassign-u-farhan').click()
  const dialog = page.getByTestId('assign-dialog')
  await expect(dialog).toBeVisible()
  // the auto option carries the Demo AI badge and a per-lead preview; on-leave people cannot be picked
  await expect(page.getByTestId('assign-auto')).toContainText(/Demo AI/i)
  await expect(page.getByTestId('assign-preview')).toBeVisible()
  await expect(page.getByTestId('assign-person-u-farhan').getByRole('radio')).toBeDisabled()
  await expect(page.getByTestId('assign-person-u-arjun')).toContainText(/open/i)
  await dialog.getByRole('textbox').fill('Covering while Farhan is away')
  await page.getByTestId('assign-confirm').click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(/assigned/i).first()).toBeVisible()

  await expect.poll(async () => (await readDb(page))!.leads.filter((l) => l.ownerId === 'u-farhan' && OPEN(l)).length).toBe(0)
  await expect(page.getByTestId('leave-reassign-u-farhan')).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test('assign dialog: one lead gets an explained recommendation; the unassigned queue is assigned by hand', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/today')
  const db = (await readDb(page))!
  const lead = db.leads.find((l) => l.ownerId === 'u-arjun' && OPEN(l))!

  // single lead (the dialog as other modules open it): recommendation with its reason, then auto-assign
  await page.goto(`/leads/${lead.id}`)
  await page.getByRole('button', { name: /reassign/i }).first().click()
  await expect(page.getByTestId('assign-dialog')).toBeVisible()
  await expect(page.getByTestId('assign-recommendation')).toContainText(/Recommended: Sneha Reddy · lowest workload/)
  await expect(page.getByTestId('assign-person-u-arjun')).toContainText(/Owner now/i)
  await page.getByTestId('assign-confirm').click()
  await expect(page.getByText(/Sneha Reddy/).last()).toBeVisible()
  await expect.poll(async () => (await readDb(page))!.leads.find((l) => l.id === lead.id)?.ownerId).toBe('u-sneha')

  // the unassigned queue tile on Team opens the dialog for every queued lead
  await page.goto('/team')
  expect(db.leads.filter((l) => !l.ownerId && OPEN(l)).length).toBeGreaterThan(0)
  await page.getByText(/^Unassigned$/i).first().click()
  await expect(page.getByTestId('assign-dialog')).toBeVisible()
  await page.getByTestId('assign-person-u-vikram').click()
  await page.getByTestId('assign-dialog').getByRole('textbox').fill('Weekend cover')
  await page.getByTestId('assign-confirm').click()
  await expect(page.getByTestId('assign-dialog')).toBeHidden()
  await expect.poll(async () => (await readDb(page))!.leads.filter((l) => !l.ownerId && OPEN(l)).length).toBe(0)
  expect(consoleProblems).toEqual([])
})

test('settings: a rule described in words fills the editor and says what one rule cannot hold', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/settings/assignment')
  const before = (await readDb(page))!.settings.assignment
  await page.getByTestId('rule-add').click()
  await page.getByTestId('rule-words').fill('Leads from Chennai who speak Tamil go to Sneha')
  await page.getByTestId('rule-read').click()
  await expect(page.getByTestId('rule-also-found')).toContainText(/Location/)
  await expect(page.getByTestId('rule-editor')).toContainText(/Demo AI/i)
  // nothing saved until Save
  expect((await readDb(page))!.settings.assignment).toEqual(before)
  await page.getByTestId('rule-save').click()
  await expect(page.getByTestId('rule-list')).toContainText(/Language: Tamil/)
  expect(consoleProblems).toEqual([])
})

test('team: admin adds a user by pasting a sentence, then deactivates an executive with a hand-over preview', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/team')
  await page.getByTestId('add-user').click()
  await page.getByTestId('user-paste').fill('Add Priya Nair as a sales executive under Rohit, priya.nair@example.com, 98450 11122, covers Chennai and Bangalore, speaks Tamil and English')
  await page.getByTestId('user-extract').click()
  await expect(page.getByTestId('user-name')).toHaveValue('Priya Nair')
  // nothing saved yet
  expect((await readDb(page))!.users.some((u) => u.name === 'Priya Nair')).toBe(false)
  await page.getByTestId('user-save').click()
  await expect(page).toHaveURL(/\/team\/[\w-]+$/)
  await expect(page.locator('main h1').first()).toHaveText('Priya Nair')
  const priya = (await readDb(page))!.users.find((u) => u.name === 'Priya Nair')!
  expect(priya).toMatchObject({ role: 'executive', managerId: 'u-rohit', status: 'active' })

  await page.goto('/team')
  await page.getByTestId('user-actions-u-vikram').click()
  await page.getByTestId('deactivate-u-vikram').click()
  await expect(page.getByTestId('redistribute-dialog')).toBeVisible()
  await expect(page.getByTestId('redistribute-preview')).toBeVisible()
  await page.getByTestId('redistribute-confirm').click()
  await expect(page.getByTestId('redistribute-dialog')).toBeHidden()
  await expect.poll(async () => {
    const db = (await readDb(page))!
    return [db.users.find((u) => u.id === 'u-vikram')?.status, db.leads.filter((l) => l.ownerId === 'u-vikram' && OPEN(l)).length]
  }).toEqual(['deactivated', 0])

  // activate again from the people list
  await page.getByTestId('user-actions-u-vikram').click()
  await page.getByTestId('activate-u-vikram').click()
  await expect.poll(async () => (await readDb(page))!.users.find((u) => u.id === 'u-vikram')?.status).toBe('active')
  expect(consoleProblems).toEqual([])
})

test('notifications: bell marks all read and the page filters by tab', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/today')
  await page.getByTestId('bell').click()
  await expect(page.getByTestId('bell-popover')).toBeVisible()
  await expect(page.getByTestId('bell-popover').getByTestId('notification-item').first()).toBeVisible()
  await page.getByTestId('bell-mark-all').click()
  await expect.poll(async () => (await readDb(page))!.notifications.filter((n) => n.userId === 'u-admin' && !n.readAt).length).toBe(0)
  await page.getByTestId('bell-view-all').click()
  await expect(page).toHaveURL(/\/notifications$/)
  await expect(page.getByTestId('notification-item').first()).toBeVisible()
  // mark one unread again from the page
  await page.getByTestId('notification-toggle-read').first().click()
  await expect.poll(async () => (await readDb(page))!.notifications.filter((n) => n.userId === 'u-admin' && !n.readAt).length).toBe(1)
  await page.getByTestId('notifications-digest').click()
  await expect(page.getByText(/Demo AI/i).first()).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('settings: matching weights must total 1.00, balance and save', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/settings')
  await expect(page.getByTestId('settings-tiles').locator('a')).toHaveCount(8)
  await page.getByTestId('settings-tile-matching').click()
  await expect(page).toHaveURL(/\/settings\/matching$/)
  const budget = page.getByTestId('weight-budget').getByRole('slider')
  await budget.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('matching-save')).toBeDisabled()
  await page.getByTestId('weights-balance').click()
  await expect(page.getByTestId('weights-sum')).toContainText('1.00')
  const before = (await readDb(page))!.settings.matching.weights.budget
  await page.getByTestId('matching-save').click()
  await expect.poll(async () => (await readDb(page))!.settings.matching.weights.budget).not.toBe(before)
  const w = (await readDb(page))!.settings.matching.weights
  expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  expect(consoleProblems).toEqual([])
})

test('settings: reset demo data asks first and restores the seed', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/settings/demo')
  // change something first
  await page.goto('/team')
  await page.getByTestId('user-actions-u-sneha').click()
  await page.getByTestId('deactivate-u-sneha').click()
  await page.getByTestId('redistribute-confirm').click()
  await expect.poll(async () => (await readDb(page))!.users.find((u) => u.id === 'u-sneha')?.status).toBe('deactivated')
  await page.goto('/settings/demo')
  await page.getByTestId('demo-reset').click()
  await expect(page.getByRole('alertdialog').or(page.getByRole('dialog'))).toBeVisible()
  // nothing happens until confirmed
  expect((await readDb(page))!.users.find((u) => u.id === 'u-sneha')?.status).toBe('deactivated')
  await page.getByRole('button', { name: /reset/i }).last().click()
  await expect.poll(async () => (await readDb(page))!.users.find((u) => u.id === 'u-sneha')?.status).toBe('active')
  expect(consoleProblems).toEqual([])
})

test('roles: manager sees profile + assignment only; executives go straight to their profile', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  await page.goto('/settings')
  const tiles = page.getByTestId('settings-tiles')
  await expect(tiles.getByTestId('settings-tile-profile')).toBeVisible()
  await expect(tiles.getByTestId('settings-tile-assignment')).toBeVisible()
  await expect(tiles.locator('a')).toHaveCount(2)
  await page.goto('/settings/matching')
  await expect(page.getByTestId('no-access')).toBeVisible()
  await page.goto('/team')
  await expect(page.getByTestId('add-user')).toHaveCount(0)
  await expect(page.getByTestId('user-actions-u-arjun')).toBeVisible()
  await page.getByTestId('user-actions-u-arjun').click()
  await expect(page.getByTestId('deactivate-u-arjun')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto('/today')

  for (const exec of ['profile-u-arjun', 'profile-u-sneha', 'profile-u-vikram']) {
    await switchTo(page, exec)
    await page.goto('/settings')
    await expect(page.getByTestId('settings-tiles')).toHaveCount(0)
    await page.getByTestId('theme-dark').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByTestId('theme-light').click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    for (const denied of ['/team', '/activity', '/settings/assignment', '/settings/demo']) {
      await page.goto(denied)
      await expect(page.getByTestId('no-access')).toBeVisible()
    }
    await page.goto('/notifications')
    await expect(page.getByTestId('no-access')).toHaveCount(0)
  }
  expect(consoleProblems).toEqual([])
})

test('activity: ask in words narrows the log, and the person filter shows who', async ({ page, consoleProblems }) => {
  await asAdmin(page, '/activity')
  const log = page.getByTestId('activity-log')
  await expect(log).toBeVisible()
  await page.getByTestId('activity-ask').fill('changes by Arjun this week')
  await page.getByTestId('activity-ask-go').click()
  await expect(page.getByRole('status').filter({ hasText: /person/i }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Person: 1/ })).toContainText('Arjun Mehta')
  await expect(log).toContainText('Arjun Mehta')
  await expect(log).not.toContainText('Sneha Reddy')
  expect(consoleProblems).toEqual([])
})

test('@phone team, settings, notifications and activity fit a phone without sideways scroll', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await page.getByTestId('mobile-profile').click()
  await page.getByTestId('profile-picker').getByTestId('role-admin').click()
  for (const path of ['/team', '/team/u-arjun', '/settings', '/settings/assignment', '/settings/matching', '/settings/templates', '/notifications', '/activity']) {
    await page.goto(path)
    await expect(page.locator('main h1').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
  expect(consoleProblems).toEqual([])
})
