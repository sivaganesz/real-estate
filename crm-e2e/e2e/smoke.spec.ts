/**
 * Foundation smoke test (plan §9): switches through all five demo profiles with the real profile switcher, clicks
 * every nav item each one has, asserts no console errors or warnings, checks that an executive gets NoAccess on
 * /team, that data and preferences persist across a reload, and that the theme and language toggles work.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

const PROFILES = [
  { role: 'admin', userId: 'u-admin', testId: 'role-admin' },
  { role: 'manager', userId: 'u-rohit', testId: 'role-manager' },
  { role: 'executive', userId: 'u-arjun', testId: 'profile-u-arjun' },
  { role: 'executive', userId: 'u-sneha', testId: 'profile-u-sneha' },
  { role: 'executive', userId: 'u-vikram', testId: 'profile-u-vikram' },
] as const

type PersistedDb = { state: { db: { meta: { seededAt: string; anchorDate: string }; appointments: { id: string; start: string }[]; leads: { id: string; name: string; ownerId: string | null }[] } } }

const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as PersistedDb | null)
const readSession = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('crm-e2e-session') ?? 'null') as { state: { role: string; userId: string } } | null)

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) {
    await picker.getByTestId('role-executive').click()
  }
  await picker.getByTestId(testId).click()
  await expect(page.getByTestId('profile-picker')).toBeHidden()
}

test('every profile can open every nav item without console errors', async ({ page, consoleProblems }) => {
  // 5 profiles × every nav item: well over Playwright's default 30 s budget
  test.setTimeout(120_000)
  await page.goto('/')
  await expect(page).toHaveURL(/\/today$/)
  await expect(page.getByTestId('sidebar')).toBeVisible()

  for (const profile of PROFILES) {
    await switchTo(page, profile.testId)
    await expect.poll(async () => (await readSession(page))?.state.userId).toBe(profile.userId)
    expect((await readSession(page))?.state.role).toBe(profile.role)

    const sidebar = page.getByTestId('sidebar')
    const hrefs = await sidebar.locator('a[data-testid^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
    expect(hrefs.length).toBeGreaterThan(4)
    if (profile.role === 'executive') expect(hrefs).not.toContain('/team')
    else expect(hrefs).toContain('/team')

    for (const href of hrefs) {
      // client-side navigation through the real sidebar link
      await sidebar.locator(`a[data-testid^="nav-"][href="${href}"]`).click()
      await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
      await expect(page.locator('main h1')).toBeVisible()
      await expect(page.getByTestId('no-access')).toHaveCount(0)
      await expect(page.getByTestId('not-found')).toHaveCount(0)
    }
  }
  expect(consoleProblems).toEqual([])
})

test('an executive sees NoAccess on /team and can go back to Today', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  // the default profile is an executive; switch through the UI to another one to be explicit
  await switchTo(page, 'profile-u-vikram')
  await page.goto('/team')
  await expect(page.getByTestId('no-access')).toBeVisible()
  await page.getByTestId('no-access').getByRole('link', { name: /today/i }).first().click()
  await expect(page).toHaveURL(/\/today$/)
  expect(consoleProblems).toEqual([])
})

test('switching to an executive on a manager-only page redirects to Today', async ({ page, consoleProblems }) => {
  await page.goto('/')
  await switchTo(page, 'role-manager')
  await page.getByTestId('sidebar').getByTestId('nav-team').click()
  await expect(page).toHaveURL(/\/team$/)
  await expect(page.getByTestId('no-access')).toHaveCount(0)
  await switchTo(page, 'profile-u-sneha')
  await expect(page).toHaveURL(/\/today$/)
  expect(consoleProblems).toEqual([])
})

test('language and theme toggles update the shell and survive a reload', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByTestId('nav-today')).toContainText('Today')

  await page.getByTestId('topbar').getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta')
  await expect(page.getByTestId('nav-today')).toContainText('இன்று')

  await page.getByTestId('topbar').getByTestId('theme-toggle').click()
  await page.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByTestId('nav-today')).toContainText('இன்று')

  await page.getByTestId('topbar').getByTestId('theme-toggle').click()
  await page.getByTestId('theme-light').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.getByTestId('topbar').getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByTestId('nav-today')).toContainText('Today')
  expect(consoleProblems).toEqual([])
})

test('Ctrl+K opens the AI panel and Escape closes it', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await expect(page.locator('main h1')).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('ai-panel')).toBeVisible()
  await expect(page.getByTestId('demo-ai-badge').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ai-panel')).toBeHidden()
  expect(consoleProblems).toEqual([])
})

test('unknown URLs show the not-found page inside the shell', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toBeVisible()
})

test('phone shows the bottom tabs and the menu sheet @phone', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await expect(page.getByTestId('bottom-tabs')).toBeVisible()
  await page.getByTestId('tab-more').click()
  await expect(page.getByTestId('mobile-nav')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('tablet renders the shell without horizontal scroll @tablet', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await expect(page.locator('main h1')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  expect(consoleProblems).toEqual([])
})

test('a change made in the app and the chosen profile persist after reload', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')

  // create a lead through the AI assistant (proposal → confirm → services → store)
  await page.getByTestId('ai-fab').click()
  await expect(page.getByTestId('ai-panel')).toBeVisible()
  await page.getByTestId('ai-input').fill('Add lead Smoke Tester 9811122233, 2BHK Whitefield, budget 80 L')
  await page.getByTestId('ai-send').click()
  await page.getByTestId('proposal-confirm').first().click()
  await expect.poll(async () => (await readDb(page))?.state.db.leads.some((l) => l.name === 'Smoke Tester')).toBe(true)

  await page.reload()
  await expect(page.locator('main h1')).toBeVisible()
  const db = await readDb(page)
  expect(db!.state.db.leads.filter((l) => l.name === 'Smoke Tester')).toHaveLength(1)
  const session = await readSession(page)
  expect(session!.state).toMatchObject({ role: 'manager', userId: 'u-rohit' })
  expect(consoleProblems).toEqual([])
})

test('demo data persists across reloads and rebases to today', async ({ page }) => {
  await page.goto('/today')
  const first = await readDb(page)
  expect(first).not.toBeNull()
  await page.reload()
  const second = await readDb(page)
  expect(second!.state.db.meta.seededAt).toBe(first!.state.db.meta.seededAt)

  // Simulate yesterday's session: move the anchor back a day and reload; every date moves forward by one day.
  const today = first!.state.db.meta.anchorDate
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('crm-e2e-db')!)
    const d = new Date(raw.state.db.meta.anchorDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    raw.state.db.meta.anchorDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    localStorage.setItem('crm-e2e-db', JSON.stringify(raw))
  })
  await page.reload()
  await expect(page.locator('main h1')).toBeVisible()
  const third = await readDb(page)
  expect(third!.state.db.meta.anchorDate).toBe(today)
  const before = new Date(first!.state.db.appointments[0].start).getTime()
  const after = new Date(third!.state.db.appointments[0].start).getTime()
  expect(Math.round((after - before) / 3_600_000)).toBe(24)
})

test('the assistant refuses what the role cannot do, in the chosen language', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  await page.keyboard.press('Control+k')
  await page.getByTestId('ai-input').fill('delete property Aranya Greens')
  await page.getByTestId('ai-send').click()
  await expect(page.getByTestId('ai-refusal').last()).toContainText('Only the admin can delete properties')
  await expect(page.getByTestId('proposal-confirm')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await switchTo(page, 'profile-u-arjun')
  await page.getByTestId('topbar').getByTestId('language-toggle').click()
  await page.keyboard.press('Control+k')
  await page.getByTestId('ai-input').fill('reassign Priya Sharma to Sneha')
  await page.getByTestId('ai-send').click()
  await expect(page.getByTestId('ai-refusal').last()).toContainText('மறு ஒதுக்கீடு')
  expect(consoleProblems).toEqual([])
})
