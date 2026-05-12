import { test, expect } from '@playwright/test'

test.describe('/dispute-letter page', () => {
  test('renders headline and form', async ({ page }) => {
    await page.goto('/dispute-letter')
    await expect(
      page.getByRole('heading', { name: /the dispute letter that gets insurance companies/i })
    ).toBeVisible()
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /download free letter/i })).toBeVisible()
  })

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/dispute-letter')
    await page.getByRole('textbox', { name: /email/i }).fill('not-an-email')
    await page.getByRole('button', { name: /download free letter/i }).click()
    await expect(page.getByText(/please enter a valid email address/i)).toBeVisible()
  })

  test('shows success state after valid email submission', async ({ page }) => {
    await page.route('/api/dispute-letter', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          downloadUrl: 'data:application/octet-stream;base64,dGVzdA==',
        }),
      })
    )

    await page.goto('/dispute-letter')
    await page.getByRole('textbox', { name: /email/i }).fill(`e2e-${Date.now()}@example.com`)
    await page.getByRole('button', { name: /download free letter/i }).click()

    await expect(page.getByText(/your download has started/i)).toBeVisible({ timeout: 10000 })
  })
})
