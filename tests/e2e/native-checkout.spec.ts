import { expect, test } from '@playwright/test';
import { updateDisposableNativeProductPrice } from './support/disposable-postgres';

const storePath = '/store/browser-native-store';

async function openCheckout(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(storePath, { waitUntil: 'load' });
  await expect(page.getByRole('button', { name: /^Cart/ })).toHaveText('Cart · 0');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await page.getByRole('article').filter({ hasText: 'Browser Native Product' }).getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status').filter({ hasText: /added to your cart/i })).toContainText('added to your cart', { timeout: 15000 });
  await page.getByRole('button', { name: 'Cart · 1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('dialog')).toContainText('Review your selections');
}

test('prepares physical checkout from the adaptive canvas with authoritative totals and pending payment state', async ({ page }) => {
  await openCheckout(page);
  const checkout = page.getByRole('dialog');
  await checkout.getByLabel('Email').fill('visitor@example.test');
  await checkout.getByLabel('Name').fill('A Browser Visitor');
  await checkout.getByLabel('Country').fill('US');
  await checkout.getByLabel('Address').fill('1 Test Street');
  await checkout.getByLabel('City').fill('Test City');
  await checkout.getByLabel('Region').fill('TS');
  await checkout.getByLabel('Postal code').fill('00001');
  await checkout.getByRole('button', { name: 'Review total' }).click();
  await expect(checkout).toContainText('Server total: USD 31.53', { timeout: 15000 });
  await expect(checkout).toContainText('Reservation expires');
  await expect(checkout.getByRole('button', { name: 'Continue to secure payment' })).toBeVisible();
  await expect(checkout).toContainText('Payment remains pending until the merchant provider confirms it.');
  await expect(checkout.getByText('Payment verified')).toHaveCount(0);
});

test('surfaces a server-authoritative price conflict before reservation or payment', async ({ page }) => {
  await updateDisposableNativeProductPrice({ amountMinor: 2400, priceRevision: 1 });
  try {
    await openCheckout(page);
    await updateDisposableNativeProductPrice({ amountMinor: 2700, priceRevision: 2 });
    const checkout = page.getByRole('dialog');
    await checkout.getByLabel('Email').fill('visitor@example.test');
    await checkout.getByLabel('Name').fill('A Browser Visitor');
    await checkout.getByLabel('Country').fill('US');
    await checkout.getByLabel('Address').fill('1 Test Street');
    await checkout.getByLabel('City').fill('Test City');
    await checkout.getByLabel('Region').fill('TS');
    await checkout.getByLabel('Postal code').fill('00001');
    await checkout.getByRole('button', { name: 'Review total' }).click();
    await expect(checkout.getByRole('alert')).toContainText(/price changed|explicit price/i);
    await expect(checkout.getByText('Payment verified')).toHaveCount(0);
  } finally {
    await updateDisposableNativeProductPrice({ amountMinor: 2400, priceRevision: 1 });
  }
});

test('reuses the payment idempotency key after an uncertain payment response', async ({ page }) => {
  const paymentRequests: string[] = [];
  await page.route('**/api/store/browser-native-store/checkout/*/payment', async route => {
    paymentRequests.push(String(route.request().postDataJSON().idempotencyKey));
    await route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ code: 'unavailable', message: 'Payment is temporarily unavailable.' }) });
  });

  await openCheckout(page);
  const checkout = page.getByRole('dialog');
  await checkout.getByLabel('Email').fill('visitor@example.test');
  await checkout.getByLabel('Name').fill('A Browser Visitor');
  await checkout.getByLabel('Country').fill('US');
  await checkout.getByLabel('Address').fill('1 Test Street');
  await checkout.getByLabel('City').fill('Test City');
  await checkout.getByLabel('Region').fill('TS');
  await checkout.getByLabel('Postal code').fill('00001');
  await checkout.getByRole('button', { name: 'Review total' }).click();
  await expect(checkout).toContainText('Server total:', { timeout: 15000 });

  const paymentButton = checkout.getByRole('button', { name: 'Continue to secure payment' });
  await paymentButton.click();
  await expect(checkout.getByRole('alert')).toContainText('temporarily unavailable');
  await paymentButton.click();
  await expect.poll(() => paymentRequests.length).toBe(2);
  expect(paymentRequests[0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(paymentRequests[1]).toBe(paymentRequests[0]);
});
