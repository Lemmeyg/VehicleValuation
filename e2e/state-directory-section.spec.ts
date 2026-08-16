import { test, expect } from '@playwright/test'

test.describe('StateDirectorySection', () => {
  test('does not appear on non-state KB articles', async ({ page }) => {
    await page.goto(
      '/knowledge-base/how-to-challenge-insurance-company-vehicle-valuation-complete-guide'
    )
    await expect(
      page.getByRole('heading', { name: /Find a .* Total Loss Professional/ })
    ).not.toBeVisible()
  })

  test('section heading uses the correct state name on a state article', async ({ page }) => {
    await page.goto('/knowledge-base/pennsylvania-total-loss-law-explained')
    // Pennsylvania has at least one published appraiser/advocate supplier in the
    // directory today, so this section must render — not a conditional check.
    await expect(
      page.getByRole('heading', { name: 'Find a Pennsylvania Total Loss Professional' })
    ).toBeVisible()
    // Whether or not suppliers exist, the article body must always be present
    await expect(
      page.getByRole('heading', { name: /Pennsylvania Total Loss Law/i }).first()
    ).toBeVisible()
  })
})
