import { expect, test } from '@playwright/test';

test('renders the published native store and hides unpublished products', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/store/browser-native-store');
  await expect(page).toHaveTitle(/Native Store|Kablet/i);
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toBeVisible();
  await expect(page.getByText('Private Draft Product')).toHaveCount(0);
  await expect(page.getByText('USD 24.00')).toBeVisible();
});

test('renders the published native store on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/store/browser-native-store');
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toBeVisible();
});

test('returns a safe not-found experience for an unpublished store', async ({ page }) => {
  const response = await page.goto('/store/not-published');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This storefront is not available.' })).toBeVisible();
});
