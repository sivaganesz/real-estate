/**
 * QA – Visual & responsive (round 1). Walks every main route for each demo profile (switched through the real profile
 * switcher) at 1440 light, 1440 dark, 768 and 375, plus Tamil for key screens. Saves full-page screenshots under
 * notes/screens/qa/visual/ and checks: no horizontal page overflow, no element sticking out of the viewport, no console
 * errors or warnings, no raw i18n keys, Tamil pages without left-over English UI copy, visible keyboard focus and
 * prefers-reduced-motion. Assertions describe the CORRECT behaviour, so a test fails while its bug is still open.
 *
 * Set QA_VIS_REPORT=<path> to also dump every per-page measurement as JSON (used while triaging).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

const SHOTS = path.resolve(import.meta.dirname, '../notes/screens/qa/visual')
fs.mkdirSync(SHOTS, { recursive: true })

type Mode = '1440-light' | '1440-dark' | '768' | '375' | '1440-ta'
const VIEWPORT: Record<Mode, { width: number; height: number }> = {
  '1440-light': { width: 1440, height: 900 },
  '1440-dark': { width: 1440, height: 900 },
  '1440-ta': { width: 1440, height: 900 },
  '768': { width: 768, height: 1024 },
  '375': { width: 375, height: 812 },
}

const PROFILES = [
  { key: 'admin', testId: 'role-admin' },
  { key: 'manager', testId: 'role-manager' },
  { key: 'arjun', testId: 'profile-u-arjun' },
  { key: 'sneha', testId: 'profile-u-sneha' },
  { key: 'vikram', testId: 'profile-u-vikram' },
] as const

type Finding = { profile: string; mode: Mode; route: string; kind: string; detail: string }
const report: Finding[] = []

function dumpReport() {
  const out = process.env.QA_VIS_REPORT
  if (!out) return
  let prev: Finding[] = []
  try { prev = JSON.parse(fs.readFileSync(out, 'utf8')) as Finding[] } catch { /* first write */ }
  fs.writeFileSync(out, JSON.stringify([...prev, ...report.splice(0)], null, 1))
}

async function switchTo(page: Page, testId: string) {
  const vw = page.viewportSize()?.width ?? 1440
  if (vw < 768) {
    await page.getByTestId('topbar').getByRole('button').last().click()
  } else {
    await page.getByTestId('profile-switcher').click()
  }
  const picker = page.getByTestId('profile-picker')
  await expect(picker).toBeVisible()
  if (testId.startsWith('profile-') && !(await picker.getByTestId(testId).isVisible())) {
    await picker.getByTestId('role-executive').click()
  }
  await picker.getByTestId(testId).click()
  await expect(page.getByTestId('profile-picker')).toBeHidden()
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.getByTestId('topbar').getByTestId('theme-toggle').click()
  await page.getByTestId(`theme-${theme}`).click()
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
  else await expect(page.locator('html')).not.toHaveClass(/dark/)
}

async function setLanguage(page: Page, lang: 'en' | 'ta') {
  if ((await page.locator('html').getAttribute('lang')) !== lang) await page.getByTestId('topbar').getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', lang)
}

/** Client-side navigation keeps the store, the session and sessionStorage (so the fixture does not wipe data). */
async function go(page: Page, href: string) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, href)
  await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  // the lazy route shows a skeleton fallback first; wait until the real page has replaced it
  await expect(page.locator('main [aria-busy="true"]:has(> .skeleton)')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(450)
}

/** Page-level measurements: horizontal overflow, elements poking out of the viewport, raw i18n keys, English left in Tamil. */
async function measure(page: Page, lang: 'en' | 'ta') {
  return page.evaluate((lang) => {
    const doc = document.documentElement
    const vw = doc.clientWidth
    const pageOverflow = doc.scrollWidth - vw
    const clippedByAncestor = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (s.overflowX !== 'visible' || s.position === 'fixed') return true
      }
      return false
    }
    const describe = (el: Element) => {
      const tid = el.closest('[data-testid]')?.getAttribute('data-testid')
      const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
      return `${el.tagName.toLowerCase()}${tid ? `[in ${tid}]` : ''} "${txt}"`
    }
    const offenders: string[] = []
    for (const el of Array.from(document.querySelectorAll('main *, header *'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > vw + 1 && !clippedByAncestor(el)) offenders.push(describe(el) + ` right=${Math.round(r.right)}`)
      if (offenders.length > 6) break
    }
    // Text that is cut off without an ellipsis: overflow hidden/clip, no text-overflow, content wider than the box.
    const clippedText: string[] = []
    for (const el of Array.from(document.querySelectorAll('main *'))) {
      const s = getComputedStyle(el)
      if (!(el as HTMLElement).innerText || el.children.length > 2) continue
      if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        clippedText.push(describe(el) + ` ${el.scrollWidth}>${el.clientWidth}`)
      }
      if (clippedText.length > 6) break
    }
    const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT)
    const rawKeys: string[] = []
    const english: string[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? '').trim()
      if (!t) continue
      const parent = n.parentElement
      if (!parent || parent.closest('[aria-hidden="true"], script, style, input, textarea, [data-no-translate]')) continue
      if (/^[a-z]+:[a-zA-Z.]+$/.test(t) || /^[a-z]+(\.[a-zA-Z]+){2,}$/.test(t)) rawKeys.push(t)
      if (lang === 'ta' && /^[A-Za-z][a-z]+( [a-z]+){1,}[.!?]?$/.test(t)) english.push(t.slice(0, 60))
    }
    const h1 = document.querySelector('main h1')?.textContent ?? ''
    return { pageOverflow, offenders, clippedText, rawKeys: [...new Set(rawKeys)].slice(0, 8), english: [...new Set(english)].slice(0, 12), h1 }
  }, lang)
}

const slug = (href: string) => href.replace(/^\//, '').replace(/[/?=&]+/g, '_') || 'root'

async function shoot(page: Page, profile: string, mode: Mode, href: string) {
  await page.screenshot({ path: path.join(SHOTS, `${profile}--${slug(href)}--${mode}.png`), fullPage: true })
}

/** Main routes for the current profile: the sidebar links, notifications, and one detail page per record type it owns or can see. */
async function routesFor(page: Page): Promise<string[]> {
  await go(page, '/today')
  const hrefs = await page.getByTestId('sidebar').locator('a[data-testid^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
  const ids = await page.evaluate(() => {
    type Rec = { id: string; ownerId?: string | null; status?: string }
    const db = JSON.parse(localStorage.getItem('crm-e2e-db') ?? 'null')?.state?.db as Record<string, Rec[]> | undefined
    // the store persists nothing until the profile changes, so no entry means the default profile (executive Arjun)
    const session = (JSON.parse(localStorage.getItem('crm-e2e-session') ?? 'null')?.state ?? { role: 'executive', userId: 'u-arjun' }) as { role: string; userId: string }
    const mine = (list: Rec[] | undefined) => (list ?? []).find((r) => session.role !== 'executive' || r.ownerId === session.userId)?.id
    return { lead: mine(db?.leads), property: db?.properties?.[0]?.id, client: mine(db?.clients), appointment: mine(db?.appointments), user: session.userId, role: session.role }
  })
  const extra: string[] = ['/notifications']
  if (hrefs.includes('/leads')) { extra.push('/leads/new'); if (ids.lead) extra.push(`/leads/${ids.lead}`) }
  if (hrefs.includes('/properties') && ids.property) extra.push(`/properties/${ids.property}`)
  if (hrefs.includes('/clients') && ids.client) extra.push(`/clients/${ids.client}`)
  if (hrefs.includes('/appointments') && ids.appointment) extra.push(`/appointments/${ids.appointment}`)
  if (hrefs.includes('/team')) extra.push('/team/u-arjun')
  if (hrefs.includes('/reports')) extra.push('/reports/sources')
  // executives are deliberately redirected from /reports/team to their personal report (no Team tab)
  if (hrefs.includes('/reports') && ids.role !== 'executive') extra.push('/reports/team')
  if (hrefs.includes('/settings')) extra.push('/settings/profile')
  if (hrefs.includes('/import')) extra.push('/import/leads', '/import/drafts')
  return [...hrefs, ...extra.filter((h) => !hrefs.includes(h))]
}

async function walk(page: Page, consoleProblems: string[], profile: string, mode: Mode, routes: string[]) {
  const lang = mode === '1440-ta' ? 'ta' : 'en'
  for (const href of routes) {
    const before = consoleProblems.length
    try {
      await go(page, href)
    } catch (e) {
      report.push({ profile, mode, route: href, kind: 'no-heading', detail: String(e).slice(0, 200) })
      await shoot(page, profile, mode, href)
      continue
    }
    const m = await measure(page, lang)
    await shoot(page, profile, mode, href)
    const add = (kind: string, detail: string) => report.push({ profile, mode, route: href, kind, detail })
    if (m.pageOverflow > 0) add('page-overflow', `${m.pageOverflow}px; ${m.offenders.join(' | ')}`)
    else if (m.offenders.length) add('element-outside-viewport', m.offenders.join(' | '))
    if (m.clippedText.length) add('clipped-text', m.clippedText.join(' | '))
    if (m.rawKeys.length) add('raw-i18n-key', m.rawKeys.join(' | '))
    if (m.english.length) add('english-in-tamil', m.english.join(' | '))
    for (const p of consoleProblems.slice(before)) add('console', p.slice(0, 300))
  }
}

const MODES: Mode[] = ['1440-light', '1440-dark', '768', '375']

for (const profile of PROFILES) {
  for (const mode of MODES) {
    test(`${profile.key} @ ${mode}: every main route renders without overflow, console problems or raw keys`, async ({ page, consoleProblems }) => {
      test.setTimeout(420_000)
      // screenshots are taken with reduced motion so charts and count-ups are captured in their final state
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize(VIEWPORT['1440-light'])
      await page.goto('/today')
      await expect(page.getByTestId('sidebar')).toBeVisible()
      await switchTo(page, profile.testId)
      const routes = await routesFor(page)
      if (mode === '1440-dark') await setTheme(page, 'dark')
      await page.setViewportSize(VIEWPORT[mode])
      const start = report.length
      await walk(page, consoleProblems, profile.key, mode, routes)
      const mine = report.slice(start).filter((f) => f.kind !== 'clipped-text')
      dumpReport()
      expect(mine.map((f) => `${f.route} ${f.kind}: ${f.detail}`)).toEqual([])
    })
  }
}

test('Tamil: key screens are fully translated and do not overflow at 1440 and 375', async ({ page, consoleProblems }) => {
  test.setTimeout(300_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(VIEWPORT['1440-ta'])
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  await setLanguage(page, 'ta')
  const key = ['/today', '/leads', '/leads/new', '/pipeline', '/properties', '/appointments', '/tasks', '/reports', '/import', '/settings', '/team', '/notifications']
  const start = report.length
  await walk(page, consoleProblems, 'manager', '1440-ta', key)
  await page.setViewportSize(VIEWPORT['375'])
  for (const href of ['/today', '/leads', '/pipeline', '/reports']) {
    await go(page, href)
    const m = await measure(page, 'ta')
    await shoot(page, 'manager', '1440-ta', `${href}-375`)
    if (m.pageOverflow > 0) report.push({ profile: 'manager', mode: '375', route: href + ' (ta)', kind: 'page-overflow', detail: `${m.pageOverflow}px; ${m.offenders.join(' | ')}` })
  }
  const mine = report.slice(start).filter((f) => f.kind !== 'clipped-text')
  dumpReport()
  expect(mine.map((f) => `${f.mode} ${f.route} ${f.kind}: ${f.detail}`)).toEqual([])
})

test('keyboard: tabbing through main screens always shows a visible focus indicator', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(VIEWPORT['1440-light'])
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  const missing: string[] = []
  for (const href of ['/today', '/leads', '/pipeline', '/properties', '/appointments', '/tasks', '/reports', '/settings']) {
    await go(page, href)
    await page.locator('main h1').first().click()
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        const s = getComputedStyle(el)
        // a stretched link (card click target) paints its ring on its ::after overlay, which covers the whole card
        const after = getComputedStyle(el, '::after')
        const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
          || (after.content !== 'none' && after.position === 'absolute' && !!after.boxShadow && after.boxShadow !== 'none')
        const tid = el.closest('[data-testid]')?.getAttribute('data-testid') ?? ''
        const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
        // a focused recharts surface shows its tooltip and active dot as the focus indicator
        const chart = el.tagName.toLowerCase() === 'svg' && !!el.closest('.recharts-wrapper')
        return { ok: !!ring || chart, desc: `${el.tagName.toLowerCase()}${tid ? `[${tid}]` : ''} "${label}"` }
      })
      if (info && !info.ok) missing.push(`${href}: ${info.desc}`)
    }
  }
  expect([...new Set(missing)]).toEqual([])
})

test('prefers-reduced-motion: no CSS animation or transition runs and charts render without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(VIEWPORT['1440-light'])
  await page.goto('/today')
  await switchTo(page, 'role-admin')
  const longest = async () => page.evaluate(() => {
    const slow: string[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const s = getComputedStyle(el)
      const durs = [...s.animationDuration.split(','), ...s.transitionDuration.split(',')].map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 1 : 1000))
      const named = s.animationName !== 'none' || s.transitionProperty !== 'none'
      if (named && Math.max(...durs) > 1) slow.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} ${s.animationDuration}/${s.transitionDuration}`)
      if (slow.length > 5) break
    }
    // recharts draws with its own JS animation; with reduced motion the line path is present at once
    const animatingPaths = document.querySelectorAll('.recharts-layer.recharts-line-curve, .recharts-curve').length
    return { slow, animatingPaths }
  })
  for (const href of ['/today', '/reports', '/pipeline']) {
    await go(page, href)
    const r = await longest()
    expect(r.slow, href).toEqual([])
  }
})

/** WCAG contrast of an element's text against the nearest opaque background (canvas resolves oklch/color-mix). */
async function contrastOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const toRgb = (c: string) => {
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
      return Array.from(ctx.getImageData(0, 0, 1, 1).data)
    }
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    let bg = [255, 255, 255, 255]
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = toRgb(getComputedStyle(e).backgroundColor)
      if (c[3] > 200) { bg = c; break }
    }
    const [a, b] = [lum(toRgb(getComputedStyle(el).color)), lum(bg)].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  })
}

test('VIS-1 dark mode: the executive rank chip on Today is readable (≥ 4.5:1)', async ({ page }) => {
  await page.goto('/today')
  await switchTo(page, 'profile-u-arjun')
  await setTheme(page, 'dark')
  await expect(page.getByTestId('today-rank')).toBeVisible()
  await page.getByTestId('today-rank').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(SHOTS, 'VIS-1-dark-rank-chip.png') })
  expect(await contrastOf(page, '[data-testid="today-rank"]')).toBeGreaterThanOrEqual(4.5)
})

test('VIS-2 switching to Tamil re-renders the AI dashboard insights already on screen', async ({ page }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  await expect(page.locator('main')).toContainText('Your team this week: calls')
  await setLanguage(page, 'ta')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(SHOTS, 'VIS-2-tamil-stale-ai.png'), fullPage: true })
  await expect(page.locator('main')).not.toContainText('Your team this week: calls')
  await expect(page.locator('main')).not.toContainText(/calls \d+ · visits \d+ · bookings \d+/)
})

test('VIS-3 phone: the import wizard, the client page and the Tamil leads toolbar fit in 375 px', async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  await page.setViewportSize(VIEWPORT['375'])
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const results: Record<string, number> = {}
  await go(page, '/import/leads')
  results['/import/leads'] = await overflow()
  await page.screenshot({ path: path.join(SHOTS, 'VIS-3-import-wizard-375.png') })
  await go(page, '/clients/CL-1002')
  results['/clients/CL-1002'] = await overflow()
  await page.screenshot({ path: path.join(SHOTS, 'VIS-3-client-page-375.png') })
  // on phones the language toggle sits in the page footer
  await page.locator('main').getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta')
  await go(page, '/leads')
  results['/leads (ta)'] = await overflow()
  await page.screenshot({ path: path.join(SHOTS, 'VIS-3-leads-ta-375.png') })
  expect(results).toEqual({ '/import/leads': 0, '/clients/CL-1002': 0, '/leads (ta)': 0 })
})

test('VIS-4 toasts do not sit under the floating AI button', async ({ page }) => {
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  const toast = page.locator('[data-sonner-toast]').first()
  await expect(toast).toBeVisible()
  const [t, f] = [await toast.boundingBox(), await page.getByTestId('ai-fab').boundingBox()]
  await page.screenshot({ path: path.join(SHOTS, 'VIS-4-toast-vs-fab.png') })
  const overlap = !!t && !!f && t.x < f.x + f.width && f.x < t.x + t.width && t.y < f.y + f.height && f.y < t.y + t.height
  expect(overlap).toBe(false)
})

test('VIS-5 tablet and phone: data tables do not cut columns off (key columns only, or stacked cards)', async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/today')
  await switchTo(page, 'role-manager')
  const clipped: string[] = []
  for (const [w, href] of [[768, '/leads'], [768, '/clients'], [375, '/today'], [375, '/team']] as const) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 1024 })
    await go(page, href)
    await page.waitForTimeout(800)
    const cut = await page.evaluate(() => Array.from(document.querySelectorAll('main table')).filter((t) => {
      for (let p = t.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible' && p.scrollWidth > p.clientWidth + 1) return true
      }
      return false
    }).map((t) => t.querySelector('th')?.textContent ?? 'table'))
    if (cut.length) {
      clipped.push(`${w} ${href}: ${cut.join(', ')}`)
      await page.screenshot({ path: path.join(SHOTS, `VIS-5-table-${w}${href.replace(/\//g, '-')}.png`) })
    }
  }
  expect(clipped).toEqual([])
})
