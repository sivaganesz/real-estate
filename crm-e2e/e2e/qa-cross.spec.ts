/**
 * QA – Cross-module & AI (round 1). Journeys for master prompt §5.3 (permissions in every role, tried through routes,
 * buttons and AI commands), §7 (data flowing between modules), §12.3 (paste-and-fill with Indian formats), §12.4 (voice
 * fallback), §12.5 (every global-assistant command in at least three phrasings), §12.1 (Demo AI badge on simulated
 * output), §15 (import end to end) and §18 (persistence and Reset demo data).
 *
 * Profiles are switched through the real profile switcher. Tests for bugs that are still open assert the CORRECT
 * behaviour (they fail until fixed); bug ids XAI-n are in the QA report. Screenshots go to notes/screens/qa/cross/.
 */
import type { Locator, Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures.ts'

type Lead = {
  id: string; name: string; phone: string; stage: string; ownerId: string | null; createdVia: string; importJobId?: string; source: string
  requirement: { configurations: string[]; localities: string[]; cities: string[]; budgetMax?: number; facing: string[]; areaMinSqft?: number; areaMaxSqft?: number; propertyTypes: string[] }
  qualification: { timeline?: string; decisionMakers: string[] }
}
type Db = {
  leads: Lead[]
  properties: { id: string; title: string; status: string; price: number; configuration?: string; facing?: string; area: Record<string, number>; location: { locality: string; city: string }; owner?: { name: string; phone: string }; possession: { status: string } }[]
  appointments: { id: string; leadId?: string; ownerId: string; type: string; start: string; status: string; propertyIds: string[] }[]
  tasks: { id: string; leadId?: string; ownerId: string; title: string; status: string; dueAt: string; origin: string }[]
  activities: { kind: string; via: string; refs: { kind: string; id: string }[] }[]
  notifications: { userId: string; kind: string; ref?: { id: string }; at: string }[]
  importJobs: { id: string }[]
}

/** Soft checks with a short timeout, so every phrasing is checked and reported in one run. */
// AI answers and lazy pages are slower against the dev server while other agents share the machine
test.describe.configure({ timeout: 120_000 })

const soft = expect.configure({ soft: true, timeout: 3000 })
const SHOTS = fileURLToPath(new URL('../notes/screens/qa/cross', import.meta.url))
const readDb = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null') as { state: { db: Db } }).state.db)
const leadById = async (page: Page, id: string) => (await readDb(page)).leads.find((l) => l.id === id)!
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png` })

async function switchTo(page: Page, testId: string) {
  await page.getByTestId('profile-switcher').click()
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) await picker.getByTestId('role-executive').click()
  await picker.getByTestId(testId).click()
  await expect(picker).toBeHidden()
}

async function openPanel(page: Page, how: 'keys' | 'fab' = 'keys') {
  if (await page.getByTestId('ai-panel').isVisible()) return
  if (how === 'fab') await page.getByTestId('ai-fab').click()
  else await page.keyboard.press('Control+k')
  await expect(page.getByTestId('ai-panel')).toBeVisible()
}

/** Types a request into the global assistant, sends it and returns the newest answer (which must carry the Demo AI badge). */
async function ask(page: Page, text: string): Promise<Locator> {
  await openPanel(page)
  const answers = page.getByTestId('ai-answer')
  if ((await answers.count()) > 14) await page.getByTestId('ai-clear').click()
  const before = await answers.count()
  await page.getByTestId('ai-input').fill(text)
  await page.getByTestId('ai-input').press('Enter')
  await expect(answers).toHaveCount(before + 1, { timeout: 15_000 })
  const last = answers.last()
  await soft(last.getByTestId('demo-ai-badge').first(), `Demo AI badge on the answer to "${text}"`).toBeVisible()
  return last
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// §12.5: every global-assistant command, at least three phrasings each, in the role that may use it
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Check = (answer: Locator, phrase: string) => Promise<void>
const proposal = (title: string, ...must: string[]): Check => async (a, phrase) => {
  const card = a.getByTestId('action-proposal').first()
  await soft(card, `"${phrase}" → a "${title}" card`).toContainText(title)
  for (const m of must) await soft(card, `"${phrase}" → card shows ${m}`).toContainText(m)
}
const answerWith = (...must: (string | RegExp)[]): Check => async (a, phrase) => {
  await soft(a, `"${phrase}" is understood`).not.toContainText("I didn't understand")
  for (const m of must) await soft(a, `"${phrase}" → answer shows ${m}`).toContainText(m)
  await soft(a.locator('a').first(), `"${phrase}" → answer links to records`).toBeVisible()
}

const COMMANDS: { name: string; role: string; phrases: [string, Check][] }[] = [
  {
    name: 'add a new lead', role: 'role-manager', phrases: [
      ['add lead Kiran Rao 9876501234 2BHK Whitefield budget 90 L', proposal('Create lead', 'Kiran Rao', '+91 98765 01234', '₹90 L')],
      ['Hi I am Ravi Kumar 9845098450 looking for 2.5BHK east facing flat in Kondapur 85 lakhs', proposal('Create lead', 'Ravi Kumar', '2.5 BHK', '₹85 L')],
      ['new enquiry: Meena Pillai, +91 98450 33221, wants 3 BHK in HSR Layout, 1.5 Cr', proposal('Create lead', 'Meena Pillai', '₹1.5 Cr')], // XAI-3
      ['create a lead for Sanjay Mehra 9988776655 looking for villa in Sarjapur under 2 Cr', proposal('Create lead', 'Sanjay Mehra', '+91 99887 76655')], // XAI-1
    ],
  },
  {
    name: 'update an existing lead', role: 'profile-u-arjun', phrases: [
      ["update Priya Sharma's budget to 1.5 Cr", proposal('Update lead', 'Priya Sharma', '₹1.5 Cr')],
      ['Priya budget is now 1.4 Cr', proposal('Update lead', 'Priya Sharma', '₹1.4 Cr')],
      ['Karthik can stretch to 1.6 Cr', proposal('Update lead', 'Karthik Subramanian', '₹1.6 Cr')],
      ['change Karthik phone number to 9845011111', proposal('Update lead', '+91 98450 11111')],
    ],
  },
  {
    name: 'find matching properties for a client', role: 'profile-u-arjun', phrases: [
      ['find matches for Priya Sharma', answerWith('Priya Sharma', 'Aranya Greens')],
      ['recommend properties for Karthik', answerWith('Karthik Subramanian', 'Kaveri Enclave')],
      ['show matching properties for Priya', answerWith('Priya Sharma', 'Aranya Greens')],
      ['which properties suit Ananya Iyer?', answerWith('Ananya Iyer', 'Neelam Heights')], // XAI-4
    ],
  },
  {
    name: 'create an appointment / site visit', role: 'profile-u-arjun', phrases: [
      ['schedule a site visit for Priya tomorrow 11am at Aranya Greens', proposal('Book appointment', 'Site visit', 'Priya Sharma', 'Aranya Greens')],
      ['book a meeting with Karthik on Saturday 4 pm', proposal('Book appointment', 'Karthik Subramanian', '4:00 PM')],
      ['fix visit for Ananya day after tomorrow at 10:30', proposal('Book appointment', 'Site visit', 'Ananya Iyer', '10:30 AM')],
      ['create appointment with Deepak Verma tomorrow 3pm phone call', proposal('Book appointment', 'Phone call', 'Deepak Verma', '3:00 PM')],
      ['book site visit for Neha on 2nd Dec at 11', proposal('Book appointment', 'Neha Kulkarni', '02 Dec 2026')],
    ],
  },
  {
    name: 'schedule a follow-up', role: 'profile-u-arjun', phrases: [
      ['remind me to call Karthik tomorrow 10am', proposal('Create follow-up', 'Karthik Subramanian', '10:00 AM')],
      ['schedule a follow-up with Priya on Monday', proposal('Create follow-up', 'Priya Sharma')],
      ['set a follow up with Deepak next week', proposal('Create follow-up', 'Deepak Verma')],
      ['create task: send brochure to Deepak tomorrow', proposal('Create follow-up', 'Deepak Verma')], // XAI-6
      ['Priya ko kal shaam 5 baje call karna hai', proposal('Create follow-up', 'Priya Sharma', '5:00 PM')], // XAI-10
    ],
  },
  {
    name: 'assign lead X to executive Y', role: 'role-manager', phrases: [
      ['assign Priya Sharma to Sneha', proposal('Assign lead', 'Priya Sharma', 'Sneha Reddy')],
      ['give Karthik to Vikram', proposal('Assign lead', 'Karthik Subramanian', 'Vikram Singh')],
      ['hand over Harish Reddy to Arjun Mehta', proposal('Assign lead', 'Harish Reddy', 'Arjun Mehta')],
      ['allot Rajesh Nair to Vikram', proposal('Assign lead', 'Rajesh Nair', 'Vikram Singh')],
    ],
  },
  {
    name: "show today's pending tasks", role: 'profile-u-arjun', phrases: [
      ["show today's pending tasks", answerWith(/tasks? due today/)],
      ['what are my tasks today?', answerWith(/tasks? due today/)],
      ['what should I do today', answerWith(/tasks? due today/)],
      ["what's on my plate", answerWith(/tasks? due today/)],
    ],
  },
  {
    name: 'summarize my sales performance', role: 'profile-u-arjun', phrases: [
      ['summarize my sales performance', async (a, p) => { await soft(a, p).toContainText('Your numbers') }],
      ['how am I doing this month?', async (a, p) => { await soft(a, p).toContainText('Your numbers') }],
      ['give me my performance summary', async (a, p) => { await soft(a, p).toContainText('Your numbers') }],
    ],
  },
  {
    name: "summarize my team's performance", role: 'role-manager', phrases: [
      ["summarize my team's performance", answerWith('Your team', 'Sneha Reddy')],
      ['how is the team doing?', answerWith('Your team', 'Vikram Singh')],
      ['team performance this week', answerWith('Your team this week')],
      ['which executive has the best conversion?', answerWith(/Arjun Mehta|Sneha Reddy|Vikram Singh/)], // XAI-10
    ],
  },
  {
    name: 'find my highest-priority leads', role: 'profile-u-arjun', phrases: [
      ['find my highest-priority leads', answerWith('Karthik Subramanian')],
      ['who are my hot leads?', answerWith('Karthik Subramanian')],
      ['top leads to focus on', answerWith('Karthik Subramanian')],
      ['which leads are hot', answerWith('Karthik Subramanian')], // XAI-10
      ['what should I focus on', answerWith('Karthik Subramanian')], // XAI-10
    ],
  },
  {
    name: 'leads needing follow-up', role: 'profile-u-arjun', phrases: [
      ['leads needing follow-up', answerWith('Mohammed Irfan')],
      ['follow-ups due', answerWith('Mohammed Irfan')],
      ['leads pending follow up', answerWith('Mohammed Irfan')],
      ['which leads have not been contacted?', answerWith('Mohammed Irfan')], // XAI-10
    ],
  },
  {
    name: "properties within a client's budget", role: 'profile-u-arjun', phrases: [
      ["properties within Priya Sharma's budget", answerWith('Priya Sharma', 'Aranya Greens')],
      ['show flats within Karthik budget', answerWith('Karthik Subramanian', 'Aranya Greens')],
      ['options in budget for Deepak', answerWith('Deepak Verma', 'Aranya Greens')],
      ['what fits Ananya budget?', answerWith('Neelam Heights')], // XAI-5
    ],
  },
  {
    name: 'potential conversions', role: 'profile-u-arjun', phrases: [
      ['potential conversions', answerWith('close to booking', 'Karthik Subramanian')],
      ['who is likely to book?', answerWith('close to booking')],
      ['any leads close to booking?', answerWith('close to booking')],
      ['which deals are close to closing?', answerWith('Karthik Subramanian')], // XAI-10
    ],
  },
  {
    name: "summarize today's appointments", role: 'profile-u-arjun', phrases: [
      ["summarize today's appointments", answerWith(/appointments? today/, 'Priya Sharma')],
      ['what visits do I have today?', answerWith(/appointments? today/)],
      ["today's schedule", answerWith(/appointments? today/)],
      ['meetings today', answerWith(/appointments? today/)],
    ],
  },
]

for (const cmd of COMMANDS) {
  test(`assistant understands "${cmd.name}" in every phrasing (${cmd.role})`, async ({ page, consoleProblems }) => {
    test.setTimeout(120_000)
    await page.goto('/today')
    await expect(page.locator('main h1')).toBeVisible()
    await switchTo(page, cmd.role)
    const before = await readDb(page)
    for (const [phrase, check] of cmd.phrases) {
      const a = await ask(page, phrase)
      await check(a, phrase)
    }
    await shot(page, `cmd-${cmd.name.replace(/[^a-z]+/gi, '-').toLowerCase()}`)
    // read questions and unconfirmed proposals change nothing
    const after = await readDb(page)
    expect(after.leads.length).toBe(before.leads.length)
    expect(after.appointments.length).toBe(before.appointments.length)
    expect(after.tasks.length).toBe(before.tasks.length)
    expect(consoleProblems).toEqual([])
  })
}

test('admin: "summarize my sales performance" gives meaningful numbers, not "49 of 0" targets (XAI-11)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  for (const p of ['summarize my sales performance', 'how am I doing this month?', 'give me my performance summary']) {
    const a = await ask(page, p)
    await soft(a, p).not.toContainText(/of 0(?!\d)/)
  }
  await shot(page, 'xai-11-admin-performance')
  expect(consoleProblems).toEqual([])
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Actions change real data after Confirm, link to the records, and nothing changes on Cancel
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('executive: assistant actions change real data only on Confirm, link to the records and show up in every module', async ({ page, consoleProblems }) => {
  test.setTimeout(120_000)
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const before = await readDb(page)

  // Cancel changes nothing
  let a = await ask(page, 'move Priya to negotiation')
  await a.getByTestId('proposal-cancel').click()
  await expect(a).toContainText('Nothing was changed')
  expect((await leadById(page, 'LEAD-1001')).stage).toBe('siteVisitScheduled')

  // add lead (opened with the floating button this time)
  await page.keyboard.press('Escape')
  await openPanel(page, 'fab')
  a = await ask(page, 'add lead Ravi Kumar +91 98450 12345 looking for 2.5BHK east facing flat 1200 sqft in Kondapur 85 lakhs from MagicBricks')
  expect((await readDb(page)).leads.length).toBe(before.leads.length)
  await a.getByTestId('proposal-confirm').first().click()
  await expect(a.getByTestId('proposal-done')).toBeVisible()
  const ravi = (await readDb(page)).leads.find((l) => l.name === 'Ravi Kumar')!
  expect(ravi).toMatchObject({ phone: '+919845012345', ownerId: 'u-arjun', createdVia: 'ai', source: 'magicbricks' })
  expect(ravi.requirement).toMatchObject({ configurations: ['2.5BHK'], localities: ['Kondapur'], budgetMax: 8_500_000, facing: ['E'] })
  await expect(a.locator(`a[href="/leads/${ravi.id}"]`).first()).toBeVisible()

  // appointment → calendar + lead timeline
  a = await ask(page, 'schedule a site visit for Priya tomorrow 4pm at Aranya Greens')
  await a.getByTestId('proposal-confirm').first().click()
  await expect(a.getByTestId('proposal-done')).toBeVisible()
  const appt = (await readDb(page)).appointments.find((x) => !before.appointments.some((b) => b.id === x.id))!
  expect(appt).toMatchObject({ leadId: 'LEAD-1001', type: 'siteVisit', ownerId: 'u-arjun', propertyIds: ['PRP-1001'] })
  await expect(a.locator(`a[href="/appointments/${appt.id}"]`).first()).toBeVisible()

  // follow-up → tasks
  a = await ask(page, 'remind me to call Karthik tomorrow 10am about PAN')
  await a.getByTestId('proposal-confirm').first().click()
  await expect(a.getByTestId('proposal-done')).toBeVisible()
  const task = (await readDb(page)).tasks.find((x) => x.title === 'Call Karthik about PAN')!
  expect(task).toMatchObject({ leadId: 'LEAD-1002', ownerId: 'u-arjun', status: 'open' })
  await expect(a.locator('a[href="/leads/LEAD-1002"]').first()).toBeVisible()

  // update lead and stage move, then Undo the stage move
  a = await ask(page, "Karthik's budget is 1.6 Cr now")
  await a.getByTestId('proposal-confirm').first().click()
  await expect.poll(async () => (await leadById(page, 'LEAD-1002')).requirement.budgetMax).toBe(16_000_000)
  a = await ask(page, 'move Ananya to visit done')
  await a.getByTestId('proposal-confirm').first().click()
  await expect.poll(async () => (await leadById(page, 'LEAD-1003')).stage).toBe('siteVisitDone')
  await a.getByTestId('proposal-undo').click()
  await expect.poll(async () => (await leadById(page, 'LEAD-1003')).stage).toBe('qualified')
  await shot(page, 'exec-ai-actions-done')

  // every change is logged as an AI change
  const db = await readDb(page)
  for (const id of [ravi.id, 'LEAD-1001', 'LEAD-1002']) expect(db.activities.some((x) => x.via === 'ai' && x.refs.some((r) => r.id === id)), id).toBe(true)

  // the records show up in the other modules
  await page.keyboard.press('Escape')
  await page.goto('/leads')
  await expect(page.locator('main')).toContainText('Ravi Kumar')
  await page.goto('/appointments?view=list')
  await expect(page.getByTestId('agenda-list')).toContainText('Priya Sharma')
  await page.goto('/leads/LEAD-1002') // tomorrow's follow-up is on Karthik's lead page
  await expect(page.locator('#lead-tabs')).toContainText('Task added')
  await page.locator('#lead-tabs').getByRole('button', { name: /^Tasks/ }).click()
  await expect(page.locator('#lead-tabs')).toContainText('Call Karthik about PAN')
  await page.goto('/leads/LEAD-1001')
  await expect(page.locator('#lead-tabs')).toContainText('Appointment booked')

  // persistence after reload
  await page.reload()
  await expect(page.getByTestId('lead-page')).toBeVisible()
  const reloaded = await readDb(page)
  expect(reloaded.leads.some((l) => l.id === ravi.id)).toBe(true)
  expect(reloaded.appointments.some((x) => x.id === appt.id)).toBe(true)
  expect(reloaded.tasks.some((x) => x.id === task.id)).toBe(true)
  expect(consoleProblems).toEqual([])
})

test('manager reassigns by AI: both executives, notifications, history, and the upcoming visit follow the lead (XAI-12)', async ({ page, consoleProblems }) => {
  test.setTimeout(120_000)
  await page.goto('/today')
  // Arjun books a visit for Priya tomorrow
  await switchTo(page, 'profile-u-arjun')
  let a = await ask(page, 'schedule a site visit for Priya tomorrow 4pm at Aranya Greens')
  await a.getByTestId('proposal-confirm').first().click()
  await expect(a.getByTestId('proposal-done')).toBeVisible()
  const visit = (await readDb(page)).appointments.filter((x) => x.leadId === 'LEAD-1001').sort((x, y) => y.start.localeCompare(x.start))[0]
  await page.keyboard.press('Escape')

  // Rohit gives Priya to Sneha
  await switchTo(page, 'role-manager')
  a = await ask(page, 'give Priya Sharma to Sneha')
  await a.getByTestId('proposal-confirm').first().click()
  await expect(a.getByTestId('proposal-done')).toBeVisible()
  await expect(a.locator('a[href="/leads/LEAD-1001"]').first()).toBeVisible()
  await expect(a.locator('a[href="/team/u-sneha"]').first()).toBeVisible()
  const db = await readDb(page)
  expect((await leadById(page, 'LEAD-1001')).ownerId).toBe('u-sneha')
  expect(db.notifications.some((n) => n.userId === 'u-sneha' && n.kind === 'reassignment' && n.ref?.id === 'LEAD-1001')).toBe(true)
  expect(db.activities.some((x) => x.kind === 'lead.reassigned' && x.refs.some((r) => r.id === 'LEAD-1001'))).toBe(true)
  await page.keyboard.press('Escape')

  // Arjun lost it: not in his leads, his lead page is closed, the assistant no longer finds it
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/leads')
  await expect(page.locator('main')).not.toContainText('Priya Sharma')
  await page.goto('/leads/LEAD-1001')
  await expect(page.locator('main')).toContainText("This lead isn't on your list")
  a = await ask(page, 'find matches for Priya Sharma')
  await expect(a).not.toContainText('Aranya Greens')
  await page.keyboard.press('Escape')

  // Sneha has it, with the notification in her bell, and the upcoming visit is in her calendar
  await switchTo(page, 'profile-u-sneha')
  await page.goto('/leads')
  await expect(page.locator('main')).toContainText('Priya Sharma')
  await page.getByTestId('bell').click()
  await expect(page.getByTestId('bell-popover')).toContainText('Priya Sharma was reassigned')
  await page.keyboard.press('Escape')
  await page.goto('/appointments?view=list')
  await expect(page.getByTestId('agenda-list')).toBeVisible()
  await shot(page, 'xai-12-sneha-calendar-after-reassign')
  expect((await readDb(page)).appointments.find((x) => x.id === visit.id)!.ownerId, 'the upcoming visit moves to the new owner').toBe('u-sneha')
  await expect(page.getByTestId('agenda-list')).toContainText('Priya Sharma')
  expect(consoleProblems).toEqual([])
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Assistant mistakes that touch the wrong data
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('on a lead page, a command about another lead never targets the open lead (XAI-8)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/leads/LEAD-1003')
  await expect(page.getByTestId('lead-page')).toBeVisible()
  await openPanel(page, 'fab')
  await expect(page.getByTestId('ai-context')).toContainText('Ananya Iyer')
  // Harish Reddy is Sneha's lead, not Arjun's
  const a = await ask(page, 'move Harish Reddy to negotiation')
  await shot(page, 'xai-8-wrong-lead-stage-move')
  // no card at all may target the open lead, and the reply says Harish isn't among Arjun's leads
  await expect(a.getByTestId('action-proposal').filter({ hasText: 'Ananya Iyer' })).toHaveCount(0)
  await expect(a).toContainText("can't find Harish Reddy")
  expect(consoleProblems).toEqual([])
})

test('on a lead page, a question is answered, not turned into a logged call and a timeline change (XAI-9)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await page.goto('/leads/LEAD-1003')
  await expect(page.getByTestId('lead-page')).toBeVisible()
  const a = await ask(page, 'show me leads I have not called in a week')
  await shot(page, 'xai-9-question-becomes-update')
  await expect(a.getByTestId('action-proposal')).toHaveCount(0)
  // a read answer about contact gaps (in the seed every open lead of Arjun's was contacted within 7 days; Mohammed
  // Irfan's last contact is 5 days old), never "updates for Ananya Iyer"
  await expect(a).toContainText(/no contact|contacted in the last 7 days/)
  await expect(a).not.toContainText('Ananya Iyer')
  expect(consoleProblems).toEqual([])
})

test('the source "99acres" is not read as a 99-acre area requirement (XAI-2)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  const a = await ask(page, 'add lead Kiran Rao 9876501234 2BHK Whitefield budget 90 L from 99acres')
  await a.getByTestId('proposal-confirm').first().click()
  await expect(a.getByTestId('proposal-done')).toBeVisible()
  await shot(page, 'xai-2-99acres-area')
  const kiran = (await readDb(page)).leads.find((l) => l.name === 'Kiran Rao')!
  expect(kiran.source).toBe('acres99')
  expect(kiran.requirement.areaMinSqft ?? 0, 'no area was given in the message').toBeLessThan(10_000)
  expect(consoleProblems).toEqual([])
})

test('"add note for Priya" adds a note and does not overwrite her facing preference (XAI-7)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  const facingBefore = (await leadById(page, 'LEAD-1001')).requirement.facing
  const a = await ask(page, 'add note for Priya: wants east facing')
  await shot(page, 'xai-7-add-note')
  const card = a.getByTestId('action-proposal').first()
  await expect(card).not.toContainText('East, North → East')
  await card.getByTestId('proposal-confirm').click()
  await expect.poll(async () => (await leadById(page, 'LEAD-1001')).requirement.facing).toEqual(facingBefore)
  expect((await readDb(page)).activities.some((x) => x.kind === 'note' && x.refs.some((r) => r.id === 'LEAD-1001'))).toBe(true)
  expect(consoleProblems).toEqual([])
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Permissions: routes, buttons and AI commands in every role
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('executive: blocked routes show No access, blocked buttons are hidden, and the AI politely refuses', async ({ page, consoleProblems }) => {
  test.setTimeout(90_000)
  await page.goto('/today')
  await switchTo(page, 'profile-u-vikram')
  for (const url of ['/team', '/team/u-sneha', '/activity', '/settings/users', '/settings/assignment', '/settings/pipeline', '/settings/demo', '/import/leads', '/import/apartments', '/import/history']) {
    await page.goto(url)
    await expect(page.getByTestId('no-access'), url).toBeVisible()
  }
  await page.goto('/leads/LEAD-1001') // Arjun's lead
  await expect(page.locator('main')).toContainText("This lead isn't on your list")
  // his own lead: request, never assign or delete
  await page.goto('/leads/LEAD-1011')
  await expect(page.getByTestId('lead-page')).toBeVisible()
  await expect(page.getByTestId('qa-request')).toBeVisible()
  await expect(page.getByTestId('qa-assign')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^delete/i })).toHaveCount(0)

  await page.goto('/today') // no lead in context (XAI-8 covers that case)
  await expect(page.locator('main h1')).toBeVisible()
  const refusals: [string, string][] = [
    ['assign Rohan Deshpande to Sneha', "can't reassign"],
    ['transfer Pooja Agarwal lead to Arjun', "can't reassign"],
    ['auto-assign new leads', "can't reassign"],
    ['delete lead Rohan Deshpande', "can't delete leads"],
    ['remove the lead Pooja Agarwal', "can't delete leads"],
    ['delete property Aranya Greens', 'Only the admin can delete properties'],
    ['deactivate Sneha', 'Only the admin'],
    ['add a new executive Ravi', 'Only the admin'],
    ['how is the team doing?', 'for managers and admins'],
    ['who is overloaded today?', 'for managers and admins'],
  ]
  for (const [q, why] of refusals) {
    const a = await ask(page, q)
    await soft(a.getByTestId('ai-refusal'), q).toContainText(why)
    await soft(a.getByTestId('proposal-confirm'), q).toHaveCount(0)
  }
  // bulk import is redirected to single-document extraction, never offered
  const imp = await ask(page, 'import leads from excel')
  await expect(imp).toContainText("isn't available for your role")
  // another executive's lead is never found or changed
  for (const q of ['update Harish Reddy budget to 2 Cr', 'find matches for Priya Sharma', 'schedule a site visit for Karthik tomorrow 4pm']) {
    const a = await ask(page, q)
    await soft(a.getByTestId('proposal-confirm'), q).toHaveCount(0)
    await soft(a, q).not.toContainText(/Aranya Greens|Karthik Subramanian · /)
  }
  await shot(page, 'exec-refusals')
  expect(consoleProblems).toEqual([])
})

test('manager: admin-only routes, buttons and AI requests are refused; team actions are allowed', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  for (const url of ['/settings/users', '/settings/pipeline', '/settings/demo', '/import/apartments']) {
    await page.goto(url)
    await expect(page.getByTestId('no-access'), url).toBeVisible()
  }
  for (const url of ['/team', '/activity', '/settings/assignment', '/import/leads', '/import/history']) {
    await page.goto(url)
    await expect(page.locator('main h1').first(), url).toBeVisible()
    await expect(page.getByTestId('no-access'), url).toHaveCount(0)
  }
  await page.goto('/properties/PRP-1001')
  await expect(page.getByTestId('property-page')).toBeVisible()
  await expect(page.getByRole('button', { name: /^delete property$/i })).toHaveCount(0)

  for (const [q, why] of [['delete property Aranya Greens', 'Only the admin can delete properties'], ['remove listing Kaveri Enclave', 'Only the admin'], ['deactivate Kavya Joshi', 'Only the admin'], ['create a new sales executive Priya Nair', 'Only the admin']] as const) {
    const a = await ask(page, q)
    await soft(a.getByTestId('ai-refusal'), q).toContainText(why)
  }
  // a deactivated executive can't take leads
  const kavya = await ask(page, 'assign Priya to Kavya Joshi')
  await expect(kavya).toContainText('not active')
  await expect(kavya.getByTestId('proposal-confirm')).toHaveCount(0)
  // team actions are proposals the manager may confirm
  await expect((await ask(page, "reassign Farhan's leads")).getByTestId('proposal-confirm')).toBeVisible()
  await expect((await ask(page, 'auto-assign new leads')).getByTestId('proposal-confirm')).toBeVisible()
  await shot(page, 'mgr-refusals')
  expect(consoleProblems).toEqual([])
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Paste-and-fill with Indian formats on the lead, property and appointment forms; voice fallback
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('lead form: paste-and-fill reads +91 98450 12345, 2.5BHK, east facing, 1200 sqft and 85 lakhs, and saves only on Save', async ({ page, consoleProblems }) => {
  await page.goto('/leads')
  await switchTo(page, 'role-manager')
  await expect(page.getByTestId('leads-page')).toBeVisible()
  const before = await readDb(page)
  await page.getByTestId('leads-paste').click()
  const sheet = page.getByRole('dialog')
  await sheet.getByTestId('paste-text').fill('Hi, this is Sunita Rao, +91 98450 12345. Need a 2.5BHK east facing flat around 1200 sqft in Kondapur, Hyderabad, budget 85 lakhs. Ready to move, in 1-3 months.')
  await sheet.getByTestId('paste-extract').click()
  await expect(sheet.getByTestId('lead-name')).toHaveValue('Sunita Rao')
  await expect(sheet.locator('[id="lf-phone"]')).toHaveValue('98450 12345')
  await expect(sheet.getByTestId('demo-ai-badge').first()).toBeVisible()
  await shot(page, 'paste-lead-form')
  expect((await readDb(page)).leads.length).toBe(before.leads.length)
  await sheet.getByRole('button', { name: 'WhatsApp', exact: true }).first().click()
  await sheet.getByTestId('lead-next').click()
  await sheet.getByTestId('lead-next').click()
  await sheet.getByTestId('lead-save').click()
  await expect(page).toHaveURL(/\/leads\/LEAD-\d+$/)
  const sunita = (await readDb(page)).leads.find((l) => l.name === 'Sunita Rao')!
  expect(sunita.phone).toBe('+919845012345')
  expect(sunita.requirement).toMatchObject({ configurations: ['2.5BHK'], localities: ['Kondapur'], budgetMax: 8_500_000, facing: ['E'] })
  expect(sunita.requirement.areaMinSqft).toBeGreaterThanOrEqual(1000)
  expect(sunita.requirement.areaMaxSqft).toBeLessThanOrEqual(1500)
  expect(consoleProblems).toEqual([])
})

test('property form: paste-and-fill reads 2.5BHK, 1200 sqft, east facing, 85 L / 1.2 Cr / 72 lakhs and +91 phones', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-sneha')
  const cases = [
    { text: 'Resale 2.5BHK, 1200 sqft, east facing, Kondapur Hyderabad, asking 85 L, ready to move, owner Ramesh +91 98450 12345', locality: 'Kondapur', price: '85', unit: 'Lakh', ppsf: '7,083', owner: '98450 12345' },
    { text: '3 BHK villa in Sarjapur Road, 2400 sq ft, 1.2 Cr, north facing, under construction possession Dec 2027', locality: 'Sarjapur Road', price: '1.2', unit: 'Crore', ppsf: '5,000' },
    { text: 'Plot 30x40 in Yelahanka, 1200 sqft, 72 lakhs, east facing corner plot, A khata', locality: 'Yelahanka', price: '72', unit: 'Lakh', ppsf: '6,000' },
  ]
  for (const c of cases) {
    await page.goto('/properties/new?paste=1')
    await page.locator('[data-testid=paste-text]:visible').fill(c.text)
    await page.getByTestId('paste-extract').last().click()
    await expect(page.getByTestId('pf-locality')).toHaveValue(c.locality)
    await expect(page.locator('[id="pf-price"], [data-testid="pf-price"]').first()).toHaveValue(c.price)
    await expect(page.locator('main')).toContainText(c.unit)
    await expect(page.getByTestId('pf-ppsf')).toContainText(c.ppsf)
    if (c.owner) await expect(page.locator('[id="pf-owner.phone"]')).toHaveValue(c.owner)
    await expect(page.locator('[data-testid=demo-ai-badge]:visible').first()).toBeVisible()
  }
  await shot(page, 'paste-property-form')
  // the first one, saved
  await page.goto('/properties/new?paste=1')
  await page.locator('[data-testid=paste-text]:visible').fill(cases[0].text)
  await page.getByTestId('paste-extract').last().click()
  await expect(page.getByTestId('pf-locality')).toHaveValue('Kondapur')
  await page.getByTestId('property-save').click()
  await expect(page.getByTestId('property-page')).toBeVisible()
  const p = (await readDb(page)).properties.at(-1)!
  expect(p).toMatchObject({ price: 8_500_000, configuration: '2.5BHK', facing: 'E', owner: { name: 'Ramesh', phone: '+919845012345' }, possession: { status: 'ready' } })
  expect(Object.values(p.area)).toContain(1200)
  expect(consoleProblems).toEqual([])
})

test('appointment form: paste-and-fill reads the lead, type, day and time in three phrasings', async ({ page, consoleProblems }) => {
  await page.goto('/appointments')
  await switchTo(page, 'profile-u-arjun')
  const cases = [
    { text: 'Site visit with Karthik on Saturday 4 pm at Kaveri Enclave', lead: 'Karthik Subramanian', time: '4:00 PM', type: 'Site visit', prop: 'Kaveri Enclave' },
    { text: 'phone call with Ananya Iyer tomorrow at 10:30 am', lead: 'Ananya Iyer', time: '10:30 AM', type: 'Phone call' },
    { text: 'Book Deepak Verma video call day after tomorrow 6pm', lead: 'Deepak Verma', time: '6:00 PM', type: 'Video call' },
  ]
  for (const c of cases) {
    await page.getByTestId('book-ai').click()
    const form = page.getByTestId('appointment-form')
    await form.getByTestId('paste-text').fill(c.text)
    await form.getByTestId('paste-extract').click()
    await expect(form.getByTestId('demo-ai-badge').first()).toBeVisible()
    await expect(form.getByRole('combobox').first()).toContainText(c.lead)
    await expect(form).toContainText(c.time)
    await expect(form.getByRole('button', { name: c.type, exact: true })).toHaveAttribute('aria-pressed', 'true')
    if (c.prop) await expect(form).toContainText(c.prop)
    if (c === cases[2]) {
      await shot(page, 'paste-appointment-form')
      const before = (await readDb(page)).appointments.length
      await form.getByTestId('appointment-save').click()
      await expect(form).toBeHidden()
      await expect.poll(async () => (await readDb(page)).appointments.length).toBe(before + 1)
      const created = (await readDb(page)).appointments.at(-1)!
      expect(created).toMatchObject({ type: 'videoCall', leadId: 'LEAD-1006', ownerId: 'u-arjun' })
    } else {
      await page.keyboard.press('Escape')
      const discard = page.getByRole('alertdialog')
      if (await discard.isVisible()) await discard.getByRole('button', { name: /Discard/ }).click()
      await expect(form).toBeHidden()
    }
  }
  expect(consoleProblems).toEqual([])
})

test('voice: without speech recognition the mic stays and explains the fallback, in the assistant and in paste boxes', async ({ page, consoleProblems }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
  })
  await page.goto('/today')
  await openPanel(page)
  await page.getByTestId('ai-panel').getByTestId('voice-button').click()
  const pop = page.locator('[data-slot="popover-content"]')
  await expect(pop).toContainText('Voice input needs Chrome or Edge')
  await expect(pop).toContainText('Type or paste the text instead')
  await shot(page, 'voice-fallback')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.goto('/properties/new?paste=1')
  await page.locator('[data-testid=voice-button]:visible').first().click()
  await expect(page.locator('[data-slot="popover-content"]')).toContainText('Voice input needs Chrome or Edge')
  expect(consoleProblems).toEqual([])
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Demo AI badge on simulated output
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('every simulated AI output carries the Demo AI badge, including the lead-score explanation (XAI-13)', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  for (const url of ['/today', '/reports', '/pipeline', '/matching?lead=LEAD-1003', '/leads/LEAD-1003', '/properties/PRP-1001', '/import']) {
    await page.goto(url)
    await expect(page.locator('main h1').first()).toBeVisible()
    await soft(page.locator('[data-testid=demo-ai-badge]:visible').first(), url).toBeVisible()
  }
  await page.goto('/leads/LEAD-1003')
  await expect(page.getByTestId('next-action').getByTestId('demo-ai-badge')).toBeVisible()
  await expect(page.getByTestId('message-composer').getByTestId('demo-ai-badge')).toBeVisible()
  await page.getByTestId('score-why').click()
  const why = page.locator('[role="dialog"], [data-slot="popover-content"]').last()
  await expect(why).toContainText('Score')
  await shot(page, 'xai-13-score-why-no-badge')
  await expect(why.getByTestId('demo-ai-badge')).toBeVisible()
  expect(consoleProblems).toEqual([])
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// §7 data flow: property status → matching; import → executives; persistence and Reset demo data
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('marking a property Sold removes it from matching, the assistant and the lead page at once', async ({ page, consoleProblems }) => {
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  let a = await ask(page, 'find matches for Priya Sharma')
  await expect(a).toContainText('Aranya Greens')
  await page.keyboard.press('Escape')
  await page.goto('/properties/PRP-1001')
  await page.getByTestId('property-status').click()
  await page.getByTestId('status-sold').click()
  await page.getByRole('alertdialog').getByRole('button', { name: /Sold/ }).click()
  await expect.poll(async () => (await readDb(page)).properties.find((p) => p.id === 'PRP-1001')!.status).toBe('sold')
  // the lead owners are told
  expect((await readDb(page)).notifications.some((n) => n.userId === 'u-arjun' && n.kind === 'propertyUnavailable')).toBe(true)
  a = await ask(page, 'find matches for Priya Sharma')
  await expect(a).not.toContainText('Aranya Greens')
  a = await ask(page, "properties within Deepak Verma's budget")
  await expect(a).not.toContainText('Aranya Greens')
  await page.keyboard.press('Escape')
  await page.goto('/matching?lead=LEAD-1001')
  await expect(page.getByTestId('match-count')).toBeVisible()
  await expect(page.locator('[data-testid=match-grid] h3 a[href$="/PRP-1001"]')).toHaveCount(0)
  await shot(page, 'sold-property-out-of-matching')
  expect(consoleProblems).toEqual([])
})

test('admin import reaches the executives; data persists after reload and Reset demo data restores the seed', async ({ page, consoleProblems }) => {
  test.setTimeout(150_000)
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  const seed = await readDb(page)

  await page.getByTestId('sidebar').getByTestId('nav-import').click()
  await expect(page.getByTestId('import-hub')).toBeVisible()
  await page.getByTestId('try-leads99acresExport').click()
  await expect(page.getByTestId('to-check')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('to-check').click()
  await expect(page.getByTestId('check-step')).toBeVisible()
  await page.getByTestId('import-confirm').click()
  await page.getByRole('alertdialog').getByRole('button').last().click()
  await expect(page.getByTestId('done-step')).toBeVisible()
  await shot(page, 'import-done')
  const afterImport = await readDb(page)
  const imported = afterImport.leads.filter((l) => l.importJobId)
  expect(imported.length).toBeGreaterThan(5)
  expect(imported.every((l) => l.ownerId)).toBe(true)
  const snehas = imported.filter((l) => l.ownerId === 'u-sneha')
  expect(snehas.length).toBeGreaterThan(0)
  expect(afterImport.notifications.some((n) => n.userId === 'u-sneha' && !seed.notifications.some((s) => s.at === n.at && s.kind === n.kind))).toBe(true)

  // Sneha sees her imported leads in Leads and through the assistant
  await switchTo(page, 'profile-u-sneha')
  await page.goto('/leads')
  for (const l of snehas.slice(0, 3)) await expect(page.locator('main')).toContainText(l.name)
  const a = await ask(page, 'find my highest-priority leads')
  await expect(a.getByTestId('demo-ai-badge').first()).toBeVisible()
  await page.keyboard.press('Escape')
  // Vikram does not see Sneha's
  await switchTo(page, 'profile-u-vikram')
  await page.goto('/leads')
  await expect(page.locator('main h1').first()).toBeVisible()
  await expect(page.locator('main')).not.toContainText(snehas[0].name)

  // persistence after reload (role included)
  await page.reload()
  await expect(page.locator('main h1').first()).toBeVisible()
  expect((await readDb(page)).leads.filter((l) => l.importJobId).length).toBe(imported.length)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('crm-e2e-session')!).state.userId)).toBe('u-vikram')

  // Reset demo data (admin) brings the seed back and survives a reload
  await switchTo(page, 'role-admin')
  await page.goto('/settings/demo')
  await page.getByTestId('demo-reset').click()
  await page.getByRole('alertdialog').getByRole('button', { name: /Reset everything/ }).click()
  await expect(page.getByText('Demo data reset').first()).toBeVisible()
  await expect.poll(async () => (await readDb(page)).leads.filter((l) => l.importJobId).length).toBe(0)
  await page.reload()
  await expect(page.locator('main h1').first()).toBeVisible()
  const reset = await readDb(page)
  expect(reset.leads.length).toBe(seed.leads.length)
  expect(reset.importJobs.length).toBe(seed.importJobs.length)
  await shot(page, 'reset-done')
  expect(consoleProblems).toEqual([])
})
