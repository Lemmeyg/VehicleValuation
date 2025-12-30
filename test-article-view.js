/**
 * Test script to check article viewing
 * Run with: node test-article-view.js
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture console logs and errors
  const errors = [];
  const logs = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`[BROWSER ${msg.type()}]`, msg.text());
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('[PAGE ERROR]', error.message);
  });

  try {
    console.log('Navigating to admin knowledge base page...');
    await page.goto('http://localhost:3000/admin/knowledge-base', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Take screenshot
    await page.screenshot({ path: 'test-kb-admin.png' });
    console.log('Screenshot saved: test-kb-admin.png');

    // Look for article links
    const articles = await page.locator('a[href*="/knowledge-base/"]').all();
    console.log(`Found ${articles.length} article links`);

    if (articles.length > 0) {
      // Click the first article
      const firstArticle = articles[0];
      const href = await firstArticle.getAttribute('href');
      console.log(`Clicking article: ${href}`);

      await firstArticle.click();
      await page.waitForLoadState('networkidle');

      // Take screenshot of article page
      await page.screenshot({ path: 'test-article-page.png' });
      console.log('Screenshot saved: test-article-page.png');

      // Check for article content
      const hasTitle = await page.locator('h1').count() > 0;
      const hasContent = await page.locator('.prose').count() > 0;

      console.log('\n=== Article Page Status ===');
      console.log(`Has title: ${hasTitle}`);
      console.log(`Has content: ${hasContent}`);

      if (hasTitle) {
        const title = await page.locator('h1').first().textContent();
        console.log(`Title: ${title}`);
      }

      if (hasContent) {
        const contentPreview = await page.locator('.prose').first().textContent();
        console.log(`Content preview: ${contentPreview.substring(0, 200)}...`);
      }
    } else {
      console.log('No articles found on admin page');
    }

    console.log('\n=== Errors Captured ===');
    if (errors.length > 0) {
      errors.forEach(err => console.error(err));
    } else {
      console.log('No errors captured!');
    }

    // Wait a bit before closing
    await page.waitForTimeout(2000);

  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'test-error.png' });
  } finally {
    await browser.close();
  }
})();
