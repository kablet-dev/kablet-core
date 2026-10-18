import { expect, test } from '@playwright/test';
import { expireDisposableNativeCarts, updateDisposableNativeProductPrice } from './support/disposable-postgres';

const storePath = '/store/browser-native-store';
const isolatedStorePath = '/store/browser-isolated-store';

function cartButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: /^Cart/ });
}

async function waitForCartHydration(page: import('@playwright/test').Page): Promise<void> {
  await expect(cartButton(page)).toHaveText(/^Cart · \d+$/);
}

async function openDiscovery(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(storePath, { waitUntil: 'load' });
  await waitForCartHydration(page);
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
}

async function addAvailableProduct(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: /added to your cart/i })).toContainText('added to your cart', { timeout: 15000 });
  await expect(cartButton(page)).toHaveText('Cart · 1');
}

test('adds from discovery, issues an HttpOnly cookie, and persists after reload', async ({ page, context }) => {
  await openDiscovery(page);
  await addAvailableProduct(page);
  await expect(cartButton(page)).toHaveText('Cart · 1');
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();

  const cookies = await context.cookies();
  const cartCookie = cookies.find(cookie => cookie.name.startsWith('kablet_cart_'));
  expect(cartCookie).toBeDefined();
  expect(cartCookie?.httpOnly).toBe(true);
  expect(cartCookie?.sameSite).toBe('Lax');
  expect(cartCookie?.path).toBe('/api/store/browser-native-store');

  const response = await page.request.get('/api/store/browser-native-store/cart');
  const body = await response.text();
  expect(response.ok()).toBe(true);
  expect(body).not.toContain(cartCookie!.value);
  expect(await page.locator('body').innerText()).not.toContain(cartCookie!.value);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(cartButton(page)).toHaveText('Cart · 1');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await cartButton(page).click();
  await expect(page.getByRole('dialog')).toContainText('Browser Native Product');
  await expect(page.getByRole('dialog')).toContainText('USD 24.00');
  await expect(page.getByRole('dialog')).toContainText('Saved subtotal');
});

test('adds from spotlight without changing the active composition', async ({ page }) => {
  await openDiscovery(page);
  await page.getByRole('button', { name: 'View product' }).first().click();
  await expect(page.getByRole('heading', { name: 'Browser Native Product' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status').filter({ hasText: /added to your cart/i })).toContainText('added to your cart');
  await expect(page.getByRole('heading', { name: 'Browser Native Product' })).toBeVisible();
  await expect(cartButton(page)).toHaveText('Cart · 1');
});

test('updates quantity and removes the line using authoritative cart state', async ({ page }) => {
  await openDiscovery(page);
  await addAvailableProduct(page);
  await cartButton(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Increase quantity for Browser Native Product' }).click();
  await expect(dialog.getByText('2', { exact: true })).toBeVisible();
  await expect(cartButton(page)).toHaveText('Cart · 2');
  await dialog.getByRole('button', { name: 'Decrease quantity for Browser Native Product' }).click();
  await expect(cartButton(page)).toHaveText('Cart · 1');
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(cartButton(page)).toHaveText('Cart · 0');
  await expect(dialog.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test('does not offer unavailable or unpublished products for adding', async ({ page }) => {
  await openDiscovery(page);
  await expect(page.getByText('Private Draft Product')).toHaveCount(0);
  const unavailable = page.locator('article').filter({ hasText: 'Browser Native Alternate' }).first();
  await expect(unavailable.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeEnabled();
});

test('requires explicit acceptance when the authoritative price changes', async ({ page }) => {
  await updateDisposableNativeProductPrice({ amountMinor: 2400, priceRevision: 1 });
  try {
    await openDiscovery(page);
    await addAvailableProduct(page);
    await updateDisposableNativeProductPrice({ amountMinor: 2700, priceRevision: 2 });
    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Help me find something' }).click();
    await cartButton(page).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Saved unit price: USD 24.00');
    await expect(dialog).toContainText('Current: USD 27.00');
    await expect(dialog.getByText('Price changed')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Accept current price' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Accept current price' }).click();
    await expect(dialog.getByText('Current price accepted')).toBeVisible();
    await expect(dialog).toContainText('Current: USD 27.00');
  } finally {
    await updateDisposableNativeProductPrice({ amountMinor: 2400, priceRevision: 1 });
  }
});

test('keeps carts isolated between published stores', async ({ page }) => {
  await openDiscovery(page);
  await addAvailableProduct(page);
  await expect(cartButton(page)).toHaveText('Cart · 1');
  await page.goto(isolatedStorePath, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'Isolated Native Store' })).toBeVisible();
  await waitForCartHydration(page);
  await expect(cartButton(page)).toHaveText('Cart · 0');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(cartButton(page)).toHaveText('Cart · 1');
  await page.goto(storePath, { waitUntil: 'load' });
  await waitForCartHydration(page);
  await expect(cartButton(page)).toHaveText('Cart · 1');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await cartButton(page).click();
  await expect(page.getByRole('dialog')).toContainText('Browser Native Product');
  await expect(page.getByRole('dialog')).not.toContainText('Isolated Native Product');
});

test('keeps cart controls keyboard reachable on mobile and closes on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDiscovery(page);
  await addAvailableProduct(page);
  const trigger = cartButton(page);
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Close cart' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('clears an expired cart without silently creating a replacement', async ({ page }) => {
  await openDiscovery(page);
  await addAvailableProduct(page);
  await expect(cartButton(page)).toHaveText('Cart · 1');
  await expireDisposableNativeCarts();
  await page.reload({ waitUntil: 'load' });
  await expect(cartButton(page)).toHaveText('Cart · 0');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await cartButton(page).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test('surfaces a cart version conflict without duplicating or recreating the cart', async ({ page, context }) => {
  await openDiscovery(page);
  await addAvailableProduct(page);
  const secondPage = await context.newPage();
  await secondPage.goto(storePath, { waitUntil: 'load' });
  await waitForCartHydration(secondPage);
  await expect(cartButton(secondPage)).toHaveText('Cart · 1');
  await secondPage.getByRole('button', { name: 'Help me find something' }).click();
  await cartButton(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Increase quantity for Browser Native Product' }).click();
  await expect(cartButton(page)).toHaveText('Cart · 2');
  await cartButton(secondPage).click();
  await secondPage.getByRole('dialog').getByRole('button', { name: 'Increase quantity for Browser Native Product' }).click();
  await expect(secondPage.getByRole('dialog').getByRole('alert')).toContainText('cart changed');
  await expect(cartButton(secondPage)).toHaveText('Cart · 2');
  await secondPage.close();
});
