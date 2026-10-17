import { expect, test } from '@playwright/test';

test('renders different governed native compositions for isolated visitors', async ({ browser }) => {
  const discoveryContext = await browser.newContext();
  const comparisonContext = await browser.newContext();
  const discovery = await discoveryContext.newPage();
  const comparison = await comparisonContext.newPage();
  try {
    await Promise.all([discovery.goto('/store/browser-native-store'), comparison.goto('/store/browser-native-store')]);
    await discovery.getByRole('button', { name: 'Help me find something' }).click();
    await expect(discovery.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
    await comparison.getByRole('button', { name: 'Compare products' }).click();
    await expect(comparison.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
    await expect(discovery.getByRole('heading', { name: 'Compare the collection' })).toHaveCount(0);
    await expect(comparison.getByRole('heading', { name: 'A useful place to begin.' })).toHaveCount(0);
  } finally {
    await discoveryContext.close();
    await comparisonContext.close();
  }
});

test('resumes the server-authorized native composition after reload', async ({ page }) => {
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
});
