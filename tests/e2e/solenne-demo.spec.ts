import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

const storePath = '/store/solenne-demo';

async function openDiscovery(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(storePath, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'SOLENNE' })).toBeVisible();
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Daily Hydration Serum', { exact: true }).first()).toBeVisible();
}

async function expectDecodedSolenneImages(page: import('@playwright/test').Page, count: number): Promise<void> {
  const images = page.locator('img[src*="/demo/solenne/"]');
  await expect(images).toHaveCount(count);
  await expect.poll(async () => images.evaluateAll(elements => elements.every(element => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  })), { timeout: 15000 }).toBe(true);
}

test('loads the persisted SOLENNE catalog and product media', async ({ page }) => {
  await openDiscovery(page);
  for (const title of ['Daily Hydration Serum', 'Barrier Comfort Cream', 'Gentle Cleansing Gel', 'Vitamin C Radiance Serum', 'Overnight Nourishing Mask']) await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expectDecodedSolenneImages(page, 5);
  await expect(page.getByText('USD 38.00')).toBeVisible();
  await expect(page.getByText('USD 46.00')).toBeVisible();
  await expect(page.getByText('USD 28.00')).toBeVisible();
  await expect(page.getByText('USD 52.00')).toBeVisible();
  await expect(page.getByText('USD 44.00')).toBeVisible();
});

test('decodes imagery across entry, spotlight, and comparison compositions', async ({ page }) => {
  await page.goto(storePath, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'SOLENNE' })).toBeVisible();
  await expectDecodedSolenneImages(page, 1);
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await page.getByRole('button', { name: 'View Daily Hydration Serum' }).first().click();
  await expectDecodedSolenneImages(page, 1);
  await page.getByRole('button', { name: 'Compare with another product' }).click();
  await expectDecodedSolenneImages(page, 5);
});

test('supports SOLENNE spotlight, comparison, cart persistence, and stock guards', async ({ page }) => {
  await openDiscovery(page);
  await page.getByRole('button', { name: 'View Daily Hydration Serum' }).first().click();
  await expect(page.getByRole('heading', { name: 'Daily Hydration Serum' })).toBeVisible();
  await expect(page.getByText(/30 mL/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Compare with another product' }).click();
  await expect(page.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await page.getByRole('button', { name: 'View Daily Hydration Serum' }).first().click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('button', { name: 'Cart · 1' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cart · 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByRole('button', { name: 'Unavailable' })).toHaveCount(2);
});

test('shows merchant-grounded guidance and bounded clarification in the rail', async ({ page }) => {
  await openDiscovery(page);
  await expect(page.getByRole('heading', { name: 'What should guide the first choice?' })).toBeVisible();
  await expect(page.getByText(/published product.*available inventory/i)).toBeVisible();
  await page.getByRole('button', { name: 'Show available options' }).click();
  await expect(page.getByRole('heading', { name: 'These products match that direction.' })).toBeVisible();
  await expect(page.getByText('Daily Hydration Serum', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/clinical|guaranteed|scarcity/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Check store policies' }).click();
  await expect(page.getByRole('heading', { name: /policy|store policy/i })).toBeVisible();
  await page.getByLabel('What would be useful next?').fill('tell me about clinical results');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What should guide the first choice?' })).toBeVisible();
  await expect(page.getByText(/clinical results/i)).toHaveCount(0);
});

test('shows purchase readiness from the selected published product', async ({ page }) => {
  await openDiscovery(page);
  await page.getByRole('button', { name: 'View Daily Hydration Serum' }).first().click();
  await page.getByRole('button', { name: 'Check purchase readiness' }).click();
  await expect(page.getByRole('heading', { name: 'Ready to review.' })).toBeVisible();
  await expect(page.getByText(/authorized cart flow/i)).toBeVisible();
  await expect(page.getByText(/clinical|guaranteed|scarcity/i)).toHaveCount(0);
});

test('keeps SOLENNE usable on mobile and isolated from the browser-native store', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDiscovery(page);
  await expect(page.getByRole('button', { name: /Cart ·/ })).toBeVisible();
  await page.goto('/store/browser-native-store');
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
  await expect(page.getByText('Daily Hydration Serum')).toHaveCount(0);
});

test('recovers from a stale visitor session without a false transition error', async ({ page }) => {
  const cookieName = `kablet_native_intelligence_${createHash('sha256').update('solenne-demo', 'utf8').digest('hex').slice(0, 16)}`;
  await page.context().addCookies([{ name: cookieName, value: 'stale-session-handle', domain: '127.0.0.1', path: '/api/store/solenne-demo' }]);
  const intelligenceResponses: number[] = [];
  page.on('response', async response => {
    if (response.url().includes('/api/store/solenne-demo/intelligence')) intelligenceResponses.push(response.status());
  });
  await page.goto(storePath, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'SOLENNE' })).toBeVisible();
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await page.waitForTimeout(2000);
  expect(intelligenceResponses).toContain(401);
  expect(intelligenceResponses).toContain(200);
  await expect(page.getByText('This experience could not be updated.')).toHaveCount(0);
});

test('clears a failed transition message when a newer local intent is selected', async ({ page }) => {
  await page.goto(storePath, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Daily Hydration Serum', { exact: true }).first()).toBeVisible();
  let failNextPost = true;
  await page.route('**/api/store/solenne-demo/intelligence', async route => {
    if (route.request().method() === 'POST' && failNextPost) {
      failNextPost = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'unavailable', message: 'The storefront experience is temporarily unavailable.' }) });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Compare products' }).click();
  await expect(page.getByText('This experience could not be updated.')).toBeVisible();
  await page.getByLabel('What would be useful next?').fill('I know what I want');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByText('Current direction: specific')).toBeVisible();
  await expect(page.getByText('This experience could not be updated.')).toHaveCount(0);
});
