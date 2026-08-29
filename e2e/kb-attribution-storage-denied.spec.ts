import { test, expect } from '@playwright/test'

/**
 * Regression guard for BL-173 / PR #143.
 *
 * `setKBAttribution` (lib/analytics/kb-attribution.ts) runs from
 * `ArticlePageTracker`'s mount effect on every KB article view. Some browsers
 * (blocked cookies, strict privacy modes, embedded contexts) make the
 * `window.sessionStorage` getter itself throw DOMException/SecurityError.
 * Before PR #143 that unguarded throw propagated out of the effect and, with no
 * error boundary on the /knowledge-base/[slug] route, fell through to the global
 * error page — taking the whole article down and losing KB→form attribution.
 *
 * This test denies sessionStorage access the same way and asserts the article
 * still renders. Validated green against production after PR #143. Without the
 * guard the mount-effect throw has no catch and no route error boundary, so the
 * heading assertion below would fail (global error page) — that path was not
 * re-executed here since the fix is already live.
 */
test.describe('KB article with sessionStorage access denied (BL-173)', () => {
  const denySessionStorage = () => {
    const denied = () => {
      throw new DOMException('Access is denied for this document.', 'SecurityError')
    }
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: denied })
  }

  test('article still renders and does not crash to the error page', async ({ page }) => {
    await page.addInitScript(denySessionStorage)

    const pageErrors: string[] = []
    page.on('pageerror', e => pageErrors.push(e.message))

    await page.goto('/knowledge-base/indiana-total-loss-law-explained')

    // Sanity-check the denial is actually in effect for page scripts — otherwise
    // this test would pass vacuously.
    const storageState = await page.evaluate(() => {
      try {
        void window.sessionStorage
        return 'accessible'
      } catch (e) {
        return (e as Error).name
      }
    })
    expect(storageState).toBe('SecurityError')

    // The article heading must be present — this is what disappears when the
    // mount-effect throw bubbles to the global-error boundary.
    await expect(
      page.getByRole('heading', { name: /indiana total loss law/i }).first()
    ).toBeVisible({ timeout: 15000 })

    // Give the mount effects time to run (that's where the throw happened).
    await page.waitForTimeout(1500)

    // The embedded report bar (also a client component on the page) still mounts.
    await expect(
      page.getByRole('button', { name: /valuation|comparable sales/i }).first()
    ).toBeVisible()

    // No storage error escaped to the window.
    expect(
      pageErrors.filter(m => /securityerror|sessionstorage|access is denied/i.test(m))
    ).toEqual([])
  })

  test('happy path unaffected: attribution is written when storage works', async ({ page }) => {
    await page.goto('/knowledge-base/pennsylvania-total-loss-law-explained')
    await expect(
      page.getByRole('heading', { name: /pennsylvania total loss law/i }).first()
    ).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)

    // The try/catch must not have broken the write path: the mount effect still
    // records the last-touched article under 'kb_last_touch'.
    const raw = await page.evaluate(() => window.sessionStorage.getItem('kb_last_touch'))
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string)).toMatchObject({
      slug: 'pennsylvania-total-loss-law-explained',
    })
  })
})
