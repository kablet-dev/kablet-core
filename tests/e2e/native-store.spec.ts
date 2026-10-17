import { expect, test } from '@playwright/test';

test('renders the published native store and hides unpublished products', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/store/browser-native-store');
  await expect(page).toHaveTitle(/Native Store|Kablet/i);
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Help me find something' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare products' })).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toHaveCount(0);
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toBeVisible();
  await expect(page.getByText('Private Draft Product')).toHaveCount(0);
  await expect(page.getByText('USD 24.00')).toBeVisible();
});

test('keeps a fresh and returning visit on the cinematic entry until explicit intent', async ({ page }) => {
  const bootstrap = page.waitForResponse(response => response.url().includes('/api/store/browser-native-store/intelligence') && response.request().method() === 'GET');
  await page.goto('/store/browser-native-store');
  await (await bootstrap).finished();
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();

  const discoveryResponse = page.waitForResponse(response => response.url().includes('/api/store/browser-native-store/intelligence') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await (await discoveryResponse).finished();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();

  const returningBootstrap = page.waitForResponse(response => response.url().includes('/api/store/browser-native-store/intelligence') && response.request().method() === 'GET');
  await page.goto('/store/browser-native-store');
  await (await returningBootstrap).finished();
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toHaveCount(0);
});

test('does not let a late bootstrap response overwrite explicit intent', async ({ page }) => {
  let releaseBootstrap!: () => void;
  const bootstrapHeld = new Promise<void>(resolve => { releaseBootstrap = resolve; });
  await page.route('**/api/store/browser-native-store/intelligence', async route => {
    if (route.request().method() === 'GET') await bootstrapHeld;
    await route.continue();
  });
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  releaseBootstrap();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await page.unroute('**/api/store/browser-native-store/intelligence');
});

test('keeps the cinematic entry controls within representative desktop viewports', async ({ page }) => {
  for (const viewport of [{ width: 1728, height: 880 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/store/browser-native-store');
    await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
    const heading = await page.getByRole('heading', { name: 'Native Store Collection' }).boundingBox();
    const input = await page.getByLabel('What would be useful next?').boundingBox();
    const shortcut = await page.getByRole('button', { name: 'Help me find something' }).boundingBox();
    const metrics = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    expect(heading && heading.y + heading.height).toBeLessThanOrEqual(viewport.height);
    expect(input && input.y + input.height).toBeLessThanOrEqual(viewport.height);
    expect(shortcut && shortcut.y + shortcut.height).toBeLessThanOrEqual(viewport.height);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 2);
    await expect(page.getByRole('button', { name: /Cart ·/ })).toBeVisible();
  }
});

test('keeps the featured product and alternatives in the discovery first viewport', async ({ page }) => {
  for (const viewport of [{ width: 1728, height: 880 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/store/browser-native-store');
    await page.getByRole('button', { name: 'Help me find something' }).click();
    await expect(page.getByText('Browser Native Product').first()).toBeVisible();
    await expect(page.getByText('Browser Native Product')).toBeVisible();
    await expect(page.getByText('USD 24.00')).toBeVisible();
    await expect(page.getByText('Available now').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Add to cart|Unavailable/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compare products' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Other published products' })).toBeVisible();
    const metrics = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 2);
  }
});

test('renders the published native store on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/store/browser-native-store');
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Help me find something' })).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toHaveCount(0);
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product')).toBeVisible();
  await expect(page.getByText('Private Draft Product')).toHaveCount(0);
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();
  await expect(page.getByRole('heading', { name: 'Browser Native Product' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByRole('button', { name: 'Compare products' })).toBeVisible();
});

test('adapts the canvas through discovery, spotlight, and comparison', async ({ page }) => {
  await page.goto('/store/browser-native-store');
  await expect(page.getByRole('button', { name: 'Help me find something' })).toBeVisible();
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();
  await expect(page.getByRole('heading', { name: 'Browser Native Product' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await page.getByRole('button', { name: 'Compare products' }).click();
  await expect(page.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();
  await page.getByRole('button', { name: 'View Browser Native Alternate' }).first().click();
  await expect(page.getByRole('heading', { name: 'A clear comparison' })).toBeVisible();
  await expect(page.getByText('USD 24.00')).toBeVisible();
  await expect(page.getByText('USD 36.00')).toBeVisible();
});

test('presents an editorial spotlight and preserves cart and navigation actions', async ({ page }) => {
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();

  await expect(page.getByRole('heading', { name: 'Browser Native Product' })).toBeVisible();
  await expect(page.getByText('Selected from the collection')).toBeVisible();
  await expect(page.getByText('Price', { exact: true })).toBeVisible();
  await expect(page.getByText('Availability', { exact: true })).toBeVisible();
  await expect(page.getByText('Fulfillment', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();

  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Browser Native Product added to your cart.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Cart · 1/ })).toBeVisible();

  await page.getByRole('button', { name: 'Compare with another product' }).click();
  await expect(page.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
});

test('keeps exploration, cart, and checkout inside one adaptive workspace', async ({ page }) => {
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByRole('region', { name: 'exploration workspace' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Shopping workspace actions' })).toBeVisible();
  const workspaceMetrics = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(workspaceMetrics.scrollHeight).toBeLessThanOrEqual(workspaceMetrics.innerHeight + 2);
  expect(workspaceMetrics.scrollWidth).toBeLessThanOrEqual(workspaceMetrics.innerWidth + 2);
  await page.getByRole('button', { name: 'Compare products' }).last().click();
  await expect(page.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();
  await expect(page.getByRole('button', { name: 'View product information' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare with alternatives' })).toBeVisible();
  await page.getByRole('button', { name: 'Compare with alternatives' }).click();
  await expect(page.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect a selected product' }).click();
  await expect(page.getByRole('heading', { name: 'Browser Native Product' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to discovery' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('button', { name: /Cart · 1/ })).toBeVisible();
  await page.getByRole('button', { name: /Cart · 1/ }).click();
  await expect(page.getByRole('region', { name: 'cart workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('region', { name: 'checkout workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review your selections' })).toBeVisible();
});

test('keeps the intent input keyboard reachable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/store/browser-native-store');
  const input = page.getByLabel('What would be useful next?');
  await input.focus();
  await expect(input).toBeFocused();
  await input.fill('compare these');
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
});

test('returns a safe not-found experience for an unpublished store', async ({ page }) => {
  const response = await page.goto('/store/not-published');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This storefront is not available.' })).toBeVisible();
});
