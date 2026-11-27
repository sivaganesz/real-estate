/**
 * Shared test fixture: clears localStorage before every page load (fresh seed) unless the test title has @persist,
 * and collects console errors / warnings and page errors so a test can assert the app loads cleanly.
 */
import { test as base, expect } from '@playwright/test'

type Fixtures = { consoleProblems: string[] }

export const test = base.extend<Fixtures>({
  consoleProblems: [async ({ page }, use, testInfo) => {
    const problems: string[] = []
    if (!testInfo.title.includes('@persist')) {
      await page.addInitScript(() => {
        if (!sessionStorage.getItem('__e2e-cleared')) {
          localStorage.clear()
          sessionStorage.setItem('__e2e-cleared', '1')
        }
      })
    }
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`)
    })
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
    await use(problems)
  }, { auto: true }],
})

export { expect }
