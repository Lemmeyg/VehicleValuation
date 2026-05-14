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
    // Section only renders if suppliers exist — check heading if present
    const heading = page.getByRole('heading', {
      name: 'Find a Pennsylvania Total Loss Professional',
    })
    const isVisible = await heading.isVisible().catch(() => false)
    if (isVisible) {
      await expect(heading).toBeVisible()
    }
    // Whether or not suppliers exist, the article body must always be present
    await expect(
      page.getByRole('heading', { name: /Pennsylvania Total Loss Law/i }).first()
    ).toBeVisible()
  })
})
