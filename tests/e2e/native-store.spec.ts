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
  await expect(page.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toBeVisible();
  await expect(page.getByText('Private Draft Product')).toHaveCount(0);
  await expect(page.getByText('USD 24.00')).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Compare products' })).toBeVisible();
});

test('adapts the canvas through discovery, spotlight, and comparison', async ({ page }) => {
  await page.goto('/store/browser-native-store');
  await expect(page.getByRole('button', { name: 'Help me find something' })).toBeVisible();
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();
  await expect(page.getByRole('heading', { name: 'Browser Native Product' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
  await page.getByRole('button', { name: 'Compare products' }).click();
  await page.getByRole('button', { name: 'View Browser Native Product' }).first().click();
  await page.getByRole('button', { name: 'View Browser Native Alternate' }).first().click();
  await expect(page.getByRole('heading', { name: 'A clear comparison' })).toBeVisible();
  await expect(page.getByText('USD 24.00')).toBeVisible();
  await expect(page.getByText('USD 36.00')).toBeVisible();
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
