/**
 * M7 AI Assistants journey (plan §8.3 M7, master prompt §12): the global panel opens by shortcut, knows the role, page
 * and record, suggests role prompts, answers questions with links, proposes changes that run only on Confirm (logged
 * with via 'ai', undoable), refuses what the role may not do, reads Hinglish, and offers the module assistants.
 * Every profile is switched through the real profile switcher; the app must stay free of console errors.
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

type Db = {
  leads: { id: string; name: string; stage: string; ownerId: string | null; createdVia: string }[]
  properties: { id: string; title: string; price: number; createdVia?: string }[]
  appointments: { id: string; leadId?: string; origin?: string; createdVia?: string }[]
  activities: { kind: string; via: string; refs: { kind: string; id: string }[] }[]
}
const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } } | null)?.state.db)

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

async function openPanel(page: Page) {
  if (!(await page.getByTestId('ai-panel').isVisible())) await page.keyboard.press('Control+k')
  await expect(page.getByTestId('ai-panel')).toBeVisible()
}

/** Types a request, sends it and returns the newest answer. */
async function ask(page: Page, text: string): Promise<Locator> {
  const answers = page.getByTestId('ai-answer')
  const before = await answers.count()
  await page.getByTestId('ai-input').fill(text)
  await page.getByTestId('ai-input').press('Enter')
  await expect(answers).toHaveCount(before + 1)
  const last = answers.last()
  await expect(last.getByTestId('demo-ai-badge').first()).toBeVisible()
  return last
}

test('manager: shortcuts, context chip, role chips and a stage move that runs only on Confirm, with Undo', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await expect(page.locator('main h1')).toBeVisible()
  await switchTo(page, 'role-manager')

  // "/" opens the panel from anywhere (not while typing); Esc closes it; Ctrl+K opens it again
  await page.locator('main').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('/')
  await expect(page.getByTestId('ai-panel')).toBeVisible()
  await expect(page.getByTestId('ai-input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ai-panel')).toBeHidden()
  await openPanel(page)

  // the role's prompt chips (ROLE_RESEARCH §5) and the context chip with the role
  await expect(page.getByTestId('ai-prompt-mgr-assign')).toBeVisible()
  await expect(page.getByTestId('ai-prompt-mgr-overload')).toBeVisible()
  await expect(page.getByTestId('ai-context')).toContainText('Sales Manager')

  // a chip answers with graphics and record links
  await page.getByTestId('ai-prompt-mgr-team').click()
  const team = page.getByTestId('ai-answer').last()
  await expect(team).toContainText('Your team')
  await expect(team.getByTestId('ai-stats').first()).toBeVisible()

  // a change is a card: nothing happens before Confirm
  const card = (await ask(page, 'move Priya to negotiation')).getByTestId('action-proposal')
  await expect(card).toContainText('Negotiation')
  expect((await readDb(page))?.leads.find((l) => l.id === 'LEAD-1001')?.stage).toBe('siteVisitScheduled')
  await card.getByTestId('proposal-confirm').click()
  await expect(card.getByTestId('proposal-done')).toBeVisible()
  await expect.poll(async () => (await readDb(page))?.leads.find((l) => l.id === 'LEAD-1001')?.stage).toBe('negotiation')
  // logged as an AI change (✦ on timelines)
  const db = await readDb(page)
  expect(db?.activities.some((a) => a.via === 'ai' && a.refs.some((r) => r.id === 'LEAD-1001'))).toBe(true)

  // Undo puts it back
  await card.getByTestId('proposal-undo').click()
  await expect.poll(async () => (await readDb(page))?.leads.find((l) => l.id === 'LEAD-1001')?.stage).toBe('siteVisitScheduled')

  // the link on the done card opens the changed record
  const again = (await ask(page, 'move Priya Sharma to negotiation')).getByTestId('action-proposal')
  await again.getByTestId('proposal-confirm').click()
  await again.getByTestId('proposal-done').getByRole('link', { name: /Priya Sharma/ }).first().click()
  await expect(page).toHaveURL(/\/leads\/LEAD-1001$/)
  // below 1920 px the panel overlays, so following a link closes it (M7 R5); open it again
  await openPanel(page)

  // Cancel leaves the data alone
  const cancelled = (await ask(page, 'reassign Sanjay Gupta -> Vikram')).getByTestId('action-proposal')
  await cancelled.getByTestId('proposal-cancel').click()
  await expect(cancelled.getByTestId('proposal-confirm')).toHaveCount(0)
  expect((await readDb(page))?.leads.find((l) => l.id === 'LEAD-1010')?.ownerId).toBe('u-sneha')

  // assignment by the manager runs and is undoable
  const assign = (await ask(page, "give Sanjay's lead to Vikram")).getByTestId('action-proposal')
  await assign.getByTestId('proposal-confirm').click()
  await expect.poll(async () => (await readDb(page))?.leads.find((l) => l.id === 'LEAD-1010')?.ownerId).toBe('u-vikram')
  await assign.getByTestId('proposal-undo').click()
  await expect.poll(async () => (await readDb(page))?.leads.find((l) => l.id === 'LEAD-1010')?.ownerId).toBe('u-sneha')

  expect(consoleProblems).toEqual([])
})

test('executive: refusals with the reason, adding a lead from a message, Hinglish and query answers', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-sneha')
  await openPanel(page)
  await expect(page.getByTestId('ai-prompt-exec-next')).toBeVisible()
  await expect(page.getByTestId('ai-prompt-mgr-assign')).toHaveCount(0)

  // refused by permission, with the reason and an alternative
  const refusal = await ask(page, "give Sanjay's lead to Vikram")
  await expect(refusal.getByTestId('ai-refusal')).toContainText("can't reassign")
  await expect(refusal.getByTestId('action-proposal')).toHaveCount(0)
  await expect(await ask(page, 'delete lead Sanjay')).toContainText("can't delete")

  // paste an enquiry → a lead card → Confirm → the lead exists, created via AI
  const add = await ask(page, 'Add lead Rahul Verma 98450 12345 looking for 3BHK in Whitefield budget 1.2 Cr')
  const card = add.getByTestId('action-proposal')
  await expect(card).toContainText('Rahul Verma')
  await expect(card).toContainText('1.2 Cr')
  await card.getByTestId('proposal-confirm').click()
  await expect(card.getByTestId('proposal-done')).toBeVisible()
  await expect.poll(async () => (await readDb(page))?.leads.find((l) => l.name === 'Rahul Verma')?.createdVia).toBe('ai')

  // Hinglish is rewritten, then read
  const hinglish = await ask(page, 'Sanjay ka visit kal 11 baje fix karo')
  await expect(hinglish.getByTestId('ai-read-as')).toContainText('tomorrow')
  await expect(hinglish.getByTestId('action-proposal')).toContainText('Site visit')

  // query answers list records that link to them
  const tasks = await ask(page, "show today's pending tasks")
  await expect(tasks.getByTestId('ai-results')).toBeVisible()
  const next = await ask(page, 'Who should I call next?')
  await expect(next).not.toContainText('{{')
  await next.getByTestId('ai-results').getByRole('link').first().click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)

  expect(consoleProblems).toEqual([])
})

test('admin: adds a property from a listing message, and record context on a lead page', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  await openPanel(page)
  await expect(page.getByTestId('ai-prompt-adm-business')).toBeVisible()

  const listing = await ask(page, 'add property 2.5BHK 1200 sqft east facing in Kondapur, Hyderabad 85 L ready to move owner Ramesh 98450 12345')
  const card = listing.getByTestId('action-proposal')
  await expect(card).toContainText('Kondapur')
  await card.getByTestId('proposal-confirm').click()
  await expect(card.getByTestId('proposal-done')).toBeVisible()
  await expect.poll(async () => (await readDb(page))?.properties.some((p) => p.price === 8_500_000 && /Kondapur/.test(p.title))).toBe(true)

  // Booked needs the stage dialog, never a one-click AI move
  await expect(await ask(page, 'mark Priya as booked')).toContainText('needs the property')

  // the context chip follows the open record; record chips and the module assistants appear
  await page.keyboard.press('Escape')
  await page.goto('/leads/LEAD-1001')
  await expect(page.locator('main h1')).toBeVisible()
  await openPanel(page)
  await expect(page.getByTestId('ai-context')).toContainText('Priya Sharma')
  if (await page.getByTestId('ai-clear').isVisible()) await page.getByTestId('ai-clear').click()
  await expect(page.getByTestId('ai-prompt-rec-summary')).toBeVisible()
  await page.getByTestId('ai-panel').getByRole('button', { name: /^Assistants/ }).click()
  const tools = page.getByTestId('ai-tools')
  await expect(tools).toBeVisible()
  await expect(tools.locator('[data-testid^="assistant-"]').first()).toBeVisible()
  expect(await tools.locator('[data-testid^="assistant-"]').count()).toBeGreaterThanOrEqual(3)
  await expect(tools.getByTestId('demo-ai-badge').first()).toBeVisible()

  expect(consoleProblems).toEqual([])
})

test('executives Arjun and Vikram see only their own work', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await openPanel(page)
  const prio = await ask(page, 'highest priority leads')
  await expect(prio.getByTestId('ai-results')).toBeVisible()
  // Arjun owns Priya; Sanjay belongs to Sneha
  await expect(prio).not.toContainText('Sanjay Gupta')
  await expect(await ask(page, 'Who is overloaded today?')).toContainText("can't")

  await page.getByTestId('ai-close').click()
  await switchTo(page, 'profile-u-vikram')
  await openPanel(page)
  if (await page.getByTestId('ai-clear').isVisible()) await page.getByTestId('ai-clear').click()
  await expect(page.getByTestId('ai-prompt-exec-target')).toBeVisible()
  const target = await ask(page, "What's left for my target this month?")
  await expect(target.getByTestId('ai-stats').first()).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test('@phone the panel fills the screen without sideways scrolling', async ({ page, consoleProblems }) => {
  await page.goto('/leads/LEAD-1001')
  await expect(page.locator('main h1')).toBeVisible()
  await page.getByRole('button', { name: /ask ai|assistant/i }).first().click()
  await expect(page.getByTestId('ai-panel')).toBeVisible()
  const box = await page.getByTestId('ai-panel').boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 1)
  await ask(page, 'Show my highest priority leads')
  await ask(page, 'move Priya to negotiation')
  const overflow = await page.evaluate(() => {
    const p = document.querySelector('[data-testid=ai-panel]') as HTMLElement
    return Math.max(document.documentElement.scrollWidth - window.innerWidth, p.scrollWidth - p.clientWidth)
  })
  expect(overflow).toBeLessThanOrEqual(0)
  await page.getByTestId('ai-close').click()
  await expect(page.getByTestId('ai-panel')).toBeHidden()
  expect(consoleProblems).toEqual([])
})
