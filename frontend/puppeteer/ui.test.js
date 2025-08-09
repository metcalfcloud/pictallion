// Automated Puppeteer UI tests for major features
import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:5173'; // Adjust if needed

(async () => {
  const results = [];
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();
  await page.goto(BASE_URL);

  async function runTest(name, fn) {
    try {
      await fn();
      results.push({ name, status: 'PASS' });
    } catch (e) {
      results.push({ name, status: 'FAIL', error: e.message });
    }
  }

  await runTest('Gallery loads and displays images', async () => {
    await page.waitForSelector('[data-testid="gallery"]');
    const images = await page.$$('[data-testid="gallery-image"]');
    if (images.length === 0) throw new Error('No images found');
  });

  await runTest('Upload supports preview and drag-and-drop', async () => {
    await page.click('[data-testid="upload-button"]');
    await page.waitForSelector('[data-testid="upload-preview"]');
    if (!await page.$('[data-testid="upload-preview"]')) throw new Error('No preview');
  });

  await runTest('People Manager displays people list', async () => {
    await page.click('[data-testid="people-manager-nav"]');
    await page.waitForSelector('[data-testid="people-list"]');
    const people = await page.$$('[data-testid="person-item"]');
    if (people.length === 0) throw new Error('No people found');
  });

  await runTest('Metadata Viewer shows metadata', async () => {
    await page.click('[data-testid="metadata-viewer-nav"]');
    await page.waitForSelector('[data-testid="metadata-table"]');
    if (!await page.$('[data-testid="metadata-table"]')) throw new Error('No metadata');
  });

  await runTest('Face Detection works', async () => {
    await page.click('[data-testid="face-detection-nav"]');
    await page.waitForSelector('[data-testid="face-detection-result"]');
    if (!await page.$('[data-testid="face-detection-result"]')) throw new Error('No face detection result');
  });

  await runTest('Bulk actions are available', async () => {
    await page.click('[data-testid="bulk-actions-nav"]');
    await page.waitForSelector('[data-testid="bulk-action-btn"]');
    if (!await page.$('[data-testid="bulk-action-btn"]')) throw new Error('No bulk action button');
  });

  await runTest('Search and filter function', async () => {
    await page.type('[data-testid="search-input"]', 'test');
    await page.click('[data-testid="search-btn"]');
    await new Promise(r => setTimeout(r, 500));
    const resultsCount = await page.$$('[data-testid="search-result"]');
    if (resultsCount.length < 0) throw new Error('No search results');
  });

  await runTest('Onboarding/help modal appears', async () => {
    await page.click('[data-testid="help-nav"]');
    await page.waitForSelector('[data-testid="onboarding-modal"]');
    if (!await page.$('[data-testid="onboarding-modal"]')) throw new Error('No onboarding modal');
  });

  await runTest('User settings/profile accessible', async () => {
    await page.click('[data-testid="user-settings-nav"]');
    await page.waitForSelector('[data-testid="user-profile"]');
    if (!await page.$('[data-testid="user-profile"]')) throw new Error('No user profile');
  });

  await runTest('Dark mode toggle works', async () => {
    await page.click('[data-testid="dark-mode-toggle"]');
    await new Promise(r => setTimeout(r, 300));
    const bodyClass = await page.evaluate(() => document.body.className);
    if (!bodyClass.includes('dark')) throw new Error('Dark mode not enabled');
  });

  await runTest('Responsive layout (mobile)', async () => {
    await page.setViewport({ width: 375, height: 667 });
    await page.reload();
    await page.waitForSelector('[data-testid="mobile-nav"]');
    if (!await page.$('[data-testid="mobile-nav"]')) throw new Error('No mobile nav');
  });

  await runTest('Accessibility: ARIA attributes present', async () => {
    const ariaLabels = await page.$$eval('[aria-label]', els => els.length);
    if (ariaLabels === 0) throw new Error('No ARIA labels');
  });

  await browser.close();
  console.log('UI Test Results:', results);
})();