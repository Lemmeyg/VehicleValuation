import { test, expect } from '@playwright/test'

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/')

  // Wait for the page to load
  await page.waitForLoadState('networkidle')

  // Check that the page title is present
  await expect(page).toHaveTitle(/Vehicle Valuation/i)
})
